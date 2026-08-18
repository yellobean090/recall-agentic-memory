export async function runAgentTurn(history) {
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
