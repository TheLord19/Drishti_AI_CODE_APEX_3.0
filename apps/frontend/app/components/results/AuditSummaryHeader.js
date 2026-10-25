"use client";

import { RotateCcw, Download, ExternalLink } from "lucide-react";

function StatCard({ label, value, note, accent = false }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 font-mono text-3xl font-medium tabular-nums tracking-tight ${accent ? "text-accent" : "text-fg"}`}>
        {value}
      </div>
      {note && <div className="mt-0.5 text-[11px] text-muted">{note}</div>}
    </div>
  );
}

export default function AuditSummaryHeader({
  isBlocker,
  isWarning,
  isClean,
  blockerDefectsCount,
  warningObservationsCount,
  confirmedDefectsCount,
  runId,
  targetHostname,
  targetUrl,
  telemetry,
  qualityScorePercent,
  passingJourneysCount,
  dynamicJourneysLength,
  routesCount,
  locatorsCount,
  onOpenWorkflow,
  onRetestAll,
  retestingAll,
  onDownloadPytest,
}) {
  // Status is always a dot plus a word, never colour alone.
  const status = isBlocker
    ? {
        dot: "bg-red-500",
        text: "text-red-700",
        label: `Release blocked · ${blockerDefectsCount} blocker${blockerDefectsCount === 1 ? "" : "s"}`,
      }
    : isWarning
    ? {
        dot: "bg-amber-500",
        text: "text-amber-700",
        label: `Needs review · ${warningObservationsCount} warning${warningObservationsCount === 1 ? "" : "s"}`,
      }
    : { dot: "bg-emerald-500", text: "text-emerald-700", label: "Ready to ship" };

  const isHttps = typeof targetUrl === "string" && targetUrl.startsWith("https://");

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className={`inline-flex items-center gap-1.5 font-medium ${status.text}`}>
              <span className={`w-2 h-2 rounded-full ${status.dot}`} aria-hidden="true" />
              {status.label}
            </span>
            <span className="font-mono text-muted">{runId}</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-fg truncate">{targetHostname}</h1>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <a
              href={targetUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono hover:text-fg"
            >
              <span className="truncate max-w-[240px] sm:max-w-sm">{targetUrl}</span>
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
            {isHttps && (
              <>
                <span aria-hidden="true">·</span>
                <span>HTTPS</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="font-mono">{telemetry?.latency_ms || 28}ms</span>
            <span aria-hidden="true">·</span>
            <span>{telemetry?.tech_stack?.slice(0, 3).join(", ") || "Web application"}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenWorkflow}
            className="text-xs text-muted hover:text-fg underline-offset-2 hover:underline"
            title="See what each agent did in this run"
          >
            Agent workflow
          </button>
          <button
            type="button"
            onClick={onRetestAll}
            disabled={retestingAll}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-line bg-white text-xs font-medium text-fg hover:bg-subtle transition-colors disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 text-muted ${retestingAll ? "animate-spin" : ""}`} aria-hidden="true" />
            <span>{retestingAll ? "Re-running..." : "Re-run"}</span>
          </button>
          <button
            type="button"
            onClick={onDownloadPytest}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-fg text-white hover:bg-black transition-colors text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Export pytest</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Confirmed defects"
          value={confirmedDefectsCount}
          note={
            isBlocker
              ? `${blockerDefectsCount} blocker${blockerDefectsCount === 1 ? "" : "s"}`
              : isWarning
              ? `${warningObservationsCount} observation${warningObservationsCount === 1 ? "" : "s"}`
              : "None found"
          }
          accent={confirmedDefectsCount > 0}
        />
        <StatCard label="Journeys passed" value={`${passingJourneysCount}/${dynamicJourneysLength}`} />
        <StatCard
          label="Quality score"
          value={`${qualityScorePercent}%`}
          note={isBlocker ? "High risk" : isWarning ? "Needs review" : "Good"}
        />
        <StatCard label="Routes discovered" value={routesCount} note={`${locatorsCount} locators`} />
      </div>
    </div>
  );
}
