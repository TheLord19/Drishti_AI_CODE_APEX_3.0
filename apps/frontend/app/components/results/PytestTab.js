"use client";

import { Copy, Check, Download } from "lucide-react";

const STATUS = {
  passed: { dot: "bg-emerald-500", text: "text-emerald-700", label: "Passed" },
  failed: { dot: "bg-red-500", text: "text-red-700", label: "Failed" },
  warning: { dot: "bg-amber-500", text: "text-amber-700", label: "Warning" },
  skipped: { dot: "bg-[#D4D4D4]", text: "text-muted", label: "Unavailable" },
};

export default function PytestTab({
  tests = [],
  computedPlaywrightCode,
  targetHostname,
  copiedCode,
  copyToClipboard,
  downloadTestSuite,
}) {
  const fileName = `test_${targetHostname.replace(/[^a-zA-Z0-9]/g, "_")}.py`;
  const counts = tests.reduce((acc, t) => ({ ...acc, [t.status]: (acc[t.status] || 0) + 1 }), {});

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-fg">Tests</h2>
          <p className="text-xs text-muted mt-1">
            {tests.length
              ? `${tests.length} named tests: ${counts.passed || 0} passed, ${counts.failed || 0} failed, ${counts.skipped || 0} unavailable${counts.warning ? `, ${counts.warning} warning` : ""}.`
              : "Tests appear here as the run progresses."}{" "}
            Each one is exported to a Playwright test you can rerun with pytest.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadTestSuite}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-line bg-white text-xs font-medium text-fg hover:bg-subtle transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
          <span>Download {fileName}</span>
        </button>
      </div>

      {tests.length > 0 && (
        <ul className="divide-y divide-line rounded-lg border border-line bg-white">
          {tests.map((t) => {
            const st = STATUS[t.status] || STATUS.passed;
            return (
              <li key={t.id}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden hover:bg-subtle">
                    <span className={`inline-flex w-24 shrink-0 items-center gap-1.5 text-xs ${st.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} aria-hidden="true" />
                      {st.label}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-fg">{t.name}</span>
                    <span className="hidden sm:inline font-mono text-[11px] text-muted">{t.id}</span>
                  </summary>
                  <div className="space-y-3 border-t border-line bg-[#FAFAF9] px-4 py-3 text-xs">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted">
                      <span>Page <span className="font-mono text-fg">{t.route || "/"}</span></span>
                      <span>Area <span className="text-fg">{t.category}</span></span>
                      {t.replay && <span>Reproduced <span className="font-mono text-fg">{t.replay}</span></span>}
                      {t.note && <span>{t.note}</span>}
                    </div>
                    {t.steps?.length > 0 && (
                      <ol className="list-decimal space-y-0.5 pl-4 text-[#525252]">
                        {t.steps.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ol>
                    )}
                    {t.code && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(t.code, `test-${t.id}`)}
                          className="absolute right-2 top-2 rounded-md border border-[#3F3F46] bg-[#18181B] p-1.5 text-zinc-300 hover:text-white"
                          title="Copy this test"
                          aria-label={`Copy ${t.id}`}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <pre className="overflow-x-auto rounded-md border border-[#27272A] bg-[#0E1015] p-3 font-mono text-[11px] leading-relaxed text-zinc-200">
                          {t.code}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}

      <details className="rounded-lg border border-line bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-xs text-muted hover:text-fg [&::-webkit-details-marker]:hidden">
          <span>Full file · <span className="font-mono">{fileName}</span></span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              copyToClipboard(computedPlaywrightCode, "code");
            }}
            className="inline-flex items-center gap-1.5 text-fg hover:underline"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
            {copiedCode ? "Copied" : "Copy"}
          </button>
        </summary>
        <div className="max-h-[420px] overflow-y-auto border-t border-[#27272A] bg-[#0E1015] p-4 font-mono text-xs text-zinc-200 leading-relaxed">
          <pre className="whitespace-pre-wrap">{computedPlaywrightCode}</pre>
        </div>
      </details>

      <div className="rounded-lg border border-line bg-white px-4 py-3 text-xs">
        <span className="block text-[11px] text-muted mb-1">Run it locally (needs the playwright and pytest-playwright packages)</span>
        <code className="font-mono text-fg break-all">
          <span className="text-muted select-none">$ </span>pytest -v {fileName} --browser-channel chrome
        </code>
      </div>
    </div>
  );
}
