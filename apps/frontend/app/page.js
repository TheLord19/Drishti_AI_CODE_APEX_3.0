"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Play, ChevronDown } from "lucide-react";

import HeroBrowserDemo from "./components/HeroBrowserDemo";
import Launchpad, { PRESET_TARGETS } from "./components/Launchpad";
import ExecutionTimeline from "./components/ExecutionTimeline";
import HowItWorks from "./components/HowItWorks";
import Differentiators from "./components/Differentiators";
import EvidenceShowcase from "./components/EvidenceShowcase";
import BenchmarkSection from "./components/BenchmarkSection";
import Footer from "./components/Footer";

const DEFAULT_PRESET = PRESET_TARGETS[0];

// Secondary content stays on the page but starts collapsed, so a new visitor sees
// the headline and the run form first and opens the rest only if they want it.
function MoreSection({ title, summary, children }) {
  return (
    <details className="group border-t border-line bg-[#FAFAF9]">
      <summary className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between gap-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-sm font-medium text-fg">{title}</span>
          <span className="block text-xs text-muted mt-0.5">{summary}</span>
        </span>
        <ChevronDown className="w-4 h-4 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      {children}
    </details>
  );
}

export default function LandingPage() {
  const router = useRouter();

  // Primary operation form state
  const [activePreset, setActivePreset] = useState(DEFAULT_PRESET.id);
  const [targetUrl, setTargetUrl] = useState(DEFAULT_PRESET.url);
  const [description, setDescription] = useState(DEFAULT_PRESET.description);
  const [mode, setMode] = useState(DEFAULT_PRESET.mode);
  const [attestation, setAttestation] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handlePresetSelect = (presetId) => {
    setActivePreset(presetId);
    const selected = PRESET_TARGETS.find((p) => p.id === presetId);
    if (selected) {
      setTargetUrl(selected.url);
      setDescription(selected.description);
      setMode(selected.mode);
      setAttestation(true);
      setError(null);
    }
  };

  const scrollToWorkspace = () => {
    const el = document.getElementById("operation-workspace");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const scrollToHowItWorks = () => {
    const el = document.getElementById("how-it-works");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  // auth is { login_path, username, password } when the developer turned on authenticated crawl.
  const handleSubmit = async (e, auth = null) => {
    e.preventDefault();
    if (!targetUrl.trim()) {
      setError("Please enter a valid target URL to test.");
      return;
    }
    if (!attestation) {
      setError("Authorization Attestation (SEC-1) must be confirmed to run tests.");
      return;
    }

    setLoading(true);
    setError(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "/api";

    try {
      const res = await fetch(`${apiUrl}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_url: targetUrl.trim(),
          description: description,
          mode: mode,
          authorization: {
            confirmed: true,
            statement: "I own or am authorized to test this target and it is a non-production environment.",
          },
          ...(auth ? { auth } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.error?.message || "Failed to create QA run");
      }

      const data = await res.json();
      if (data?.run_id) {
        window.location.href = `/runs/${data.run_id}`;
      } else {
        router.push("/runs");
      }
    } catch (err) {
      setError(err.message || "Failed to launch autonomous session");
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-[#FAFAF9] text-fg min-h-screen">
      {/* Hero: headline, one line of support, one primary action */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-12 pb-16 lg:pt-16 lg:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 text-xs font-mono text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden="true"></span>
              Autonomous QA agent
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.08]">
              Your next bug shouldn&apos;t reach production.
            </h1>

            <p className="text-base sm:text-lg text-[#525252] leading-relaxed max-w-xl">
              DRISHTI explores your web app, tests real user journeys and reports bugs with browser evidence.
            </p>

            <p className="text-xs text-muted">
              No pre-written tests <span aria-hidden="true">·</span> 3× replay verification{" "}
              <span aria-hidden="true">·</span> pytest export for CI
            </p>

            <div className="pt-1 flex flex-col sm:flex-row sm:items-center gap-4">
              <button
                type="button"
                onClick={scrollToWorkspace}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md bg-fg text-white hover:bg-black transition-colors text-sm font-medium"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start a QA run</span>
              </button>
              <button
                type="button"
                onClick={scrollToHowItWorks}
                className="inline-flex items-center justify-center gap-1 text-sm text-muted hover:text-fg transition-colors"
              >
                <span>How it works</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="lg:col-span-5">
            <HeroBrowserDemo />
          </div>
        </div>
      </section>

      {/* The main action comes straight after the hero */}
      <Launchpad
        targetUrl={targetUrl}
        setTargetUrl={setTargetUrl}
        description={description}
        setDescription={setDescription}
        mode={mode}
        setMode={setMode}
        attestation={attestation}
        setAttestation={setAttestation}
        loading={loading}
        error={error}
        onSubmit={handleSubmit}
        onPresetSelect={handlePresetSelect}
        activePreset={activePreset}
      />

      <HowItWorks />

      <MoreSection title="The 10-stage pipeline" summary="What happens between submitting a URL and getting a report.">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-10">
          <ExecutionTimeline />
        </div>
      </MoreSection>

      <MoreSection title="What makes it different" summary="Grounded planning, replay verification and generated tests.">
        <Differentiators />
      </MoreSection>

      <MoreSection title="What a bug report looks like" summary="Evidence, reproduction steps and replay results.">
        <EvidenceShowcase />
      </MoreSection>

      <MoreSection title="Benchmark" summary="Results on the ShopLite app with planted bugs.">
        <BenchmarkSection />
      </MoreSection>

      <Footer onLaunchClick={scrollToWorkspace} />
    </div>
  );
}
