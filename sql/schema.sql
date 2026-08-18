-- ============================================================
-- RECALL — Persistent Agentic Memory
-- CockroachDB schema
-- ============================================================

CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    incident_number STRING NOT NULL UNIQUE,

    service STRING NOT NULL,

    severity STRING NOT NULL,

    title STRING NOT NULL,

    description STRING NOT NULL,

    symptoms JSONB NOT NULL DEFAULT '{}',

    root_cause STRING,

    remediation STRING,

    status STRING NOT NULL DEFAULT 'open',

    confidence DECIMAL(5,4),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    resolved_at TIMESTAMPTZ
);


CREATE TABLE IF NOT EXISTS agent_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    incident_id UUID NOT NULL
        REFERENCES incidents(id)
        ON DELETE CASCADE,

    action_type STRING NOT NULL,

    action_description STRING NOT NULL,

    reasoning STRING,

    status STRING NOT NULL DEFAULT 'proposed',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    completed_at TIMESTAMPTZ
);


CREATE TABLE IF NOT EXISTS incident_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    incident_id UUID NOT NULL
        REFERENCES incidents(id)
        ON DELETE CASCADE,

    outcome STRING NOT NULL,

    metrics_before JSONB NOT NULL DEFAULT '{}',

    metrics_after JSONB NOT NULL DEFAULT '{}',

    success BOOL NOT NULL DEFAULT false,

    lessons_learned STRING,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE TABLE IF NOT EXISTS agent_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    memory_type STRING NOT NULL,

    incident_id UUID
        REFERENCES incidents(id)
        ON DELETE SET NULL,

    content STRING NOT NULL,

    metadata JSONB NOT NULL DEFAULT '{}',

    embedding VECTOR(1536),

    importance DECIMAL(5,4) DEFAULT 0.5,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    last_retrieved_at TIMESTAMPTZ
);


CREATE INDEX IF NOT EXISTS incidents_service_idx
    ON incidents (service);


CREATE INDEX IF NOT EXISTS incidents_created_idx
    ON incidents (created_at DESC);


CREATE INDEX IF NOT EXISTS agent_actions_incident_idx
    ON agent_actions (incident_id);


CREATE INDEX IF NOT EXISTS memories_incident_idx
    ON agent_memories (incident_id);


-- CockroachDB vector index for semantic memory retrieval.
-- CREATE INDEX IF NOT EXISTS agent_memories_embedding_idx
--     ON agent_memories USING VECTOR (embedding vector_l2_ops);