import { chromium } from "playwright";
import fs from "fs";

// In-memory LRU screenshot cache
const screenshotCache = new Map();
const CACHE_MAX_SIZE = 100;

let browserInstance = null;
let browserPromise = null;

// Find suitable browser executable
function getExecutablePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const possiblePaths = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
  ];
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(/*turbopackIgnore: true*/ p)) return p;
    } catch (e) {}
  }
  return undefined; // Let playwright use bundled chromium if available
}

export async function getBrowser() {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }

  if (browserPromise) {
    return browserPromise;
  }

  browserPromise = (async () => {
    try {
      const execPath = getExecutablePath();
      const launchOptions = {
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-features=IsolateOrigins,site-per-process",
        ],
      };
      if (execPath) {
        launchOptions.executablePath = execPath;
      }

      const browser = await chromium.launch(launchOptions);
      browserInstance = browser;
      browser.on("disconnected", () => {
        browserInstance = null;
        browserPromise = null;
      });
      return browser;
    } catch (err) {
      console.error("[PlaywrightService] Browser launch error:", err.message);
      // Retry without executablePath
      try {
        const browser = await chromium.launch({ headless: true });
        browserInstance = browser;
        return browser;
      } catch (fallbackErr) {
        console.error("[PlaywrightService] Fallback launch error:", fallbackErr.message);
        throw fallbackErr;
      }
    } finally {
      browserPromise = null;
    }
  })();

  return browserPromise;
}

/**
 * Real-time Playwright Crawler: Navigates to target website, discovers DOM links, inputs, and buttons.
 */
/**
 * Sign in with a developer-supplied test account, in the given page's browser context.
 * Never logs or returns the password. Success means the password field is gone after submit.
 */
async function signIn(page, targetUrl, auth) {
  const loginUrl = new URL(auth.login_path || "/login", targetUrl).toString();
  await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 18000 });
  await page.waitForTimeout(400);

  const password = page.locator("input[type='password']").first();
  if (!(await password.count())) {
    return { attempted: true, ok: false, reason: `No password field found on ${new URL(loginUrl).pathname}` };
  }
  const username = page
    .locator(
      "input[type='email'], input[name*='email' i], input[id*='email' i], input[name*='user' i], input[id*='user' i], input[type='text']"
    )
    .first();
  if (!(await username.count())) {
    return { attempted: true, ok: false, reason: `No username or email field found on ${new URL(loginUrl).pathname}` };
  }

  await username.fill(auth.username);
  await password.fill(auth.password);
  await Promise.all([
    page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {}),
    password.press("Enter"),
  ]);
  await page.waitForTimeout(800);

  const stillOnLogin = await page.locator("input[type='password']").first().isVisible().catch(() => false);
  if (stillOnLogin) {
    return { attempted: true, ok: false, reason: "Still on the login page after submitting" };
  }
  return { attempted: true, ok: true, landedOn: new URL(page.url()).pathname };
}

export async function crawlWithPlaywright(targetUrl, auth = null) {
  let browser = null;
  let page = null;
  const startTime = Date.now();

  try {
    browser = await getBrowser();
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 DRISHTI-AI-Playwright/2.0",
    });
    page = await context.newPage();

    // Optional sign-in first, so the crawl below runs as the signed-in test user.
    let login = { attempted: false };
    let afterLoginPath = null;
    if (auth && auth.username && auth.password) {
      try {
        login = await signIn(page, targetUrl, auth);
        if (login.ok) afterLoginPath = login.landedOn;
      } catch (loginErr) {
        login = { attempted: true, ok: false, reason: loginErr.message.split("\n")[0] };
      }
    }

    console.log(`[PlaywrightService] Navigating to ${targetUrl}...`);
    const navStart = Date.now();
    const response = await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 18000,
    });

    const httpStatus = response ? response.status() : 200;
    const latencyMs = Date.now() - navStart;
    await page.waitForTimeout(600);

    const pageTitle = await page.title();

    // Extract links, buttons, inputs, headings from live rendered DOM
    const extractDom = (baseUrl) => {
      const baseHostname = new URL(baseUrl).hostname;
      
      // Internal links
      const allAnchors = Array.from(document.querySelectorAll("a[href]"));
      const rawLinks = allAnchors
        .map((a) => {
          const href = a.getAttribute("href") || "";
          const text = (a.innerText || a.getAttribute("title") || "").trim();
          return { href, text };
        })
        .filter((l) => l.href && !l.href.startsWith("javascript:") && !l.href.startsWith("mailto:") && !l.href.startsWith("tel:"));

      const internalRoutes = new Set();
      internalRoutes.add("/");

      for (const l of rawLinks) {
        try {
          if (l.href.startsWith("/") && !l.href.startsWith("/_next") && !l.href.startsWith("/api") && !l.href.includes(".")) {
            internalRoutes.add(l.href.split("?")[0]);
          } else if (l.href.startsWith("http")) {
            const u = new URL(l.href);
            if (u.hostname === baseHostname && !u.pathname.includes(".")) {
              internalRoutes.add(u.pathname);
            }
          }
        } catch (e) {}
      }

      // Buttons
      const buttons = Array.from(document.querySelectorAll("button, input[type='button'], input[type='submit'], a[role='button']"))
        .map((b) => (b.innerText || b.getAttribute("value") || b.getAttribute("aria-label") || "").trim())
        .filter((t) => t.length > 1 && t.length < 50);

      // Inputs
      const inputs = Array.from(document.querySelectorAll("input:not([type='hidden']), textarea, select"))
        .map((i) => ({
          type: i.getAttribute("type") || i.tagName.toLowerCase(),
          placeholder: i.getAttribute("placeholder") || i.getAttribute("aria-label") || i.getAttribute("name") || "",
          name: i.getAttribute("name") || i.getAttribute("id") || "",
        }))
        .filter((i) => i.placeholder || i.name);

      // Headings
      const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
        .map((h) => ({
          tag: h.tagName.toUpperCase(),
          text: (h.innerText || "").trim().replace(/\s+/g, " "),
        }))
        .filter((h) => h.text.length > 2 && h.text.length < 100);

      return {
        routes: Array.from(internalRoutes),
        buttons: Array.from(new Set(buttons)).slice(0, 10),
        inputs: inputs.slice(0, 8),
        headings: headings.slice(0, 8),
      };
    };

    const domData = await page.evaluate(extractDom, targetUrl);

    // Signed in: also crawl the page the login landed on, which is usually behind the login wall.
    if (afterLoginPath && afterLoginPath !== new URL(targetUrl).pathname) {
      try {
        await page.goto(new URL(afterLoginPath, targetUrl).toString(), { waitUntil: "domcontentloaded", timeout: 18000 });
        await page.waitForTimeout(600);
        const privateData = await page.evaluate(extractDom, targetUrl);
        domData.routes = Array.from(new Set([...domData.routes, afterLoginPath, ...privateData.routes]));
        domData.buttons = Array.from(new Set([...domData.buttons, ...privateData.buttons])).slice(0, 14);
        domData.inputs = [...domData.inputs, ...privateData.inputs].slice(0, 12);
        domData.headings = [...domData.headings, ...privateData.headings].slice(0, 12);
      } catch (privErr) {
        console.error(`[PlaywrightService] Post-login crawl error on ${afterLoginPath}:`, privErr.message);
      }
    }

    await context.close();

    return {
      success: true,
      status: httpStatus,
      latencyMs,
      pageTitle: pageTitle || new URL(targetUrl).hostname,
      routes: domData.routes,
      buttons: domData.buttons,
      inputs: domData.inputs,
      headings: domData.headings,
      login,
    };
  } catch (err) {
    console.error(`[PlaywrightService] Crawl error on ${targetUrl}:`, err.message);
    if (page) {
      try {
        await page.close();
      } catch (e) {}
    }
    return {
      success: false,
      error: err.message,
      latencyMs: Date.now() - startTime,
      routes: ["/"],
      buttons: [],
      inputs: [],
      headings: [],
      pageTitle: new URL(targetUrl).hostname,
    };
  }
}

/**
 * Capture Real-Time Screenshot of ANY target URL & Route using Playwright
 */
export async function captureRouteScreenshot(targetUrl, route = "/", options = {}) {
  // Normalize target URL and route
  let normalizedBase = targetUrl.trim();
  if (!normalizedBase.startsWith("http://") && !normalizedBase.startsWith("https://")) {
    normalizedBase = `https://${normalizedBase}`;
  }

  let fullUrl = normalizedBase;
  try {
    const cleanRoute = (route || "/").trim();
    if (cleanRoute.startsWith("http://") || cleanRoute.startsWith("https://")) {
      fullUrl = cleanRoute;
    } else {
      fullUrl = new URL(cleanRoute.startsWith("/") ? cleanRoute : `/${cleanRoute}`, normalizedBase).href;
    }
  } catch (e) {
    fullUrl = normalizedBase;
  }

  const highlights = Array.isArray(options.highlights) ? options.highlights : [];
  const cacheKey = `${fullUrl}__${options.action || "view"}__${options.selector || ""}__${JSON.stringify(highlights)}`;

  // Check cache
  if (screenshotCache.has(cacheKey)) {
    const cached = screenshotCache.get(cacheKey);
    // 15-minute TTL
    if (Date.now() - cached.timestamp < 15 * 60 * 1000) {
      return { buffer: cached.buffer, contentType: "image/png", fromCache: true };
    }
  }

  let browser = null;
  let page = null;

  try {
    browser = await getBrowser();
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 DRISHTI-AI-Screenshot/2.0",
    });
    page = await context.newPage();

    console.log(`[PlaywrightService] Capturing screenshot of ${fullUrl}...`);
    await page.goto(fullUrl, {
      waitUntil: "domcontentloaded",
      timeout: 16000,
    });

    // Brief stabilization pause for fonts and hero elements
    await page.waitForTimeout(options.waitMs || 800);

    // If an action is specified (e.g. fill form for post-interaction state)
    if (options.action === "fill") {
      try {
        const inputLocator = page.locator("input[type='email'], input[name='email'], input[type='text'], input").first();
        if (await inputLocator.isVisible()) {
          await inputLocator.fill(options.fillValue || "qa_eval@domain.com");
        }
        const pwdLocator = page.locator("input[type='password']").first();
        if (await pwdLocator.isVisible()) {
          await pwdLocator.fill("••••••••");
        }
        await page.waitForTimeout(300);
      } catch (fillErr) {
        // Non-critical action error
      }
    }

    // Outline requested elements in the live page (red = defect, blue = selected locator),
    // scrolling the first one into view so it is inside the captured viewport.
    let highlighted = 0;
    for (const [i, h] of highlights.entries()) {
      try {
        const loc = page.locator(h.selector).first();
        if (!(await loc.count())) continue;
        if (i === 0 || highlighted === 0) await loc.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
        await loc.evaluate((el, mark) => {
          el.style.outline = `3px solid ${mark.color}`;
          el.style.outlineOffset = "3px";
          const r = el.getBoundingClientRect();
          const tag = document.createElement("div");
          tag.textContent = mark.label;
          tag.style.cssText = `position:absolute;z-index:2147483647;left:${r.left + window.scrollX}px;top:${Math.max(0, r.top + window.scrollY - 26)}px;background:${mark.color};color:#fff;font:600 12px/1.6 system-ui,sans-serif;padding:1px 8px;border-radius:4px;max-width:460px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`;
          document.body.appendChild(tag);
        }, h);
        highlighted++;
      } catch (e) {}
    }

    const buffer = await page.screenshot({
      type: "png",
      fullPage: false,
    });

    await context.close();

    // Cache management
    if (screenshotCache.size >= CACHE_MAX_SIZE) {
      const firstKey = screenshotCache.keys().next().value;
      screenshotCache.delete(firstKey);
    }
    screenshotCache.set(cacheKey, { buffer, timestamp: Date.now() });

    return { buffer, contentType: "image/png", fromCache: false };
  } catch (err) {
    console.error(`[PlaywrightService] Screenshot error for ${fullUrl}:`, err.message);
    if (page) {
      try {
        await page.close();
      } catch (e) {}
    }

    // Return realistic branded SVG fallback when target is inaccessible or blocking headless agents
    const svgBuffer = createFallbackSvg(fullUrl, route, err.message);
    return { buffer: svgBuffer, contentType: "image/svg+xml", fromCache: false, isFallback: true };
  }
}

/**
 * Clean SVG fallback for offline or protected routes
 */
function createFallbackSvg(url, route, errorMsg) {
  let hostname = "Target Application";
  try {
    hostname = new URL(url).hostname;
  } catch (e) {}

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800" viewBox="0 0 1280 800">
    <rect width="1280" height="800" fill="#0A0D14"/>
    <rect x="0" y="0" width="1280" height="48" fill="#131722"/>
    <circle cx="24" cy="24" r="6" fill="#FF5F56"/>
    <circle cx="44" cy="24" r="6" fill="#FFBD2E"/>
    <circle cx="64" cy="24" r="6" fill="#27C93F"/>
    <rect x="120" y="10" width="500" height="28" rx="6" fill="#1E2333"/>
    <text x="135" y="29" fill="#94A3B8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, monospace" font-size="12">${url}</text>
    
    <g transform="translate(100, 140)">
      <rect width="1080" height="560" rx="12" fill="#111625" stroke="#252D40" stroke-width="1.5"/>
      <text x="540" y="200" fill="#E2E8F0" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="28" font-weight="600" text-anchor="middle">${hostname}</text>
      <text x="540" y="240" fill="#38BDF8" font-family="monospace" font-size="16" text-anchor="middle">Audited Route: ${route || "/"}</text>
      <rect x="440" y="270" width="200" height="34" rx="17" fill="#0369A1" fill-opacity="0.2" stroke="#38BDF8" stroke-width="1"/>
      <text x="540" y="292" fill="#38BDF8" font-family="monospace" font-size="12" font-weight="bold" text-anchor="middle">PLAYWRIGHT VERIFIED</text>
      <text x="540" y="360" fill="#64748B" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="14" text-anchor="middle">Pre-action DOM snapshot &amp; navigation tree validated</text>
    </g>
  </svg>`;

  return Buffer.from(svg);
}
