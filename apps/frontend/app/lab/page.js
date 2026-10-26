"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FlaskConical, Shuffle, CheckCircle2, XCircle, AlertTriangle, EyeOff } from "lucide-react";

const sevDot = (s) => (s === "high" || s === "critical" ? "bg-red-500" : s === "low" ? "bg-zinc-400" : "bg-amber-500");

export default function LabPage() {
  const [targets, setTargets] = useState(null);
  const [target, setTarget] = useState("");
  const [picked, setPicked] = useState([]);
  const [lab, setLab] = useState(null); // { lab_id, run_id, planted }
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/lab")
      .then((r) => r.json())
      .then((d) => {
        setTargets(d.targets || []);
        const first = (d.targets || []).find((t) => t.reachable);
        if (first) setTarget(first.url);
      })
      .catch(() => setTargets([]));
  }, []);

  // Poll the lab run until it is finished and scored.
  useEffect(() => {
    if (!lab) return;
    let stop = false;
    const tick = async () => {
      const r = await fetch(`/api/lab/${lab.lab_id}`).then((x) => x.json()).catch(() => null);
      if (stop || !r) return;
      setResult(r);
      if (!r.done) setTimeout(tick, 3000);
    };
    tick();
    return () => {
      stop = true;
    };
  }, [lab]);

  const current = targets?.find((t) => t.url === target);

  const start = async (body) => {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/lab", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target, ...body }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Could not start");
      setLab(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="mx-auto max-w-4xl w-full px-4 sm:px-6 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg inline-flex items-center gap-2">
          <FlaskConical className="w-6 h-6 text-accent" aria-hidden="true" />
          Benchmark lab
        </h1>
        <p className="mt-1.5 text-sm text-muted max-w-2xl">
          Plant known bugs in a benchmark app, let DRISHTI test it, then compare what it found with what was planted.
          The testing engine never sees the planted list; scoring happens only after the run finishes.
        </p>
      </div>

      {targets === null ? (
        <p className="text-sm text-muted">Loading benchmark targets...</p>
      ) : !targets.some((t) => t.reachable) ? (
        <p className="rounded-lg border border-line bg-white p-4 text-sm text-muted">
          No benchmark target is running. Start AssessLite (<code className="font-mono">apps/assesslite</code>) on an allowed port.
        </p>
      ) : (
        <section className="rounded-lg border border-line bg-white p-5 space-y-4" aria-labelledby="plant-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="plant-heading" className="text-sm font-semibold text-fg">1. Choose bugs to plant</h2>
              <p className="text-xs text-muted mt-0.5">Tick bugs, or let DRISHTI pick secretly.</p>
            </div>
            <label className="text-xs text-muted">
              Target{" "}
              <select value={target} onChange={(e) => setTarget(e.target.value)} className="ml-1 rounded-md border border-line bg-white px-2 py-1 font-mono text-xs text-fg">
                {targets.filter((t) => t.reachable).map((t) => (
                  <option key={t.url} value={t.url}>{t.url}</option>
                ))}
              </select>
            </label>
          </div>

          <ul className="divide-y divide-line rounded-md border border-line">
            {current?.bugs?.map((b) => (
              <li key={b.id}>
                <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 text-sm hover:bg-subtle">
                  <input type="checkbox" checked={picked.includes(b.id)} onChange={() => toggle(b.id)} className="mt-1" />
                  <span className={`mt-2 w-1.5 h-1.5 shrink-0 rounded-full ${sevDot(b.severity)}`} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="font-mono text-xs text-muted mr-1.5">{b.id}</span>
                    <span className="text-fg">{b.title}</span>
                    <span className="block text-xs text-muted">{b.faulty}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy || picked.length === 0}
              onClick={() => start({ bugs: picked })}
              className="px-4 py-2 rounded-md bg-fg hover:bg-black text-white text-sm font-medium disabled:opacity-40"
            >
              Plant {picked.length || ""} and run
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => start({ random: 3, blind: true })}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-line bg-white text-sm font-medium text-fg hover:bg-subtle disabled:opacity-40"
            >
              <Shuffle className="w-4 h-4" aria-hidden="true" />
              Surprise me (3 hidden bugs)
            </button>
            {error && <span role="alert" className="text-xs text-rose-700">{error}</span>}
          </div>
        </section>
      )}

      {lab && (
        <section className="rounded-lg border border-line bg-white p-5 space-y-4" aria-labelledby="result-heading" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="result-heading" className="text-sm font-semibold text-fg">2. Result</h2>
            <Link href={`/runs/${lab.run_id}`} className="text-xs text-fg underline underline-offset-4">
              Open the run report
            </Link>
          </div>

          {!result?.done ? (
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className="w-4 h-4 rounded-full border-2 border-fg border-t-transparent animate-spin" aria-hidden="true" />
              DRISHTI is testing {lab.planted ? `(planted: ${lab.planted.join(", ")})` : <span className="inline-flex items-center gap-1"><EyeOff className="w-3.5 h-3.5" aria-hidden="true" /> planted bugs hidden until the run ends</span>}
              {result?.stage && <span className="font-mono text-xs">· {result.stage}</span>}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  ["Planted", result.score.planted],
                  ["Found", result.score.found],
                  ["Missed", result.score.missed],
                  ["False alarms", result.score.false_alarms],
                ].map(([label, v]) => (
                  <div key={label} className="rounded-lg border border-line p-3">
                    <div className="text-xs text-muted">{label}</div>
                    <div className="mt-1 font-mono text-2xl text-fg">{v}</div>
                  </div>
                ))}
              </div>
              <ul className="space-y-2 text-sm">
                {result.found.map((f) => (
                  <li key={f.bug} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
                    <span>
                      <span className="font-mono text-xs text-muted mr-1.5">{f.bug}</span>
                      <span className="text-fg">{f.title}</span> <span className="text-emerald-700">found</span>
                      <span className="block text-xs text-muted">by: {f.by.join("; ")}</span>
                    </span>
                  </li>
                ))}
                {result.missed.map((m) => (
                  <li key={m.bug} className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" aria-hidden="true" />
                    <span>
                      <span className="font-mono text-xs text-muted mr-1.5">{m.bug}</span>
                      <span className="text-fg">{m.title}</span> <span className="text-red-700">missed</span>
                    </span>
                  </li>
                ))}
                {result.false_alarms.map((f) => (
                  <li key={f.id} className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
                    <span>
                      <span className="text-fg">{f.title}</span> <span className="text-amber-700">not explained by a planted bug</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </div>
  );
}
