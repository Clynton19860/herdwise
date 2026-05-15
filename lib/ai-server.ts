import "server-only";
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-4-7";

/**
 * Generate a single short, structured answer from Claude with adaptive thinking
 * and a small prompt-cached system block. Used by server components that want
 * an inline AI summary at render time.
 *
 * Returns null on missing/invalid key so the UI can gracefully fall back to
 * static copy in local dev.
 */
export async function generateAiSummary({
  system,
  user,
  maxTokens = 800,
  effort = "low",
}: {
  system: string;
  user: string;
  maxTokens?: number;
  effort?: "low" | "medium" | "high" | "max";
}): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      thinking: { type: "adaptive" },
      output_config: { effort },
      system: [
        {
          type: "text",
          text: system,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: user }],
    });

    let out = "";
    for (const block of response.content) {
      if (block.type === "text") out += block.text;
    }
    return out.trim() || null;
  } catch (err) {
    console.error("[ai-server] generateAiSummary failed:", err);
    return null;
  }
}
