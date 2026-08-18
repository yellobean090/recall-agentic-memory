import { sql, desc } from "drizzle-orm";
import { db } from "../db/client.js";
import { incidents, incidentEmbeddings, actionsTaken } from "../db/schema.js";
import { embed } from "./embeddings.js";

/**
 * Anthropic tool-use definitions for the agent's memory operations.
 * These map 1:1 to the functions below and are passed as `tools` in
 * the Messages API call in src/agent/index.ts.
 */
export const toolDefinitions = [
  {
    name: "search_similar_incidents",
    description:
      "Semantically search past incidents by symptom/description similarity using CockroachDB's distributed vector index. Use this before proposing a root cause, to check if this incident has been seen before.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Description of the current symptoms" },
        limit: { type: "number", description: "Max results, default 3" },
      },
      required: ["query"],
    },
  },
  {
    name: "record_incident",
    description:
      "Write a new incident (or update an existing one) to persistent memory, including its embedding for future semantic recall.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        symptoms: { type: "string" },
        rootCause: { type: "string" },
        resolution: { type: "string" },
        severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
        sourceProject: { type: "string" },
      },
      required: ["title", "symptoms"],
    },
  },
  {
    name: "log_action",
    description: "Record a step the agent took while investigating an incident, for the timeline view.",
    input_schema: {
      type: "object",
      properties: {
        incidentId: { type: "string" },
        action: { type: "string" },
        result: { type: "string" },
        stepNumber: { type: "number" },
      },
      required: ["incidentId", "action", "stepNumber"],
    },
  },
  {
    name: "check_memory_health",
    description:
      "Inspect the agent's own CockroachDB memory store via the CockroachDB MCP server — total incidents stored, how many unresolved, and vector index status. Use when asked about memory health or before a long investigation to confirm memory is available.",
    input_schema: { type: "object", properties: {} },
  },
] as const;

export interface ToolTraceEntry {
  name: (typeof toolDefinitions)[number]["name"];
  input: any;
  result: any;
}

export async function executeTool(name: ToolTraceEntry["name"], input: any) {
  switch (name) {
    case "search_similar_incidents":
      return searchSimilarIncidents(input.query, input.limit);
    case "record_incident":
      return recordIncident(input);
    case "log_action":
      return logAction(input);
    case "check_memory_health":
      return checkMemoryHealth();
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/**
 * Bedrock's Converse API wants tools in its own toolConfig shape
 * (toolSpec.inputSchema.json) rather than Anthropic's tools[].input_schema.
 * Same tool set, different envelope — this keeps tools.ts as the single
 * source of truth regardless of which agent loop is active.
 */
export function toBedrockToolConfig() {
  return {
    tools: toolDefinitions.map((t) => ({
      toolSpec: {
        name: t.name,
        description: t.description,
        inputSchema: { json: t.input_schema },
      },
    })),
  };
}

/**
 * Groq (and any OpenAI-compatible API) wants tools as
 * [{ type: "function", function: { name, description, parameters } }].
 * Same tool set as Bedrock/Anthropic, different envelope.
 */
export function toOpenAIToolConfig() {
  return toolDefinitions.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));
}

export async function searchSimilarIncidents(query: string, limit = 3) {
  const queryEmbedding = await embed(query);
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;

  // Cosine distance search over the distributed vector index.
  const results = await db.execute(sql`
    SELECT i.id, i.title, i.symptoms, i.root_cause, i.resolution, i.severity,
           e.embedding <=> ${vectorLiteral}::VECTOR(1536) AS distance
    FROM incident_embeddings e
    JOIN incidents i ON i.id = e.incident_id
    ORDER BY distance ASC
    LIMIT ${limit}
  `);

  return results;
}

export async function recordIncident(input: {
  title: string;
  symptoms: string;
  rootCause?: string;
  resolution?: string;
  severity?: string;
  sourceProject?: string;
}) {
  const [incident] = await db
    .insert(incidents)
    .values({
      title: input.title,
      symptoms: input.symptoms,
      rootCause: input.rootCause,
      resolution: input.resolution,
      severity: input.severity ?? "medium",
      status: input.resolution ? "resolved" : "open",
      sourceProject: input.sourceProject,
      resolvedAt: input.resolution ? new Date() : undefined,
    })
    .returning();

  // Embed symptoms + root cause together so recall matches on the
  // technical shape of the problem, not just the surface description.
  const textToEmbed = [input.symptoms, input.rootCause].filter(Boolean).join("\n\n");
  const vector = await embed(textToEmbed);

  await db.insert(incidentEmbeddings).values({
    incidentId: incident.id,
    embeddedText: textToEmbed,
    embedding: vector,
  });

  return incident;
}

export async function logAction(input: {
  incidentId: string;
  action: string;
  result?: string;
  stepNumber: number;
}) {
  const [row] = await db.insert(actionsTaken).values(input).returning();
  return row;
}

/**
 * This calls out to the CockroachDB Cloud Managed MCP Server
 * (https://cockroachlabs.cloud/mcp) rather than querying directly,
 * so the agent is demonstrably using MCP for self-inspection, not
 * just using CockroachDB as a plain datastore.
 *
 * See src/agent/mcp-client.ts for the MCP connection.
 */
export async function checkMemoryHealth() {
  const { queryViaMcp } = await import("./mcp-client.js");
  return queryViaMcp(`
    SELECT
      (SELECT count(*) FROM incidents) AS total_incidents,
      (SELECT count(*) FROM incidents WHERE status != 'resolved') AS unresolved,
      (SELECT count(*) FROM incident_embeddings) AS embedded_memories
  `);
}
