"use client";

import { useState } from "react";
import { LockKeyhole } from "lucide-react";

const fieldClass =
  "w-full px-3 py-2 text-sm rounded-md border border-line bg-white text-fg placeholder-[#A3A3A3] focus:outline-hidden focus:border-fg transition-colors";

// Shown when the run found a sign-in page but had no account to use.
// Starts a new run of the same target with the test account; the password is never stored.
export default function SignInNeeded({ authRequired, run, apiUrl }) {
  const [loginPath, setLoginPath] = useState(authRequired.login_path || "/login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${apiUrl}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_url: run?.target_url,
          description: run?.description || "",
          mode: run?.mode || "sandbox",
          auth: { login_path: loginPath, username, password },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.run_id) throw new Error(data.error?.message || "Could not start the run");
      window.location.href = `/runs/${data.run_id}`;
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="signin-needed-title" className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <LockKeyhole className="w-4 h-4 mt-0.5 text-amber-700 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 id="signin-needed-title" className="text-sm font-semibold text-fg">
            Sign-in testing unavailable
          </h2>
          <p className="mt-1 text-xs text-[#525252]">
            {authRequired.reason} Sign-in checks are marked <span className="font-medium">Unavailable</span>, not passed.
            {authRequired.walled?.length > 0 && (
              <>
                {" "}Pages behind the sign-in: <span className="font-mono">{authRequired.walled.join(", ")}</span>.
              </>
            )}
          </p>

          <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-1 sm:grid-cols-[140px_1fr_1fr_auto] gap-2 items-end">
            <div>
              <label htmlFor="auth-path" className="block text-[11px] text-muted mb-1">Sign-in page</label>
              <input id="auth-path" value={loginPath} onChange={(e) => setLoginPath(e.target.value)} required className={`${fieldClass} font-mono text-xs`} />
            </div>
            <div>
              <label htmlFor="auth-user" className="block text-[11px] text-muted mb-1">Test account email</label>
              <input id="auth-user" type="text" autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} required className={fieldClass} />
            </div>
            <div>
              <label htmlFor="auth-pass" className="block text-[11px] text-muted mb-1">Password</label>
              <input id="auth-pass" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required className={fieldClass} />
            </div>
            <button type="submit" disabled={busy} className="px-4 py-2 rounded-md bg-fg hover:bg-black text-white text-sm font-medium disabled:opacity-50">
              {busy ? "Starting..." : "Run with account"}
            </button>
          </form>
          <p className="mt-2 text-[11px] text-muted">
            Use a test account, not a personal one. It is used for this run only and never saved.
          </p>
          {error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
        </div>
      </div>
    </section>
  );
}
