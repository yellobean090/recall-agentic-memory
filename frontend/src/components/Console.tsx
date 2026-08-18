import { FormEvent, useState } from "react";
import { LogLine } from "../types";

export function Console({
  lines,
  onSubmit,
  isThinking,
}: {
  lines: LogLine[];
  onSubmit: (text: string) => void;
  isThinking: boolean;
}) {
  const [draft, setDraft] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    onSubmit(draft);
    setDraft("");
  }

  return (
    <div className="console">
      <div className="console-log">
        {lines.length === 0 && (
          <div className="console-empty">
            <p>Paste symptoms, an error log, or an alert to start an investigation.</p>
          </div>
        )}
        {lines.map((line) => (
          <div key={line.id} className={`log-line log-line--${line.kind}`}>
            <span className="log-line-kind">{kindLabel(line.kind)}</span>
            <span className="log-line-text">{line.text}</span>
          </div>
        ))}
        {isThinking && (
          <div className="log-line log-line--agent">
            <span className="log-line-kind">agent</span>
            <span className="log-line-text log-line-text--pulse">investigating…</span>
          </div>
        )}
      </div>
      <form className="console-input" onSubmit={handleSubmit}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Describe the incident…"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        <button type="submit" disabled={isThinking || !draft.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

function kindLabel(kind: LogLine["kind"]) {
  switch (kind) {
    case "user":
      return "you";
    case "agent":
      return "agent";
    case "tool":
      return "tool";
    case "recall":
      return "recall";
  }
}
