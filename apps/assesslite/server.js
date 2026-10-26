/**
 * AssessLite: a small online assessment app used as a DRISHTI benchmark target.
 *
 * Candidate flow: invite link -> setup -> instructions -> exam (5 questions, timer,
 * palette, code editor) -> review -> submit -> receipt.
 * Bugs are planted from bugs.manifest.json and switched on with BUG_SET ("all", "none",
 * or "A1,A3") or at runtime from the /__bugs switchboard. Node built-ins only.
 */
const http = require("http");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const PORT = Number(process.env.PORT || 3001);
const BUG_KEY = process.env.BUG_KEY || ""; // when set, changing bugs requires this key
const EXAM_SECONDS = Number(process.env.EXAM_SECONDS || 30 * 60);
const MANIFEST = JSON.parse(fs.readFileSync(path.join(__dirname, "bugs.manifest.json"), "utf8"));
const ALL_BUGS = MANIFEST.map((b) => b.id.toLowerCase());

const raw = (process.env.BUG_SET || "all").trim().toLowerCase();
const ACTIVE = new Set(raw === "all" ? ALL_BUGS : raw === "none" ? [] : raw.split(",").map((b) => b.trim()).filter((b) => ALL_BUGS.includes(b)));
const hasBug = (id) => ACTIVE.has(id.toLowerCase());

const INVITES = new Set(["demo-invite"]);
const QUESTIONS = [
  { id: "q1", type: "mcq", text: "Which HTTP status code means the resource was not found?", options: ["200", "301", "404", "500"] },
  { id: "q2", type: "mcq", text: "Which data structure processes items first in, first out?", options: ["Stack", "Queue", "Tree", "Graph"] },
  { id: "q3", type: "text", text: "Name the SQL clause used to filter rows in a SELECT statement." },
  { id: "q4", type: "code", text: "Write a JavaScript function add(a, b) that returns the sum of a and b." },
  { id: "q5", type: "mcq", text: "What is the time complexity of binary search on a sorted array?", options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"] },
];

let sessions = {}; // sid -> { name, email, answers, deadline, submissionIds }
let submissions = [];

function reset() {
  sessions = {};
  submissions = [];
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:",
  "X-Content-Type-Options": "nosniff",
};

function send(res, status, body, type = "text/html; charset=utf-8", extra = {}) {
  res.writeHead(status, { "Content-Type": type, ...SECURITY_HEADERS, ...extra });
  res.end(body);
}
const json = (res, status, data, extra) => send(res, status, JSON.stringify(data), "application/json", extra);
const redirect = (res, to) => {
  res.writeHead(302, { Location: to, ...SECURITY_HEADERS });
  res.end();
};

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 1e6) req.destroy();
    });
    req.on("end", () => resolve(data));
  });
}

function parseBody(text, type) {
  if ((type || "").includes("application/json")) {
    try {
      return JSON.parse(text || "{}");
    } catch {
      return {};
    }
  }
  // Repeated keys (several ticked checkboxes) become arrays.
  const out = {};
  for (const [k, v] of new URLSearchParams(text)) out[k] = k in out ? [].concat(out[k], v) : v;
  return out;
}

function getSession(req) {
  const m = /(?:^|;\s*)sid=([a-f0-9]+)/.exec(req.headers.cookie || "");
  return m && sessions[m[1]] ? { sid: m[1], ...sessions[m[1]], ref: sessions[m[1]] } : null;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function page(title, body, script = "") {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · AssessLite</title><style>
*{box-sizing:border-box}body{margin:0;font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;color:#1f2937;background:#f4f6f8}
header{background:#fff;border-bottom:1px solid #e5e7eb;padding:.8rem 1.5rem;display:flex;justify-content:space-between;align-items:center}
.brand{font-weight:700;color:#0f766e}main{max-width:860px;margin:2rem auto;padding:0 1rem}
.card{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:1.5rem;margin-bottom:1rem}
label{display:block;font-weight:600;font-size:.9rem;margin:.8rem 0 .3rem}
input[type=text],input[type=email],textarea{width:100%;padding:.6rem .7rem;border:1px solid #cbd5e1;border-radius:6px;font:inherit}
textarea.code{font-family:ui-monospace,Consolas,monospace;min-height:160px;background:#0f172a;color:#e2e8f0}
.btn{display:inline-block;background:#0f766e;color:#fff;border:0;border-radius:6px;padding:.6rem 1.1rem;font-weight:600;cursor:pointer;text-decoration:none;font-size:.95rem}
.btn:disabled{opacity:.5;cursor:not-allowed}.btn.secondary{background:#fff;color:#0f766e;border:1px solid #0f766e}
.row{display:flex;gap:.6rem;justify-content:space-between;align-items:center;margin-top:1.2rem}
.error{color:#b91c1c;font-size:.9rem;margin-top:.6rem}.muted{color:#6b7280;font-size:.9rem}
.palette{display:flex;gap:.4rem;flex-wrap:wrap}.palette span{width:2rem;height:2rem;border-radius:6px;border:1px solid #cbd5e1;display:flex;align-items:center;justify-content:center;font-size:.85rem}
.palette .done{background:#ccfbf1;border-color:#0f766e}.palette .now{outline:2px solid #0f766e}
.opt{display:flex;gap:.6rem;align-items:center;padding:.5rem .7rem;border:1px solid #e5e7eb;border-radius:6px;margin:.4rem 0;font-weight:400}
.timer{font-family:ui-monospace,monospace;font-weight:700}
</style></head><body><header><span class="brand">AssessLite</span><span class="muted">Online assessments</span></header>
<main>${body}</main>${script ? `<script>${script}</script>` : ""}</body></html>`;
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------
function landing() {
  return page(
    "Welcome",
    `<div class="card"><h1>Online assessment</h1><p>You have been invited to a 5-question technical assessment.
    It takes about 15 minutes. Answers are saved as you go.</p>
    <a class="btn" href="/t/demo-invite">Start your assessment</a> <a class="btn secondary" href="/help">Help</a></div>`
  );
}

function help() {
  return page(
    "Help",
    `<div class="card"><h1>Help</h1><p>Use <b>Save &amp; Next</b> to save each answer. You can go back with <b>Previous</b>.
    The timer keeps running if you refresh. Submit once you have reviewed your answers.</p><a class="btn secondary" href="/">Back</a></div>`
  );
}

function setup(token) {
  return page(
    "Candidate details",
    `<div class="card"><h1>Candidate details</h1><form id="setup-form" novalidate>
    <label for="name">Full name</label><input type="text" id="name" name="name" required>
    <label for="email">Email</label><input type="email" id="email" name="email" required>
    <label class="opt"><input type="checkbox" id="agree" name="agree" required> I agree to the assessment rules</label>
    <div id="setup-error" class="error" role="alert"></div>
    <div class="row"><span class="muted">Invite: ${esc(token)}</span><button class="btn" type="submit" id="continue-btn">Continue</button></div></form></div>`,
    `document.getElementById('setup-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = document.getElementById('setup-error'); err.textContent = '';
      const body = { token: ${JSON.stringify(token)}, name: document.getElementById('name').value,
        email: document.getElementById('email').value, agree: document.getElementById('agree').checked };
      const res = await fetch('/api/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok) location.href = data.redirect; else err.textContent = data.error || 'Please check your details.';
    });`
  );
}

function instructions(s) {
  return page(
    "Instructions",
    `<div class="card"><h1>Before you start</h1><p>Hello ${esc(s.name)}. There are 5 questions and ${Math.round(EXAM_SECONDS / 60)} minutes.</p>
    <ul><li>Save each answer with <b>Save &amp; Next</b>.</li><li>You can review and change answers before submitting.</li><li>Submit only once.</li></ul>
    <button class="btn" id="start-btn">Start test</button><div id="start-error" class="error" role="alert"></div></div>`,
    `document.getElementById('start-btn').addEventListener('click', async () => {
      const res = await fetch('/api/start', { method: 'POST' });
      if (res.ok) location.href = '/exam'; else document.getElementById('start-error').textContent = 'Could not start. Try again.';
    });`
  );
}

function exam() {
  // Bug flags the page needs. Each is a realistic client-side mistake.
  const flags = { a1: hasBug("a1"), a2: hasBug("a2"), a3: hasBug("a3"), a6: hasBug("a6") };
  return page(
    "Assessment",
    `<div class="card"><div class="row" style="margin-top:0"><div class="palette" id="palette"></div>
      <span>Time left <span class="timer" id="timer">--:--</span></span></div></div>
    <div class="card" id="panel"></div>`,
    `const BUG = ${JSON.stringify(flags)};
let questions = [], saved = {}, idx = 0, deadline = 0;
const panel = document.getElementById('panel');

async function load() {
  const res = await fetch('/api/exam');
  if (!res.ok) { location.href = '/'; return; }
  const data = await res.json();
  questions = data.questions; saved = data.answers || {}; deadline = data.deadline;
  const m = /q=(\\d+)/.exec(location.hash); idx = m ? Math.min(Number(m[1]) - 1, questions.length) : 0;
  render(); tick(); setInterval(tick, 1000);
}

function tick() {
  const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
  document.getElementById('timer').textContent = String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0');
}

function palette() {
  document.getElementById('palette').innerHTML = questions.map((q, i) =>
    '<span class="' + (saved[q.id] ? 'done ' : '') + (i === idx ? 'now' : '') + '">' + (i + 1) + '</span>').join('');
}

function field(q) {
  const v = saved[q.id] || '';
  if (q.type === 'mcq') return q.options.map((o, i) =>
    '<label class="opt"><input type="radio" name="answer" value="' + o + '"' + (v === o ? ' checked' : '') + '> ' + o + '</label>').join('');
  if (q.type === 'code') return '<label for="answer">Your code</label><textarea class="code" id="answer" name="answer" spellcheck="false">' + v.replace(/</g, '&lt;') + '</textarea>';
  return '<label for="answer">Your answer</label><input type="text" id="answer" name="answer" value="' + v.replace(/"/g, '&quot;') + '">';
}

function value(q) {
  if (q.type === 'mcq') { const c = panel.querySelector('input[name=answer]:checked'); return c ? c.value : ''; }
  return panel.querySelector('#answer').value;
}

function render() {
  location.hash = 'q=' + (idx + 1);
  palette();
  if (idx >= questions.length) return review();
  const q = questions[idx];
  const hide = BUG.a2 && q.id === 'q3' ? ' style="color:#ffffff"' : '';
  panel.innerHTML = '<p class="muted">Question ' + (idx + 1) + ' of ' + questions.length + '</p>' +
    '<h2 id="question-text"' + hide + '>' + q.text + '</h2>' + field(q) +
    '<div id="save-error" class="error" role="alert"></div><div class="row">' +
    (idx > 0 ? '<button class="btn secondary" id="prev-btn">Previous</button>' : '<span></span>') +
    '<button class="btn" id="next-btn">' + (idx === questions.length - 1 ? 'Save &amp; Review' : 'Save &amp; Next') + '</button></div>';
  if (BUG.a3 && q.type === 'code') panel.querySelector('#answer').addEventListener('keydown', (e) => e.preventDefault());
  const prev = document.getElementById('prev-btn');
  if (prev) prev.onclick = () => { idx--; render(); };
  document.getElementById('next-btn').onclick = saveAndNext;
}

async function saveAndNext() {
  const q = questions[idx], v = value(q), btn = document.getElementById('next-btn');
  btn.disabled = true;
  const res = await fetch('/api/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ qid: q.id, value: v }) }).catch(() => null);
  if (!res || !res.ok) { btn.disabled = false; document.getElementById('save-error').textContent = 'Your answer could not be saved. Please try again.'; return; }
  if (!BUG.a1) saved[q.id] = v; // A1: the local copy is never updated, so Previous shows the question unanswered
  idx++; render();
}

function review() {
  const done = questions.filter((q) => saved[q.id]).length;
  panel.innerHTML = '<h2>Review and submit</h2><p>' + done + ' of ' + questions.length + ' questions answered.</p>' +
    '<div id="submit-error" class="error" role="alert"></div><div class="row"><button class="btn secondary" id="prev-btn">Previous</button>' +
    '<button class="btn" id="submit-btn">Submit test</button></div>';
  document.getElementById('prev-btn').onclick = () => { idx = questions.length - 1; render(); };
  document.getElementById('submit-btn').onclick = submit;
}

async function submit() {
  const btn = document.getElementById('submit-btn');
  if (!BUG.a6) btn.disabled = true; // A6: the button stays active, so a double-click submits twice
  const res = await fetch('/api/submit', { method: 'POST' }).catch(() => null);
  if (!res || !res.ok) { btn.disabled = false; document.getElementById('submit-error').textContent = 'Submission failed. Please try again.'; return; }
  const data = await res.json();
  location.href = '/receipt/' + data.id;
}
load();`
  );
}

function receipt(id) {
  const sub = submissions.find((s) => s.id === id);
  if (!sub) return null;
  return page(
    "Submitted",
    `<div class="card"><h1>Assessment submitted</h1><p>Thank you, ${esc(sub.name)}. Your answers were received.</p>
    <p>Submission ID: <b>${esc(sub.id)}</b></p><p class="muted">You may now close this window.</p></div>`
  );
}

function switchboard(message = "") {
  const rows = MANIFEST.map((b) => {
    const id = b.id.toLowerCase();
    return `<label class="opt" style="align-items:flex-start"><input type="checkbox" name="bugs" value="${id}" ${ACTIVE.has(id) ? "checked" : ""}>
      <span><b>${b.id}</b> · ${esc(b.severity)} · ${esc(b.title)}<br><span class="muted">Bug: ${esc(b.faulty)}<br>Correct: ${esc(b.expected)}</span></span></label>`;
  }).join("");
  const live = [...ACTIVE].map((b) => b.toUpperCase()).join(", ") || "none";
  return page(
    "Bug switchboard",
    `<div class="card"><h1>Bug switchboard</h1><p class="muted">Pick the bugs planted on this AssessLite (port ${PORT}). Saving resets all candidate data. Live now: <b>${live}</b></p>
    ${message ? `<p class="error">${esc(message)}</p>` : ""}
    <form method="POST" action="/__bugs">${rows}
    ${BUG_KEY ? '<label for="key">Switchboard key</label><input type="text" id="key" name="key" autocomplete="off">' : ""}
    <div class="row"><span><button class="btn secondary" name="preset" value="none">Turn all off</button>
    <button class="btn secondary" name="preset" value="all">Turn all on</button></span><button class="btn" type="submit">Save planted bugs</button></div></form></div>`
  );
}

function setBugs(list) {
  ACTIVE.clear();
  list.map((b) => String(b).toLowerCase()).filter((b) => ALL_BUGS.includes(b)).forEach((b) => ACTIVE.add(b));
  reset();
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;
  const s = getSession(req);
  try {
    if (req.method === "GET" && p === "/") return send(res, 200, landing());
    if (req.method === "GET" && p === "/help") return send(res, 200, help());
    if (req.method === "GET" && p.startsWith("/t/")) {
      const token = decodeURIComponent(p.slice(3));
      return INVITES.has(token) ? send(res, 200, setup(token)) : send(res, 404, page("Invite not found", '<div class="card"><h1>Invite not found</h1><a class="btn secondary" href="/">Home</a></div>'));
    }
    if (req.method === "GET" && p === "/instructions") return s ? send(res, 200, instructions(s)) : redirect(res, "/");
    if (req.method === "GET" && p === "/exam") return s && s.deadline ? send(res, 200, exam()) : redirect(res, "/");
    if (req.method === "GET" && p.startsWith("/receipt/")) {
      const html = receipt(decodeURIComponent(p.slice(9)));
      return html ? send(res, 200, html) : send(res, 404, page("Not found", '<div class="card"><h1>Not found</h1></div>'));
    }

    if (req.method === "POST" && p === "/api/setup") {
      const b = parseBody(await readBody(req), req.headers["content-type"]);
      if (!INVITES.has(b.token)) return json(res, 404, { error: "Invite not found" });
      if (!String(b.name || "").trim()) return json(res, 400, { error: "Enter your full name." });
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(b.email || "").trim())) return json(res, 400, { error: "Enter a valid email address." });
      if (b.agree !== true && b.agree !== "on") return json(res, 400, { error: "Accept the assessment rules to continue." });
      const sid = crypto.randomBytes(12).toString("hex");
      sessions[sid] = { name: String(b.name).trim().slice(0, 200), email: String(b.email).trim().toLowerCase(), answers: {}, deadline: 0, submissionIds: [] };
      return json(res, 200, { redirect: "/instructions" }, { "Set-Cookie": `sid=${sid}; Path=/; HttpOnly; SameSite=Lax` });
    }
    if (req.method === "POST" && p === "/api/start") {
      if (!s) return json(res, 401, { error: "No session" });
      if (!s.ref.deadline) s.ref.deadline = Date.now() + EXAM_SECONDS * 1000;
      return json(res, 200, { ok: true });
    }
    if (req.method === "GET" && p === "/api/exam") {
      if (!s || !s.deadline) return json(res, 401, { error: "Not started" });
      // A4: saved answers are left out of the response, so a refresh shows an empty exam.
      return json(res, 200, { questions: QUESTIONS, answers: hasBug("a4") ? {} : s.answers, deadline: s.deadline });
    }
    if (req.method === "POST" && p === "/api/answer") {
      if (!s || !s.deadline) return json(res, 401, { error: "Not started" });
      const b = parseBody(await readBody(req), req.headers["content-type"]);
      if (!QUESTIONS.some((q) => q.id === b.qid)) return json(res, 400, { error: "Unknown question" });
      let value = String(b.value ?? "").slice(0, 20000);
      // A8: the answer is re-parsed through a hand-built JSON string, which breaks on quotes.
      if (hasBug("a8")) value = JSON.parse('{"v":"' + value + '"}').v;
      s.ref.answers[b.qid] = value;
      return json(res, 200, { ok: true });
    }
    if (req.method === "POST" && p === "/api/submit") {
      if (!s || !s.deadline) return json(res, 401, { error: "Not started" });
      // A6: no check for an earlier submission, so a repeat creates a second one.
      if (!hasBug("a6") && s.submissionIds.length) return json(res, 409, { error: "Already submitted", id: s.submissionIds[0] });
      const id = "SUB-" + crypto.randomBytes(4).toString("hex").toUpperCase();
      submissions.push({ id, name: s.name, answers: { ...s.answers }, at: new Date().toISOString() });
      s.ref.submissionIds.push(id);
      return json(res, 200, { id });
    }

    // Operator switchboard (benchmarking only; DRISHTI's engine never reads it).
    if (p === "/__bugs.json" && req.method === "GET") {
      return json(res, 200, { bugs: MANIFEST, keyRequired: !!BUG_KEY });
    }
    if (p === "/__bugs" && req.method === "GET") return send(res, 200, switchboard());
    if (p === "/__bugs" && req.method === "POST") {
      const b = parseBody(await readBody(req), req.headers["content-type"]);
      if (BUG_KEY && b.key !== BUG_KEY) {
        return (req.headers["content-type"] || "").includes("json") ? json(res, 403, { error: "Wrong key" }) : send(res, 403, switchboard("Wrong switchboard key."));
      }
      const picked = b.preset === "all" ? ALL_BUGS : b.preset === "none" ? [] : [].concat(b.bugs || []);
      setBugs(picked);
      return (req.headers["content-type"] || "").includes("json") ? json(res, 200, { active: [...ACTIVE] }) : redirect(res, "/__bugs");
    }
    if (p === "/__test/reset" && req.method === "POST") {
      reset();
      return json(res, 200, { ok: true });
    }

    return send(res, 404, page("Not found", '<div class="card"><h1>Page not found</h1><a class="btn secondary" href="/">Home</a></div>'));
  } catch (e) {
    console.error("[assesslite]", e.message);
    return json(res, 500, { error: "Internal server error" });
  }
});

server.listen(PORT, () => console.log(`AssessLite on http://localhost:${PORT} · bugs: ${[...ACTIVE].join(",") || "none"}`));
