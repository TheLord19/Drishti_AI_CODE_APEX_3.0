import "./globals.css";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import Navbar from "./components/Navbar";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata = {
  title: "DRISHTI AI — Autonomous AI QA Engineer",
  description:
    "Autonomous QA platform: deterministic graph exploration, grounded assertion planning, 3x replay failure verification, and standalone pytest-playwright regression suite generation.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full scroll-smooth`}>
      <body className="min-h-full flex flex-col antialiased bg-[#FAFAF9] text-[#171717] selection:bg-[#F97316]/20 selection:text-[#171717]">
        {/* Top Navigation - Interactive with localStorage session sync */}
        <Suspense fallback={<div className="h-14 border-b border-[#E5E5E5] bg-[#FAFAF9]" />}>
          <Navbar />
        </Suspense>

        {/* Main Application Body */}
        <main className="flex-1 flex flex-col">{children}</main>

        {/* Site-wide reminder: findings and suggested fixes are aids, not verdicts. */}
        <p className="border-t border-[#E5E5E5] bg-white px-4 py-3 text-center text-[11px] text-[#737373]">
          AI can make mistakes. Please validate each finding and suggested fix yourself, or take a second opinion,
          before acting on it.
        </p>
      </body>
    </html>
  );
}
