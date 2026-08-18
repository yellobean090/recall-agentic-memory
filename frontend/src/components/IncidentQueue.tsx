import { Incident } from "../types";

const SEVERITY_COLOR: Record<Incident["severity"], string> = {
  low: "var(--text-tertiary)",
  medium: "var(--status-medium)",
  high: "var(--status-high)",
  critical: "var(--status-critical)",
};

export function IncidentQueue({
  incidents,
  activeId,
  onSelect,
}: {
  incidents: Incident[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="queue">
      <div className="queue-header">
        <span className="eyebrow">Incidents</span>
        <span className="queue-count">{incidents.length}</span>
      </div>
      <div className="queue-list">
        {incidents.map((incident) => (
          <button
            key={incident.id}
            className={`queue-item ${activeId === incident.id ? "queue-item--active" : ""}`}
            onClick={() => onSelect(incident.id)}
          >
            <span className="queue-dot" style={{ background: SEVERITY_COLOR[incident.severity] }} />
            <span className="queue-item-body">
              <span className="queue-item-title">{incident.title}</span>
              <span className="queue-item-meta">
                {incident.sourceProject ?? "—"} · {incident.status}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
