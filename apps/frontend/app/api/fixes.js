// Suggested fixes for findings. The cause and fix come from fixed rules per check, so they are
// always right for that kind of bug. Groq only writes an optional code example for the detected
// stack, labelled as an AI suggestion. Groq receives the defect summary and stack, never page
// content, credentials or usernames.

const RULES = {
  test_pages_load: {
    summary: "Handle the failing case on the server and show a friendly page instead of crashing.",
    cause: "The page's server or client code throws on a case it does not expect, such as missing or empty data.",
    steps: [
      "Reproduce with the steps above and read the server log for the stack trace.",
      "Guard the code path against missing or empty data (empty cart, missing record, absent query value).",
      "Render an empty state or a 4xx page instead of throwing.",
      "Add an error handler so unexpected errors are logged and return a clean error page.",
    ],
  },
  test_pages_load_signed_in: {
    summary: "Fix the crash on this signed-in page; it only affects logged-in users.",
    cause: "Code that runs only for signed-in users throws, often when profile or account data is missing.",
    steps: [
      "Sign in with a test account and open the page to reproduce.",
      "Guard against missing user, profile or account data.",
      "Return an empty state instead of throwing.",
    ],
  },
  test_internal_links: {
    summary: "Create the missing page, or point the link at the right one.",
    cause: "A link on the site points to a route that does not exist.",
    steps: [
      "Decide whether the page should exist.",
      "If yes, add the route and its page. If no, change or remove the link.",
      "Add a link check to CI so new dead links are caught before release.",
    ],
  },
  test_signup_rejects_malformed_email: {
    summary: "Validate the email format on the server and reject invalid addresses with a clear message.",
    cause: "The sign-up endpoint accepts any text as an email. Browser checks alone are not enough because requests can bypass them.",
    steps: [
      "Validate the email on the server before creating the account.",
      "Return HTTP 400 with a message such as 'Enter a valid email address'.",
      "Also set type=\"email\" on the input for instant feedback in the browser.",
    ],
  },
  test_signup_duplicate_email: {
    summary: "Detect an existing account and answer 409 'already registered' instead of crashing.",
    cause: "Creating a second account with the same email hits a unique-key error that is not handled.",
    steps: [
      "Normalise the email, then check whether an account already exists before inserting.",
      "Also catch the database unique-key error, since two requests can race.",
      "Return HTTP 409 with a friendly message and a link to sign in or reset the password.",
    ],
  },
  test_login_email_case_insensitive: {
    summary: "Lower-case and trim emails on both sign-up and sign-in before storing or comparing.",
    cause: "Emails are compared exactly, so 'Dev@Example.com' does not match 'dev@example.com'.",
    steps: [
      "Normalise the email (trim, lower-case) at sign-up, sign-in and password reset.",
      "Migrate existing stored emails to the normalised form.",
      "Keep a unique index on the normalised email.",
    ],
  },
  test_quantity_rejects_zero: {
    summary: "Validate quantity on the server: a whole number of at least 1 (and a sensible maximum).",
    cause: "The server trusts the quantity sent by the browser; the input's min attribute is only a hint.",
    steps: [
      "Parse the quantity as an integer on the server.",
      "Reject values below 1 or above your maximum with HTTP 400 and a message.",
      "Keep min=\"1\" on the input for user feedback.",
    ],
  },
  test_security_headers: {
    summary: "Send Content-Security-Policy and X-Content-Type-Options: nosniff on every response.",
    cause: "The server does not set recommended security headers. This is hardening, not a functional bug.",
    steps: [
      "Add the headers in one place (middleware or framework config).",
      "Start CSP in report-only mode, then enforce it once no violations are reported.",
    ],
  },
  // Hidden failures: users rarely report these; they surface later as lost orders or support tickets.
  test_background_requests: {
    hidden: true,
    summary: "Fix the failing background request or asset, and show a fallback when it fails.",
    cause: "A request the page makes in the background (API call, image, script or font) fails, so part of the page silently breaks.",
    steps: [
      "Open the failing URL from the evidence and fix the endpoint or the missing file.",
      "Show a fallback or a retry message when the request fails instead of hiding the section.",
      "Report these failures to your error monitoring so they are seen before users complain.",
    ],
  },
  test_double_submit: {
    hidden: true,
    summary: "Make the action idempotent on the server and disable the button while it is processing.",
    cause: "Clicking twice quickly sends the request twice and the server processes both.",
    steps: [
      "Disable the button and show 'Processing...' as soon as it is clicked.",
      "On the server, use an idempotency key or check state inside a transaction so a repeat does nothing.",
      "Clear or lock the cart before responding, not after.",
    ],
  },
  test_silent_failure: {
    hidden: true,
    summary: "Show the user an error message when a save or request fails.",
    cause: "The page catches the failed request but tells the user nothing, so they believe it worked.",
    steps: [
      "In the request's error and non-OK branches, show a visible message (toast, inline alert).",
      "Keep the user's input so they can retry.",
      "Log the failure to error monitoring.",
    ],
  },
  test_odd_input: {
    hidden: true,
    summary: "Escape or parameterise user input and cap its length so odd characters cannot crash the server.",
    cause: "User input with symbols, emoji or extreme length reaches code that does not expect it (for example a regular expression or a query built from raw text).",
    steps: [
      "Never build regular expressions or queries from raw input: escape it or use parameters.",
      "Cap input length on the server and return 400 when exceeded.",
      "Add a test with symbols ( ) [ ] * + ?, emoji and 5,000 characters.",
    ],
  },
  test_flow_odd_input: {
    hidden: true,
    summary: "Save text exactly as typed: never build JSON, queries or regular expressions by joining strings.",
    cause: "The save path treats the answer as code (for example a hand-built JSON string or query), so quotes or symbols break it.",
    steps: [
      "Send and store the text with proper serialisation (JSON.stringify, parameterised queries).",
      "Cap the length on the server and return 400 when it is exceeded.",
      "Add a test that saves quotes, backslashes, < >, emoji and long text.",
    ],
  },
  test_visible_text: {
    summary: "Give the text a colour with at least 4.5:1 contrast against its background.",
    cause: "The text colour is the same as, or very close to, the background colour, so users see an empty area.",
    steps: [
      "Find the style that sets this element's colour (often a theme or state class).",
      "Use a colour with at least 4.5:1 contrast (WCAG AA).",
      "Add a contrast check to your UI tests.",
    ],
  },
  test_editable_fields: {
    summary: "Remove whatever blocks typing in this field, or mark it read-only openly if that is intended.",
    cause: "A key handler, overlay or editor setting swallows keystrokes, so the field looks editable but ignores input.",
    steps: [
      "Check key handlers on the field (preventDefault on keydown or keypress).",
      "Check for invisible overlays above the field and the editor's read-only option.",
      "If the field should not be edited, set readonly or aria-readonly so users can tell.",
    ],
  },
  test_step_memory: {
    summary: "Update the step's stored answer when it is saved, and render Previous from that state.",
    cause: "The answer reaches the server, but the page's own copy is not updated, so going back shows the step empty.",
    steps: [
      "After a successful save, update the in-page state for that step before moving on.",
      "Render each step from that single source of state (or reload it from the server).",
      "Test: answer, go forward, go back, and expect the answer to be there.",
    ],
  },
  test_refresh_memory: {
    hidden: true,
    summary: "Restore saved answers from the server when the page loads.",
    cause: "Answers are saved, but the page does not load them back after a refresh, so users think their work is lost.",
    steps: [
      "Return the saved answers with the page's initial data.",
      "Fill every step from that data on load.",
      "Test: answer, save, refresh, and expect the answer to be there.",
    ],
  },
  test_search_whitespace: {
    summary: "Trim the search text before matching.",
    cause: "A trailing or leading space is kept in the search term, so matches fail.",
    steps: ["Trim (and collapse repeated spaces in) the query on the server before searching."],
  },
  test_coupon_once: {
    summary: "Allow each coupon once per order and recompute totals on the server.",
    cause: "Applying the same code again adds the discount again; the server does not remember it was applied.",
    steps: [
      "Store the applied coupon on the order or session.",
      "Reject a second application with a message such as 'Coupon already applied'.",
      "Compute the total on the server from subtotal and applied discounts, never from browser values.",
    ],
  },
  test_form_required: {
    summary: "Require the mandatory fields on the server and show which ones are missing.",
    cause: "The form can be submitted empty and the server accepts it.",
    steps: ["Validate required fields on the server and return 400 with field-level messages.", "Mark fields required in the form for instant feedback."],
  },
  test_form_email: {
    summary: "Validate the email field on the server.",
    cause: "The form accepts text without '@' as an email address.",
    steps: ["Validate the email format on the server and return 400 with a message.", "Use type=\"email\" on the input."],
  },
  test_form_feedback: {
    summary: "Confirm to the user that the form was sent.",
    cause: "After a successful submit the page shows nothing, so users submit again or assume it failed.",
    steps: ["Show a success message or redirect to a thank-you page after submitting.", "Clear or disable the form to prevent duplicates."],
  },
};

const GENERIC = {
  summary: "Investigate with the reproduction steps and evidence above.",
  cause: "See the evidence for what the browser observed.",
  steps: ["Reproduce with the steps above.", "Fix the cause, then re-run the named test to confirm."],
};

/** One-line fix for a named test id (ids may carry a "_2" suffix for a second form). */
export function fixSummaryFor(testId) {
  const rule = RULES[testId] || RULES[String(testId).replace(/_\d+$/, "")];
  return rule ? rule.summary : null;
}

/** Attach a rule-based fix to every finding (synchronous, always available). */
export function attachFixes(findings) {
  for (const f of findings) {
    const rule = RULES[f.scenario_id] || GENERIC;
    f.hidden = !!rule.hidden;
    f.fix = {
      summary: rule.summary,
      cause: rule.cause,
      steps: rule.steps,
      confirm_test: f.scenario_id || null,
      code: null,
      code_language: null,
      code_source: null,
    };
  }
  return findings;
}

/**
 * Ask Groq for one short code example per finding, for the detected stack, in a single call.
 * Returns { ok, model, error }. Findings keep their rule-based fix if this fails or times out.
 */
export async function addCodeExamples(findings, techStack = []) {
  const key = process.env.GROQ_API_KEY;
  const base = (process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, "");
  const models = [process.env.LLM_MODEL || "openai/gpt-oss-120b", process.env.LLM_FALLBACK_MODEL].filter(Boolean);
  const targets = findings.filter((f) => f.fix);
  if (!key || !targets.length) return { ok: false, error: key ? "nothing to do" : "GROQ_API_KEY not set" };

  const stack = techStack.filter((t) => t && t !== "Modern Web Platform").join(", ") || "unknown (use Node.js/Express)";
  const items = targets.map((f) => ({ id: f.id, problem: f.title, cause: f.fix.cause, fix: f.fix.summary }));
  const messages = [
    {
      role: "system",
      content:
        "You write short, correct code examples that illustrate a described fix. Use the given stack. " +
        "Each example is at most 12 lines, uses generic names, invents no file paths, and implements only the described fix. " +
        'Reply with JSON only: {"examples":[{"id":"<id>","language":"<js|ts|python|...>","code":"<code>"}]}',
    },
    { role: "user", content: JSON.stringify({ stack, defects: items }) },
  ];

  for (const model of models) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, temperature: 0.2, response_format: { type: "json_object" } }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
      const byId = new Map((parsed.examples || []).map((e) => [e.id, e]));
      let added = 0;
      for (const f of targets) {
        const ex = byId.get(f.id);
        if (ex && typeof ex.code === "string" && ex.code.trim()) {
          f.fix.code = ex.code.trim().slice(0, 1500);
          f.fix.code_language = String(ex.language || "").slice(0, 20);
          f.fix.code_source = `Groq ${model}`;
          added++;
        }
      }
      return { ok: added > 0, model, added };
    } catch (e) {
      console.error(`[fixes] Groq ${model} failed:`, e.message);
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, error: "Groq unavailable" };
}

/** Markdown bug report for one finding, for GitHub, Jira or Slack. */
export function issueMarkdown(f, targetUrl) {
  return [
    `## ${f.title}`,
    "",
    `**Severity:** ${f.severity}${f.hidden ? " (hidden failure)" : ""} · **Reproduced:** ${f.replay_rate} · **Page:** ${f.anomaly_location?.screen || "/"} · **Site:** ${targetUrl}`,
    "",
    "### Steps to reproduce",
    ...(f.trigger_steps || []).map((s, i) => `${i + 1}. ${s}`),
    "",
    `**Expected:** ${f.expected}`,
    `**Actual:** ${f.actual}`,
    `**Evidence:** \`${f.evidence}\``,
    "",
    "### Suggested fix",
    `${f.fix?.summary || ""}`,
    "",
    `Likely cause: ${f.fix?.cause || ""}`,
    "",
    ...(f.fix?.steps || []).map((s) => `- ${s}`),
    ...(f.fix?.code ? ["", `Example (${f.fix.code_source}, AI suggestion):`, "```" + (f.fix.code_language || ""), f.fix.code, "```"] : []),
    "",
    `**Confirm the fix:** re-run \`${f.fix?.confirm_test || "the DRISHTI run"}\`; it should pass.`,
    "",
    "_Found by DRISHTI AI_",
  ].join("\n");
}
