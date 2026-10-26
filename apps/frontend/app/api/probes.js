// Generic behaviour checks. Everything here is learned from the target in a real browser
// (pages, links, forms, fields); there are no site names, routes or known-bug lists.
// Each failing check is replayed in fresh browser contexts and reports how often it reproduced.
import { getBrowser } from "./playwright-service";
import { surveyFlow, rescanStep, memoryCheck, oddInputFlow, doubleSubmitCheck } from "./flow";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 DRISHTI-AI-Probe/1.0";
const MAX_PAGES = 20;
const NAV_TIMEOUT = 15000;
const REPLAYS = 3;
const TEST_PASSWORD = "DrishtiQA!2026x";

const EMAIL_SEL = [
  "input[type='email']",
  "input[autocomplete='email']",
  "input[autocomplete='username']",
  "input[name*='email' i]",
  "input[id*='email' i]",
  "input[name*='user' i]",
  "input[id*='user' i]",
].join(", ");
const PASSWORD_SEL = "input[type='password']";
const ADD_BUTTON_TEXT = /add|cart|buy|order|basket/i;

const rand = () => Math.random().toString(36).slice(2, 8);
const freshEmail = () => `drishti.qa.${Date.now().toString(36)}${rand()}@example.com`;

async function newContext() {
  const browser = await getBrowser();
  return browser.newContext({ viewport: { width: 1280, height: 800 }, userAgent: UA });
}

// Records server errors, uncaught page errors and every non-GET request the page makes.
function watch(page) {
  const seen = { serverErrors: [], pageErrors: [], writes: [], background: [] };
  page.on("response", (res) => {
    const req = res.request();
    const type = req.resourceType();
    if (res.status() >= 500) seen.serverErrors.push({ method: req.method(), url: res.url(), status: res.status() });
    // Failures a visitor never sees: background API calls that error, assets that 404.
    if (
      (["fetch", "xhr"].includes(type) && res.status() >= 500) ||
      (["script", "stylesheet", "image", "font"].includes(type) && res.status() >= 400)
    ) {
      seen.background.push({ type, method: req.method(), url: res.url(), status: res.status() });
    }
    if (req.method() !== "GET" && ["fetch", "xhr", "document"].includes(req.resourceType())) {
      seen.writes.push({ method: req.method(), url: res.url(), status: res.status() });
    }
  });
  page.on("pageerror", (err) => seen.pageErrors.push(String(err.message || err).split("\n")[0]));
  return seen;
}

const pathOf = (url) => {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
};

// Runs in the browser: what this page offers to a tester.
function snapshotPage() {
  const cssPath = (el) => {
    if (!el) return null;
    if (el.id) return `#${CSS.escape(el.id)}`;
    if (el.name) return `${el.tagName.toLowerCase()}[name="${el.name}"]`;
    return el.tagName.toLowerCase();
  };
  const links = [];
  for (const a of document.querySelectorAll("a[href]")) {
    try {
      const u = new URL(a.getAttribute("href"), location.href);
      if (u.origin !== location.origin) continue;
      if (/\.(png|jpe?g|gif|svg|webp|pdf|zip|css|js|ico|xml|txt)$/i.test(u.pathname)) continue;
      if (/log-?out|sign-?out/i.test(u.pathname)) continue;
      links.push({ path: u.pathname, text: (a.innerText || a.getAttribute("aria-label") || "").trim().slice(0, 40) });
    } catch (e) {}
  }
  const passwords = document.querySelectorAll("input[type='password']");
  const emailEl = document.querySelector(
    "input[type='email'], input[autocomplete='email'], input[autocomplete='username'], input[name*='email' i], input[id*='email' i], input[name*='user' i], input[id*='user' i]"
  );
  const words = [
    document.title,
    ...Array.from(document.querySelectorAll("h1, h2, button, input[type='submit'], legend")).map((e) => e.innerText || e.value || ""),
  ]
    .join(" ")
    .toLowerCase();
  const newPassword = !!document.querySelector("input[autocomplete='new-password']") || passwords.length >= 2;
  const signupWords = /sign ?up|register|create (an |your )?account|join/.test(words);
  const loginWords = /log ?in|sign ?in/.test(words);
  let kind = null;
  if (passwords.length && emailEl) {
    if (newPassword || (signupWords && !loginWords)) kind = "signup";
    else if (loginWords || !signupWords) kind = "login";
  }
  const qty = Array.from(document.querySelectorAll("input[type='number']")).find((i) =>
    /qty|quant|amount|count/i.test(`${i.name} ${i.id} ${i.getAttribute("aria-label") || ""}`)
  );
  const getForms = Array.from(document.querySelectorAll("form"))
    .filter((f) => (f.getAttribute("method") || "get").toLowerCase() === "get")
    .map((f) => {
      const input = f.querySelector("input[type='search'], input[type='text'], input:not([type])");
      if (!input || !input.name) return null;
      return { action: new URL(f.getAttribute("action") || location.pathname, location.href).pathname, field: input.name, selector: cssPath(input) };
    })
    .filter(Boolean);
  // Other forms (contact, enquiry, newsletter): no password field, and either a textarea,
  // a POST method, or at least two visible fields. One-box GET search forms are excluded.
  const otherForms = Array.from(document.forms)
    .map((f, index) => {
      if (f.querySelector("input[type='password']")) return null;
      const fields = Array.from(f.querySelectorAll("input, textarea, select")).filter(
        (el) => !["hidden", "submit", "button", "image", "reset"].includes((el.type || "").toLowerCase()) && el.offsetParent !== null
      );
      const isPost = (f.getAttribute("method") || "").toLowerCase() === "post";
      const hasTextarea = !!f.querySelector("textarea");
      if (!fields.length || !(hasTextarea || isPost || fields.length >= 2)) return null;
      const label = (f.getAttribute("aria-label") || f.id || f.getAttribute("name") || f.querySelector("h1,h2,h3,legend")?.innerText || "form").trim().slice(0, 40);
      return { index, label, fieldCount: fields.length, hasEmail: !!f.querySelector("input[type='email'], input[name*='email' i]") };
    })
    .filter(Boolean);
  return {
    title: document.title,
    links,
    getForms,
    otherForms,
    kind,
    emailSelector: cssPath(emailEl),
    emailType: emailEl ? emailEl.type : null,
    qtySelector: cssPath(qty),
  };
}

// Breadth-first walk of same-origin pages. `signIn` (optional) runs first in the same context.
async function explore(targetUrl, signIn = null) {
  const origin = new URL(targetUrl).origin;
  const context = await newContext();
  const pages = new Map();
  try {
    const page = await context.newPage();
    const seen = watch(page);
    if (signIn) await signIn(page);
    const queue = [{ path: pathOf(targetUrl) || "/", from: null, linkText: null }];
    while (queue.length && pages.size < MAX_PAGES) {
      const item = queue.shift();
      if (pages.has(item.path)) continue;
      const errorsBefore = seen.pageErrors.length;
      const serverBefore = seen.serverErrors.length;
      const backgroundBefore = seen.background.length;
      let status = -1;
      let error = null;
      try {
        const res = await page.goto(origin + item.path, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
        status = res ? res.status() : 0;
        await page.waitForTimeout(350);
      } catch (e) {
        error = e.message.split("\n")[0];
      }
      const finalPath = pathOf(page.url());
      // Let late background requests (analytics, recommendations, lazy images) finish first.
      if (status >= 200 && status < 400) await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {});
      const info = {
        path: item.path,
        status,
        error,
        from: item.from,
        linkText: item.linkText,
        finalPath,
        pageErrors: seen.pageErrors.slice(errorsBefore),
        serverErrors: seen.serverErrors.slice(serverBefore),
        background: seen.background.slice(backgroundBefore),
        snap: null,
      };
      pages.set(item.path, info);
      if (status < 200 || status >= 400) continue;
      try {
        info.snap = await page.evaluate(snapshotPage);
      } catch (e) {
        continue;
      }
      for (const l of info.snap.links) {
        if (!pages.has(l.path) && !queue.some((q) => q.path === l.path)) {
          queue.push({ path: l.path, from: item.path, linkText: l.text });
        }
      }
    }
  } finally {
    await context.close().catch(() => {});
  }
  return pages;
}

// Fill and submit an email/password form; report whether the site accepted it.
async function submitCredentials(url, email, password, context = null) {
  const own = !context;
  const ctx = context || (await newContext());
  const page = await ctx.newPage();
  const seen = watch(page);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    await page.waitForTimeout(300);
    const emailField = page.locator(EMAIL_SEL).first();
    const pw = page.locator(PASSWORD_SEL);
    if (!(await emailField.count()) || !(await pw.count())) {
      return { ok: false, reason: "form not found" };
    }
    await emailField.fill(email);
    const pwCount = await pw.count();
    for (let i = 0; i < pwCount; i++) await pw.nth(i).fill(password);
    // Other required fields (name, terms) get neutral values so only the email is under test.
    const extras = page.locator("input[required]:not([type='password']):not([type='hidden']):not([type='checkbox'])");
    for (let i = 0; i < (await extras.count()); i++) {
      const el = extras.nth(i);
      if ((await el.inputValue().catch(() => "x")) === "") await el.fill("Drishti QA").catch(() => {});
    }
    const boxes = page.locator("input[type='checkbox'][required]");
    for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).check().catch(() => {});
    const browserRejects = await emailField.evaluate((el) => el.validity && !el.validity.valid).catch(() => false);
    const startPath = pathOf(page.url());
    await pw.last().press("Enter");
    await page.waitForURL((u) => pathOf(u.toString()) !== startPath, { timeout: 4000 }).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
    const endPath = pathOf(page.url());
    const stillOnForm = endPath === startPath && (await page.locator(PASSWORD_SEL).first().isVisible().catch(() => false));
    return {
      ok: true,
      accepted: !stillOnForm,
      browserRejects,
      landedOn: endPath,
      serverErrors: seen.serverErrors,
      writes: seen.writes,
    };
  } catch (e) {
    return { ok: false, reason: e.message.split("\n")[0] };
  } finally {
    await page.close().catch(() => {});
    if (own) await ctx.close().catch(() => {});
  }
}

// Set a quantity field and press the nearest add button; report what the server answered.
async function submitQuantity(url, qtySelector, value) {
  const ctx = await newContext();
  const page = await ctx.newPage();
  const seen = watch(page);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    await page.waitForTimeout(300);
    const qty = page.locator(qtySelector).first();
    if (!(await qty.count())) return { ok: false, reason: "quantity field not found" };
    await qty.fill(String(value));
    const button = page.locator("button, input[type='submit']").filter({ hasText: ADD_BUTTON_TEXT }).first();
    const fallback = page.locator("input[type='submit'][value]").first();
    const target = (await button.count()) ? button : fallback;
    if (!(await target.count())) return { ok: false, reason: "no add button found" };
    const label = ((await target.innerText().catch(() => "")) || (await target.getAttribute("value")) || "").trim();
    const writesBefore = seen.writes.length;
    await target.click();
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(600);
    const writes = seen.writes.slice(writesBefore);
    return { ok: true, label, writes, accepted: writes.some((w) => w.status >= 200 && w.status < 300), serverErrors: seen.serverErrors };
  } catch (e) {
    return { ok: false, reason: e.message.split("\n")[0] };
  } finally {
    await ctx.close().catch(() => {});
  }
}

// Fill a non-login form and submit it. `mode`: "empty" | "bad_email" | "odd" | "valid".
// Reports whether the site accepted it and whether the user saw any response.
const ODD_TEXT = `DRISHTI QA ( ) [ ] * + ? \\ ' " < > % 😀 ✓ — ` + "x".repeat(5000);
async function submitForm(url, formIndex, mode) {
  const ctx = await newContext();
  const page = await ctx.newPage();
  const seen = watch(page);
  let dialog = null;
  page.on("dialog", (d) => {
    dialog = d.message();
    d.dismiss().catch(() => {});
  });
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    await page.waitForTimeout(400);
    const form = page.locator("form").nth(formIndex);
    if (!(await form.count())) return { ok: false, reason: "form not found" };
    const fields = form.locator("input, textarea, select");
    let emailSelector = null;
    if (mode !== "empty") {
      for (let i = 0; i < (await fields.count()); i++) {
        const el = fields.nth(i);
        if (!(await el.isVisible().catch(() => false))) continue;
        const info = await el.evaluate((n) => ({
          tag: n.tagName.toLowerCase(),
          type: (n.type || "").toLowerCase(),
          name: `${n.name || ""} ${n.id || ""} ${n.getAttribute("placeholder") || ""}`.toLowerCase(),
          required: n.required,
        }));
        if (["hidden", "submit", "button", "image", "reset", "file"].includes(info.type)) continue;
        const isEmail = info.type === "email" || /e-?mail/.test(info.name);
        if (isEmail && !emailSelector) emailSelector = await el.evaluate((n) => (n.id ? `#${n.id}` : n.name ? `[name="${n.name}"]` : n.tagName.toLowerCase()));
        if (info.tag === "select") {
          await el.selectOption({ index: 1 }).catch(() => {});
        } else if (info.type === "checkbox" || info.type === "radio") {
          if (info.required) await el.check().catch(() => {});
        } else if (isEmail) {
          await el.fill(mode === "bad_email" ? "drishti-qa-no-at-sign" : "drishti.qa.form@example.com").catch(() => {});
        } else if (info.type === "tel") {
          await el.fill("5551234567").catch(() => {});
        } else if (info.type === "number") {
          await el.fill("1").catch(() => {});
        } else if (info.type === "url") {
          await el.fill("https://example.com").catch(() => {});
        } else if (info.type === "date") {
          await el.fill("2026-01-15").catch(() => {});
        } else {
          await el.fill(mode === "odd" ? ODD_TEXT : info.tag === "textarea" ? "DRISHTI QA test message. Please ignore." : "Drishti QA").catch(() => {});
        }
      }
    }
    // Did the browser itself block submission (required / type=email)?
    const browserBlocked = await form.evaluate((f) => !f.checkValidity()).catch(() => false);
    const textBefore = await page.evaluate(() => document.body.innerText).catch(() => "");
    const startUrl = page.url();
    const writesBefore = seen.writes.length;
    const submit = form.locator("button[type='submit'], input[type='submit'], button:not([type])").first();
    if (await submit.count()) await submit.click({ timeout: 5000 }).catch(() => {});
    else await form.evaluate((f) => f.requestSubmit()).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(800);
    const writes = seen.writes.slice(writesBefore);
    const navigated = page.url() !== startUrl;
    const textAfter = await page.evaluate(() => document.body.innerText).catch(() => "");
    const added = textAfter.length !== textBefore.length || textAfter !== textBefore;
    return {
      ok: true,
      browserBlocked,
      writes,
      serverErrors: seen.serverErrors,
      // A failed response (4xx/5xx) means refused, even if the browser moved to an error page.
      accepted:
        !browserBlocked &&
        !writes.some((w) => w.status >= 400) &&
        (navigated || writes.some((w) => w.status >= 200 && w.status < 400)),
      feedback: navigated || added || !!dialog,
      dialog,
      emailSelector,
    };
  } catch (e) {
    return { ok: false, reason: e.message.split("\n")[0] };
  } finally {
    await ctx.close().catch(() => {});
  }
}

// Replays run side by side, each in its own fresh browser context.
async function replay(attempt, first) {
  const results = await Promise.all(
    Array.from({ length: REPLAYS - 1 }, () => Promise.resolve().then(attempt).catch(() => false))
  );
  return (first ? 1 : 0) + results.filter(Boolean).length;
}

const pin = (selector, description, screen) => ({ selector, description, screen, x: 25, y: 35, w: 50, h: 12 });

const pyStr = (s) => JSON.stringify(String(s));

/**
 * Run every check that applies to the target. `log(stage, type, message)` streams progress.
 * Returns { tests, findings, pages, authRequired } where tests are named and carry pytest code.
 */
export async function runProbes(targetUrl, { auth = null, safeMode = false, log = () => {} } = {}) {
  const origin = new URL(targetUrl).origin;
  const abs = (p) => origin + p;
  const tests = [];
  const findings = [];
  const addTest = (t) => {
    tests.push(t);
    log(
      t.status === "failed" ? "S6" : "S5",
      t.status === "failed" ? "test_failed" : t.status === "skipped" ? "test_skipped" : "test_passed",
      `${t.name}: ${t.status.toUpperCase()}${t.replay ? ` (reproduced ${t.replay})` : ""}${t.note ? ` - ${t.note}` : ""}`
    );
  };

  // ---- 1. Explore as a signed-out visitor -------------------------------------------------
  log("S4", "explore_started", `Exploring ${origin} in a fresh browser (up to ${MAX_PAGES} pages)`);
  const pages = await explore(targetUrl);
  const all = Array.from(pages.values());
  const okPages = all.filter((p) => p.snap);
  log("S4", "explore_done", `Visited ${all.length} pages: ${all.map((p) => p.path).slice(0, 8).join(", ")}${all.length > 8 ? " ..." : ""}`);

  const signupPage = okPages.find((p) => p.snap.kind === "signup");
  const loginPage = okPages.find((p) => p.snap.kind === "login" && p.finalPath === p.path) || okPages.find((p) => p.snap.kind === "login");
  const qtyPage = okPages.find((p) => p.snap.qtySelector);
  const loginPath = auth?.login_path || loginPage?.path || null;
  const walled = loginPath ? all.filter((p) => p.path !== loginPath && p.finalPath === loginPath) : [];

  const planned = [
    "Pages load without server errors or crashes",
    "Internal links resolve",
    signupPage && "Sign-up checks",
    (loginPage || auth) && "Sign-in checks",
    qtyPage && "Quantity validation",
    okPages.some((p) => p.snap.otherForms?.length && !p.snap.kind) && "Form checks",
    "Security headers",
  ].filter(Boolean);
  log("S4", "plan_ready", `Planned ${planned.length} check groups from what the site offers: ${planned.join("; ")}`);

  // ---- 2. Page health ------------------------------------------------------------------------
  const broken = all.filter((p) => p.status >= 500 || p.pageErrors.length);
  for (const p of broken) {
    const reproduced = await replay(async () => {
      const ctx = await newContext();
      try {
        const page = await ctx.newPage();
        const seen = watch(page);
        const res = await page.goto(abs(p.path), { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
        await page.waitForTimeout(350);
        return (res && res.status() >= 500) || seen.pageErrors.length > 0;
      } finally {
        await ctx.close().catch(() => {});
      }
    }, true);
    if (reproduced < 2) continue;
    const crash = p.status >= 500 ? `HTTP ${p.status}` : `uncaught error: ${p.pageErrors[0]}`;
    findings.push({
      id: `PAGE-${findings.length + 1}`,
      scenario_id: "test_pages_load",
      title: `Page ${p.path} fails to load (${p.status >= 500 ? `HTTP ${p.status}` : "JavaScript crash"})`,
      journey: "Page health",
      category: "Server Error Invariant",
      severity: "high",
      replay_rate: `${reproduced}/${REPLAYS}`,
      classification_reason: `Opening ${p.path} in a fresh browser gave ${crash}.`,
      anomaly_location: pin("body", `Server or script failure on ${p.path}`, p.path),
      trigger_steps: [`Open a fresh browser (signed out)`, `Go to ${abs(p.path)}`, `Observe ${crash}`],
      expected: `${p.path} loads (status below 500) without uncaught script errors`,
      actual: crash,
      evidence: `${crash}${p.from ? ` â€¢ linked from ${p.from}` : ""}`,
    });
  }
  addTest({
    id: "test_pages_load",
    name: "Pages load without server errors or crashes",
    category: "Page health",
    route: "/",
    status: broken.length && findings.some((f) => f.scenario_id === "test_pages_load") ? "failed" : "passed",
    replay: null,
    note: `${all.length} pages checked`,
    steps: [`Visit each of the ${all.length} discovered pages in a fresh browser`, "Fail on any status 500+ or uncaught JavaScript error"],
    code: `def test_pages_load(page: Page):
    """Every discovered page loads without a 5xx response or an uncaught script error."""
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    for path in ${JSON.stringify(all.filter((p) => p.status > 0 && p.status < 400 || p.status >= 500).map((p) => p.path))}:
        response = page.goto(BASE_URL + path)
        assert response.status < 500, f"{path} returned {response.status}"
    assert not errors, f"Uncaught errors: {errors}"
`,
  });

  // ---- 3. Dead links -----------------------------------------------------------------------------
  const dead = all.filter((p) => p.status === 404 && p.from);
  let deadFound = 0;
  for (const p of dead) {
    const reproduced = await replay(async () => {
      const r = await fetch(abs(p.path), { headers: { "User-Agent": UA } });
      return r.status === 404;
    }, true);
    if (reproduced < 2) continue;
    deadFound++;
    findings.push({
      id: `LINK-${deadFound}`,
      scenario_id: "test_internal_links",
      title: `Broken link "${p.linkText || p.path}" on ${p.from} (HTTP 404)`,
      journey: "Navigation",
      category: "Dead Link Invariant",
      severity: "medium",
      replay_rate: `${reproduced}/${REPLAYS}`,
      classification_reason: `The link on ${p.from} points to ${p.path}, which returns 404 Not Found.`,
      anomaly_location: pin(`a[href='${p.path}']`, `Link to a missing page`, p.from),
      trigger_steps: [`Go to ${abs(p.from)}`, `Click the link "${p.linkText || p.path}"`, `Observe HTTP 404 on ${p.path}`],
      expected: `${p.path} exists`,
      actual: "HTTP 404 Not Found",
      evidence: `GET ${abs(p.path)} â†’ 404 (${reproduced}/${REPLAYS} times)`,
    });
  }
  addTest({
    id: "test_internal_links",
    name: "Internal links resolve",
    category: "Navigation",
    route: "/",
    status: deadFound ? "failed" : "passed",
    replay: null,
    note: deadFound ? `${deadFound} broken link(s)` : `${all.length} links followed`,
    steps: ["Follow every same-site link found while exploring", "Fail on HTTP 404"],
    code: `def test_internal_links(page: Page):
    """Links found on the site do not lead to 404 pages."""
    for path in ${JSON.stringify(all.filter((p) => p.from).map((p) => p.path))}:
        response = page.goto(BASE_URL + path)
        assert response.status != 404, f"Broken link: {path}"
`,
  });

  // ---- 4. Sign-up checks ---------------------------------------------------------------------
  let createdAccount = null;
  if (signupPage) {
    const url = abs(signupPage.path);
    const field = signupPage.snap.emailSelector || EMAIL_SEL;
    if (safeMode) {
      addTest({ id: "test_signup", name: "Sign-up checks", category: "Sign-up", route: signupPage.path, status: "skipped", note: "safe mode: no forms submitted", steps: [], code: "" });
    } else {
      const email = freshEmail();
      const control = await submitCredentials(url, email, TEST_PASSWORD);
      if (!control.ok || !control.accepted) {
        addTest({
          id: "test_signup_valid",
          name: "Sign-up works with valid details",
          category: "Sign-up",
          route: signupPage.path,
          status: "skipped",
          note: control.ok ? "could not complete sign-up (extra steps such as captcha or email confirmation)" : control.reason,
          steps: [`Open ${signupPage.path}`, `Sign up with a new address`],
          code: "",
        });
      } else {
        createdAccount = { username: email, password: TEST_PASSWORD };
        addTest({
          id: "test_signup_valid",
          name: "Sign-up works with valid details",
          category: "Sign-up",
          route: signupPage.path,
          status: "passed",
          note: `landed on ${control.landedOn}`,
          steps: [`Open ${signupPage.path}`, "Enter a new email and a strong password", "Submit", `Expect to leave the form (landed on ${control.landedOn})`],
          code: `def test_signup_valid(page: Page):
    """A new account with valid details is accepted."""
    page.goto(BASE_URL + ${pyStr(signupPage.path)})
    page.fill(${pyStr(field)}, f"drishti.qa.{int(time.time())}@example.com")
    page.fill("input[type='password']", ${pyStr(TEST_PASSWORD)})
    page.press("input[type='password']", "Enter")
    page.wait_for_timeout(1500)
    assert not page.locator("input[type='password']").first.is_visible()
`,
        });

        // Malformed email must be refused.
        const badAttempt = async () => {
          const r = await submitCredentials(url, `drishti-qa-${rand()}-no-at-sign`, TEST_PASSWORD);
          return r.ok && r.accepted && !r.browserRejects;
        };
        const firstBad = await badAttempt();
        const badRep = firstBad ? await replay(badAttempt, true) : 0;
        if (badRep >= 2) {
          findings.push({
            id: "SIGNUP-EMAIL",
            scenario_id: "test_signup_rejects_malformed_email",
            title: "Sign-up accepts an email address without '@'",
            journey: "Sign-up",
            category: "Validation Invariant",
            severity: "medium",
            replay_rate: `${badRep}/${REPLAYS}`,
            classification_reason: "An address with no @ sign was accepted and an account was created.",
            anomaly_location: pin(field, "Email field accepts malformed addresses", signupPage.path),
            trigger_steps: [`Go to ${url}`, `Enter "drishti-qa-â€¦-no-at-sign" as the email`, "Enter a valid password", "Submit"],
            expected: "The form is rejected with an error and the user stays on the sign-up page",
            actual: "The account was created and the browser left the sign-up page",
            evidence: `Accepted in ${badRep}/${REPLAYS} fresh browsers`,
          });
        }
        addTest({
          id: "test_signup_rejects_malformed_email",
          name: "Sign-up rejects a malformed email",
          category: "Sign-up",
          route: signupPage.path,
          status: badRep >= 2 ? "failed" : "passed",
          replay: badRep >= 2 ? `${badRep}/${REPLAYS}` : null,
          steps: [`Open ${signupPage.path}`, "Enter an email without '@'", "Submit", "Expect to stay on the form"],
          code: `def test_signup_rejects_malformed_email(page: Page):
    """An email without '@' must not create an account."""
    page.goto(BASE_URL + ${pyStr(signupPage.path)})
    page.fill(${pyStr(field)}, "drishti-qa-no-at-sign")
    page.fill("input[type='password']", ${pyStr(TEST_PASSWORD)})
    page.press("input[type='password']", "Enter")
    page.wait_for_timeout(1500)
    assert page.locator("input[type='password']").first.is_visible(), "Malformed email was accepted"
`,
        });

        // Registering the same address twice must not crash the server.
        const dupAttempt = async (existing) => {
          const addr = existing || freshEmail();
          if (!existing) {
            const first = await submitCredentials(url, addr, TEST_PASSWORD);
            if (!first.ok || !first.accepted) return false;
          }
          const r = await submitCredentials(url, addr, TEST_PASSWORD);
          return r.ok && r.serverErrors.length > 0 ? r : false;
        };
        const firstDup = await dupAttempt(email);
        const dupRep = firstDup ? await replay(async () => !!(await dupAttempt(null)), true) : 0;
        if (dupRep >= 2) {
          const err = firstDup.serverErrors[0];
          findings.push({
            id: "SIGNUP-DUP",
            scenario_id: "test_signup_duplicate_email",
            title: `Signing up twice with the same email crashes the server (HTTP ${err.status})`,
            journey: "Sign-up",
            category: "Server Error Invariant",
            severity: "high",
            replay_rate: `${dupRep}/${REPLAYS}`,
            classification_reason: `The second sign-up with an existing address returned HTTP ${err.status} instead of a friendly message.`,
            anomaly_location: pin(field, "Duplicate registration causes a server error", signupPage.path),
            trigger_steps: [`Sign up at ${url} with a new email`, "Sign up again with the same email"],
            expected: "A message such as 'already registered' (4xx), no server error",
            actual: `${err.method} ${pathOf(err.url)} returned HTTP ${err.status}`,
            evidence: `${err.method} ${err.url} â†’ ${err.status}`,
          });
        }
        addTest({
          id: "test_signup_duplicate_email",
          name: "Duplicate sign-up is handled without a server error",
          category: "Sign-up",
          route: signupPage.path,
          status: dupRep >= 2 ? "failed" : "passed",
          replay: dupRep >= 2 ? `${dupRep}/${REPLAYS}` : null,
          steps: ["Sign up with a new email", "Sign up again with the same email", "Fail on any 5xx response"],
          code: `def test_signup_duplicate_email(page: Page):
    """A second sign-up with the same email must not cause a 5xx."""
    email = f"drishti.qa.dup.{int(time.time())}@example.com"
    statuses = []
    page.on("response", lambda r: statuses.append(r.status))
    for _ in range(2):
        page.goto(BASE_URL + ${pyStr(signupPage.path)})
        page.fill(${pyStr(field)}, email)
        page.fill("input[type='password']", ${pyStr(TEST_PASSWORD)})
        page.press("input[type='password']", "Enter")
        page.wait_for_timeout(1500)
    assert all(s < 500 for s in statuses), f"Server error on duplicate sign-up: {statuses}"
`,
        });
      }
    }
  }

  // ---- 5. Sign-in checks --------------------------------------------------------------------
  const account = auth?.username && auth?.password ? auth : createdAccount;
  let authRequired = null;
  if (loginPath) {
    const url = abs(loginPath);
    const field = loginPage?.snap?.emailSelector || EMAIL_SEL;
    if (!account) {
      authRequired = {
        login_path: loginPath,
        walled: walled.map((p) => p.path),
        reason: safeMode
          ? "Safe mode does not submit forms, so no account could be created to sign in with."
          : signupPage
          ? "Sign-up could not be completed automatically, so there is no account to sign in with."
          : "This site has a sign-in page and no public sign-up.",
      };
      addTest({
        id: "test_login_valid",
        name: "Sign-in works with a valid account",
        category: "Sign-in",
        route: loginPath,
        status: "skipped",
        note: "needs a test account",
        steps: [],
        code: "",
      });
    } else if (safeMode && account === createdAccount) {
      addTest({ id: "test_login_valid", name: "Sign-in checks", category: "Sign-in", route: loginPath, status: "skipped", note: "safe mode", steps: [], code: "" });
    } else {
      const control = await submitCredentials(url, account.username, account.password);
      const signedIn = control.ok && control.accepted;
      addTest({
        id: "test_login_valid",
        name: "Sign-in works with a valid account",
        category: "Sign-in",
        route: loginPath,
        status: signedIn ? "passed" : "failed",
        note: signedIn ? `landed on ${control.landedOn}` : "the account was refused",
        steps: [`Open ${loginPath}`, `Sign in as ${account === auth ? "the provided test account" : "the account created during sign-up checks"}`, "Expect to leave the sign-in form"],
        code: `def test_login_valid(page: Page):
    """The test account can sign in."""
    page.goto(BASE_URL + ${pyStr(loginPath)})
    page.fill(${pyStr(field)}, os.environ["DRISHTI_TEST_USER"])
    page.fill("input[type='password']", os.environ["DRISHTI_TEST_PASSWORD"])
    page.press("input[type='password']", "Enter")
    page.wait_for_timeout(1500)
    assert not page.locator("input[type='password']").first.is_visible()
`,
      });
      if (!signedIn && account === auth) {
        authRequired = { login_path: loginPath, walled: walled.map((p) => p.path), reason: "The provided test account was refused." };
      }

      const variant = account.username.toUpperCase();
      if (signedIn && variant !== account.username && account.username.includes("@") && !safeMode) {
        const caseAttempt = async () => {
          const r = await submitCredentials(url, variant, account.password);
          return r.ok && !r.accepted;
        };
        const first = await caseAttempt();
        const rep = first ? await replay(caseAttempt, true) : 0;
        if (rep >= 2) {
          findings.push({
            id: "LOGIN-CASE",
            scenario_id: "test_login_email_case_insensitive",
            title: "Sign-in fails when the email is typed in capital letters",
            journey: "Sign-in",
            category: "Logic Invariant",
            severity: "medium",
            replay_rate: `${rep}/${REPLAYS}`,
            classification_reason: "The same account signs in with the original email but is refused when the email is upper-cased.",
            anomaly_location: pin(field, "Email comparison is case-sensitive", loginPath),
            trigger_steps: [`Go to ${url}`, "Sign in with the account's email in capital letters and the correct password"],
            expected: "Email addresses are matched without regard to case; sign-in succeeds",
            actual: "Sign-in is refused; the browser stays on the sign-in form",
            evidence: `Original email: signed in â€¢ Upper-case email: refused (${rep}/${REPLAYS})`,
          });
        }
        addTest({
          id: "test_login_email_case_insensitive",
          name: "Sign-in accepts the email in any letter case",
          category: "Sign-in",
          route: loginPath,
          status: rep >= 2 ? "failed" : "passed",
          replay: rep >= 2 ? `${rep}/${REPLAYS}` : null,
          steps: [`Open ${loginPath}`, "Sign in with the email in capitals", "Expect to be signed in"],
          code: `def test_login_email_case_insensitive(page: Page):
    """Email matching on sign-in ignores letter case."""
    page.goto(BASE_URL + ${pyStr(loginPath)})
    page.fill(${pyStr(field)}, os.environ["DRISHTI_TEST_USER"].upper())
    page.fill("input[type='password']", os.environ["DRISHTI_TEST_PASSWORD"])
    page.press("input[type='password']", "Enter")
    page.wait_for_timeout(1500)
    assert not page.locator("input[type='password']").first.is_visible(), "Upper-case email was refused"
`,
        });
      }

      // Pages that bounced to the sign-in page: re-check them signed in.
      if (signedIn && walled.length) {
        const ctx = await newContext();
        try {
          const ok = await submitCredentials(url, account.username, account.password, ctx);
          if (ok.ok && ok.accepted) {
            const page = await ctx.newPage();
            const seen = watch(page);
            for (const p of walled) {
              const before = seen.pageErrors.length;
              const res = await page.goto(abs(p.path), { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT }).catch(() => null);
              await page.waitForTimeout(300);
              const status = res ? res.status() : -1;
              if (status >= 500 || seen.pageErrors.length > before) {
                findings.push({
                  id: `PAGE-AUTH-${findings.length + 1}`,
                  scenario_id: "test_pages_load_signed_in",
                  title: `Signed-in page ${p.path} fails to load`,
                  journey: "Page health",
                  category: "Server Error Invariant",
                  severity: "high",
                  replay_rate: `1/1`,
                  classification_reason: `As a signed-in user, ${p.path} gave ${status >= 500 ? `HTTP ${status}` : seen.pageErrors[before]}.`,
                  anomaly_location: pin("body", "Failure behind the login wall", p.path),
                  trigger_steps: ["Sign in with the test account", `Go to ${abs(p.path)}`],
                  expected: "The page loads",
                  actual: status >= 500 ? `HTTP ${status}` : seen.pageErrors[before],
                  evidence: `Signed-in GET ${p.path} â†’ ${status}`,
                });
              }
            }
            log("S5", "auth_pages_checked", `Checked ${walled.length} pages behind the sign-in wall: ${walled.map((p) => p.path).join(", ")}`);
          }
        } finally {
          await ctx.close().catch(() => {});
        }
      }
    }
  }

  // ---- 6. Quantity validation -------------------------------------------------------------
  if (qtyPage && !safeMode) {
    const url = abs(qtyPage.path);
    const sel = qtyPage.snap.qtySelector;
    const control = await submitQuantity(url, sel, 1);
    if (!control.ok || !control.accepted) {
      addTest({
        id: "test_quantity_rejects_zero",
        name: "Quantity must be at least 1",
        category: "Forms",
        route: qtyPage.path,
        status: "skipped",
        note: control.ok ? "adding quantity 1 did not reach the server, so the check is inconclusive" : control.reason,
        steps: [],
        code: "",
      });
    } else {
      const zeroAttempt = async () => {
        const r = await submitQuantity(url, sel, 0);
        return r.ok && r.accepted ? r : false;
      };
      const first = await zeroAttempt();
      const rep = first ? await replay(async () => !!(await zeroAttempt()), true) : 0;
      if (rep >= 2) {
        const w = first.writes.find((x) => x.status >= 200 && x.status < 300);
        findings.push({
          id: "QTY-ZERO",
          scenario_id: "test_quantity_rejects_zero",
          title: `Quantity 0 is accepted by "${first.label || "add"}"`,
          journey: "Forms",
          category: "Validation Invariant",
          severity: "medium",
          replay_rate: `${rep}/${REPLAYS}`,
          classification_reason: `Setting ${sel} to 0 and pressing "${first.label}" was accepted by the server.`,
          anomaly_location: pin(sel, "Quantity field allows 0", qtyPage.path),
          trigger_steps: [`Go to ${url}`, `Set ${sel} to 0`, `Click "${first.label}"`],
          expected: "The server rejects quantities below 1 (4xx) and shows an error",
          actual: `${w.method} ${pathOf(w.url)} returned HTTP ${w.status}`,
          evidence: `${w.method} ${w.url} â†’ ${w.status} with quantity 0`,
        });
      }
      addTest({
        id: "test_quantity_rejects_zero",
        name: "Quantity must be at least 1",
        category: "Forms",
        route: qtyPage.path,
        status: rep >= 2 ? "failed" : "passed",
        replay: rep >= 2 ? `${rep}/${REPLAYS}` : null,
        steps: [`Open ${qtyPage.path}`, `Set ${sel} to 0`, `Click "${control.label}"`, "Expect the server to refuse it"],
        code: `def test_quantity_rejects_zero(page: Page):
    """A quantity of 0 must be refused by the server."""
    statuses = []
    page.on("response", lambda r: statuses.append(r.status) if r.request.method != "GET" else None)
    page.goto(BASE_URL + ${pyStr(qtyPage.path)})
    page.fill(${pyStr(sel)}, "0")
    page.get_by_role("button", name=re.compile(${pyStr(control.label)}, re.I)).first.click()
    page.wait_for_timeout(1500)
    assert not any(200 <= s < 300 for s in statuses), "Quantity 0 was accepted"
`,
      });
    }
  }

  // ---- 6b. Other forms (contact, enquiry, newsletter) -----------------------------------------
  const formTargets = [];
  for (const p of okPages) {
    if (p.snap.kind) continue; // sign-up and sign-in pages have their own checks
    for (const f of p.snap.otherForms || []) {
      if (formTargets.length < 2) formTargets.push({ path: p.path, ...f });
    }
  }
  for (const [n, ft] of formTargets.entries()) {
    const url = abs(ft.path);
    const suffix = n ? `_${n + 1}` : "";
    const where = `the "${ft.label}" form on ${ft.path}`;
    const pyForm = `page.locator("form").nth(${ft.index})`;
    if (safeMode) {
      addTest({
        id: `test_form_checks${suffix}`,
        name: `Form checks (${ft.path})`,
        category: "Forms",
        route: ft.path,
        status: "skipped",
        note: "safe mode: no forms submitted",
        steps: [],
        code: "",
      });
      continue;
    }
    const formFinding = (scenario, title, severity, reproduced, r, extra) => {
      findings.push({
        id: `FORM${n + 1}-${scenario.replace("test_form_", "").replace("test_", "").toUpperCase()}`,
        scenario_id: scenario,
        title,
        journey: "Forms",
        category: "Form Contract",
        severity,
        replay_rate: `${reproduced}/${REPLAYS}`,
        classification_reason: `${title} (${where}).`,
        anomaly_location: pin(`form >> nth=${ft.index}`, title, ft.path),
        trigger_steps: [`Go to ${url}`, ...extra.steps],
        expected: extra.expected,
        actual: extra.actual,
        evidence: r.writes?.length ? r.writes.map((w) => `${w.method} ${pathOf(w.url)} → ${w.status}`).join(" • ") : extra.evidence || "No request; page state observed in the browser",
      });
    };

    // 1. Empty submit must not be accepted.
    const emptyAttempt = async () => {
      const r = await submitForm(url, ft.index, "empty");
      return r.ok && r.accepted ? r : false;
    };
    const emptyFirst = await emptyAttempt();
    const emptyRep = emptyFirst ? await replay(async () => !!(await emptyAttempt()), true) : 0;
    if (emptyRep >= 2) {
      formFinding("test_form_required", `Empty ${ft.label} form is accepted`, "medium", emptyRep, emptyFirst, {
        steps: ["Leave every field empty", "Submit"],
        expected: "Submission is blocked with a message about the required fields",
        actual: "The empty form was accepted",
      });
    }
    addTest({
      id: `test_form_required${suffix}`,
      name: `Empty form is refused (${ft.path})`,
      category: "Forms",
      route: ft.path,
      status: emptyRep >= 2 ? "failed" : "passed",
      replay: emptyRep >= 2 ? `${emptyRep}/${REPLAYS}` : null,
      steps: [`Open ${ft.path}`, `Submit ${where} with every field empty`, "Expect it to be blocked"],
      code: `def test_form_required${suffix}(page: Page):
    """An empty form must not be accepted."""
    writes = []
    page.on("response", lambda r: writes.append(r.status) if r.request.method != "GET" else None)
    page.goto(BASE_URL + ${pyStr(ft.path)})
    form = ${pyForm}
    form.locator("button[type='submit'], input[type='submit'], button:not([type])").first.click()
    page.wait_for_timeout(1500)
    assert not any(200 <= s < 400 for s in writes), "Empty form was accepted"
`,
    });

    // 2. A malformed email must be refused.
    if (ft.hasEmail) {
      const badAttempt = async () => {
        const r = await submitForm(url, ft.index, "bad_email");
        return r.ok && r.accepted ? r : false;
      };
      const badFirst = await badAttempt();
      const badRep = badFirst ? await replay(async () => !!(await badAttempt()), true) : 0;
      if (badRep >= 2) {
        formFinding("test_form_email", `${ft.label} form accepts an email without '@'`, "medium", badRep, badFirst, {
          steps: ["Fill the form with valid values", 'Enter "drishti-qa-no-at-sign" as the email', "Submit"],
          expected: "The form is refused with an email error",
          actual: "The form was accepted with a malformed email",
        });
      }
      addTest({
        id: `test_form_email${suffix}`,
        name: `Form rejects a malformed email (${ft.path})`,
        category: "Forms",
        route: ft.path,
        status: badRep >= 2 ? "failed" : "passed",
        replay: badRep >= 2 ? `${badRep}/${REPLAYS}` : null,
        steps: [`Open ${ft.path}`, "Fill the form, with an email without '@'", "Submit", "Expect it to be refused"],
        code: "",
      });
    }

    // Control: a normal valid submission. Used by checks 3 and 4.
    const valid = await submitForm(url, ft.index, "valid");

    // 3. Odd input must not crash the server (hidden failure). Only meaningful when a normal
    // submission does not itself return a server error.
    const oddAttempt = async () => {
      const r = await submitForm(url, ft.index, "odd");
      return r.ok && r.serverErrors.length ? r : false;
    };
    const controlClean = valid.ok && !valid.serverErrors.length;
    const oddFirst = controlClean ? await oddAttempt() : false;
    const oddRep = oddFirst ? await replay(async () => !!(await oddAttempt()), true) : 0;
    if (oddRep >= 2) {
      const err = oddFirst.serverErrors[0];
      formFinding("test_odd_input", `${ft.label} form crashes on symbols, emoji or long text (HTTP ${err.status})`, "high", oddRep, oddFirst, {
        steps: ["Fill text fields with symbols ( ) [ ] * + ?, emoji and 5,000 characters", "Submit"],
        expected: "The server accepts or refuses the input cleanly (no 5xx)",
        actual: `${err.method} ${pathOf(err.url)} returned HTTP ${err.status}`,
        evidence: `${err.method} ${err.url} → ${err.status}`,
      });
    }
    addTest({
      id: `test_odd_input${suffix}`,
      name: `Form survives symbols, emoji and long text (${ft.path})`,
      category: "Hidden failures",
      route: ft.path,
      status: !controlClean ? "skipped" : oddRep >= 2 ? "failed" : "passed",
      replay: oddRep >= 2 ? `${oddRep}/${REPLAYS}` : null,
      note: !controlClean ? "a normal submission already fails on the server, so this is inconclusive" : null,
      steps: [`Open ${ft.path}`, "Fill text fields with symbols, emoji and 5,000 characters", "Submit", "Fail on any 5xx"],
      code: "",
    });

    // 4. A valid submission must tell the user something happened (hidden failure).
    if (!valid.ok || !valid.accepted) {
      addTest({
        id: `test_form_feedback${suffix}`,
        name: `Form confirms a valid submission (${ft.path})`,
        category: "Hidden failures",
        route: ft.path,
        status: "skipped",
        note: valid.ok ? "a valid submission was not accepted (captcha or extra steps), so this is inconclusive" : valid.reason,
        steps: [],
        code: "",
      });
    } else {
      let fbRep = 0;
      if (!valid.feedback) {
        fbRep = await replay(async () => {
          const r = await submitForm(url, ft.index, "valid");
          return r.ok && r.accepted && !r.feedback;
        }, true);
        if (fbRep >= 2) {
          formFinding("test_form_feedback", `${ft.label} form gives no confirmation after sending`, "low", fbRep, valid, {
            steps: ["Fill the form with valid values", "Submit"],
            expected: "A success message, thank-you page or other visible confirmation",
            actual: "The request succeeded but the page did not change",
          });
        }
      }
      addTest({
        id: `test_form_feedback${suffix}`,
        name: `Form confirms a valid submission (${ft.path})`,
        category: "Hidden failures",
        route: ft.path,
        status: fbRep >= 2 ? "failed" : "passed",
        replay: fbRep >= 2 ? `${fbRep}/${REPLAYS}` : null,
        note: valid.dialog ? `confirmation shown as a pop-up: "${valid.dialog.slice(0, 60)}"` : null,
        steps: [`Open ${ft.path}`, "Fill the form with valid values", "Submit", "Expect a visible confirmation"],
        code: "",
      });
    }
    log("S5", "form_checked", `Checked ${where}`);
  }

  // ---- 6c. Multi-step flows (wizards, checkouts, bookings, online tests) --------------------
  await runFlowChecks(targetUrl, { safeMode, log, addTest, findings });

  // ---- 7. Security headers (hardening note, low severity) ------------------------------------
  try {
    const r = await fetch(targetUrl, { headers: { "User-Agent": UA } });
    const missing = ["content-security-policy", "x-content-type-options"].filter((h) => !r.headers.get(h));
    if (missing.length) {
      findings.push({
        id: "HEADERS",
        scenario_id: "test_security_headers",
        title: `Missing security headers: ${missing.join(", ")}`,
        journey: "Hardening",
        category: "Security Invariant",
        severity: "low",
        replay_rate: "1/1",
        classification_reason: "Recommended response headers are not set. This is hardening advice, not a functional bug.",
        anomaly_location: pin("HTTP response headers", "Missing headers", "/"),
        trigger_steps: [`GET ${targetUrl}`, "Inspect the response headers"],
        expected: missing.map((h) => `${h} is set`).join("; "),
        actual: `${missing.join(", ")} absent`,
        evidence: `Headers present: ${Array.from(r.headers.keys()).slice(0, 8).join(", ")}`,
      });
    }
    addTest({
      id: "test_security_headers",
      name: "Security headers are set",
      category: "Hardening",
      route: "/",
      status: missing.length ? "warning" : "passed",
      note: missing.length ? `missing ${missing.join(", ")}` : null,
      steps: ["Request the home page", "Check Content-Security-Policy and X-Content-Type-Options"],
      code: `def test_security_headers(page: Page):
    """Recommended security headers are present."""
    response = page.goto(BASE_URL)
    for header in ["content-security-policy", "x-content-type-options"]:
        assert header in response.headers, f"Missing {header}"
`,
    });
  } catch (e) {}

  return { tests, findings, pages: all.map((p) => p.path), authRequired };
}

// Checks that need the flow walker (flow.js). A flow is followed by pressing forward buttons
// (Start, Continue, Next, Submit...) from the start URL; it needs at least 3 steps to count.
async function runFlowChecks(targetUrl, { safeMode, log, addTest, findings }) {
  const FLOW_TESTS = [
    ["test_visible_text", "Every step's text is readable", "Flows"],
    ["test_editable_fields", "Fields accept typing", "Flows"],
    ["test_step_memory", "Answers survive Next and Previous", "Flows"],
    ["test_refresh_memory", "Saved answers survive a page refresh", "Hidden failures"],
    ["test_flow_odd_input", "Steps save symbols, emoji and long text", "Hidden failures"],
    ["test_double_submit", "Double-click on the final button submits once", "Hidden failures"],
  ];
  const skipAll = (note) => FLOW_TESTS.forEach(([id, name, category]) => addTest({ id, name, category, route: "/", status: "skipped", note, steps: [], code: "" }));
  if (safeMode) return skipAll("safe mode: flows are not walked");

  log("S5", "flow_started", `Walking the main flow from ${pathOf(targetUrl) || "/"} by pressing its forward buttons`);
  let survey;
  try {
    survey = await surveyFlow(targetUrl);
  } catch (e) {
    return skipAll(`could not walk the flow: ${e.message.split("\n")[0]}`);
  }
  const steps = survey.steps;
  if (steps.length < 3) return; // no multi-step flow on this site: these checks do not apply
  log("S5", "flow_mapped", `Flow has ${steps.length} steps: ${steps.map((s) => s.action || "(end)").join(" → ")}`);
  const stepName = (s) => `step ${s.index + 1} (${s.path}${s.index ? `, after "${steps[s.index - 1]?.action}"` : ""})`;
  const howToReach = (s) => [`Open ${targetUrl}`, ...steps.slice(0, s.index).map((x) => `Fill the step and press "${x.action}"`)];

  // Per-step scans: invisible text and fields that ignore typing.
  for (const [kind, id, name, severity] of [
    ["invisible", "test_visible_text", "Every step's text is readable", "high"],
    ["uneditable", "test_editable_fields", "Fields accept typing", "high"],
  ]) {
    const first = survey.problems[kind][0];
    let rep = 0;
    if (first) rep = await replay(() => rescanStep(targetUrl, first.step, kind), true);
    if (rep >= 2) {
      const s = steps[first.step];
      const isInvisible = kind === "invisible";
      findings.push({
        id: isInvisible ? "FLOW-INVISIBLE" : "FLOW-UNEDITABLE",
        scenario_id: id,
        title: isInvisible
          ? `Text is practically invisible on ${stepName(s)}: "${first.text.slice(0, 50)}"`
          : `"${first.label || first.selector}" ignores typing on ${stepName(s)}`,
        journey: "Flows",
        category: isInvisible ? "Visibility Invariant" : "Input Contract",
        severity,
        replay_rate: `${rep}/${REPLAYS}`,
        classification_reason: isInvisible
          ? `Text contrast is ${first.ratio}:1 against its background (readable text needs at least 4.5:1).`
          : "The field looks editable, but typed characters never appear in it.",
        anomaly_location: pin(first.selector, isInvisible ? "Invisible text" : "Field ignores typing", s.path),
        trigger_steps: [...howToReach(s), isInvisible ? "Read the step's text" : `Click "${first.label || first.selector}" and type`],
        expected: isInvisible ? "All text is clearly readable" : "Typed characters appear in the field",
        actual: isInvisible ? `Contrast ratio ${first.ratio}:1; the text cannot be seen` : "Nothing is typed into the field",
        evidence: isInvisible ? `${first.selector}: "${first.text.slice(0, 60)}" at ${first.ratio}:1` : `${first.selector} unchanged after typing "qa"`,
        screenshot: survey.problems[`${kind}Shot`] || null,
      });
    }
    addTest({
      id,
      name,
      category: "Flows",
      route: first ? steps[first.step].path : "/",
      status: rep >= 2 ? "failed" : "passed",
      replay: rep >= 2 ? `${rep}/${REPLAYS}` : null,
      note: `${steps.length} steps checked`,
      steps: ["Walk the flow step by step", kind === "invisible" ? "Measure text contrast on every step" : "Type into every editable field on every step"],
      code: "",
    });
  }

  // Memory across Next/Previous, and across a refresh.
  const memStep = steps.find((s, i) => i > 0 && s.fields.answer && steps[i + 1]?.hasBack && s.action);
  for (const [id, name, reload, category] of [
    ["test_step_memory", "Answers survive Next and Previous", false, "Flows"],
    ["test_refresh_memory", "Saved answers survive a page refresh", true, "Hidden failures"],
  ]) {
    if (!memStep) {
      addTest({ id, name, category, route: "/", status: "skipped", note: "no step with a Previous or Back control", steps: [], code: "" });
      continue;
    }
    const attempt = async () => {
      const r = await memoryCheck(targetUrl, memStep.index, memStep.fields.answer, { reload });
      return r.ok && !r.kept ? r : r.ok ? false : r;
    };
    const first = await attempt();
    if (first && first.ok === false) {
      addTest({ id, name, category, route: memStep.path, status: "skipped", note: first.reason, steps: [], code: "" });
      continue;
    }
    const rep = first ? await replay(async () => !!(await attempt())?.ok, true) : 0;
    if (rep >= 2) {
      findings.push({
        id: reload ? "FLOW-REFRESH" : "FLOW-MEMORY",
        scenario_id: id,
        title: reload
          ? `Saved answer is lost after a page refresh (${stepName(memStep)})`
          : `Answer is lost after "${memStep.action}" then Previous (${stepName(memStep)})`,
        journey: "Flows",
        category: "State Invariant",
        severity: "high",
        replay_rate: `${rep}/${REPLAYS}`,
        classification_reason: reload
          ? "An answer saved before the refresh is empty when the user goes back to it."
          : "An answer saved with the forward button is empty when the user goes back to it.",
        anomaly_location: pin(memStep.fields.answer.selector, "Answer not kept", memStep.path),
        trigger_steps: [
          ...howToReach(memStep),
          "Answer this step",
          `Press "${memStep.action}"`,
          ...(reload ? ["Refresh the page"] : []),
          "Press Previous",
        ],
        expected: "The answer is still selected or filled in",
        actual: `The answer is empty (expected "${first.expected}", found "${first.actual ?? ""}")`,
        evidence: `${memStep.fields.answer.selector}: expected "${first.expected}", found "${first.actual ?? ""}"`,
        screenshot: first.shot || null,
      });
    }
    addTest({
      id,
      name,
      category,
      route: memStep.path,
      status: rep >= 2 ? "failed" : "passed",
      replay: rep >= 2 ? `${rep}/${REPLAYS}` : null,
      steps: ["Answer a step", `Press "${memStep.action}"`, ...(reload ? ["Refresh the page"] : []), "Press Previous", "Expect the answer to still be there"],
      code: "",
    });
  }

  // Odd input through the whole flow.
  const oddFirst = await oddInputFlow(targetUrl, 1).catch(() => null);
  const oddRep = oddFirst ? await replay(async () => !!(await oddInputFlow(targetUrl, 1).catch(() => null)), true) : 0;
  if (oddRep >= 2) {
    const s = steps[oddFirst.step] || { index: oddFirst.step, path: oddFirst.path };
    findings.push({
      id: "FLOW-ODD",
      scenario_id: "test_flow_odd_input",
      title: `Saving symbols, quotes or emoji crashes the server on ${stepName(s)} (HTTP ${oddFirst.error.status})`,
      journey: "Flows",
      category: "Server Error Invariant",
      severity: "high",
      replay_rate: `${oddRep}/${REPLAYS}`,
      classification_reason: "A text answer containing quotes, symbols and emoji returned a server error.",
      anomaly_location: pin(s.fields?.answer?.selector || "body", "Input crashes the save", s.path),
      trigger_steps: [...howToReach(s), "Type text containing ( ) [ ] * + ? \\ ' \" < > and emoji", `Press "${s.action || "the forward button"}"`],
      expected: "The text is saved, or refused with a message",
      actual: `${oddFirst.error.method} ${pathOf(oddFirst.error.url)} returned HTTP ${oddFirst.error.status}`,
      evidence: `${oddFirst.error.method} ${oddFirst.error.url} → ${oddFirst.error.status}`,
      screenshot: oddFirst.shot || null,
    });
  }
  addTest({
    id: "test_flow_odd_input",
    name: "Steps save symbols, emoji and long text",
    category: "Hidden failures",
    route: oddFirst ? oddFirst.path : steps[1]?.path || "/",
    status: oddRep >= 2 ? "failed" : "passed",
    replay: oddRep >= 2 ? `${oddRep}/${REPLAYS}` : null,
    steps: ["Walk the flow typing symbols, quotes, emoji and long text into every text field", "Fail on any 5xx"],
    code: "",
  });

  // Double-click on the button that ends the flow.
  const last = steps[steps.length - 1];
  const finalStep = !last.action ? steps[steps.length - 2] : null;
  if (!finalStep?.action) {
    addTest({ id: "test_double_submit", name: "Double-click on the final button submits once", category: "Hidden failures", route: "/", status: "skipped", note: "the flow has no final button", steps: [], code: "" });
  } else {
    const dblAttempt = async () => {
      const r = await doubleSubmitCheck(targetUrl, finalStep.index);
      return r.repeated ? { ...r.repeated, shot: r.shot } : null;
    };
    const firstDbl = await dblAttempt().catch(() => null);
    const dblRep = firstDbl ? await replay(async () => !!(await dblAttempt().catch(() => null)), true) : 0;
    if (dblRep >= 2) {
      findings.push({
        id: "FLOW-DOUBLE",
        scenario_id: "test_double_submit",
        title: `Double-clicking "${finalStep.action}" submits twice`,
        journey: "Flows",
        category: "Idempotency Invariant",
        severity: "high",
        replay_rate: `${dblRep}/${REPLAYS}`,
        classification_reason: `A double-click on "${finalStep.action}" sent ${firstDbl.request} ${firstDbl.times} times and the server accepted each.`,
        anomaly_location: pin(`button:has-text("${finalStep.action}")`, "Submits twice", finalStep.path),
        trigger_steps: [...howToReach(finalStep), `Double-click "${finalStep.action}"`],
        expected: "One submission: the button is disabled or the server refuses the repeat",
        actual: `${firstDbl.request} accepted ${firstDbl.times} times`,
        evidence: `${firstDbl.request} × ${firstDbl.times}, all 2xx`,
        screenshot: firstDbl.shot || null,
      });
    }
    addTest({
      id: "test_double_submit",
      name: "Double-click on the final button submits once",
      category: "Hidden failures",
      route: finalStep.path,
      status: dblRep >= 2 ? "failed" : "passed",
      replay: dblRep >= 2 ? `${dblRep}/${REPLAYS}` : null,
      steps: [`Walk to the last step`, `Double-click "${finalStep.action}"`, "Expect a single accepted request"],
      code: "",
    });
  }
}

/** Build one runnable pytest file from the named tests. */
export function buildPytestFile(targetUrl, tests) {
  const runnable = tests.filter((t) => t.code);
  return `"""
DRISHTI AI regression tests for ${targetUrl}
Generated from ${runnable.length} named checks. Run: pytest -v this_file.py
Sign-in tests read DRISHTI_TEST_USER and DRISHTI_TEST_PASSWORD from the environment.
"""
import os
import re
import time

import pytest
from playwright.sync_api import Page

BASE_URL = ${JSON.stringify(new URL(targetUrl).origin)}


${runnable.map((t) => t.code).join("\n\n")}`;
}
