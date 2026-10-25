"use client";

import { useState } from "react";
import {
  Globe,
  Play,
  RotateCcw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  LockKeyhole,
} from "lucide-react";

export const PRESET_TARGETS = [
  {
    id: "wealthwise",
    label: "WealthWise Live App",
    url: "https://www.mywealthwise.in",
    description: `# WealthWise Ground-Truth Autonomous QA Rules

- Sign-up Flow: Navigation to /auth/signup must render registration inputs; malformed emails rejected with 400.
- Login Portal: Authentication at /auth/signin must support case-insensitive emails; forgot password link must resolve 200 OK.
- Financial Dashboard: Budget and Expense tracking tabs must update dashboard metrics deterministically.`,
    mode: "sandbox",
  },
  {
    id: "padmora",
    label: "Padmora Sarees",
    url: "https://padmorasarees.com/",
    description: `# Padmora Sarees Ground-Truth Autonomous QA Rules
- Storefront Availability: Root URL and Mohar collection banner must resolve HTTP 200 OK without unhandled load errors.
- Headline & Branding: Main H1 "Padmora Sarees by Yashi | Handloom" rendered with proper contrast and DOM hierarchy.
- Product Weaves: Interactive category filters (Maheshwari, Banarasi, Narayanpet, Paithani) and "Every saree, one place" collections.
- Media & Video: "Sarees in Motion" video players and customer care footer links must not throw unhandled exceptions.`,
    mode: "sandbox",
  },
  {
    id: "designrip",
    label: "DesignRip.in",
    url: "https://designrip.in",
    description: `# Behavioral Rules & Ground Truth Constraints

- Navigation: Root URL and all discovered internal links must resolve with HTTP 200 OK.
- Form Inputs: Input fields must enforce format validation (emails, URLs, required attributes).
- Interactive Controls: Buttons and links must dispatch handlers without uncaught exceptions.
- Security: Application must serve traffic over HTTPS with appropriate security headers.`,
    mode: "sandbox",
  },
  {
    id: "shoplite",
    label: "ShopLite (Benchmark)",
    url: "http://localhost:3001",
    description: `# ShopLite Ground-Truth Benchmark Rules
- Sign-up: Malformed emails must be rejected; duplicate emails must return user-friendly message.
- Login: Case-insensitive email authentication; forgot password link must not 404.`,
    mode: "sandbox",
  },
  {
    id: "github",
    label: "GitHub Repository",
    url: "https://github.com/TheLord19/Drishti_AI_CODE_APEX_3.0",
    description: `# GitHub Repository Audit Rules
- Codebase Analysis: Discover routes, interactive components, forms, and dependencies.
- Frontend Invariants: Verify build entrypoint, manifest, and accessible DOM anchors.
- Security Policies: Inspect secrets leakage, CSP configuration, and package vulnerabilities.`,
    mode: "sandbox",
  },
  {
    id: "custom",
    label: "Custom Target",
    url: "",
    description: `# Behavioral Rules & Ground Truth Constraints

- Navigation: Root URL and all discovered internal links must resolve with HTTP 200 OK.
- Form Inputs: Input fields must enforce format validation (emails, URLs, required attributes).
- Interactive Controls: Buttons and links must dispatch handlers without uncaught exceptions.
- Security: Application must serve traffic over HTTPS with appropriate security headers.`,
    mode: "sandbox",
  },
];

const fieldLabel = "block text-xs font-medium text-fg mb-1.5";
const smallLabel = "block text-[11px] font-medium text-fg mb-1";
const numberInput = "w-full px-2.5 py-1.5 text-xs font-mono border border-line rounded-md bg-white";

export default function Launchpad({
  targetUrl,
  setTargetUrl,
  description,
  setDescription,
  mode,
  setMode,
  attestation,
  setAttestation,
  loading,
  error,
  onSubmit,
  onPresetSelect,
  activePreset,
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [maxConcurrency, setMaxConcurrency] = useState(3);
  const [replayAttempts, setReplayAttempts] = useState(3);
  const [viewportWidth, setViewportWidth] = useState(1280);
  // Off and empty by default: developers bring their own test account.
  const [authEnabled, setAuthEnabled] = useState(false);
  const [loginPath, setLoginPath] = useState("/login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");

  return (
    <section id="operation-workspace" className="py-16 bg-[#FAFAF9] border-t border-line">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight text-fg">Start a QA run</h2>
        <p className="mt-2 text-sm text-muted">
          Paste a URL. DRISHTI explores the app, plans tests and reports bugs with evidence.
        </p>

        <form
          onSubmit={(e) =>
            onSubmit(
              e,
              authEnabled ? { login_path: loginPath, username: authEmail, password: authPassword } : null
            )
          }
          className="mt-6 bg-white border border-line rounded-lg overflow-hidden"
        >
          {/* Essentials: always visible */}
          <div className="p-5 sm:p-6 space-y-5">
            <div>
              <label htmlFor="target-url" className={fieldLabel}>
                Target URL
              </label>
              <div className="relative rounded-md border border-line bg-white focus-within:border-fg transition-colors">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Globe className="w-4 h-4 text-muted" />
                </div>
                <input
                  id="target-url"
                  type="text"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://your-staging-app.com"
                  className="block w-full pl-9 pr-3 py-2.5 text-sm font-mono text-fg placeholder-[#A3A3A3] focus:outline-none bg-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="target-description" className={fieldLabel}>
                What should it focus on? <span className="font-normal text-muted">(optional)</span>
              </label>
              <textarea
                id="target-description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Key user journeys, validation rules, expected responses..."
                className="block w-full p-3 text-xs font-mono text-fg border border-line rounded-md focus:border-fg focus:outline-none leading-relaxed"
              />
            </div>

            <label htmlFor="attestation-check" className="flex items-start gap-2.5 cursor-pointer text-xs text-muted">
              <input
                id="attestation-check"
                type="checkbox"
                checked={attestation}
                onChange={(e) => setAttestation(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-[#D4D4D4] text-fg focus:ring-fg"
              />
              <span>
                I own or am authorized to test this target, and it is not a production environment.
              </span>
            </label>

            {error && (
              <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <span>
                  <span className="font-semibold">Run blocked: </span>
                  {error}
                </span>
              </div>
            )}

            <button
              id="start-run-btn"
              type="submit"
              disabled={loading || !attestation}
              className={`w-full py-3 px-6 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                loading || !attestation
                  ? "bg-[#E5E5E5] text-[#A3A3A3] cursor-not-allowed"
                  : "bg-fg text-white hover:bg-black"
              }`}
            >
              {loading ? (
                <>
                  <RotateCcw className="w-4 h-4 animate-spin" />
                  <span>Starting run...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start run</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              aria-expanded={showAdvanced}
              aria-controls="run-options"
              className="mx-auto flex items-center gap-1 text-xs text-muted hover:text-fg transition-colors"
            >
              <span>{showAdvanced ? "Hide options" : "Show options"}</span>
              {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          {/* Options: hidden until asked for */}
          {showAdvanced && (
            <div id="run-options" className="border-t border-line bg-[#FAFAF9] p-5 sm:p-6 space-y-6 text-xs">
              <div>
                <span className={smallLabel}>Example targets</span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_TARGETS.map((p) => {
                    const isSelected = activePreset === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onPresetSelect(p.id)}
                        aria-pressed={isSelected}
                        className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                          isSelected
                            ? "bg-fg text-white"
                            : "bg-white text-[#525252] border border-line hover:text-fg"
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="mode-select" className={smallLabel}>
                  Execution safety mode
                </label>
                <select
                  id="mode-select"
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="block w-full px-3 py-2 border border-line rounded-md bg-white text-fg focus:border-fg focus:outline-none"
                >
                  <option value="sandbox">Sandbox (exploration and non-destructive actions)</option>
                  <option value="safe_exploration">Safe exploration (read-only navigation and form probing)</option>
                </select>
                <p className="mt-1.5 text-[11px] text-muted">
                  {mode === "sandbox"
                    ? "Explores, probes form validation boundaries and replays in isolated sandboxes."
                    : "Limits the agent to GET requests, navigation and passive DOM inspection."}
                </p>
              </div>

              <div className="space-y-2.5">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="flex items-center gap-2 font-medium text-fg">
                    <LockKeyhole className="w-3.5 h-3.5 text-muted" />
                    Authenticated crawl
                  </span>
                  <input
                    type="checkbox"
                    checked={authEnabled}
                    onChange={(e) => setAuthEnabled(e.target.checked)}
                    className="rounded border-line text-fg focus:ring-0 cursor-pointer"
                  />
                </label>
                {authEnabled && (
                  <>
                    <p className="text-[11px] text-muted leading-relaxed">
                      Sign in with a test account so the agent can reach pages behind your login. Use a test
                      account, not a real user&apos;s. Credentials are kept in memory for this run only and are
                      never shown or stored.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono">
                      <input
                        type="text"
                        value={loginPath}
                        onChange={(e) => setLoginPath(e.target.value)}
                        placeholder="/login"
                        aria-label="Login page path"
                        title="Path of your login page, for example /login"
                        required
                        className="px-2.5 py-1.5 rounded-md border border-line bg-white text-fg"
                      />
                      <input
                        type="text"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder="Test email or username"
                        aria-label="Test account email or username"
                        autoComplete="off"
                        required
                        className="px-2.5 py-1.5 rounded-md border border-line bg-white text-fg"
                      />
                      <input
                        type="password"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder="Password"
                        aria-label="Test account password"
                        autoComplete="new-password"
                        required
                        className="px-2.5 py-1.5 rounded-md border border-line bg-white text-fg"
                      />
                    </div>
                  </>
                )}
              </div>

              <div>
                <span className={smallLabel}>Engine parameters</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="opt-replay" className="block text-[11px] text-muted mb-1">
                      Replay count
                    </label>
                    <input
                      id="opt-replay"
                      type="number"
                      min="2"
                      max="5"
                      value={replayAttempts}
                      onChange={(e) => setReplayAttempts(Number(e.target.value))}
                      className={numberInput}
                    />
                  </div>
                  <div>
                    <label htmlFor="opt-concurrency" className="block text-[11px] text-muted mb-1">
                      Crawl concurrency
                    </label>
                    <input
                      id="opt-concurrency"
                      type="number"
                      min="1"
                      max="6"
                      value={maxConcurrency}
                      onChange={(e) => setMaxConcurrency(Number(e.target.value))}
                      className={numberInput}
                    />
                  </div>
                  <div>
                    <label htmlFor="opt-viewport" className="block text-[11px] text-muted mb-1">
                      Viewport width
                    </label>
                    <input
                      id="opt-viewport"
                      type="number"
                      min="375"
                      max="1920"
                      step="5"
                      value={viewportWidth}
                      onChange={(e) => setViewportWidth(Number(e.target.value))}
                      className={numberInput}
                    />
                  </div>
                </div>
              </div>

              <div>
                <span className={smallLabel}>Engine readiness</span>
                <ul className="space-y-1.5 text-[11px] text-[#525252]">
                  {[
                    ["Chromium browser sandboxes", "v1.50 headless"],
                    ["Isolated replay contexts", "3×"],
                    ["Pytest codegen emitter", "active"],
                  ].map(([name, value]) => (
                    <li key={name} className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" aria-hidden="true" />
                        {name}
                      </span>
                      <span className="font-mono text-muted">{value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </form>
      </div>
    </section>
  );
}
