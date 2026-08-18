/**
 * Thin client for the CockroachDB Cloud Managed MCP Server
 * (https://cockroachlabs.cloud/mcp).
 *
 * Used specifically for the agent's self-inspection tool
 * (check_memory_health) — the point is to show the agent reasoning
 * about its OWN memory store through the managed MCP server (read-only
 * by default, fully audit-logged), not just hitting Postgres directly
 * for every query.
 *
 * Setup:
 *   1. CockroachDB Cloud Console -> your cluster -> "Connect" -> MCP
 *      integration option -> copy the generated config snippet.
 *   2. Auth is via a service account API key (Cloud RBAC-scoped to this
 *      cluster) for autonomous/backend use — OAuth is for interactive
 *      clients like Claude Code, not what we want here since this is
 *      the agent calling MCP itself at runtime.
 *   3. Set COCKROACH_MCP_URL and COCKROACH_MCP_TOKEN in .env.
 *   4. Grant READ-ONLY consent only — this app never needs write
 *      access through MCP (writes go through Drizzle/postgres directly
 *      in tools.ts). Read-only exposes list_databases, select_query,
 *      get_table_schema — which is all check_memory_health needs.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

let clientPromise: Promise<Client> | null = null;

async function getClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = (async () => {
      if (!process.env.COCKROACH_MCP_URL) {
        throw new Error("COCKROACH_MCP_URL is not set — get this from CockroachDB Cloud Console > Connect > MCP");
      }
      const transport = new StreamableHTTPClientTransport(new URL(process.env.COCKROACH_MCP_URL), {
        requestInit: {
          headers: process.env.COCKROACH_MCP_TOKEN
            ? { Authorization: `Bearer ${process.env.COCKROACH_MCP_TOKEN}` }
            : {},
        },
      });
      const client = new Client({ name: "agentops-memory", version: "0.1.0" }, { capabilities: {} });
      await client.connect(transport);
      return client;
    })();
  }
  return clientPromise;
}

export async function queryViaMcp(sqlText: string) {
  const client = await getClient();
  // "select_query" is one of the managed MCP server's read-only tools
  // (alongside list_databases, get_table_schema). Run `tools/list` on
  // first connect to confirm the exact set exposed for your cluster
  // tier if this changes.
  const result = await client.callTool({
    name: "select_query",
    arguments: { sql: sqlText },
  });
  return result;
}
