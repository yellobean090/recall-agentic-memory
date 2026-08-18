const { query, closeDatabase } = require("./db");

async function findRelevantMemories(service, searchTerm) {
  const result = await query(
    `
    SELECT
      m.id,
      m.memory_type,
      m.content,
      m.metadata,
      m.importance,
      m.created_at,
      i.incident_number,
      i.service,
      i.severity,
      i.title,
      i.root_cause,
      i.remediation
    FROM agent_memories m
    LEFT JOIN incidents i
      ON i.id = m.incident_id
    WHERE
      i.service = $1
      AND (
        m.content ILIKE '%' || $2 || '%'
        OR i.title ILIKE '%' || $2 || '%'
        OR i.description ILIKE '%' || $2 || '%'
        OR i.root_cause ILIKE '%' || $2 || '%'
        OR i.remediation ILIKE '%' || $2 || '%'
      )
    ORDER BY
      m.importance DESC,
      m.created_at DESC
    LIMIT 5
    `,
    [service, searchTerm]
  );

  return result.rows;
}

async function main() {
  console.log("\n========================================");
  console.log("          RECALL MEMORY SEARCH");
  console.log("========================================\n");

  const service = "checkout";
  const searchTerm = "database connection";

  console.log(`Service: ${service}`);
  console.log(`Searching memory for: "${searchTerm}"\n`);

  const memories = await findRelevantMemories(
    service,
    searchTerm
  );

  if (memories.length === 0) {
    console.log("No relevant memories found.");
  } else {
    console.log(`Found ${memories.length} relevant memory:\n`);

    for (const memory of memories) {
      console.log("----------------------------------------");
      console.log(`Incident: ${memory.incident_number}`);
      console.log(`Title: ${memory.title}`);
      console.log(`Severity: ${memory.severity}`);
      console.log(`Importance: ${memory.importance}`);
      console.log("");
      console.log("Root cause:");
      console.log(memory.root_cause);
      console.log("");
      console.log("Remediation:");
      console.log(memory.remediation);
      console.log("");
      console.log("Agent memory:");
      console.log(memory.content);
      console.log("----------------------------------------\n");
    }
  }

  await closeDatabase();
}

main().catch(async (error) => {
  console.error("\nMemory search failed:");
  console.error(error.message);

  await closeDatabase();

  process.exit(1);
});