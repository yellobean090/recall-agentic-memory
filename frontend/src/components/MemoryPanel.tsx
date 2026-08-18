import { MemoryMatch } from "../types";

export function MemoryPanel({
  matches,
  memoryStats,
}: {
  matches: MemoryMatch[];
  memoryStats: { total: number; unresolved: number } | null;
}) {
  return (
    <div className="memory-panel">
      <div className="memory-header">
        <span className="eyebrow">Memory</span>
        {memoryStats && (
          <span className="memory-stats">
            {memoryStats.total} stored · {memoryStats.unresolved} open
          </span>
        )}
      </div>

      {matches.length === 0 ? (
        <div className="memory-empty">
          <div className="memory-empty-node" />
          <p>No recall yet. Once the agent searches memory, matches appear here.</p>
        </div>
      ) : (
        <div className="memory-matches">
          {matches.map((match, i) => (
            <div key={match.incidentId} className="memory-match" style={{ animationDelay: `${i * 120}ms` }}>
              <div className="memory-match-pulse-track">
                <span className="memory-match-pulse-dot" />
              </div>
              <div className="memory-match-card">
                <div className="memory-match-top">
                  <span className="memory-match-title">{match.title}</span>
                  <span className="memory-match-similarity">
                    {Math.round(match.similarity * 100)}%
                  </span>
                </div>
                <p className="memory-match-field">
                  <span>root cause</span>
                  {match.rootCause}
                </p>
                <p className="memory-match-field">
                  <span>resolution</span>
                  {match.resolution}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
