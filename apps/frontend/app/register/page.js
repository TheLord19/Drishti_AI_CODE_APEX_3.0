"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";

const fieldClass =
  "w-full px-3 py-2 text-sm rounded-md border border-line bg-white text-fg placeholder-[#A3A3A3] focus:outline-hidden focus:border-fg transition-colors";
const labelClass = "block text-xs font-medium text-fg mb-1.5";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("Staff QA Architect / Team Lead");
  const [organization, setOrganization] = useState("Team Refactor");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handlePreloadParas = () => {
    setName("Paras");
    setEmail("paras@drishti.ai");
    setPassword("Refactor2026!QA");
    setConfirmPassword("Refactor2026!QA");
    setRole("Staff QA Architect / Team Lead");
    setOrganization("Team Refactor (iMocha IM-02)");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!name || !email || !password) {
      setErrorMsg("Please fill out all required fields.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setLoading(true);

    setTimeout(() => {
      try {
        const newUser = {
          id: `usr_${Date.now()}`,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          role: role,
          organization: organization.trim() || "Independent Developer",
          avatar: name.trim()[0].toUpperCase(),
          registeredAt: new Date().toISOString(),
          permissions: ["all_features", "swarm_orchestrator", "healing_engine"],
        };

        // Save to registered users registry in localStorage
        const existingUsersStr = localStorage.getItem("drishti_registered_users");
        const existingUsers = existingUsersStr ? JSON.parse(existingUsersStr) : [];
        const filtered = existingUsers.filter(
          (u) => u.email.toLowerCase() !== newUser.email
        );
        filtered.push(newUser);
        localStorage.setItem("drishti_registered_users", JSON.stringify(filtered));

        // Set as active session
        localStorage.setItem("drishti_user", JSON.stringify(newUser));
        window.dispatchEvent(new Event("drishti_auth_change"));

        setSuccessMsg(`Account created for ${newUser.name}! Redirecting to workspace...`);

        setTimeout(() => {
          router.push("/");
        }, 800);
      } catch (err) {
        setErrorMsg("Failed to persist user profile in localStorage.");
        setLoading(false);
      }
    }, 700);
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col justify-center py-12 px-4 bg-[#FAFAF9]">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Create your account</h1>
        <p className="mt-1.5 text-sm text-muted">Start testing your app with DRISHTI.</p>

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
              <label htmlFor="reg-name" className={labelClass}>
                Full name
              </label>
              <input
                id="reg-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="reg-email" className={labelClass}>
                Email
              </label>
              <input
                id="reg-email"
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
              <label htmlFor="reg-password" className={labelClass}>
                Password
              </label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  required
                  className={`${fieldClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide passwords" : "Show passwords"}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted hover:text-fg"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="reg-confirm" className={labelClass}>
                Confirm password
              </label>
              <input
                id="reg-confirm"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
                className={fieldClass}
              />
            </div>

            <details className="group">
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden text-xs text-muted hover:text-fg">
                More about you (optional)
              </summary>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="reg-role" className={labelClass}>
                    Role
                  </label>
                  <select
                    id="reg-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className={`${fieldClass} text-xs`}
                  >
                    <option value="Staff QA Architect / Team Lead">Team Lead</option>
                    <option value="Senior QA Automation Engineer">QA Engineer</option>
                    <option value="Full-Stack Developer">Developer</option>
                    <option value="Hackathon Evaluator / Judge">Judge / Evaluator</option>
                    <option value="Engineering Manager">Manager</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="reg-org" className={labelClass}>
                    Organization
                  </label>
                  <input
                    id="reg-org"
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    autoComplete="organization"
                    className={`${fieldClass} text-xs`}
                  />
                </div>
              </div>
            </details>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2.5 rounded-md bg-fg hover:bg-black text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <button
            type="button"
            onClick={handlePreloadParas}
            className="w-full text-center text-xs text-muted hover:text-fg hover:underline"
          >
            Fill in the demo profile (Paras)
          </button>
        </div>

        <p className="mt-5 text-center text-xs text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-fg underline underline-offset-4 hover:text-black">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
