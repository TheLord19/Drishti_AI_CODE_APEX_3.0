"use client";

import { ChevronRight, Maximize2 } from "lucide-react";

const sectionLabel = "block text-[11px] font-medium text-muted mb-1.5";

function statusStyle(status) {
  if (status === "DEFECT DETECTED") return { dot: "bg-red-500", text: "text-red-700", label: "Defect" };
  if (status === "POLICY WARNING") return { dot: "bg-amber-500", text: "text-amber-700", label: "Warning" };
  if (status === "UNAVAILABLE") return { dot: "bg-[#D4D4D4]", text: "text-muted", label: "Unavailable" };
  return { dot: "bg-emerald-500", text: "text-emerald-700", label: "Passed" };
}

function ScreenFrame({ heading, shot, onExpand, title }) {
  return (
    <figure className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium text-fg">{heading}</span>
        <span className="flex items-center gap-2">
          {shot.badge && <span className="font-mono text-muted">{shot.badge}</span>}
          <button type="button" onClick={onExpand} className="inline-flex items-center gap-1 text-muted hover:text-fg" title="Open full page">
            <Maximize2 className="w-3 h-3" aria-hidden="true" />
            <span className="sr-only">Open full page</span>
          </button>
        </span>
      </div>
      <div className="overflow-hidden rounded-md border border-line bg-white">
        <div className="border-b border-line bg-[#FAFAF9] px-2 py-1 font-mono text-[10px] text-muted truncate">{shot.target}</div>
        <div className="max-h-[320px] overflow-y-auto">
          {shot.isImage ? (
            <img src={shot.src} alt={shot.caption} className="w-full h-auto block select-none" />
          ) : (
            <iframe
              src={shot.src}
              title={title}
              sandbox="allow-same-origin allow-forms"
              className="w-full h-[300px] border-0 pointer-events-none select-none bg-white"
              loading="lazy"
            />
          )}
        </div>
      </div>
      {shot.caption && <figcaption className="font-mono text-[10px] text-muted truncate">{shot.caption}</figcaption>}
    </figure>
  );
}

export default function JourneysTab({
  dynamicJourneys = [],
  passingJourneysCount,
  expandedJourney,
  setExpandedJourney,
  getWorkflowScreens,
  setFullImageModal,
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-fg flex items-baseline gap-2">
          Journeys
          <span className="font-mono text-sm font-normal text-muted">
            {passingJourneysCount}/{dynamicJourneys.length} passed
          </span>
        </h2>
        <p className="text-xs text-muted mt-1">What a real visitor goes through, grouped into journeys. Open one for its result and screenshots; per-test steps and code are in the Tests tab.</p>
      </div>

      <ul className="rounded-lg border border-line bg-white divide-y divide-line">
        {dynamicJourneys.map((j) => {
          const isExpanded = expandedJourney === j.id;
          const st = statusStyle(j.status);
          const panelId = `journey-panel-${j.id}`;

          return (
            <li key={j.id}>
              <button
                type="button"
                onClick={() => setExpandedJourney(isExpanded ? null : j.id)}
                aria-expanded={isExpanded}
                aria-controls={panelId}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-subtle"
              >
                <span className={`w-2 h-2 shrink-0 rounded-full ${st.dot}`} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-fg">{j.title}</span>
                  <span className="block truncate font-mono text-[11px] text-muted">{j.target}</span>
                  {j.fix && (
                    <span className="mt-0.5 block truncate text-[11px] text-emerald-800">
                      <span className="font-semibold">Fix:</span> {j.fix}
                    </span>
                  )}
                </span>
                <span className="hidden sm:inline shrink-0 text-[11px] text-muted">{j.category}</span>
                <span className={`shrink-0 text-xs font-medium ${st.text}`}>{st.label}</span>
                <ChevronRight className={`w-4 h-4 shrink-0 text-muted transition-transform ${isExpanded ? "rotate-90" : ""}`} aria-hidden="true" />
              </button>

              {isExpanded && (
                <div id={panelId} className="border-t border-line divide-y divide-line text-xs">
                  {j.details && <p className="px-4 py-3 text-[#525252] leading-relaxed">{j.details}</p>}

                  {j.fixes?.length > 0 && (
                    <div className="px-4 py-3">
                      <div className="rounded-md border border-emerald-200 border-l-4 border-l-emerald-500 bg-emerald-50/60 px-3 py-2">
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-emerald-800 mb-1">Suggested fixes</span>
                        <ul className="list-disc space-y-0.5 pl-4 text-emerald-900">
                          {j.fixes.map((fx, i) => (
                            <li key={i}>{fx}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {j.assertions?.length > 0 && (
                    <div className="px-4 py-4">
                      <span className={sectionLabel}>Checks in this journey</span>
                      <ul className="space-y-1 text-[#262626]">
                        {j.assertions.map((ast, i) => (
                          <li key={i}>{ast}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {(() => {
                    const screens = getWorkflowScreens(j);
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-4 py-4">
                        <ScreenFrame
                          heading="Before"
                          shot={screens.pre}
                          title={`Before screenshot for ${j.id}`}
                          onExpand={() =>
                            setFullImageModal({
                              src: screens.pre.src,
                              title: `${j.title} — Pre-Action`,
                              route: screens.pre.target,
                              description: screens.pre.caption,
                            })
                          }
                        />
                        <ScreenFrame
                          heading="After"
                          shot={screens.post}
                          title={`After screenshot for ${j.id}`}
                          onExpand={() =>
                            setFullImageModal({
                              src: screens.post.src,
                              title: `${j.title} — Post-Action`,
                              route: screens.post.target,
                              description: screens.post.caption,
                            })
                          }
                        />
                      </div>
                    );
                  })()}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
