"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

function StatCard({ label, value, note }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 font-mono text-3xl font-medium tabular-nums tracking-tight text-fg">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted">{note}</div>
    </div>
  );
}

const BENCHMARK_BUGS = [
  {
    id: "B1",
    journey: "J1 (Sign-up)",
    type: "Validation",
    severity: "Medium",
    expected: "Malformed email rejected with message; user stays on /signup",
    faulty: "Account created, redirect to /account",
    detected_via: "Assertion (ui_contract / description)",
    stage2_gate: true,
    status: "DETECTED & CONFIRMED",
  },
  {
    id: "B2",
    journey: "J1 (Sign-up)",
    type: "Server error",
    severity: "High",
    expected: "Duplicate email shows friendly 'already registered' message",
    faulty: "POST /api/signup returns 500 error",
    detected_via: "Convention (no_server_errors)",
    stage2_gate: true,
    status: "DETECTED & CONFIRMED",
  },
  {
    id: "B3",
    journey: "J2 (Login)",
    type: "Logic",
    severity: "Medium",
    expected: "Login with registered email in any letter case succeeds",
    faulty: "Login fails if email contains uppercase letters",
    detected_via: "Assertion (description rule)",
    stage2_gate: true,
    status: "DETECTED & CONFIRMED",
  },
  {
    id: "B4",
    journey: "J2 (Login)",
    type: "Navigation",
    severity: "Low",
    expected: "'Forgot password' link opens a reset page",
    faulty: "Link returns 404 dead link",
    detected_via: "Convention (dead-link detector)",
    stage2_gate: true,
    status: "DETECTED & CONFIRMED",
  },
  {
    id: "B5",
    journey: "J3 (Search)",
    type: "Edge case",
    severity: "Low",
    expected: "Search ignores trailing whitespace",
    faulty: "Query with trailing space returns no results",
    detected_via: "Assertion (description)",
    stage2_gate: false,
    status: "DETECTED & CONFIRMED",
  },
  {
    id: "B6",
    journey: "J4 (Cart)",
    type: "Validation",
    severity: "Medium",
    expected: "Quantity must be at least 1",
    faulty: "Quantity 0 or negative accepted",
    detected_via: "Assertion & Invariant",
    stage2_gate: false,
    status: "DETECTED & CONFIRMED",
  },
  {
    id: "B7",
    journey: "J5 (Checkout)",
    type: "Pricing",
    severity: "High",
    expected: "SAVE10 applies once per order",
    faulty: "Applying twice stacks discount",
    detected_via: "Invariant (total == subtotal - discount)",
    stage2_gate: false,
    status: "DETECTED & CONFIRMED",
  },
  {
    id: "B8",
    journey: "J5 (Checkout)",
    type: "Crash",
    severity: "High",
    expected: "Empty checkout shows empty message",
    faulty: "Uncaught TypeError in console; crash",
    detected_via: "Convention (no_page_errors)",
    stage2_gate: false,
    status: "DETECTED & CONFIRMED",
  },
];

export default function BenchmarksPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 w-full flex-1 bg-[#FAFAF9] space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Benchmark: ShopLite</h1>
          <p className="text-sm text-muted mt-1">
            A demo shop with 8 planted bugs, used to measure what DRISHTI finds.
          </p>
        </div>
        <Link
          href="/#operation-workspace"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-fg text-white hover:bg-black transition-colors text-sm font-medium"
        >
          Run a benchmark
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Recall (B1–B4)" value="100%" note="4 of 4 planted defects detected" />
        <StatCard label="Precision" value="100%" note="0 false positives on the clean build" />
        <StatCard label="Replay reproducibility" value="100%" note="3/3 in fresh contexts" />
        <StatCard label="Safety violations" value="0" note="Destructive actions contained" />
      </div>

      <section aria-labelledby="planted-heading" className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="planted-heading" className="text-base font-semibold text-fg">
            Planted bugs
          </h2>
          <span className="font-mono text-xs text-muted">bugs.manifest.json · {BENCHMARK_BUGS.length}</span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line bg-subtle text-muted">
                <th scope="col" className="py-2.5 px-4 font-medium">ID</th>
                <th scope="col" className="py-2.5 px-4 font-medium">Bug</th>
                <th scope="col" className="py-2.5 px-4 font-medium hidden md:table-cell">Journey</th>
                <th scope="col" className="py-2.5 px-4 font-medium hidden lg:table-cell">Detected via</th>
                <th scope="col" className="py-2.5 px-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {BENCHMARK_BUGS.map((b) => (
                <tr key={b.id} className="align-top">
                  <td className="py-3 px-4 font-mono text-muted">{b.id}</td>
                  <td className="py-3 px-4 max-w-md">
                    <div className="text-fg">{b.faulty}</div>
                    <div className="mt-0.5 text-[11px] text-muted">
                      Expected: {b.expected} · <span className="font-mono">{b.type}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[#525252] hidden md:table-cell whitespace-nowrap">{b.journey}</td>
                  <td className="py-3 px-4 font-mono text-[11px] text-muted hidden lg:table-cell">{b.detected_via}</td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 text-emerald-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                      {b.status === "DETECTED & CONFIRMED" ? "Detected" : b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
