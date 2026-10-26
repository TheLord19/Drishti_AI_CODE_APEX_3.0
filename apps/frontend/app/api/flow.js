// Generic multi-step flow walker and the checks that need one (wizards, checkouts, bookings,
// onboarding, online tests). It knows nothing about any particular site: it fills each step,
// presses the forward button, and records what it sees.
import { getBrowser } from "./playwright-service";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 DRISHTI-AI-Probe/1.0";
const MAX_STEPS = 14;
const NAV_TIMEOUT = 15000;
const FORWARD = /\b(start|begin|continue|next|proceed|review|submit|finish|confirm)\b/i;
const BACKWARD = /\b(prev|previous|back|cancel|sign ?out|log ?out|clear|reset|help|delete|remove)\b/i;
const BACK = /\b(prev|previous|back)\b/i;
const MARKER = "drishti-memory-check";
export const ODD_TEXT = `DRISHTI QA ( ) [ ] * + ? \\ ' " < > % 😀 ✓ — ` + "x".repeat(3000);

async function newContext() {
  const browser = await getBrowser();
  return browser.newContext({ viewport: { width: 1280, height: 800 }, userAgent: UA });
}

function watch(page) {
  const seen = { serverErrors: [], writes: [] };
  page.on("response", (res) => {
    const req = res.request();
    if (res.status() >= 500) seen.serverErrors.push({ method: req.method(), url: res.url(), status: res.status() });
    if (req.method() !== "GET" && ["fetch", "xhr", "document"].includes(req.resourceType())) {
      seen.writes.push({ method: req.method(), url: res.url(), status: res.status() });
    }
  });
  page.on("dialog", (d) => d.dismiss().catch(() => {}));
  return seen;
}

const signature = (page) => page.evaluate(() => location.href + "|" + document.body.innerText.slice(0, 4000)).catch(() => "");

// Visible, enabled controls whose text matches a pattern. Buttons are preferred over links.
async function findControl(page, pattern, exclude = BACKWARD) {
  for (const sel of ["button, input[type='submit'], input[type='button']", "a[href]"]) {
    const all = page.locator(sel);
    const n = Math.min(await all.count(), 60);
    for (let i = 0; i < n; i++) {
      const el = all.nth(i);
      if (!(await el.isVisible().catch(() => false)) || !(await el.isEnabled().catch(() => false))) continue;
      const text = ((await el.innerText().catch(() => "")) || (await el.getAttribute("value")) || "").trim();
      if (text && text.length < 40 && pattern.test(text) && !(exclude && exclude.test(text))) return { el, text };
    }
  }
  return null;
}

// Describe the fields on the current step, and the first field that holds an answer.
async function describeFields(page) {
  return page
    .evaluate(() => {
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
      };
      const sel = (el) => (el.id ? `#${CSS.escape(el.id)}` : el.name ? `${el.tagName.toLowerCase()}[name="${el.name}"]` : null);
      const fields = Array.from(document.querySelectorAll("input, textarea, select")).filter(
        (el) => visible(el) && !el.disabled && !["hidden", "submit", "button", "image", "reset", "file"].includes((el.type || "").toLowerCase())
      );
      const answer = fields.find((el) => ["textarea"].includes(el.tagName.toLowerCase()) || ["text", "radio", ""].includes((el.type || "").toLowerCase()));
      return {
        count: fields.length,
        answer: answer ? { kind: answer.type === "radio" ? "radio" : "text", selector: answer.type === "radio" ? `input[type="radio"][name="${answer.name}"]` : sel(answer) } : null,
      };
    })
    .catch(() => ({ count: 0, answer: null }));
}

// Fill every visible field with a plausible value ("valid"), or text fields with odd input ("odd").
async function fillStep(page, mode = "valid") {
  const fields = page.locator("input, textarea, select");
  const n = Math.min(await fields.count(), 40);
  const radioGroups = new Set();
  for (let i = 0; i < n; i++) {
    const el = fields.nth(i);
    if (!(await el.isVisible().catch(() => false)) || !(await el.isEnabled().catch(() => false))) continue;
    const info = await el
      .evaluate((f) => ({ tag: f.tagName.toLowerCase(), type: (f.type || "").toLowerCase(), name: `${f.name} ${f.id} ${f.placeholder || ""}`.toLowerCase(), value: f.value, checked: f.checked, groupName: f.name }))
      .catch(() => null);
    if (!info || ["hidden", "submit", "button", "image", "reset", "file"].includes(info.type)) continue;
    if (info.type === "radio") {
      if (!radioGroups.has(info.groupName)) {
        radioGroups.add(info.groupName);
        await page.locator(`input[type="radio"][name="${info.groupName}"]`).nth(1).check().catch(() => el.check().catch(() => {}));
      }
    } else if (info.type === "checkbox") {
      if (!info.checked) await el.check().catch(() => {});
    } else if (info.tag === "select") {
      await el.selectOption({ index: 1 }).catch(() => {});
    } else if (info.type === "email" || /e-?mail/.test(info.name)) {
      if (!info.value) await el.fill("drishti.qa.flow@example.com").catch(() => {});
    } else if (info.type === "number") {
      if (!info.value) await el.fill("1").catch(() => {});
    } else if (info.type === "tel") {
      if (!info.value) await el.fill("5551234567").catch(() => {});
    } else if (mode === "odd") {
      await el.fill(ODD_TEXT).catch(() => {});
    } else if (!info.value) {
      await el.fill(info.tag === "textarea" ? "DRISHTI QA answer" : "Drishti QA").catch(() => {});
    }
  }
}

// Press the forward button and wait for the step to change. Returns the button text or null.
async function advance(page, { double = false } = {}) {
  const ctl = await findControl(page, FORWARD);
  if (!ctl) return null;
  const before = await signature(page);
  if (double) await ctl.el.dblclick({ timeout: 5000 }).catch(() => {});
  else await ctl.el.click({ timeout: 5000 }).catch(() => {});
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(200);
    if ((await signature(page)) !== before) break;
  }
  await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(300);
  return (await signature(page)) !== before ? ctl.text : null;
}

// Text that is present but practically invisible (contrast below 1.5:1 against its background).
function invisibleTextScan() {
  const parse = (c) => {
    const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(c || "");
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const bgOf = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.5) return c;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };
  const issues = [];
  for (const el of document.querySelectorAll("body *")) {
    const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
    if (own.length < 8) continue;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (s.display === "none" || s.visibility === "hidden" || +s.opacity === 0 || r.width === 0 || r.height === 0) continue;
    if (el.closest("[aria-hidden='true']")) continue;
    const fg = parse(s.color);
    if (!fg) continue;
    const a = lum(fg) + 0.05;
    const b = lum(bgOf(el)) + 0.05;
    const ratio = Math.max(a, b) / Math.min(a, b);
    if (ratio < 1.5) {
      issues.push({
        text: own.slice(0, 80),
        ratio: Math.round(ratio * 100) / 100,
        selector: el.id ? `#${el.id}` : el.tagName.toLowerCase(),
      });
    }
    if (issues.length >= 5) break;
  }
  return issues;
}

// Fields that look editable but ignore typing.
async function uneditableFields(page) {
  const fields = page.locator(
    "input[type='text'], input[type='email'], input[type='search'], input:not([type]), textarea, [contenteditable='true']"
  );
  const out = [];
  const n = Math.min(await fields.count(), 20);
  for (let i = 0; i < n; i++) {
    const el = fields.nth(i);
    if (!(await el.isVisible().catch(() => false)) || !(await el.isEnabled().catch(() => false))) continue;
    const meta = await el
      .evaluate((f) => ({
        readonly: f.readOnly || f.getAttribute("aria-readonly") === "true",
        ce: f.isContentEditable && !("value" in f),
        selector: f.id ? `#${f.id}` : f.name ? `${f.tagName.toLowerCase()}[name="${f.name}"]` : f.tagName.toLowerCase(),
        label: (f.labels?.[0]?.innerText || f.getAttribute("aria-label") || f.placeholder || f.name || "").trim().slice(0, 40),
      }))
      .catch(() => null);
    if (!meta || meta.readonly) continue; // openly read-only fields are intentional
    const read = () => (meta.ce ? el.innerText() : el.inputValue());
    const before = await read().catch(() => "");
    await el.click({ timeout: 3000 }).catch(() => {});
    await page.keyboard.type("qa", { delay: 20 });
    const after = await read().catch(() => before);
    if (after === before) out.push(meta);
    else if (!meta.ce) await el.fill(before).catch(() => {});
  }
  return out;
}

/**
 * Walk the flow from the start URL. `onStep(page, index)` may run checks before the step is
 * filled; returning "stop" ends the walk there with the page left open (caller closes ctx).
 */
export async function walk(startUrl, { mode = "valid", modeFrom = 0, onStep = null, stopAt = null, keepOpen = false } = {}) {
  const ctx = await newContext();
  const page = await ctx.newPage();
  const seen = watch(page);
  const steps = [];
  try {
    await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => {});
    const signatures = new Set();
    for (let i = 0; i < MAX_STEPS; i++) {
      const sig = await signature(page);
      if (signatures.has(sig)) break;
      signatures.add(sig);
      const fields = await describeFields(page);
      const hasBack = !!(await findControl(page, BACK, /\b(cancel|sign ?out|log ?out)\b/i));
      const step = { index: i, url: page.url(), path: new URL(page.url()).pathname, hasBack, fields, serverErrors: [] };
      steps.push(step);
      if (onStep && (await onStep(page, i, step)) === "stop") return { ctx, page, seen, steps, stoppedAt: i };
      if (stopAt === i) return { ctx, page, seen, steps, stoppedAt: i };
      const errorsBefore = seen.serverErrors.length;
      await fillStep(page, i >= modeFrom ? mode : "valid");
      step.action = await advance(page);
      step.serverErrors = seen.serverErrors.slice(errorsBefore);
      if (!step.action) break;
    }
    return { ctx, page, seen, steps, stoppedAt: null };
  } finally {
    if (!keepOpen && stopAt === null && !onStep) await ctx.close().catch(() => {});
  }
}

const close = async (w) => w?.ctx?.close().catch(() => {});

// Evidence screenshot taken at the moment a problem is seen, with the element outlined in red.
export async function snap(page, selector, label) {
  try {
    if (selector) {
      const loc = page.locator(selector).first();
      if (await loc.count()) {
        await loc.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
        await loc.evaluate((el, text) => {
          el.style.outline = "3px solid #DC2626";
          el.style.outlineOffset = "3px";
          const r = el.getBoundingClientRect();
          const tag = document.createElement("div");
          tag.textContent = text;
          tag.style.cssText = `position:absolute;z-index:2147483647;left:${r.left + window.scrollX}px;top:${Math.max(0, r.top + window.scrollY - 26)}px;background:#DC2626;color:#fff;font:600 12px/1.6 system-ui,sans-serif;padding:1px 8px;border-radius:4px;max-width:520px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`;
          document.body.appendChild(tag);
        }, label);
      }
    }
    const buf = await page.screenshot({ type: "jpeg", quality: 70 });
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}


async function readAnswer(page, answer) {
  if (answer.kind === "radio") {
    return page
      .locator(`${answer.selector}:checked`)
      .first()
      .getAttribute("value")
      .catch(() => null);
  }
  return page.locator(answer.selector).first().inputValue().catch(() => null);
}

async function setAnswer(page, answer) {
  if (answer.kind === "radio") {
    const opt = page.locator(answer.selector).nth(1);
    await opt.check().catch(() => {});
    return opt.getAttribute("value").catch(() => null);
  }
  await page.locator(answer.selector).first().fill(MARKER).catch(() => {});
  return MARKER;
}

/** Survey the flow once, collecting per-step visibility and editability problems. */
export async function surveyFlow(startUrl) {
  const problems = { invisible: [], uneditable: [] };
  const w = await walk(startUrl, {
    onStep: async (page, i, step) => {
      const inv = await page.evaluate(invisibleTextScan).catch(() => []);
      inv.forEach((x) => problems.invisible.push({ step: i, path: step.path, ...x }));
      if (inv.length && !problems.invisibleShot) problems.invisibleShot = await snap(page, inv[0].selector, `Invisible text: "${inv[0].text.slice(0, 40)}"`);
      const un = await uneditableFields(page);
      un.forEach((x) => problems.uneditable.push({ step: i, path: step.path, ...x }));
      if (un.length && !problems.uneditableShot) problems.uneditableShot = await snap(page, un[0].selector, `Ignores typing: ${un[0].label || un[0].selector}`);
    },
  });
  // onStep keeps the context open; close it here.
  await close(w);
  return { steps: w.steps, problems };
}

/** Re-walk to a step and re-run one of the per-step scans. Used to replay a problem. */
export async function rescanStep(startUrl, stepIndex, kind) {
  const w = await walk(startUrl, { stopAt: stepIndex });
  try {
    if (kind === "invisible") return (await w.page.evaluate(invisibleTextScan).catch(() => [])).length > 0;
    return (await uneditableFields(w.page)).length > 0;
  } finally {
    await close(w);
  }
}

/** Answer a step, go forward, come back (optionally after a reload), and read the answer again. */
export async function memoryCheck(startUrl, stepIndex, answer, { reload = false } = {}) {
  const w = await walk(startUrl, { stopAt: stepIndex });
  try {
    await fillStep(w.page, "valid");
    const expected = await setAnswer(w.page, answer);
    if (!(await advance(w.page))) return { ok: false, reason: "could not move forward" };
    if (reload) {
      await w.page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
      await w.page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => {});
      await w.page.waitForTimeout(500);
    }
    const back = await findControl(w.page, BACK, /\b(cancel|sign ?out|log ?out)\b/i);
    if (!back) return { ok: false, reason: reload ? "no way back after a reload" : "no Previous or Back control" };
    await back.el.click({ timeout: 5000 }).catch(() => {});
    await w.page.waitForTimeout(700);
    const actual = await readAnswer(w.page, answer);
    const kept = actual === expected;
    const shot = kept ? null : await snap(w.page, answer.selector, reload ? "Answer lost after refresh" : "Answer lost after Next, then Previous");
    return { ok: true, expected, actual, kept, shot };
  } finally {
    await close(w);
  }
}

/** Walk with odd text from `fromStep` on; report server errors and the step that caused them. */
export async function oddInputFlow(startUrl, fromStep) {
  const w = await walk(startUrl, { mode: "odd", modeFrom: fromStep, keepOpen: true });
  const bad = w.steps.find((s) => s.serverErrors.length);
  const shot = bad ? await snap(w.page, "[role='alert']:not(:empty), .error:not(:empty)", `Save failed: HTTP ${bad.serverErrors[0].status}`) : null;
  await close(w);
  return bad ? { step: bad.index, path: bad.path, error: bad.serverErrors[0], shot } : null;
}

/** Walk to the step whose forward button ends the flow and double-click it. */
export async function doubleSubmitCheck(startUrl, stepIndex) {
  const w = await walk(startUrl, { stopAt: stepIndex });
  try {
    await fillStep(w.page, "valid");
    const ctl = await findControl(w.page, FORWARD);
    const shot = ctl ? await snap(w.page, `button:has-text("${ctl.text.replace(/"/g, '\\"')}")`, `Double-click submits twice: "${ctl.text}"`) : null;
    const before = w.seen.writes.length;
    const label = await advance(w.page, { double: true });
    await w.page.waitForTimeout(1200);
    const ok = w.seen.writes.slice(before).filter((x) => x.status >= 200 && x.status < 300);
    const counts = {};
    ok.forEach((x) => {
      const key = `${x.method} ${new URL(x.url).pathname}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    const repeated = Object.entries(counts).find(([, n]) => n > 1);
    return { label, shot, repeated: repeated ? { request: repeated[0], times: repeated[1] } : null };
  } finally {
    await close(w);
  }
}
