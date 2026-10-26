"use client";

import { useEffect, useState } from "react";
import { Home, Maximize2, Copy, Check, AlertTriangle } from "lucide-react";

const VIEWPORTS = [
  { id: "desktop", label: "Desktop" },
  { id: "tablet", label: "Tablet" },
  { id: "mobile", label: "Mobile" },
];

// Selectors that describe the whole page or the network, not one element, cannot be outlined.
const NOT_AN_ELEMENT = new Set(["HTTP response headers"]);

export default function LiveBrowserTab({
  viewportMode,
  setViewportMode,
  previewRoute,
  setPreviewRoute,
  previewUrlInput,
  setPreviewUrlInput,
  isNavigatingPreview,
  handleNavigatePreview,
  targetUrl,
  model,
  findings = [],
  copiedSelector,
  copyToClipboard,
  setFullImageModal,
}) {
  const [selected, setSelected] = useState(null); // { selector, label, color }
  const [imgLoading, setImgLoading] = useState(true);

  const base = (targetUrl || "").replace(/\/$/, "");
  const route = previewRoute.startsWith("/") ? previewRoute : "/" + previewRoute;
  const fullPreviewUrl = base + route;
  const routeList = (model?.routes?.length ? model.routes : ["/"]).filter((r) => !r.startsWith("/#")).slice(0, 10);

  // Every defect that points at a real element on a real page.
  const problems = findings
    .filter((f) => f.anomaly_location?.screen?.startsWith("/") && f.anomaly_location?.selector && !NOT_AN_ELEMENT.has(f.anomaly_location.selector))
    .map((f) => ({ id: f.id, title: f.title, route: f.anomaly_location.screen, selector: f.anomaly_location.selector, severity: f.severity, fix: f.fix?.summary, shot: f.screenshot_url || null }));

  // Red boxes for every defect on the page being shown, plus the selected item.
  const pageMarks = problems
    .filter((p) => p.route === route)
    .map((p) => ({ selector: p.selector, label: `${p.id}: ${p.title}`, color: "red" }));
  // The selected item goes first so the screenshot scrolls to it.
  const selectedMark = selected ? { selector: selected.selector, label: selected.label, color: selected.color } : null;
  const marks = selectedMark ? [selectedMark, ...pageMarks.filter((m) => m.selector !== selectedMark.selector)] : pageMarks;

  // A defect caught inside a flow (behind a sign-in or several steps) has its own screenshot,
  // taken during the check; a fresh browser could not reach that state.
  const capturedShot = selected?.shot && route === selected.route ? selected.shot : null;
  const liveShot = base
    ? `/api/screenshot?url=${encodeURIComponent(base)}&route=${encodeURIComponent(route)}&highlight=${encodeURIComponent(JSON.stringify(marks))}`
    : null;
  const shotSrc = capturedShot || liveShot;

  useEffect(() => setImgLoading(true), [shotSrc]);

  const openProblem = (p) => {
    setSelected({ selector: p.selector, label: `${p.id}: ${p.title}`, color: "red", shot: p.shot, route: p.route });
    setPreviewUrlInput(p.route);
    handleNavigatePreview(p.route);
  };

  const buttonList = model?.buttons || [];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Live preview */}
      <section className="rounded-lg border border-line bg-white p-4 sm:p-5 space-y-3 lg:col-span-8" aria-labelledby="preview-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="preview-heading" className="text-sm font-semibold text-fg">
            Live preview
          </h3>
          <div role="radiogroup" aria-label="Viewport" className="flex items-center rounded-md border border-line bg-subtle p-0.5 text-xs">
            {VIEWPORTS.map((v) => {
              const isOn = viewportMode === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={isOn}
                  onClick={() => setViewportMode(v.id)}
                  className={`rounded px-2.5 py-1 transition-colors ${
                    isOn ? "bg-white text-fg font-medium border border-line" : "text-muted hover:text-fg border border-transparent"
                  }`}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Address bar: Enter navigates */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (previewUrlInput) {
              setSelected(null);
              handleNavigatePreview(previewUrlInput);
            }
          }}
          className="flex items-center gap-2 rounded-md border border-line bg-white px-2.5 py-1.5 font-mono text-xs focus-within:border-fg"
        >
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setPreviewUrlInput("/");
              handleNavigatePreview("/");
            }}
            title="Go to home route"
            className="shrink-0 text-muted hover:text-fg"
          >
            <Home className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="sr-only">Go to home route</span>
          </button>
          <span className="shrink-0 text-[#A3A3A3] truncate max-w-[45%]">{base}</span>
          <label htmlFor="preview-route-input" className="sr-only">
            Route
          </label>
          <input
            id="preview-route-input"
            type="text"
            value={previewUrlInput !== "" ? previewUrlInput : previewRoute}
            onChange={(e) => setPreviewUrlInput(e.target.value)}
            placeholder={previewRoute}
            className="min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-[#A3A3A3]"
          />
          <button type="submit" className="sr-only">
            Navigate
          </button>
          {(isNavigatingPreview || imgLoading) && <span className="shrink-0 text-[10px] text-muted">Loading...</span>}
        </form>

        {/* Routes as quiet text links; a dot marks pages with defects */}
        <nav aria-label="Discovered routes" className="flex items-center gap-3 overflow-x-auto pb-0.5 font-mono text-[11px]">
          {routeList.map((r) => {
            const isActive = route === r;
            const hasProblem = problems.some((p) => p.route === r);
            return (
              <button
                key={r}
                type="button"
                aria-current={isActive ? "page" : undefined}
                onClick={() => {
                  setSelected(null);
                  setPreviewUrlInput(r);
                  handleNavigatePreview(r);
                }}
                className={`shrink-0 inline-flex items-center gap-1 transition-colors ${
                  isActive ? "text-fg underline underline-offset-4" : "text-muted hover:text-fg"
                }`}
              >
                {hasProblem && <span className="w-1.5 h-1.5 rounded-full bg-red-500" aria-label="has defects" />}
                {r}
              </button>
            );
          })}
        </nav>

        {/* Browser frame: a real Playwright screenshot with defects outlined in red */}
        <div className="overflow-hidden rounded-md border border-line bg-white">
          <div className="flex h-7 items-center justify-between gap-2 border-b border-line bg-[#FAFAF9] px-3 font-mono text-[11px] text-muted">
            <span className="truncate">{fullPreviewUrl}</span>
            {shotSrc && (
              <button
                type="button"
                onClick={() => setFullImageModal({ src: shotSrc, title: fullPreviewUrl, route, description: marks.map((m) => m.label).join(" · ") })}
                className="shrink-0 hover:text-fg"
                title="Open full size"
              >
                <Maximize2 className="w-3 h-3" aria-hidden="true" />
                <span className="sr-only">Open full size</span>
              </button>
            )}
          </div>

          <div
            className={`transition-all duration-300 mx-auto relative min-h-[300px] ${
              viewportMode === "desktop" ? "w-full" : viewportMode === "tablet" ? "w-[85%]" : "w-[55%]"
            }`}
          >
            {imgLoading && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-white/70 font-mono text-xs text-fg">
                <span className="w-5 h-5 rounded-full border-2 border-fg border-t-transparent animate-spin" aria-hidden="true"></span>
                <span>Opening {route} in a browser...</span>
              </div>
            )}
            {shotSrc && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={shotSrc}
                src={shotSrc}
                alt={`Screenshot of ${fullPreviewUrl}`}
                onLoad={() => setImgLoading(false)}
                onError={() => setImgLoading(false)}
                className="w-full h-auto block select-none"
              />
            )}
          </div>
        </div>
        {capturedShot && (
          <p className="text-[11px] text-muted">
            <span className="text-red-700">Red</span> outline: screenshot captured by DRISHTI at the moment the check caught this defect.
          </p>
        )}
        {!capturedShot && marks.length > 0 && (
          <p className="text-[11px] text-muted">
            <span className="text-red-700">Red</span> boxes are defects on this page
            {selected?.color === "blue" ? <>; <span className="text-blue-700">blue</span> is the locator you picked</> : null}.
          </p>
        )}
      </section>

      <div className="space-y-6 lg:col-span-4">
        {/* Defects that point at an element */}
        <section className="rounded-lg border border-line bg-white p-4 sm:p-5 space-y-3" aria-labelledby="problems-heading">
          <div>
            <h3 id="problems-heading" className="text-sm font-semibold text-fg flex items-baseline gap-2">
              Problems <span className="font-mono text-xs font-normal text-muted">{problems.length}</span>
            </h3>
            <p className="text-xs text-muted mt-0.5">Click one to open its page with the element outlined in red.</p>
          </div>
          {problems.length > 0 ? (
            <ul className="divide-y divide-line border-t border-line">
              {problems.map((p) => {
                const isOn = selected?.selector === p.selector && route === p.route;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => openProblem(p)}
                      aria-pressed={isOn}
                      className={`flex w-full items-start gap-2 py-2 text-left text-xs hover:bg-subtle ${isOn ? "bg-red-50" : ""}`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-600" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block text-fg">{p.title}</span>
                        {p.fix && (
                          <span className="block text-[11px] text-emerald-800">
                            <span className="font-semibold">Fix:</span> {p.fix}
                          </span>
                        )}
                        <code className="block truncate font-mono text-[10px] text-muted">
                          {p.route} · {p.selector}
                        </code>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="border-t border-line pt-3 text-xs text-muted">No element-level defects on this run.</p>
          )}
        </section>

        {/* Discovered locators */}
        <section className="rounded-lg border border-line bg-white p-4 sm:p-5 space-y-3" aria-labelledby="locators-heading">
          <div>
            <h3 id="locators-heading" className="text-sm font-semibold text-fg flex items-baseline gap-2">
              Locators <span className="font-mono text-xs font-normal text-muted">{buttonList.length}</span>
            </h3>
            <p className="text-xs text-muted mt-0.5">Click one to outline it in blue on the current page and copy its selector.</p>
          </div>

          {buttonList.length > 0 ? (
            <ul className="max-h-[360px] overflow-y-auto divide-y divide-line border-t border-line">
              {buttonList.map((btn, idx) => {
                const sel = `button:has-text("${btn.replace(/\s*\(\/[^)]*\)$/, "")}")`;
                return (
                  <li key={idx}>
                    <button
                      type="button"
                      onClick={() => {
                        copyToClipboard(sel, "selector");
                        setSelected({ selector: sel, label: btn, color: "blue" });
                      }}
                      title="Outline and copy selector"
                      className={`group flex w-full items-center justify-between gap-2 py-2 text-left text-xs hover:bg-subtle ${
                        selected?.selector === sel ? "bg-blue-50" : ""
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-fg">{btn}</span>
                        <code className="block truncate font-mono text-[10px] text-muted">{sel}</code>
                      </span>
                      {copiedSelector === sel ? (
                        <Check className="w-3.5 h-3.5 shrink-0 text-emerald-600" aria-label="Copied" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 shrink-0 text-muted opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="border-t border-line pt-3 text-xs text-muted">Locators appear here once the crawl finds them.</p>
          )}
        </section>
      </div>
    </div>
  );
}
