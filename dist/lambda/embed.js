import postgres from "postgres";
import { embed } from "../agent/embeddings.js";
export const handler = async (event) => {
    const sql = postgres(process.env.DATABASE_URL, { ssl: "require" });
    try {
        for (const record of event.Records) {
            const { incidentId, text } = JSON.parse(record.body);
            const vector = await embed(text);
            const vectorLiteral = `[${vector.join(",")}]`;
            await sql `
        UPDATE incident_embeddings
        SET embedding = ${vectorLiteral}::VECTOR(1536)
        WHERE incident_id = ${incidentId}
      `;
            console.log(`Embedded incident ${incidentId}`);
        }
    }
    finally {
        await sql.end();
    }
};
