import Anthropic from "@anthropic-ai/sdk";
import { executeTool, systemPrompt, tools } from "@/lib/ai-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IncomingMessage = {
  role: "user" | "assistant";
  content: string;
};

type Body = {
  messages: IncomingMessage[];
  currentPath?: string;
};

const MODEL = "claude-opus-4-7";
const MAX_TOKENS = 16000;
const MAX_TOOL_ITERATIONS = 8;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  const body = (await req.json()) as Body;
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const client = new Anthropic();

  // Convert incoming messages into the API shape. We assume each user/assistant turn is plain text.
  const messages: Anthropic.Messages.MessageParam[] = body.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

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
