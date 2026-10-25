"use client";

import Link from "next/link";
import { Play, ArrowUpRight, ArrowRight, ShieldCheck } from "lucide-react";

export default function FinalCTA({ onLaunchClick }) {
  return (
    <section className="py-24 lg:py-32 bg-[#FAFAF9] border-t border-[#E5E5E5] text-center">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-white text-[#737373] border border-[#E5E5E5] mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F97316]"></span>
          <span>Zero Configuration Setup</span>
        </div>

        <h2 className="text-3xl sm:text-5xl font-semibold text-[#171717] tracking-tight max-w-2xl mx-auto leading-tight">
          Give your application a more independent QA engineer.
        </h2>

        <p className="mt-4 text-base sm:text-lg text-[#737373] max-w-xl mx-auto leading-relaxed">
          Start with a URL, define the behavioral constraints that matter, and let DRISHTI autonomously explore, verify, and document.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={onLaunchClick}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#171717] text-white hover:bg-black transition-all text-sm font-medium shadow-xs"
          >
            <Play className="w-4 h-4 fill-current text-[#F97316]" />
            <span>Launch a QA Run</span>
          </button>

          <a
            href="https://github.com/TheLord19/Drishti_AI_CODE_APEX_3.0"
            target="_blank"
            rel="noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-6 py-3 rounded-lg bg-white border border-[#E5E5E5] text-[#171717] hover:bg-[#F5F5F4] transition-all text-sm font-medium shadow-2xs"
          >
            <span>Read the Documentation</span>
            <ArrowUpRight className="w-4 h-4 text-[#737373]" />
          </a>
        </div>

        <div className="mt-8 text-xs text-[#A3A3A3] flex items-center justify-center gap-4">
          <span>Browser-based execution</span>
          <span>&bull;</span>
          <span>Evidence-backed reports</span>
          <span>&bull;</span>
          <span>Reusable regression tests</span>
        </div>
      </div>
    </section>
  );
}
