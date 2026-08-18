# AgentOps Memory

An autonomous incident-response agent that remembers every production incident it has ever seen — and gets faster at diagnosis because of it.

Built for the **CockroachDB × AWS Hackathon**.

## The problem

Most on-call tooling treats every incident like the first one. The same root cause gets re-diagnosed from scratch every time a similar failure recurs, because nothing persists across sessions. AgentOps Memory gives an incident-response agent a durable, semantically-searchable memory: before it proposes a root cause, it checks whether it has seen this failure pattern before — and if so, it says so and points at what fixed it last time.

## How it works

1. An incident comes in (symptoms, logs).
2. The agent calls `search_similar_incidents`, which does a cosine-distance search over past incident embeddings using **CockroachDB's distributed vector index** — before it does anything else.
3. It investigates, logging each step to the timeline.
4. Once resolved, it calls `record_incident`, which persists the incident and its embedding back to CockroachDB — so the *next* incident benefits.
5. It can also inspect the health of its own memory store (total incidents, unresolved count, index status) live, through the **CockroachDB Managed MCP Server** — the agent reasoning about its own database, not just using it as a dumb store.

Agent reasoning runs on **Groq** by default (`src/agent/groq.ts`) — CockroachDB memory retrieval feeding into Groq's fast tool-calling for diagnosis. Amazon Bedrock and direct Anthropic API are also wired up as swappable providers (`AGENT_PROVIDER=bedrock|anthropic|groq` in `.env`) — same tool set, same memory layer, different model backing the reasoning.

## CockroachDB tools used

| Tool | How |
|---|---|
| **Distributed Vector Indexing** | `incident_embeddings.embedding VECTOR(1536)` with a `CREATE VECTOR INDEX ... USING vector (embedding vector_cosine_ops)`. This is the core of the memory system — see `search_similar_incidents` in `src/agent/tools.ts`. |
| **Cloud Managed MCP Server** | `check_memory_health` tool (`src/agent/mcp-client.ts`) connects to `https://cockroachlabs.cloud/mcp` and queries the agent's own memory store through it, read-only. |

## AWS services used

| Service | How |
|---|---|
| **AWS Lambda** | `src/lambda/embed.ts` — async embedding generation, triggered via SQS on every new incident write, so memory writes don't block the agent's response. |
| **Amazon Bedrock** | Titan Text Embeddings (`amazon.titan-embed-text-v2:0`), called from the Lambda — `src/agent/embeddings.ts`. |
| **Amazon S3** | Raw incident log dumps are stored in S3 and referenced by `incidents.raw_log_s3_key`, keeping large log blobs out of the row store. |

## Stack

React/Vite frontend (dark ops-console UI with a live memory-recall panel) · Express + TypeScript backend · Drizzle ORM · CockroachDB Cloud · Claude (Anthropic API) for agent reasoning and tool-calling.

## Setup

```bash
npm install
cp .env.example .env
# Fill in DATABASE_URL and COCKROACH_MCP_URL from CockroachDB Cloud Console -> Connect
# Fill in ANTHROPIC_API_KEY

npm run db:migrate   # creates tables + vector index
npm run dev           # starts the API on :3001
```

In a second terminal, run the frontend:

```bash
cd frontend
npm install
npm run dev            # starts the UI on :5173, proxies /api to :3001
```

Deploying the embedding Lambda:

```bash
cd infra
sam build
sam deploy --guided
```

## Deploying

**Backend (Render)**
- `render.yaml` is a ready-to-use Blueprint (New -> Blueprint on Render, point it at this repo).
- Root directory: repo root. Build: `npm install && npm run build`. Start: `npm start`.
- Fill in the secret env vars in the Render dashboard (see `.env.example`) — `sync: false` vars in `render.yaml` aren't set automatically.
- Health check: `/api/health`.
- Once deployed, set `CORS_ORIGIN` on the Render service to your Vercel URL(s), comma-separated.

**Frontend (Vercel)**
- New Project -> import this repo -> set **Root Directory** to `frontend`. Vercel auto-detects Vite via `frontend/vercel.json`.
- Set `VITE_API_URL` in the Vercel project's Environment Variables to your Render service URL (this overrides `frontend/.env.production`, which just holds a placeholder).
- Redeploy after changing `VITE_API_URL` — Vite bakes it in at build time.

## Demo data

Seed incidents are real bugs pulled from the author's own past projects (see `seed/`), not synthetic data — so semantic recall in the demo is genuine, not staged.

## License

MIT — see [LICENSE](./LICENSE).
