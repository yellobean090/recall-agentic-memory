import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
  type ContentBlock,
} from "@aws-sdk/client-bedrock-runtime";
import { executeTool, toBedrockToolConfig, ToolTraceEntry } from "./tools.js";
import { SimpleMessage } from "./types.js";

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? "us-east-1" });

// Override via BEDROCK_MODEL_ID if this ID isn't enabled in your region/account —
// check Bedrock Console > Model access to confirm what you have approved.
// Cross-region inference profile (the "us." prefix) is generally required for
// on-demand Claude throughput on Bedrock.
const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? "us.anthropic.claude-sonnet-4-6-v1:0";

const SYSTEM_PROMPT = `You are AgentOps, an incident-response assistant with persistent
memory of every past incident, stored in CockroachDB.

For every new incident:
1. ALWAYS call search_similar_incidents first with a concise description of the
   symptoms, before proposing a root cause. If a similar past incident exists,
   say so explicitly and reference what fixed it.
2. Investigate the current symptoms and reason about likely root cause.
3. Call log_action for each meaningful investigation step.
4. Once resolved (or the user provides the resolution), call record_incident
   to persist it — this is what makes the next incident faster.

Be concise and concrete. Cite specific past incidents by title when recalling them.`;

export async function runAgentTurn(history: SimpleMessage[]) {
  const messages: Message[] = history.map((m) => ({ role: m.role, content: [{ text: m.content }] }));
  const toolTrace: ToolTraceEntry[] = [];
  const toolConfig = toBedrockToolConfig();

  let response = await client.send(
    new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: SYSTEM_PROMPT }],
      messages,
      toolConfig: toolConfig as never,
    })
  );

  // Tool-use loop: Bedrock signals tool calls via stopReason "tool_use",
  // with the requested calls in the assistant message's content blocks.
  // This part keeps full native message fidelity — only the returned
  // cross-turn history gets flattened to plain text below.
  while (response.stopReason === "tool_use") {
    const assistantContent = response.output?.message?.content ?? [];
    messages.push({ role: "assistant", content: assistantContent });

    const toolResultBlocks: ContentBlock[] = [];
    for (const block of assistantContent) {
      if (!block.toolUse) continue;
      const { toolUseId, name, input } = block.toolUse;
      const result = await executeTool(name as ToolTraceEntry["name"], input);
      toolTrace.push({ name: name as ToolTraceEntry["name"], input, result });
      toolResultBlocks.push({
        toolResult: { toolUseId, content: [{ text: JSON.stringify(result) }] },
      });
    }

    messages.push({ role: "user", content: toolResultBlocks });

    response = await client.send(
      new ConverseCommand({
        modelId: MODEL_ID,
        system: [{ text: SYSTEM_PROMPT }],
        messages,
        toolConfig: toolConfig as never,
      })
    );
  }

  const finalContent = response.output?.message?.content ?? [];
  const text = finalContent.map((block) => block.text).filter(Boolean).join("\n");

  const conversation: SimpleMessage[] = [...history, { role: "assistant", content: text }];

  return { text, conversation, toolTrace };
}
