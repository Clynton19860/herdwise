import Anthropic from "@anthropic-ai/sdk";
import { executeTool, systemPrompt, tools } from "@/lib/ai-tools";
import { callerKey, rateLimit } from "@/lib/rate-limit";
import { requireStaff, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * This endpoint spends money on every call and has no authentication, because
 * the product has none yet. Until it does, these caps are what stands between a
 * public URL and an unbounded bill:
 *
 *   - a per-caller rate limit
 *   - a body size ceiling, checked before parsing
 *   - a cap on replayed history, so a client cannot grow the prompt without end
 *   - a tool-iteration ceiling
 *
 * None of it is a substitute for auth. It is the difference between an accident
 * costing pennies and costing a month's budget.
 */
const LIMIT_PER_WINDOW = Number(process.env.CHAT_RATE_LIMIT ?? 10);
const WINDOW_SECONDS = Number(process.env.CHAT_RATE_WINDOW_SECONDS ?? 60);
const MAX_BODY_BYTES = 32 * 1024;
const MAX_MESSAGES = 30;
const MAX_MESSAGE_CHARS = 4_000;

type IncomingMessage = {
  role: "user" | "assistant";
  content: string;
};

type Body = {
  messages: IncomingMessage[];
  currentPath?: string;
};

const MODEL = "claude-opus-4-7";
const MAX_TOKENS = 4000;
const MAX_TOOL_ITERATIONS = 6;

const json = (payload: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return json({ error: "The assistant is not configured on this deployment." }, 503);
  }

  // This endpoint spends money on every call, so it is the last one that should
  // stay open now that there is a sign-in to check.
  if (!(await requireStaff(req))) return unauthorized();

  const limit = rateLimit(callerKey(req), {
    limit: LIMIT_PER_WINDOW,
    windowSeconds: WINDOW_SECONDS,
  });
  if (!limit.ok) {
    return json(
      { error: `Too many questions — try again in ${limit.retryAfterSeconds}s.` },
      429,
      { "retry-after": String(limit.retryAfterSeconds) },
    );
  }

  // Check the declared size before reading, so an oversized body is refused
  // rather than buffered.
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return json({ error: "Request too large." }, 413);
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: "Request too large." }, 413);

  let body: Body;
  try {
    body = JSON.parse(raw) as Body;
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return json({ error: "messages required" }, 400);
  }
  if (body.messages.length > MAX_MESSAGES) {
    return json({ error: "Conversation too long — start a new one." }, 400);
  }
  for (const m of body.messages) {
    if (m?.role !== "user" && m?.role !== "assistant") {
      return json({ error: "Invalid message role." }, 400);
    }
    if (typeof m.content !== "string" || m.content.length > MAX_MESSAGE_CHARS) {
      return json({ error: "Message too long." }, 400);
    }
  }

  const client = new Anthropic();

  // Convert incoming messages into the API shape. We assume each user/assistant turn is plain text.
  // An assistant turn that produced no text (the user pressed stop, or the
  // stream failed) would be sent as an empty content block, which the API
  // rejects — permanently breaking that conversation.
  const messages: Anthropic.Messages.MessageParam[] = body.messages
    .filter((m) => m.content.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.content }));

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return json({ error: "The last message must be from you." }, 400);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        // Manual tool-use loop — preserve assistant content across turns so Claude
        // sees its own tool_use blocks alongside our tool_result replies.
        const working: Anthropic.Messages.MessageParam[] = [...messages];

        for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
          const liveStream = client.messages.stream({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            thinking: { type: "adaptive" },
            output_config: { effort: "medium" },
            system: [
              {
                type: "text",
                text: systemPrompt(body.currentPath),
                cache_control: { type: "ephemeral" },
              },
            ],
            tools,
            messages: working,
          });

          // Stream text deltas + signal tool_use as they appear.
          // The full Message is collected via finalMessage() after the stream ends.
          let currentBlockType: string | null = null;

          for await (const event of liveStream) {
            if (event.type === "content_block_start") {
              currentBlockType = event.content_block.type;
              if (event.content_block.type === "tool_use") {
                send({
                  type: "tool_use_start",
                  name: event.content_block.name,
                  id: event.content_block.id,
                });
              } else if (event.content_block.type === "thinking") {
                send({ type: "thinking_start" });
              }
            } else if (event.type === "content_block_delta") {
              if (event.delta.type === "text_delta") {
                send({ type: "text", delta: event.delta.text });
              } else if (event.delta.type === "thinking_delta") {
                send({ type: "thinking", delta: event.delta.thinking });
              }
            } else if (event.type === "content_block_stop") {
              if (currentBlockType === "thinking") {
                send({ type: "thinking_stop" });
              }
              currentBlockType = null;
            }
          }

          const message = await liveStream.finalMessage();

          // If Claude is done, stop the loop.
          if (message.stop_reason === "end_turn" || message.stop_reason === "refusal") {
            break;
          }

          // Otherwise we expect tool_use blocks — append the assistant turn,
          // execute every tool call, append the results, and continue.
          working.push({ role: "assistant", content: message.content });

          const toolUses = message.content.filter(
            (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
          );

          if (toolUses.length === 0) {
            // No tool calls and not end_turn — bail to avoid infinite loop.
            break;
          }

          const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
          for (const tu of toolUses) {
            try {
              const result = await executeTool(tu.name, tu.input);
              const resultText = JSON.stringify(result);
              send({
                type: "tool_use_end",
                name: tu.name,
                id: tu.id,
                input: tu.input,
                ok: true,
                // Expose navigate suggestions to the client without re-parsing the assistant text.
                navigate:
                  tu.name === "navigate" && typeof tu.input === "object" && tu.input !== null
                    ? tu.input
                    : undefined,
              });
              toolResults.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content: resultText,
              });
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              send({ type: "tool_use_end", name: tu.name, id: tu.id, ok: false, error: msg });
              toolResults.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content: `Error: ${msg}`,
                is_error: true,
              });
            }
          }

          working.push({ role: "user", content: toolResults });

          if (iter === MAX_TOOL_ITERATIONS - 1) {
            send({ type: "text", delta: "\n\n_(Stopped after max tool iterations — please refine your question.)_" });
          }
        }

        send({ type: "done" });
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send({ type: "error", error: msg });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
