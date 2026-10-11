"use client";

import { ArrowRight, Sparkles, Waves } from "lucide-react";

export function LandingHero({ onStart }: { onStart: () => void }) {
  return (
    <section className="relative overflow-hidden rounded-[28px] border border-[var(--line)] px-6 py-14 sm:px-10 sm:py-20">
      <div className="pointer-events-none absolute inset-0">
        <div className="lab-grid absolute inset-0 opacity-70" />
        <div className="absolute -left-20 top-10 h-64 w-64 rounded-full bg-[rgba(34,211,238,0.12)] blur-3xl" />
        <div className="absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-[rgba(139,92,246,0.16)] blur-3xl" />
        <svg
          className="absolute inset-0 h-full w-full opacity-40"
          viewBox="0 0 800 420"
          aria-hidden
        >
          <path
            className="network-line"
            d="M80 300 C200 120, 320 360, 440 180 S680 80, 760 220"
            fill="none"
            stroke="#22d3ee"
            strokeWidth="1"
            strokeOpacity="0.5"
          />
          <path
            className="network-line"
            d="M60 160 C180 260, 300 60, 460 240 S700 300, 780 140"
            fill="none"
            stroke="#8b5cf6"
            strokeWidth="1"
            strokeOpacity="0.45"
          />
          <circle cx="220" cy="180" r="4" fill="#22d3ee" />
          <circle cx="460" cy="240" r="5" fill="#a78bfa" />
          <circle cx="640" cy="150" r="4" fill="#d4a853" />
        </svg>
      </div>

      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <div className="fade-up mb-5 inline-flex items-center gap-2 rounded-full border border-[rgba(34,211,238,0.28)] bg-[rgba(34,211,238,0.08)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#a5f3fc]">
          <Waves className="h-3.5 w-3.5" aria-hidden />
          Creative intelligence laboratory
        </div>

        <h1 className="fade-up fade-up-delay-1 font-display text-5xl leading-[0.95] tracking-tight text-white sm:text-7xl">
          Cultural
          <span className="block bg-gradient-to-r from-[#67e8f9] via-[#c4b5fd] to-[#d4a853] bg-clip-text text-transparent">
            Fusion Lab
          </span>
        </h1>

        <p className="fade-up fade-up-delay-2 mx-auto mt-6 max-w-xl text-base leading-relaxed text-[var(--text-muted)] sm:text-lg">
          Explore adjacent cultural worlds, fuse them into product concepts, and
          mutate influences — built for the Qloo Agentic Hackathon with a
          clearly labeled Demo Mode.
        </p>

        <div className="fade-up fade-up-delay-3 mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button type="button" className="btn btn-primary" onClick={onStart}>
            Start Exploration
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
          <div className="inline-flex items-center gap-2 text-sm text-[var(--text-dim)]">
            <Sparkles className="h-4 w-4 text-[var(--gold)]" aria-hidden />
            Zero-cost MVP · localStorage drafts · no paid LLM calls
          </div>
        </div>
      </div>
    </section>
  );
}
