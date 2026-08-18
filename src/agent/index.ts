/**
 * Provider switch, same pattern as embeddings.ts: AGENT_PROVIDER picks
 * which API answers the agent's reasoning + tool-calling loop.
 *   - "groq" (default): CockroachDB memory retrieval -> Groq diagnosis.
 *     Fast, OpenAI-compatible tool calling, no Anthropic/Bedrock billing.
 *   - "bedrock": Amazon Bedrock Converse API.
 *   - "anthropic": direct Claude API.
 */
import { SimpleMessage } from "./types.js";

export async function runAgentTurn(history: SimpleMessage[]) {
  const provider = process.env.AGENT_PROVIDER ?? "groq";

  if (provider === "anthropic") {
    const { runAgentTurn: run } = await import("./anthropic.js");
    return run(history);
  }
  if (provider === "bedrock") {
    const { runAgentTurn: run } = await import("./bedrock.js");
    return run(history);
  }
  const { runAgentTurn: run } = await import("./groq.js");
  return run(history);
}
