/**
 * AWS Lambda handler: generates and stores an embedding for a newly
 * recorded incident, asynchronously.
 *
 * Trigger options (pick one for the demo — SQS is the cleanest story
 * for "agent memory writes happen async / at scale"):
 *   - SQS queue, with the API pushing a message on every new incident
 *   - Direct invoke from the API as a fire-and-forget call
 *
 * Deploy with the AWS SAM CLI or Serverless Framework — see
 * infra/template.yaml (SAM) for the function + queue definition.
 */
import type { SQSEvent, SQSHandler } from "aws-lambda";
import postgres from "postgres";
import { embed } from "../agent/embeddings.js";

export const handler: SQSHandler = async (event: SQSEvent) => {
  const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });

  try {
    for (const record of event.Records) {
      const { incidentId, text } = JSON.parse(record.body) as {
        incidentId: string;
        text: string;
      };

      const vector = await embed(text);
      const vectorLiteral = `[${vector.join(",")}]`;

      await sql`
        UPDATE incident_embeddings
        SET embedding = ${vectorLiteral}::VECTOR(1536)
        WHERE incident_id = ${incidentId}
      `;

      console.log(`Embedded incident ${incidentId}`);
    }
  } finally {
    await sql.end();
  }
};
