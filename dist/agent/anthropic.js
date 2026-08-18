import Anthropic from "@anthropic-ai/sdk";
import { toolDefinitions, executeTool } from "./tools.js";
const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from env
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
export async function runAgentTurn(history) {
    let response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools: toolDefinitions,
        messages: history,
    });
    const internalConversation = [...history];
    const toolTrace = [];
    while (response.stop_reason === "tool_use") {
        const toolUseBlocks = response.content.filter((block) => block.type === "tool_use");
        internalConversation.push({ role: "assistant", content: response.content });
        const toolResults = [];
        for (const block of toolUseBlocks) {
            const result = await executeTool(block.name, block.input);
            toolTrace.push({ name: block.name, input: block.input, result });
            toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
        }
        internalConversation.push({ role: "user", content: toolResults });
        response = await anthropic.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 2048,
            system: SYSTEM_PROMPT,
            tools: toolDefinitions,
            messages: internalConversation,
        });
    }
    const finalText = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n");
    const conversation = [...history, { role: "assistant", content: finalText }];
    return { text: finalText, conversation, toolTrace };
}
