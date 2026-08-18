/**
 * Provider-agnostic message shape used by server/index.ts and both
 * agent implementations (bedrock.ts, anthropic.ts). Each provider
 * builds its own native message format internally for the tool-calling
 * loop (full fidelity within a turn), but hands back plain text for
 * cross-turn history — which is what makes AGENT_PROVIDER actually
 * swappable without the two providers needing compatible wire formats.
 */
export interface SimpleMessage {
  role: "user" | "assistant";
  content: string;
}
