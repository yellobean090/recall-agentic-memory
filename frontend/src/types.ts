export type Severity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "open" | "investigating" | "resolved";

export interface Incident {
  id: string;
  title: string;
  symptoms: string;
  severity: Severity;
  status: IncidentStatus;
  sourceProject?: string;
  createdAt: string;
}

export interface MemoryMatch {
  incidentId: string;
  title: string;
  rootCause: string;
  resolution: string;
  similarity: number; // 0-1
}

export interface LogLine {
  id: string;
  kind: "user" | "agent" | "tool" | "recall";
  text: string;
  timestamp: string;
}
