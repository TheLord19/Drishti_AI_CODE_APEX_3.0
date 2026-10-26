"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  User,
  LogOut,
  ShieldCheck,
  ChevronDown,
  Sparkles,
} from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const syncUser = () => {
      try {
        const stored = localStorage.getItem("drishti_user");
        if (stored) {
          setCurrentUser(JSON.parse(stored));
        } else {
          setCurrentUser(null);
        }
      } catch (err) {
        console.error("Failed to parse drishti_user:", err);
      }
    };

    syncUser();

    // Listen to local and cross-window auth events
    window.addEventListener("drishti_auth_change", syncUser);
    window.addEventListener("storage", syncUser);

    return () => {
      window.removeEventListener("drishti_auth_change", syncUser);
      window.removeEventListener("storage", syncUser);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("drishti_user");
    setCurrentUser(null);
    setShowUserMenu(false);
    window.dispatchEvent(new Event("drishti_auth_change"));
  };

  return (
    <header className="border-b border-[#E5E5E5] bg-[#FAFAF9]/85 backdrop-blur-md sticky top-0 z-50 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Brand Logo & Wordmark */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-[#171717] font-semibold text-sm tracking-tight group"
          >
            <div className="w-6 h-6 rounded-md bg-[#171717] flex items-center justify-center text-white text-xs font-bold transition-transform group-hover:scale-105 shadow-2xs">
              D
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-[#171717] tracking-tight">DRISHTI</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-orange-100 text-orange-800 border border-orange-200">
                AI
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation Destinations */}
        <nav className="flex items-center gap-3 sm:gap-5 text-xs font-medium">
          <Link
            href="/#how-it-works"
            className="text-[#737373] hover:text-[#171717] transition-colors hidden md:inline-block"
          >
            How It Works
          </Link>
          <Link
            href="/benchmarks"
            className={`transition-colors hidden sm:inline-block ${
              pathname === "/benchmarks" ? "text-[#171717] font-semibold" : "text-[#737373] hover:text-[#171717]"
            }`}
            id="nav-benchmarks"
          >
            Benchmarks
          </Link>
          <Link
            href="/lab"
            className={`transition-colors hidden sm:inline-block ${
              pathname === "/lab" ? "text-[#171717] font-semibold" : "text-[#737373] hover:text-[#171717]"
            }`}
            id="nav-lab"
          >
            Lab
          </Link>
          <a
            href="https://github.com/TheLord19/Drishti_AI_CODE_APEX_3.0"
            target="_blank"
            rel="noreferrer"
            className="text-[#737373] hover:text-[#171717] transition-colors hidden lg:flex items-center gap-1"
          >
            <span>Docs</span>
            <ArrowUpRight className="w-3 h-3 text-[#A3A3A3]" />
          </a>

          {/* Authentication State Section */}
          {mounted && currentUser ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-[#E5E5E5] bg-white hover:bg-[#F5F5F4] transition-all cursor-pointer shadow-2xs"
              >
                <div className="w-5 h-5 rounded-full bg-[#171717] text-white flex items-center justify-center text-[10px] font-bold">
                  {currentUser.name ? currentUser.name[0].toUpperCase() : "U"}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-semibold text-[#171717] leading-none">
                    {currentUser.name || "Paras"}
                  </span>
                </div>
                <span className="hidden sm:inline-block text-[9px] font-medium font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {currentUser.role || "Team Lead"}
                </span>
                <ChevronDown className="w-3 h-3 text-[#737373]" />
              </button>

              {/* User Dropdown Menu */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-[#E5E5E5] bg-white p-2 shadow-lg z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-2 border-b border-[#F5F5F4]">
                    <div className="text-xs font-bold text-[#171717]">{currentUser.name}</div>
                    <div className="text-[11px] text-[#737373] font-mono truncate">{currentUser.email}</div>
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-600 font-mono">
                      <ShieldCheck className="w-3 h-3" />
                      <span>{currentUser.role || "Staff QA Architect"}</span>
                    </div>
                  </div>

                  <div className="py-1">
                    <Link
                      href="/#operation-workspace"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs text-[#737373] hover:text-[#171717] hover:bg-[#F5F5F4] rounded-lg transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#F97316]" />
                      <span>New Autonomous Run</span>
                    </Link>
                    <Link
                      href="/benchmarks"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs text-[#737373] hover:text-[#171717] hover:bg-[#F5F5F4] rounded-lg transition-colors"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Benchmark Results</span>
                    </Link>
                  </div>

                  <div className="pt-1 border-t border-[#F5F5F4]">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer text-left font-medium"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              id="nav-signin"
              className={`transition-colors ${
                pathname === "/login" || pathname === "/register"
                  ? "text-[#171717]"
                  : "text-[#737373] hover:text-[#171717]"
              }`}
            >
              Sign in
            </Link>
          )}

          {/* Secondary here: each page keeps its own single black primary action */}
          <Link
            href="/#operation-workspace"
            id="nav-new-run"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-[#E5E5E5] bg-white text-[#171717] hover:bg-[#F5F5F4] transition-colors text-xs font-medium"
          >
            <span>New run</span>
            <ArrowRight className="w-3 h-3 text-[#737373]" aria-hidden="true" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
