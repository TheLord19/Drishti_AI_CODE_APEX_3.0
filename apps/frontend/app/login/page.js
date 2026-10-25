"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";

const fieldClass =
  "w-full px-3 py-2 text-sm rounded-md border border-line bg-white text-fg placeholder-[#A3A3A3] focus:outline-hidden focus:border-fg transition-colors";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleDemoLoginParas = () => {
    setDemoLoading(true);
    setErrorMsg("");

    const demoUser = {
      id: "usr_paras_lead",
      name: "Paras",
      email: "paras@drishti.ai",
      role: "Team Lead / Staff QA Architect",
      team: "Refactor (iMocha IM-02)",
      avatar: "P",
      permissions: ["admin", "execute_swarm", "pytest_export", "self_healing"],
      loggedInAt: new Date().toISOString(),
    };

    setTimeout(() => {
      try {
        localStorage.setItem("drishti_user", JSON.stringify(demoUser));
        window.dispatchEvent(new Event("drishti_auth_change"));
        setSuccessMsg("Welcome back, Paras! Redirecting to Autonomous QA console...");
        setTimeout(() => {
          router.push("/");
        }, 800);
      } catch (err) {
        setErrorMsg("Failed to write session to localStorage.");
        setDemoLoading(false);
      }
    }, 600);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!email || !password) {
      setErrorMsg("Please provide both email and password.");
      return;
    }

    setLoading(true);

    setTimeout(() => {
      try {
        // Check if there is an existing registered user list in localStorage
        const registeredUsersStr = localStorage.getItem("drishti_registered_users");
        const registeredUsers = registeredUsersStr ? JSON.parse(registeredUsersStr) : [];
        const existing = registeredUsers.find(
          (u) => u.email.toLowerCase() === email.toLowerCase()
        );

        const authenticatedUser = existing || {
          id: `usr_${Date.now()}`,
          name: email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          email: email,
          role: "QA Engineer",
          team: "Engineering",
          avatar: email[0].toUpperCase(),
          loggedInAt: new Date().toISOString(),
        };

        localStorage.setItem("drishti_user", JSON.stringify(authenticatedUser));
        window.dispatchEvent(new Event("drishti_auth_change"));
        setSuccessMsg(`Authenticated successfully as ${authenticatedUser.name}!`);

        setTimeout(() => {
          router.push("/");
        }, 800);
      } catch (err) {
        setErrorMsg("Storage error occurred while authenticating.");
        setLoading(false);
      }
    }, 700);
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col justify-center py-12 px-4 bg-[#FAFAF9]">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Sign in</h1>
        <p className="mt-1.5 text-sm text-muted">Welcome back to DRISHTI.</p>

        <div className="mt-6 bg-white p-6 border border-line rounded-lg space-y-4">
          {errorMsg && (
            <div role="alert" className="p-3 rounded-md border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div role="status" className="p-3 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-xs font-medium text-fg mb-1.5">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                required
                className={fieldClass}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="block text-xs font-medium text-fg">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => alert("For evaluation demo, any password or the 1-Click Paras Demo button works!")}
                  className="text-[11px] text-muted hover:text-fg hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className={`${fieldClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted hover:text-fg"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || demoLoading}
              className="w-full px-4 py-2.5 rounded-md bg-fg hover:bg-black text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <button
            type="button"
            onClick={handleDemoLoginParas}
            disabled={demoLoading || loading}
            className="w-full px-4 py-2 rounded-md border border-line bg-white text-xs font-medium text-fg hover:bg-subtle transition-colors disabled:opacity-50"
          >
            {demoLoading ? "Signing in to the demo account..." : "Use the demo account (Paras)"}
          </button>
        </div>

        <p className="mt-5 text-center text-xs text-muted">
          No account yet?{" "}
          <Link href="/register" className="text-fg underline underline-offset-4 hover:text-black">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
