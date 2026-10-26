// Benchmark lab: plant bugs on a benchmark target, start a normal run, and score it afterwards.
// The testing engine (store.js, probes.js, flow.js) never imports this module and never sees
// what was planted; scoring reads only the finished run's findings.
import fs from "fs";
import path from "path";
import { createRun, getStore } from "./store";

const DATA_DIR = process.env.DRISHTI_DATA_DIR
  ? path.join(/*turbopackIgnore: true*/ process.env.DRISHTI_DATA_DIR, "..", "lab")
  : path.join(/*turbopackIgnore: true*/ process.cwd(), "..", "..", "data", "lab");

// Only these targets can be planted on. Never arbitrary websites.
export function allowedTargets() {
  return (process.env.BENCHMARK_TARGETS || "http://localhost:3001,http://localhost:3005")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

const store = getStore();
if (!store.labPlans) store.labPlans = new Map();

export async function targetInfo(url) {
  try {
    const res = await fetch(`${url}/__bugs.json`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return { url, reachable: false };
    const data = await res.json();
    return {
      url,
      reachable: true,
      bugs: (data.bugs || []).map((b) => ({ id: b.id, title: b.title, severity: b.severity, faulty: b.faulty, expected: b.expected })),
    };
  } catch {
    return { url, reachable: false };
  }
}

export async function plantAndRun({ target, bugs, random, blind }) {
  const url = String(target || "").replace(/\/$/, "");
  if (!allowedTargets().includes(url)) throw new Error("Target is not an allowed benchmark target");
  const info = await targetInfo(url);
  if (!info.reachable) throw new Error("Benchmark target is not reachable");
  const all = info.bugs.map((b) => b.id);
  let picked;
  if (random) {
    const n = Math.max(1, Math.min(Number(random) || 3, all.length));
    picked = [...all].sort(() => Math.random() - 0.5).slice(0, n);
  } else {
    picked = (Array.isArray(bugs) ? bugs : []).filter((b) => all.includes(b));
  }
  const res = await fetch(`${url}/__bugs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bugs: picked.map((b) => b.toLowerCase()), key: process.env.BENCHMARK_KEY || "" }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Could not plant bugs (HTTP ${res.status})`);

  // A normal run: nothing about the planted bugs is passed to the engine.
  const run = createRun({ target_url: url, mode: "sandbox", description: "" });
  const labId = `lab_${Date.now().toString(36)}`;
  const plan = { lab_id: labId, target: url, planted: picked, blind: !!blind, run_id: run.run_id, created_at: new Date().toISOString() };
  store.labPlans.set(labId, plan);
  save(plan);
  return { lab_id: labId, run_id: run.run_id, planted: blind ? null : picked };
}

function save(plan) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(path.join(DATA_DIR, `${plan.lab_id}.json`), JSON.stringify(plan, null, 2));
  } catch (e) {
    console.error("[lab]", e.message);
  }
}

function load(labId) {
  if (store.labPlans.has(labId)) return store.labPlans.get(labId);
  if (!/^lab_[a-z0-9]+$/.test(labId)) return null;
  try {
    const plan = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${labId}.json`), "utf8"));
    store.labPlans.set(labId, plan);
    return plan;
  } catch {
    return null;
  }
}

/** Status, and once the run is finished: what was planted and how the run scored. */
export async function labResult(labId) {
  const plan = load(labId);
  if (!plan) return null;
  const run = store.runs.get(plan.run_id);
  const done = run && (run.stage === "S10" || run.status === "failed" || run.status === "interrupted");
  const out = { lab_id: labId, run_id: plan.run_id, target: plan.target, blind: plan.blind, stage: run?.stage, status: run?.status, done: !!done };
  if (!done) return { ...out, planted: plan.blind ? null : plan.planted };

  const info = await targetInfo(plan.target);
  const manifest = new Map((info.bugs ? await fullManifest(plan.target) : []).map((b) => [b.id, b]));
  const findings = store.findings.get(plan.run_id) || [];
  const meaningful = findings.filter((f) => f.severity !== "low" && f.scenario_id !== "test_security_headers");
  const found = [];
  const missed = [];
  const explained = new Set();
  for (const id of plan.planted) {
    const by = manifest.get(id)?.detected_by || [];
    const hits = meaningful.filter((f) => by.includes(f.scenario_id));
    hits.forEach((f) => explained.add(f));
    if (hits.length) found.push({ bug: id, title: manifest.get(id)?.title || id, by: hits.map((f) => f.title) });
    else missed.push({ bug: id, title: manifest.get(id)?.title || id });
  }
  const falseAlarms = meaningful.filter((f) => !explained.has(f)).map((f) => ({ id: f.id, title: f.title }));
  const score = {
    planted: plan.planted.length,
    found: found.length,
    missed: missed.length,
    false_alarms: falseAlarms.length,
    recall: plan.planted.length ? Math.round((found.length / plan.planted.length) * 100) : null,
  };
  const result = { ...out, planted: plan.planted, found, missed, false_alarms: falseAlarms, score };
  if (!plan.scored) {
    plan.scored = { ...score, at: new Date().toISOString() };
    save(plan);
  }
  return result;
}

async function fullManifest(url) {
  try {
    const res = await fetch(`${url}/__bugs.json`, { signal: AbortSignal.timeout(4000) });
    return (await res.json()).bugs || [];
  } catch {
    return [];
  }
}
