const { query, closeDatabase } = require("./db");

async function main() {
  console.log("\n========================================");
  console.log("        RECALL MEMORY INITIALIZER");
  console.log("========================================\n");

  const incidentNumber = "INC-1847";

  console.log(`Checking for ${incidentNumber}...`);

  // Find the incident if it already exists.
  let incidentResult = await query(
    `
    SELECT *
    FROM incidents
    WHERE incident_number = $1
    `,
    [incidentNumber]
  );

  let incident;

  if (incidentResult.rows.length > 0) {
  incident = incidentResult.rows[0];

  console.log(`✓ Incident already exists: ${incident.incident_number}`);

  await query(
    `
    UPDATE incidents
    SET
      root_cause = $1,
      remediation = $2,
      status = 'resolved',
      confidence = $3,
      resolved_at = COALESCE(resolved_at, now())
    WHERE id = $4
    `,
    [
      "Database connection pool exhaustion",
      "Increase the connection pool and recycle stale connections.",
      0.98,
      incident.id,
    ]
  );

  console.log("✓ Historical diagnosis repaired.");
} else {
    console.log("Creating historical incident...");

    incidentResult = await query(
      `
      INSERT INTO incidents (
        incident_number,
        service,
        severity,
        title,
        description,
        symptoms,
        root_cause,
        remediation,
        status,
        confidence,
        resolved_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        now()
      )
      RETURNING *
      `,
      [
        incidentNumber,
        "checkout",
        "critical",
        "Checkout API latency spike",
        "Checkout requests experienced severe latency and intermittent timeouts.",
        JSON.stringify({
          latency_p99: "2.84s",
          error_rate: "18.4%",
          database_connections: "97%",
        }),
        "Database connection pool exhaustion",
        "Increase the connection pool and recycle stale connections.",
        "resolved",
        0.98,
      ]
    );

    incident = incidentResult.rows[0];

    console.log(`✓ Incident created: ${incident.incident_number}`);
  }

  // Check whether this memory already exists.
  const memoryResult = await query(
    `
    SELECT id
    FROM agent_memories
    WHERE incident_id = $1
      AND memory_type = 'incident'
    LIMIT 1
    `,
    [incident.id]
  );

  if (memoryResult.rows.length > 0) {
    console.log("✓ Memory already exists for this incident.");
  } else {
    console.log("Creating persistent agent memory...");

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
      RETURNING id
      `,
      [
        "incident",
        incident.id,
        "Checkout API latency was caused by database connection pool exhaustion. Increasing the connection pool and recycling stale connections restored service. Recovery completed in 41 seconds.",
        JSON.stringify({
          service: "checkout",
          root_cause: "database connection pool exhaustion",
          remediation:
            "increase connection pool and recycle stale connections",
          recovery_seconds: 41,
        }),
        0.95,
      ]
    );

    console.log(`✓ Memory created: ${result.rows[0].id}`);
  }

  console.log("\n========================================");
  console.log("       MEMORY READY");
  console.log("========================================\n");

  console.log("Historical incident:");
  console.log("  INC-1847");
  console.log("  Checkout API latency spike");
  console.log("");
  console.log("Remembered lesson:");
  console.log(
    "  Database connection pool exhaustion caused the incident."
  );
  console.log("");
  console.log("RECALL can now use this experience.");
  console.log("");

  await closeDatabase();
}

main().catch(async (error) => {
  console.error("\nFailed:");
  console.error(error.message);

  await closeDatabase();

  process.exit(1);
});