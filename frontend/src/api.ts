import { Incident } from "./types";

const SESSION_ID = "demo-session";

export interface ChatResponse {
  reply: string;
  toolTrace: Array<{ name: string; input: any; result: any }>;
}

export async function sendMessage(message: string): Promise<ChatResponse> {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: SESSION_ID, message }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed with ${res.status}`);
  }
  return res.json();
}

export async function fetchIncidents(): Promise<Incident[]> {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/incidents`);
  if (!res.ok) throw new Error("Failed to load incidents");
  return res.json();
}
