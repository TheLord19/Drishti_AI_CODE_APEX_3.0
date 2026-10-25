// Generic behaviour checks. Everything here is learned from the target in a real browser
// (pages, links, forms, fields); there are no site names, routes or known-bug lists.
// Each failing check is replayed in fresh browser contexts and reports how often it reproduced.
import { getBrowser } from "./playwright-service";

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
  return {
    title: document.title,
    links,
    getForms,
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

async function replay(attempt, first) {
  let reproduced = first ? 1 : 0;
  for (let i = 1; i < REPLAYS; i++) {
    try {
      if (await attempt()) reproduced++;
    } catch (e) {}
  }
  return reproduced;
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
            anomaly_location: pin("form", "Duplicate registration causes a server error", signupPage.path),
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
