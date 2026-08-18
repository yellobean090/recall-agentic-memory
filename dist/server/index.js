import "dotenv/config";
import express from "express";
import cors from "cors";
import { desc } from "drizzle-orm";
import { runAgentTurn } from "../agent/index.js";
import { db } from "../db/client.js";
import { incidents } from "../db/schema.js";
const app = express();
// In prod, restrict to the deployed Vercel frontend (comma-separated list
// supported for preview + prod URLs). Falls back to allow-all in dev so
// `npm run dev` + the Vite proxy keeps working without extra setup.
const allowedOrigins = process.env.CORS_ORIGIN?.split(",").map((o) => o.trim());
app.use(cors({
    origin: allowedOrigins && allowedOrigins.length > 0 ? allowedOrigins : true,
}));
app.use(express.json({ limit: "2mb" })); // raw incident logs can be chunky
// In-memory session store for the demo. Swap for a proper session table
// (or just store the conversation in CockroachDB too) if this grows.
const sessions = new Map();
app.post("/api/chat", async (req, res) => {
    try {
        const { sessionId = "default", message } = req.body;
        if (!message)
            return res.status(400).json({ error: "message is required" });
        const history = sessions.get(sessionId) ?? [];
        history.push({ role: "user", content: message });
        const { text, conversation, toolTrace } = await runAgentTurn(history);
        sessions.set(sessionId, conversation);
        res.json({ reply: text, toolTrace });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message ?? "internal error" });
    }
});
app.get("/api/incidents", async (_req, res) => {
    try {
        const rows = await db.select().from(incidents).orderBy(desc(incidents.createdAt)).limit(50);
        res.json(rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message ?? "internal error" });
    }
});
app.get("/api/health", (_req, res) => res.json({ ok: true }));
const port = process.env.PORT ?? 3001;
app.listen(port, () => console.log(`AgentOps Memory server listening on :${port}`));
