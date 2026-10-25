# DRISHTI checks and the errors they report

Every website goes through the same run. No site has special handling: DRISHTI learns the pages, links, forms and fields
in a real browser and picks the checks that apply. Code: `apps/frontend/app/api/probes.js`.

## Run lifecycle

| Stage | What happens |
|---|---|
| S1 Reach | Request the URL. If it is down, the run stops with "Target unreachable". |
| S2 Explore | A real browser follows same-site links (up to 20 pages) and records pages, links and forms. |
| S3 Map | Classify what the site offers: sign-up, sign-in, search, quantity fields, pages behind a sign-in. |
| S4 Plan | Choose the checks that apply. No sign-up form means no sign-up checks. |
| S5 Run | Run each check in a fresh browser context. |
| S6 Confirm | Replay each failure in fresh browsers. Only failures that reproduce at least 2 of 3 times become findings. |
| S8 Report | Findings with steps, expected, actual and evidence. |
| S9 Tests | Every check is exported as a named Playwright test (pytest). |

## Test results

| Result | Meaning |
|---|---|
| Passed | The check ran and the site behaved correctly. |
| Failed | The check failed and reproduced in fresh browsers. A finding is created. |
| Unavailable | The check could not run. The reason is shown, for example "needs a test account" or "safe mode". Never counted as a pass. |
| Warning | Hardening advice, not a functional bug. |

## Sign-in

- **Test account provided:** DRISHTI signs in, runs the sign-in checks and re-checks pages that redirected to the sign-in page.
- **No account, open sign-up:** DRISHTI creates a throwaway account (`drishti.qa.*@example.com`) and uses it.
- **No account, no sign-up (or safe mode):** sign-in checks are Unavailable, and the run page asks for a test account.

Credentials are used for one run only, never stored, and the sign-in path must be on the same site.

## Checks

| Test name (id) | Error it reports | Severity | How it is detected |
|---|---|---|---|
| Pages load without server errors or crashes (`test_pages_load`) | Page returns HTTP 500+, or throws an uncaught JavaScript error | High | Open each page in a fresh browser |
| Internal links resolve (`test_internal_links`) | A link leads to a 404 page | Medium | Follow every same-site link |
| Sign-up works with valid details (`test_signup_valid`) | Control check. If it cannot complete (captcha, email confirmation), dependent checks are Unavailable | — | Sign up with a new address |
| Sign-up rejects a malformed email (`test_signup_rejects_malformed_email`) | An address without "@" creates an account | Medium | Submit and check the browser leaves the form |
| Duplicate sign-up is handled (`test_signup_duplicate_email`) | Second sign-up with the same email gives HTTP 500+ | High | Watch network responses |
| Sign-in works with a valid account (`test_login_valid`) | The account is refused | High | Submit the sign-in form |
| Sign-in accepts the email in any letter case (`test_login_email_case_insensitive`) | Upper-case email is refused while the original works | Medium | Same account, two spellings |
| Quantity must be at least 1 (`test_quantity_rejects_zero`) | Quantity 0 accepted by the server (2xx) | Medium | Control with 1 first, then 0 |
| Security headers are set (`test_security_headers`) | Content-Security-Policy or X-Content-Type-Options missing | Low (warning) | Read response headers |

**Safe mode** only reads pages. Checks that submit forms are Unavailable in safe mode.

## Planned next (hidden failures)

Background request failures, silent failure when a save request fails, missing loading feedback on a slow network,
double-click submitting twice, odd input in search (symbols, emoji, long text), coupon applied twice.
