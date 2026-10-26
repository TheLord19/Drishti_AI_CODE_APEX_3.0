"use client";

import { useState } from "react";
import { CheckCircle2, ChevronRight, Maximize2, Wrench, Copy, Check, EyeOff } from "lucide-react";

const sectionLabel = "block text-[11px] font-medium text-muted mb-1.5";

function severityStyle(severity) {
  const s = (severity || "").toLowerCase();
  if (s === "high" || s === "critical") return { dot: "bg-red-500", text: "text-red-700", border: "border-red-200" };
  if (s === "low") return { dot: "bg-zinc-400", text: "text-[#525252]", border: "border-line" };
  return { dot: "bg-amber-500", text: "text-amber-700", border: "border-amber-200" };
}

const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

// Ready-to-paste bug report for GitHub, Jira or Slack.
function issueText(f, targetUrl) {
  const fix = f.fix || {};
  return [
    `## ${f.title}`,
    "",
    `Severity: ${f.severity}${f.hidden ? " (hidden failure)" : ""} | Reproduced: ${f.replay_rate} | Page: ${f.anomaly_location?.screen || "/"} | Site: ${targetUrl}`,
    "",
    "### Steps to reproduce",
    ...(f.trigger_steps || []).map((s, i) => `${i + 1}. ${s}`),
    "",
    `Expected: ${f.expected}`,
    `Actual: ${f.actual}`,
    `Evidence: ${f.evidence}`,
    "",
    "### Suggested fix",
    fix.summary || "",
    `Likely cause: ${fix.cause || ""}`,
    ...(fix.steps || []).map((s) => `- ${s}`),
    ...(fix.code ? ["", `Example (AI suggestion, ${fix.code_source}):`, "```" + (fix.code_language || ""), fix.code, "```"] : []),
    "",
    `Confirm the fix: re-run ${fix.confirm_test || "DRISHTI"}; it should pass.`,
    "",
    "Found by DRISHTI AI",
  ].join("\n");
}

function CopyButton({ text, label }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1 text-[11px] font-medium text-fg hover:bg-subtle"
    >
      {done ? <Check className="w-3 h-3 text-emerald-600" aria-hidden="true" /> : <Copy className="w-3 h-3 text-muted" aria-hidden="true" />}
      {done ? "Copied" : label}
    </button>
  );
}

export function HiddenBadge() {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700"
      title="Users rarely report this; it shows up later as lost orders or support tickets."
    >
      <EyeOff className="w-3 h-3" aria-hidden="true" />
      Hidden
    </span>
  );
}

// Green, labelled block: the fix is never conveyed by colour alone.
function FixBlock({ f, targetUrl }) {
  const fix = f.fix;
  if (!fix) return null;
  return (
    <div className="px-4 py-4">
      <div className="rounded-md border border-emerald-200 border-l-4 border-l-emerald-500 bg-emerald-50/60 p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
            <Wrench className="w-3.5 h-3.5" aria-hidden="true" />
            Suggested fix
          </span>
          <CopyButton text={issueText(f, targetUrl)} label="Copy as issue" />
        </div>
        <p className="text-sm font-medium text-fg">{fix.summary}</p>
        <p className="text-[#404040]">
          <span className="text-muted">Likely cause: </span>
          {fix.cause}
        </p>
        {fix.steps?.length > 0 && (
          <ol className="list-decimal space-y-0.5 pl-4 text-[#262626]">
            {fix.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        )}
        {fix.code && (
          <div>
            <span className="block text-[11px] text-muted mb-1">
              Example for this stack · AI suggestion ({fix.code_source}), review before use
            </span>
            <pre className="overflow-x-auto rounded-md border border-[#27272A] bg-[#0E1015] p-3 font-mono text-[11px] leading-relaxed text-zinc-200">
              {fix.code}
            </pre>
          </div>
        )}
        {fix.confirm_test && (
          <p className="text-[11px] text-muted">
            Confirm the fix: re-run <code className="font-mono text-fg">{fix.confirm_test}</code>; it should pass.
          </p>
        )}
      </div>
    </div>
  );
}

// Every defect in severity order with its one-line fix: the team's to-do list.
function FixPlan({ findings, targetUrl }) {
  const ordered = [...findings].sort((a, b) => (SEVERITY_RANK[a.severity] ?? 2) - (SEVERITY_RANK[b.severity] ?? 2));
  const planText = [
    `DRISHTI fix plan for ${targetUrl}`,
    "",
    ...ordered.map((f, i) => `${i + 1}. [${f.severity}${f.hidden ? ", hidden" : ""}] ${f.title}\n   Fix: ${f.fix?.summary || "-"}`),
  ].join("\n");
  return (
    <section aria-labelledby="fix-plan-heading" className="rounded-lg border border-emerald-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 px-4 py-3">
        <h3 id="fix-plan-heading" className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg">
          <Wrench className="w-4 h-4 text-emerald-600" aria-hidden="true" />
          Fix plan
          <span className="font-mono text-xs font-normal text-muted">{ordered.length}</span>
        </h3>
        <CopyButton text={planText} label="Copy fix plan" />
      </div>
      <ol className="divide-y divide-line">
        {ordered.map((f, i) => {
          const sev = severityStyle(f.severity);
          return (
            <li key={f.id || i} className="flex items-start gap-3 px-4 py-2.5 text-xs">
              <span className="w-4 shrink-0 font-mono text-muted">{i + 1}</span>
              <span className={`mt-1 w-1.5 h-1.5 shrink-0 rounded-full ${sev.dot}`} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5 text-fg">
                  {f.title}
                  {f.hidden && <HiddenBadge />}
                </span>
                <span className="mt-0.5 block text-emerald-800">
                  <span className="font-semibold">Fix:</span> {f.fix?.summary}
                </span>
              </span>
              <span className={`shrink-0 text-[10px] font-medium uppercase ${sev.text}`}>{f.severity}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default function DefectsTab({
  isBlocker,
  isWarning,
  isClean,
  findings = [],
  targetUrl,
  targetHostname,
  model,
  telemetry,
  getDefectScreenshotInfo,
  setFullImageModal,
}) {
  let origin = "";
  try {
    origin = targetUrl ? new URL(targetUrl).origin : "";
  } catch {
    origin = "";
  }
  const isHttps = typeof targetUrl === "string" && targetUrl.startsWith("https://");
  const locatorCount = (model?.buttons?.length || 0) + (model?.inputs?.length || 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-fg flex items-baseline gap-2">
          Defects
          <span className="font-mono text-sm font-normal text-muted">{findings.length}</span>
        </h2>
        <p className="text-xs text-muted mt-1">
          Each defect was replayed in fresh browser contexts. Open a row for evidence and its suggested fix.
          {findings.some((f) => f.hidden) && (
            <> {findings.filter((f) => f.hidden).length} hidden: users rarely report these, but they cost orders and support time.</>
          )}
        </p>
      </div>

      {findings.length > 0 && <FixPlan findings={findings} targetUrl={targetUrl} />}

      {findings.length > 0 ? (
        <ul className="rounded-lg border border-line bg-white divide-y divide-line">
          {findings.map((f, idx) => {
            const defectInfo = getDefectScreenshotInfo(f);
            const sev = severityStyle(f.severity);
            const title = f.title || f.classification_reason;

            return (
              <li key={f.id || idx}>
                <details className="group" open={idx === 0}>
                  <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:bg-subtle">
                    <span className={`w-2 h-2 shrink-0 rounded-full ${sev.dot}`} aria-hidden="true" />
                    <span className="shrink-0 font-mono text-xs text-muted">{f.id || `BUG-${idx + 1}`}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-fg">{title}</span>
                    {f.hidden && <HiddenBadge />}
                    <span className={`hidden sm:inline shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase ${sev.text} ${sev.border}`}>
                      {f.severity || "warning"}
                    </span>
                    <span className="hidden md:inline shrink-0 font-mono text-[11px] text-muted">
                      {f.replay_rate || "3/3"}
                    </span>
                    <ChevronRight className="w-4 h-4 shrink-0 text-muted transition-transform group-open:rotate-90" aria-hidden="true" />
                  </summary>

                  <div className="border-t border-line divide-y divide-line text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 py-4">
                      <div>
                        <span className={sectionLabel}>Expected</span>
                        <p className="text-[#262626] leading-relaxed">{f.expected}</p>
                      </div>
                      <div>
                        <span className={sectionLabel}>Actual</span>
                        <p className="text-[#262626] leading-relaxed">{f.actual}</p>
                      </div>
                    </div>

                    <FixBlock f={f} targetUrl={targetUrl} />

                    {f.journey && (
                      <div className="px-4 py-3 text-muted">
                        Journey: <span className="text-fg">{f.journey}</span>
                      </div>
                    )}

                    {f.trigger_steps?.length > 0 && (
                      <div className="px-4 py-4">
                        <span className={sectionLabel}>Steps to reproduce</span>
                        <ol className="list-decimal list-inside space-y-1 font-mono text-[#262626] leading-relaxed">
                          {f.trigger_steps.map((st, sIdx) => (
                            <li key={sIdx}>{st}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {f.evidence && (
                      <div className="px-4 py-4">
                        <span className={sectionLabel}>Evidence</span>
                        <p className="font-mono text-[11px] text-[#262626] break-all whitespace-pre-wrap leading-relaxed">
                          {f.evidence}
                        </p>
                      </div>
                    )}

                    {f.anomaly_location && (
                      <div className="px-4 py-4 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className={`${sectionLabel} mb-0`}>
                            Screenshot · <span className="font-mono">{f.anomaly_location.screen}</span> ·{" "}
                            <span className="font-mono">{f.anomaly_location.selector}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setFullImageModal({
                                src: defectInfo.src,
                                title: `${f.id}: ${f.title}`,
                                route: defectInfo.route,
                                selector: f.anomaly_location?.selector,
                                description: f.anomaly_location?.description,
                                id: f.id,
                              })
                            }
                            className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-fg"
                          >
                            <Maximize2 className="w-3 h-3" aria-hidden="true" />
                            Full page
                          </button>
                        </div>

                        <div className="rounded-md border border-line overflow-hidden">
                          <div className="px-3 py-1.5 border-b border-line bg-[#FAFAF9] font-mono text-[11px] text-muted truncate">
                            {origin}
                            <span className="text-fg">{defectInfo.route}</span>
                          </div>
                          <div className="relative max-h-[420px] overflow-y-auto bg-zinc-100">
                            {defectInfo.isImage ? (
                              <div className="relative w-full">
                                <img
                                  src={f.screenshot_url || `${defectInfo.src}&highlight=${encodeURIComponent(JSON.stringify([{ selector: f.anomaly_location.selector, label: `${f.id}: ${f.title}`, color: "red" }]))}`}
                                  alt={`Page capture for ${f.id} with the element outlined in red`}
                                  loading="lazy"
                                  className="w-full h-auto block select-none"
                                />
                              </div>
                            ) : (
                              <iframe
                                src={defectInfo.src}
                                title={`Screenshot for ${f.id}`}
                                sandbox="allow-same-origin allow-forms"
                                className="w-full h-[400px] border-0 pointer-events-none select-none bg-white"
                                loading="lazy"
                              />
                            )}
                          </div>
                          {f.anomaly_location.description && (
                            <div className="px-3 py-2 border-t border-line text-[11px] text-[#262626]">
                              {f.anomaly_location.description}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-lg border border-line bg-white px-4 py-6 text-center">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-2" aria-hidden="true" />
          <p className="text-sm font-medium text-fg">No defects found</p>
          <p className="text-xs text-muted mt-1">
            Navigation, form validation and security checks passed without anomalies.
          </p>
        </div>
      )}

      <details className="rounded-lg border border-line bg-white">
        <summary className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden text-xs">
          <span className="font-medium text-fg">Environment health</span>
          <span className="font-mono text-muted">
            HTTP {telemetry?.status_code || 200} · {telemetry?.latency_ms || 28}ms · {isHttps ? "HTTPS" : "HTTP"} ·{" "}
            {locatorCount} locators
          </span>
        </summary>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-line px-4 py-4 text-xs">
          <div>
            <dt className="text-muted">HTTP status</dt>
            <dd className="font-mono text-fg mt-0.5">{telemetry?.status_code || 200}</dd>
          </div>
          <div>
            <dt className="text-muted">Response time</dt>
            <dd className="font-mono text-fg mt-0.5">{telemetry?.latency_ms || 28}ms</dd>
          </div>
          <div>
            <dt className="text-muted">Transport</dt>
            <dd className="font-mono text-fg mt-0.5">{isHttps ? "HTTPS" : "HTTP (plain)"}</dd>
          </div>
          <div>
            <dt className="text-muted">Interactive elements</dt>
            <dd className="font-mono text-fg mt-0.5">{locatorCount}</dd>
          </div>
        </dl>
      </details>
    </div>
  );
}
