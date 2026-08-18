import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";
if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and paste your " +
        "CockroachDB Cloud connection string (from the Cloud Console -> Connect).");
}
// CockroachDB Cloud requires TLS; the sslmode=verify-full param in the
// connection string handles this, ssl: 'require' here is a fallback.
const client = postgres(process.env.DATABASE_URL, { ssl: "require" });
export const db = drizzle(client, { schema });
