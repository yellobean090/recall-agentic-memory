import { useEffect, useState } from "react";
import { IncidentQueue } from "./components/IncidentQueue";
import { Console } from "./components/Console";
import { MemoryPanel } from "./components/MemoryPanel";
import { fetchIncidents, sendMessage } from "./api";
import { Incident, LogLine, MemoryMatch } from "./types";
import "./App.css";

let lineId = 0;
const nextId = () => `line-${lineId++}`;

export default function App() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [matches, setMatches] = useState<MemoryMatch[]>([]);
  const [memoryStats, setMemoryStats] = useState<{ total: number; unresolved: number } | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchIncidents()
      .then(setIncidents)
      .catch(() => setError("Couldn't load incidents — is the API running on :3001?"));
  }, []);

  async function handleSubmit(text: string) {
    setError(null);
    setLines((prev) => [...prev, { id: nextId(), kind: "user", text, timestamp: nowLabel() }]);
    setMatches([]);
    setIsThinking(true);

    try {
      const { reply, toolTrace } = await sendMessage(text);

      for (const call of toolTrace) {
        if (call.name === "search_similar_incidents") {
          const results = Array.isArray(call.result) ? call.result : [];
          const mapped: MemoryMatch[] = results.map((r: any) => ({
            incidentId: r.id,
            title: r.title,
            rootCause: r.root_cause ?? "—",
            resolution: r.resolution ?? "—",
            similarity: Math.max(0, Math.min(1, 1 - Number(r.distance))),
          }));
          setMatches(mapped);
          setLines((prev) => [
            ...prev,
            {
              id: nextId(),
              kind: "recall",
              text:
                mapped.length > 0
                  ? `Searched memory — ${mapped.length} similar incident${mapped.length > 1 ? "s" : ""} found`
                  : "Searched memory — no similar incidents found",
              timestamp: nowLabel(),
            },
          ]);
        } else if (call.name === "check_memory_health") {
          const raw = call.result;
          const row = extractHealthRow(raw);
          if (row) {
            setMemoryStats({ total: Number(row.total_incidents), unresolved: Number(row.unresolved) });
          }
        } else if (call.name === "record_incident") {
          setLines((prev) => [
            ...prev,
            { id: nextId(), kind: "tool", text: `Recorded incident to memory: "${call.input.title}"`, timestamp: nowLabel() },
          ]);
          fetchIncidents().then(setIncidents).catch(() => {});
        } else if (call.name === "log_action") {
          setLines((prev) => [
            ...prev,
            { id: nextId(), kind: "tool", text: call.input.action, timestamp: nowLabel() },
          ]);
        }
      }

      setLines((prev) => [...prev, { id: nextId(), kind: "agent", text: reply, timestamp: nowLabel() }]);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong talking to the agent.");
    } finally {
      setIsThinking(false);
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-mark">AgentOps</span>
        <span className="app-mark-sub">Memory</span>
      </header>
      <div className="app-body">
        <IncidentQueue incidents={incidents} activeId={activeId} onSelect={setActiveId} />
        <div className="app-center">
          {error && <div className="banner-error">{error}</div>}
          <Console lines={lines} onSubmit={handleSubmit} isThinking={isThinking} />
        </div>
        <MemoryPanel matches={matches} memoryStats={memoryStats} />
      </div>
    </div>
  );
}

function nowLabel() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function extractHealthRow(raw: any): any {
  // MCP tool results come back as a content array; unwrap defensively
  // since the exact shape depends on what the managed MCP server returns.
  if (Array.isArray(raw)) return raw[0];
  if (raw?.content?.[0]?.text) {
    try {
      const parsed = JSON.parse(raw.content[0].text);
      return Array.isArray(parsed) ? parsed[0] : parsed;
    } catch {
      return null;
    }
  }
  return raw;
}
