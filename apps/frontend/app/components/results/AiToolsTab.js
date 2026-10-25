"use client";

import { useState } from "react";
import { RotateCcw, Check, Wand2, Copy, CheckCircle2, XCircle, CornerDownLeft } from "lucide-react";

const DEMO_DRIFT_SCENARIOS = [
  {
    id: "id_drift",
    label: "Legacy ID Drift",
    broken: "#legacy_cta_button_v1",
    strategy: "Semantic Accessible Role + Text Match",
    description: "Element ID was renamed during a frontend refactor; DOM query returned null.",
  },
  {
    id: "tailwind_drift",
    label: "Tailwind CSS Drift",
    broken: "button.bg-orange-500.hover\\:bg-orange-600.px-4.py-2.rounded-lg",
    strategy: "Accessible Button Hierarchy Recovery",
    description: "Utility classes shifted from Tailwind v3 to v4; hardcoded selector broke.",
  },
  {
    id: "hash_drift",
    label: "React Dynamic Hash",
    broken: "div[data-testid='auth-modal-v2'] > button.btn-7x9q",
    strategy: "Proximity & Accessible Name Recovery",
    description: "Bundler generated a new dynamic CSS-in-JS hash on rebuild.",
  },
  {
    id: "xpath_drift",
    label: "Brittle Structural XPath",
    broken: "/html/body/div[1]/main/section[2]/div[3]/div/button",
    strategy: "Semantic Subtree Graph Synthesis",
    description: "Wrapper div added around marketing hero section; strict XPath collapsed.",
  },
];

const card = "rounded-lg border border-line bg-white p-5 sm:p-6 space-y-4";
const detailsSummary =
  "cursor-pointer list-none [&::-webkit-details-marker]:hidden text-[11px] text-muted hover:text-fg select-none";

// A selector you can copy by clicking it. The copy icon only appears on hover or focus.
function CopyableCode({ text, copied, onCopy, className = "", label }) {
  return (
    <button
      type="button"
      onClick={onCopy}
      title={copied ? "Copied" : `Copy ${label}`}
      className={`group flex min-w-0 items-center gap-1.5 text-left font-mono ${className}`}
    >
      <code className="truncate">{text}</code>
      {copied ? (
        <Check className="w-3 h-3 shrink-0 text-emerald-600" aria-hidden="true" />
      ) : (
        <Copy className="w-3 h-3 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
      )}
      <span className="sr-only">{copied ? "Copied" : `Copy ${label}`}</span>
    </button>
  );
}

export default function AiToolsTab({
  customStepText,
  setCustomStepText,
  executingStep,
  handleExecuteNLStep,
  stepResult,
  signupRoute,
  primaryButton,
  h1Text,
  targetHostname,
  targetUrl,
  model,
  healedChains = [],
  isHealing,
  handleTriggerSelfHealing,
  copyToClipboard,
}) {
  const [copiedKey, setCopiedKey] = useState(null);
  const [activeDriftScenario, setActiveDriftScenario] = useState(DEMO_DRIFT_SCENARIOS[0].id);

  const handleCopy = (text, key) => {
    if (copyToClipboard) {
      copyToClipboard(text, key);
    } else {
      navigator.clipboard.writeText(text);
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const currentScenario = DEMO_DRIFT_SCENARIOS.find((s) => s.id === activeDriftScenario) || DEMO_DRIFT_SCENARIOS[0];

  const suggestions = [
    `Click button "${primaryButton || "Get Started"}"`,
    `Verify signup inputs on "${signupRoute || "/auth/signup"}"`,
    `Assert primary headline "${(h1Text || "Autonomous").slice(0, 24)}..." is visible`,
    `Check responsive navigation and zero console errors`,
  ];

  const runStep = (text) => {
    if (!text.trim() || executingStep) return;
    handleExecuteNLStep(text);
  };

  const locator = stepResult?.resolved_locator || "body";
  const generatedCode = `await page.locator('${locator}').${stepResult?.action === "fill" ? "fill('test@drishti.ai')" : "click()"}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* Natural-language test: type a step, press Enter */}
      <section className={card} aria-labelledby="nl-test-heading">
        <div>
          <h3 id="nl-test-heading" className="text-sm font-semibold text-fg">
            Natural-language test
          </h3>
          <p className="text-xs text-muted mt-1">Describe a step in plain English and DRISHTI turns it into a browser action.</p>
        </div>

        <div>
          <label htmlFor="nl-step-input" className="sr-only">
            Test step
          </label>
          <input
            id="nl-step-input"
            type="text"
            value={customStepText}
            onChange={(e) => setCustomStepText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runStep(customStepText)}
            readOnly={executingStep}
            placeholder={`e.g. Verify sign-up flow on "${signupRoute || "/auth/signup"}"`}
            aria-describedby="nl-step-hint"
            className="w-full text-xs font-mono text-fg placeholder-[#A3A3A3] px-3 py-2.5 rounded-md border border-line bg-white focus:border-fg focus:outline-hidden"
          />
          <p id="nl-step-hint" className="mt-1.5 flex items-center gap-1 text-[11px] text-muted" aria-live="polite">
            {executingStep ? (
              <>
                <RotateCcw className="w-3 h-3 animate-spin" aria-hidden="true" />
                Running...
              </>
            ) : (
              <>
                <CornerDownLeft className="w-3 h-3" aria-hidden="true" />
                Press Enter to run
              </>
            )}
          </p>
        </div>

        {stepResult ? (
          <div className="space-y-3 border-t border-line pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 font-medium text-fg">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                Step resolved
              </span>
              <span className="font-mono text-[11px] text-muted">
                {Math.round((stepResult.confidence || 0.98) * 100)}% confidence · {stepResult.latency_ms || 24}ms
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="shrink-0 rounded border border-line px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted">
                {stepResult.action || "assert"}
              </span>
              <CopyableCode
                text={locator}
                label="locator"
                copied={copiedKey === "nl_loc"}
                onCopy={() => handleCopy(locator, "nl_loc")}
                className="text-fg"
              />
            </div>

            {stepResult.reasoning && <p className="text-xs text-[#525252] leading-relaxed">{stepResult.reasoning}</p>}

            <details className="group">
              <summary className={detailsSummary}>
                Details: generated code{stepResult.trace?.length ? ` and ${stepResult.trace.length}-phase trace` : ""}
              </summary>
              <div className="mt-2 space-y-3">
                <div className="rounded-md bg-[#18181B] p-3 text-[11px] font-mono text-zinc-200 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-zinc-400">
                    <span>Playwright action</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(generatedCode, "nl_code")}
                      className="hover:text-white transition-colors"
                    >
                      {copiedKey === "nl_code" ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="text-emerald-400"># Natural language step compiled into invariant test</div>
                  <div className="break-all">{generatedCode}</div>
                  <div className="text-zinc-400">expect(page.status).to_be_one_of([200, 201, 204])</div>
                </div>

                {stepResult.trace?.length > 0 && (
                  <ol className="space-y-1 border-l border-line pl-3">
                    {stepResult.trace.map((t, idx) => (
                      <li key={idx} className="text-[11px]">
                        <span className="font-mono uppercase text-muted">{t.phase}</span>{" "}
                        <span className="text-[#525252]">{t.note}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </details>
          </div>
        ) : (
          <div className="border-t border-line pt-4">
            <span className="block text-[11px] text-muted mb-1.5">Try one:</span>
            <ul className="space-y-1">
              {suggestions.map((s, idx) => (
                <li key={idx}>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomStepText(s);
                      runStep(s);
                    }}
                    className="text-left text-xs text-[#525252] hover:text-fg hover:underline underline-offset-2"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Self-healing: pick a drift scenario, run it */}
      <section className={card} aria-labelledby="self-heal-heading">
        <div>
          <h3 id="self-heal-heading" className="text-sm font-semibold text-fg">
            Self-healing locators
          </h3>
          <p className="text-xs text-muted mt-1">When a selector breaks, DRISHTI finds the element again by role and text.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <label htmlFor="drift-scenario" className="sr-only">
            Drift scenario
          </label>
          <select
            id="drift-scenario"
            value={activeDriftScenario}
            onChange={(e) => setActiveDriftScenario(e.target.value)}
            className="flex-1 min-w-0 px-3 py-2 text-xs border border-line rounded-md bg-white text-fg focus:border-fg focus:outline-none"
          >
            {DEMO_DRIFT_SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => handleTriggerSelfHealing(currentScenario.broken)}
            disabled={isHealing}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md bg-fg hover:bg-black text-white text-xs font-medium transition-colors disabled:opacity-50 shrink-0"
          >
            <Wand2 className={`w-3.5 h-3.5 ${isHealing ? "animate-spin" : ""}`} aria-hidden="true" />
            <span>{isHealing ? "Healing..." : "Simulate drift"}</span>
          </button>
        </div>
        <p className="text-[11px] text-muted leading-relaxed">{currentScenario.description}</p>

        {healedChains && healedChains.length > 0 ? (
          <ul className="space-y-3 border-t border-line pt-4">
            {healedChains.slice(0, 3).map((hc, idx) => (
              <li key={idx} className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2 min-w-0 text-rose-700">
                  <XCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span className="shrink-0 text-[10px] uppercase font-medium">Broken</span>
                  <code className="truncate font-mono line-through text-[11px]">{hc.broken_selector}</code>
                </div>
                <div className="flex items-center gap-2 min-w-0 text-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span className="shrink-0 text-[10px] uppercase font-medium">Healed</span>
                  <CopyableCode
                    text={hc.healed_selector}
                    label="healed selector"
                    copied={copiedKey === `heal_${idx}`}
                    onCopy={() => handleCopy(hc.healed_selector, `heal_${idx}`)}
                    className="text-[11px] text-emerald-900"
                  />
                  <span className="ml-auto shrink-0 font-mono text-[10px] text-muted">
                    {Math.round((hc.confidence || 0.99) * 100)}% match
                  </span>
                </div>
                {hc.attempts?.length > 0 && (
                  <details>
                    <summary className={detailsSummary}>How it was found ({hc.attempts.length} stages)</summary>
                    <ol className="mt-1.5 space-y-0.5 border-l border-line pl-3 font-mono text-[10px] text-[#525252]">
                      {hc.attempts.map((att, aIdx) => (
                        <li key={aIdx} className="truncate">
                          {att.success ? "✓" : "✗"} Stage {att.attempt}: {att.reasoning}
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="border-t border-line pt-4 text-[11px] text-muted">
            No healed selectors yet. Pick a scenario and run it.
          </p>
        )}
      </section>
    </div>
  );
}
