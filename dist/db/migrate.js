import "dotenv/config";
import postgres from "postgres";
/**
 * Hand-written migration instead of drizzle-kit generate, because
 * drizzle-kit doesn't know CockroachDB's VECTOR index syntax yet.
 * Run with: npm run db:migrate
 */
const DDL = `
CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  symptoms TEXT NOT NULL,
  root_cause TEXT,
  resolution TEXT,
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  source_project TEXT,
  raw_log_s3_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS incident_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  embedded_text TEXT NOT NULL,
  embedding VECTOR(1536),
  model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Distributed vector index for fast semantic recall as memory grows.
CREATE VECTOR INDEX IF NOT EXISTS incident_embeddings_vector_idx
  ON incident_embeddings (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS actions_taken (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  result TEXT,
  step_number INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
async function main() {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is not set. Copy .env.example to .env first.");
    }
    const sql = postgres(process.env.DATABASE_URL, { ssl: "require" });
    console.log("Running migration against CockroachDB...");
    await sql.unsafe(DDL);
    console.log("Done. Tables + vector index created.");
    await sql.end();
}
main().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
});
