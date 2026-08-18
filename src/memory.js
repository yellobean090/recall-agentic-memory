const { query } = require("./db");

async function createIncident({
  incidentNumber,
  service,
  severity,
  title,
  description,
  symptoms,
}) {
  const result = await query(
    `
    INSERT INTO incidents (
      incident_number,
      service,
      severity,
      title,
      description,
      symptoms
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
    `,
    [
      incidentNumber,
      service,
      severity,
      title,
      description,
      JSON.stringify(symptoms),
    ]
  );

  return result.rows[0];
}


async function createMemory({
  memoryType,
  incidentId,
  content,
  metadata = {},
  importance = 0.5,
}) {
  const result = await query(
    `
    INSERT INTO agent_memories (
      memory_type,
      incident_id,
      content,
      metadata,
      importance
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
    `,
    [
      memoryType,
      incidentId,
      content,
      JSON.stringify(metadata),
      importance,
    ]
  );

  return result.rows[0];
}


async function getRecentMemories(limit = 10) {
  const result = await query(
    `
    SELECT
      id,
      memory_type,
      content,
      metadata,
      importance,
      created_at
    FROM agent_memories
    ORDER BY created_at DESC
    LIMIT $1
    `,
    [limit]
  );

  return result.rows;
}


module.exports = {
  createIncident,
  createMemory,
  getRecentMemories,
};