import Groq from "groq-sdk";
import { executeTool, toOpenAIToolConfig, ToolTraceEntry } from "./tools.js";
import { SimpleMessage } from "./types.js";

const groq = new Groq(); // reads GROQ_API_KEY from env

// llama-3.3-70b-versatile is a solid default for tool-use quality/speed.
// openai/gpt-oss-120b is the other strong tool-calling option on Groq if
// you want to try it — override with GROQ_MODEL.
const MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

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

const tools = toOpenAIToolConfig();

export async function runAgentTurn(history: SimpleMessage[]) {
  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content }) as Groq.Chat.ChatCompletionMessageParam),
  ];
  const toolTrace: ToolTraceEntry[] = [];

  let completion = await groq.chat.completions.create({
    model: MODEL,
    messages,
    tools,
    tool_choice: "auto",
  });
  let message = completion.choices[0].message;

  // CockroachDB memory retrieval -> Groq diagnosis loop: keep executing
  // whatever tools Groq asks for (search_similar_incidents is the one
  // that matters here) and feeding results back until it settles on a
  // final diagnosis with no more tool calls.
  while (message.tool_calls && message.tool_calls.length > 0) {
    messages.push(message);

    for (const call of message.tool_calls) {
      const input = JSON.parse(call.function.arguments || "{}");
      const result = await executeTool(call.function.name as ToolTraceEntry["name"], input);
      toolTrace.push({ name: call.function.name as ToolTraceEntry["name"], input, result });
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }

    completion = await groq.chat.completions.create({ model: MODEL, messages, tools, tool_choice: "auto" });
    message = completion.choices[0].message;
  }

  const text = message.content ?? "";
  const conversation: SimpleMessage[] = [...history, { role: "assistant", content: text }];

  return { text, conversation, toolTrace };
}
