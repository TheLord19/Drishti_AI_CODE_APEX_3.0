"use client";

import Link from "next/link";
import { ShieldCheck, ArrowUpRight, Github, ExternalLink } from "lucide-react";

export default function Footer({ onLaunchClick }) {
  return (
    <footer className="bg-white border-t border-[#E5E5E5] text-xs text-[#737373]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Col */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[#171717] flex items-center justify-center text-white text-xs font-bold">
                D
              </div>
              <span className="font-semibold text-sm text-[#171717] tracking-tight">DRISHTI</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-orange-100 text-orange-800 border border-orange-200">
                AI
              </span>
            </div>
            <p className="text-xs text-[#737373] max-w-sm leading-relaxed">
              Autonomous AI QA Engineer. Explores web applications, uncovers edge-case defects, eliminates flakiness with 3× fresh browser replays, and compiles reusable pytest regression suites.
            </p>
            <div className="flex items-center gap-2 pt-2 text-[11px] text-[#A3A3A3]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#F97316]" />
              <span>Engineered for iMocha Track IM-02 Standard</span>
            </div>
          </div>

          {/* Product Links */}
          <div className="space-y-3">
            <h5 className="font-semibold text-[#171717] text-xs uppercase tracking-wider font-mono">
              Product
            </h5>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  type="button"
                  onClick={onLaunchClick}
                  className="hover:text-[#171717] transition-colors"
                >
                  Launchpad
                </button>
              </li>
              <li>
                <Link href="#how-it-works" className="hover:text-[#171717] transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/benchmarks" className="hover:text-[#171717] transition-colors">
                  Benchmark Scorecard
                </Link>
              </li>
              <li>
                <Link href="/runs" className="hover:text-[#171717] transition-colors">
                  Active QA Runs
                </Link>
              </li>
            </ul>
          </div>

          {/* Documentation & Resources */}
          <div className="space-y-3">
            <h5 className="font-semibold text-[#171717] text-xs uppercase tracking-wider font-mono">
              Resources
            </h5>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href="https://github.com/TheLord19/Drishti_AI_CODE_APEX_3.0"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#171717] transition-colors inline-flex items-center gap-1"
                >
                  <span>GitHub Repository</span>
                  <ArrowUpRight className="w-3 h-3 text-[#A3A3A3]" />
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/TheLord19/Drishti_AI_CODE_APEX_3.0/tree/main/apps/backend"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#171717] transition-colors inline-flex items-center gap-1"
                >
                  <span>FastAPI Backend Core</span>
                  <ArrowUpRight className="w-3 h-3 text-[#A3A3A3]" />
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/TheLord19/Drishti_AI_CODE_APEX_3.0/tree/main/apps/shoplite"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#171717] transition-colors inline-flex items-center gap-1"
                >
                  <span>ShopLite Ground Truth</span>
                  <ArrowUpRight className="w-3 h-3 text-[#A3A3A3]" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t border-[#E5E5E5] flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[#A3A3A3]">
          <div>
            &copy; 2026 DRISHTI AI. Deterministic Frontier &bull; Grounded Assertion DSL &bull; 3&times; Replay Verification.
          </div>
          <div className="flex items-center gap-4">
            <span>Playwright 1.50+</span>
            <span>&bull;</span>
            <span>Chromium Headless</span>
            <span>&bull;</span>
            <span>Pytest Native</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
