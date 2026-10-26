// Persists every run to disk so agent logs and results survive a server restart.
// Layout: <DRISHTI_DATA_DIR or drishti/data/runs>/<run_id>/
//   run.json        target, mode, status (never credentials)
//   events.jsonl    one event per line, tagged with the agent that produced it
//   log.txt         the same events, readable, grouped by agent
//   findings.json, tests.json, model.json, <test file>.py
import fs from "fs";
import path from "path";

const DATA_DIR = process.env.DRISHTI_DATA_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "..", "..", "data", "runs");

// The seven agents shown in the UI, by pipeline stage.
export const AGENTS = {
  S1: "Preflight Sentinel",
  S2: "Crawler & Sitemap Scout",
  S3: "AppModel Synthesizer",
  S4: "Journey Planner",
  S5: "Chromium Execution Engine",
  S6: "Invariant Validator",
  S7: "Reporter",
  S8: "Reporter",
  S9: "Reporter",
  S10: "Reporter",
};

const SAFE_ID = /^run_[a-z0-9]+$/;

function runDir(runId) {
  if (!SAFE_ID.test(runId)) return null;
  return path.join(DATA_DIR, runId);
}

function ensureDir(runId) {
  const dir = runDir(runId);
  if (dir) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Disk errors must never break a run; they are logged and skipped.
function safely(fn) {
  try {
    return fn();
  } catch (e) {
    console.error("[run-log]", e.message);
    return null;
  }
}

export function logEvent(runId, ev) {
  safely(() => {
    const dir = ensureDir(runId);
    if (!dir) return;
    const agent = AGENTS[ev.stage] || "Pipeline";
    fs.appendFileSync(path.join(dir, "events.jsonl"), JSON.stringify({ ...ev, agent }) + "\n");
    fs.appendFileSync(path.join(dir, "log.txt"), `${ev.ts}  ${ev.stage.padEnd(3)}  [${agent}]  ${ev.type}: ${ev.message}\n`);
  });
}

export function saveJson(runId, name, data) {
  safely(() => {
    const dir = ensureDir(runId);
    if (dir) fs.writeFileSync(path.join(dir, name), JSON.stringify(data, null, 2));
  });
}

export function saveText(runId, name, text) {
  safely(() => {
    const dir = ensureDir(runId);
    if (dir) fs.writeFileSync(path.join(dir, name), text);
  });
}

/** Readable log grouped by agent, for download. */
export function readableLog(runId) {
  return safely(() => {
    const dir = runDir(runId);
    if (!dir) return null;
    const file = path.join(dir, "events.jsonl");
    if (!fs.existsSync(file)) return null;
    const events = fs
      .readFileSync(file, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => safely(() => JSON.parse(l)))
      .filter(Boolean);
    const run = safely(() => JSON.parse(fs.readFileSync(path.join(dir, "run.json"), "utf8"))) || {};
    const lines = [
      `DRISHTI AI run log`,
      `Run:    ${runId}`,
      `Target: ${run.target_url || "?"}`,
      `Mode:   ${run.mode || "?"}`,
      `Status: ${run.status || "?"} (stage ${run.stage || "?"})`,
      `Events: ${events.length}`,
      "",
    ];
    let lastAgent = null;
    for (const ev of events) {
      if (ev.agent !== lastAgent) {
        lines.push("", `== ${ev.agent} (${ev.stage}) ==`);
        lastAgent = ev.agent;
      }
      lines.push(`${ev.ts}  ${ev.type}: ${ev.message}`);
    }
    return lines.join("\n") + "\n";
  });
}

/** Load every saved run into the in-memory store. Runs cut off by a restart are marked interrupted. */
export function hydrateStore(store) {
  safely(() => {
    if (!fs.existsSync(DATA_DIR)) return;
    for (const runId of fs.readdirSync(DATA_DIR)) {
      const dir = runDir(runId);
      if (!dir || store.runs.has(runId)) continue;
      const read = (name) => safely(() => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")));
      const run = read("run.json");
      if (!run) continue;
      if (run.stage !== "S10" && run.status !== "failed") run.status = "interrupted";
      store.runs.set(runId, run);
      const evFile = path.join(dir, "events.jsonl");
      if (fs.existsSync(evFile)) {
        store.events.set(
          runId,
          fs
            .readFileSync(evFile, "utf8")
            .split("\n")
            .filter(Boolean)
            .map((l) => safely(() => JSON.parse(l)))
            .filter(Boolean)
        );
      }
      const findings = read("findings.json");
      if (findings) store.findings.set(runId, findings);
      const tests = read("tests.json");
      if (tests) store.namedTests.set(runId, tests);
      const model = read("model.json");
      if (model) store.models.set(runId, model);
      const telemetry = read("telemetry.json");
      if (telemetry) store.telemetry.set(runId, telemetry);
      const py = path.join(dir, "test_suite.py");
      if (fs.existsSync(py)) store.generatedTests.set(runId, fs.readFileSync(py, "utf8"));
    }
  });
}

/** Read a saved text file of a run (for example an evidence screenshot), or null. */
export function readText(runId, name) {
  return safely(() => {
    const dir = runDir(runId);
    if (!dir || !/^[\w.-]+$/.test(name)) return null;
    const file = path.join(dir, name);
    return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  });
}
