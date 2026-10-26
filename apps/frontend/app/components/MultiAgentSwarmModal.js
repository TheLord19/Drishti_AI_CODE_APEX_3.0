"use client";

import { useEffect, useRef } from "react";
import { X, Check, ArrowRight } from "lucide-react";

export default function MultiAgentSwarmModal({
  isOpen,
  onClose,
  runId,
  targetHostname,
  targetUrl,
  pipeline,
  currentAgentIndex,
  displayAgentIdx,
  setInspectedAgentIdx,
  isAllAgentsComplete,
  activeAgent,
  events = [],
  liveReplayStep,
}) {
  const telemetryEndRef = useRef(null);

  // Auto-scroll the log to the newest event
  useEffect(() => {
    if (telemetryEndRef.current) {
      telemetryEndRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [events.length]);

  // Esc closes the dialog
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const total = pipeline.length;
  const progressPercent = isAllAgentsComplete
    ? 100
    : Math.min(100, Math.round(((displayAgentIdx + 1) / total) * 100));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="swarm-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-6 overflow-y-auto"
    >
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-lg border border-line bg-white shadow-xl overflow-hidden my-auto text-fg">
        <div className="h-0.5 w-full bg-subtle" aria-hidden="true">
          <div className="h-full bg-accent transition-all duration-500" style={{ width: `${progressPercent}%` }} />
        </div>

        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id="swarm-modal-title" className="text-base font-semibold">
              {isAllAgentsComplete ? "Run complete" : "Running QA"}
            </h2>
            <p className="mt-0.5 text-xs text-muted truncate" title={targetUrl || targetHostname}>
              <span className="font-mono">{targetHostname}</span>
              {" · "}
              {isAllAgentsComplete ? `${total} of ${total} agents done` : `agent ${Math.min(displayAgentIdx + 1, total)} of ${total}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted hover:text-fg hover:bg-subtle"
            aria-label="Close"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto grid grid-cols-1 md:grid-cols-[200px_1fr]">
          {/* Vertical stage list */}
          <ol className="border-b md:border-b-0 md:border-r border-line p-3 space-y-0.5" aria-label="Agents">
            {pipeline.map((ag, idx) => {
              const isDone = (isAllAgentsComplete && liveReplayStep === null) || currentAgentIndex > idx;
              const isRunning = !isAllAgentsComplete && currentAgentIndex === idx;
              const isSelected = displayAgentIdx === idx;
              return (
                <li key={ag.key}>
                  <button
                    type="button"
                    onClick={() => setInspectedAgentIdx(idx)}
                    aria-current={isSelected ? "step" : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                      isSelected ? "bg-subtle text-fg font-medium" : "text-muted hover:text-fg"
                    }`}
                  >
                    {isDone ? (
                      <Check className="w-3.5 h-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                    ) : isRunning ? (
                      <span className="w-3.5 h-3.5 shrink-0 rounded-full border-2 border-fg border-t-transparent animate-spin" aria-hidden="true" />
                    ) : (
                      <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center" aria-hidden="true">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#D4D4D4]" />
                      </span>
                    )}
                    <span className="truncate">{ag.shortLabel || ag.tag.split(" ")[0]}</span>
                    <span className="sr-only">{isDone ? "(done)" : isRunning ? "(running)" : "(pending)"}</span>
                  </button>
                </li>
              );
            })}
          </ol>

          {/* Selected agent and log */}
          <div className="p-5 space-y-4 min-w-0">
            <div>
              <div className="text-[11px] text-muted">{activeAgent.tag}</div>
              <h3 className="mt-0.5 text-sm font-semibold">{activeAgent.name}</h3>
              <p className="text-xs text-muted">{activeAgent.role}</p>
            </div>

            <p className="text-xs text-[#525252] leading-relaxed">
              {activeAgent.actionSummary ? activeAgent.actionSummary(targetHostname) : activeAgent.description}
            </p>

            <div className="rounded-md border border-line bg-[#FAFAF9]">
              <div className="flex items-center justify-between border-b border-line px-3 py-1.5 text-[11px] text-muted">
                <span>Log · saved to disk</span>
                <span className="flex items-center gap-3">
                  <span className="font-mono">{events.length} events</span>
                  {runId && (
                    <a href={`/api/runs/${runId}/logs`} download className="text-fg hover:underline">
                      Download log
                    </a>
                  )}
                </span>
              </div>
              <div className="max-h-[220px] overflow-y-auto px-3 py-2 space-y-1 font-mono text-[11px]" aria-live="polite">
                {events.length > 0 ? (
                  events.slice(-8).map((ev, i) => (
                    <div key={ev.seq || i} className="flex items-start gap-2 leading-relaxed">
                      <span className="shrink-0 text-[#A3A3A3]">{ev.ts ? new Date(ev.ts).toLocaleTimeString() : "--:--:--"}</span>
                      <span className="shrink-0 text-muted">{ev.stage || "S1"}</span>
                      <span className="text-fg break-words">{ev.message}</span>
                    </div>
                  ))
                ) : (
                  <div className="py-3 text-center text-muted">Starting the browser sandbox...</div>
                )}
                <div ref={telemetryEndRef} />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-line px-5 py-3">
          {isAllAgentsComplete ? (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-md bg-fg text-white hover:bg-black text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            >
              View report
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          ) : (
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted">Running agents in isolated browser sandboxes...</span>
              <button type="button" onClick={onClose} className="text-fg hover:underline">
                Peek at report
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
