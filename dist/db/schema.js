import { pgTable, uuid, text, timestamp, integer, customType } from "drizzle-orm/pg-core";
/**
 * CockroachDB's native VECTOR type (distributed vector indexing) isn't
 * one of Drizzle's built-in pg-core column types, so we define it as a
 * custom type. This keeps us on CockroachDB's own vector support rather
 * than assuming the pgvector extension — CockroachDB implements VECTOR
 * natively with distributed indexing across ranges.
 *
 * Migration DDL (see src/db/migrate.ts) creates the column + index as:
 *   embedding VECTOR(1536)
 *   CREATE INDEX ... USING vector (embedding vector_cosine_ops)
 */
const vector = customType({
    dataType(config) {
        return `VECTOR(${config?.dimensions ?? 1536})`;
    },
    toDriver(value) {
        return `[${value.join(",")}]`;
    },
    fromDriver(value) {
        return value.slice(1, -1).split(",").map(Number);
    },
});
export const incidents = pgTable("incidents", {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    symptoms: text("symptoms").notNull(),
    rootCause: text("root_cause"),
    resolution: text("resolution"),
    severity: text("severity").notNull().default("medium"), // low | medium | high | critical
    status: text("status").notNull().default("open"), // open | investigating | resolved
    sourceProject: text("source_project"), // e.g. "nillohit", "reddit-link-checker"
    rawLogS3Key: text("raw_log_s3_key"), // pointer to raw log dump in S3
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});
export const incidentEmbeddings = pgTable("incident_embeddings", {
    id: uuid("id").defaultRandom().primaryKey(),
    incidentId: uuid("incident_id")
        .notNull()
        .references(() => incidents.id, { onDelete: "cascade" }),
    embeddedText: text("embedded_text").notNull(), // the text that was embedded (symptoms + root cause)
    embedding: vector("embedding", { dimensions: 1536 }),
    model: text("model").notNull().default("text-embedding-3-small"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const actionsTaken = pgTable("actions_taken", {
    id: uuid("id").defaultRandom().primaryKey(),
    incidentId: uuid("incident_id")
        .notNull()
        .references(() => incidents.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    result: text("result"),
    stepNumber: integer("step_number").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
