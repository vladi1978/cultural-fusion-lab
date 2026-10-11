"use client";

import { Atom, RotateCcw } from "lucide-react";

import type { LabStage } from "@/lib/types";

const STAGES: { id: LabStage; label: string }[] = [
  { id: "landing", label: "Lab" },
  { id: "explore", label: "Explore" },
  { id: "discovery", label: "Discovery" },
  { id: "concepts", label: "Concepts" },
  { id: "mutation", label: "Mutate" },
];

export function LabHeader({
  stage,
  onNavigate,
  onReset,
}: {
  stage: LabStage;
  onNavigate: (stage: LabStage) => void;
  onReset: () => void;
}) {
  const activeIndex = STAGES.findIndex((s) => s.id === stage);

  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[rgba(34,211,238,0.35)] bg-[rgba(34,211,238,0.1)]">
          <Atom className="h-5 w-5 text-cyan" aria-hidden />
        </div>
        <div>
          <p className="font-display text-lg leading-none text-white">
            Cultural Fusion Lab
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--text-dim)]">
            Qloo Agentic Hackathon MVP
          </p>
        </div>
      </div>

      <nav aria-label="Lab stages" className="flex flex-wrap items-center gap-2">
        {STAGES.map((item, index) => {
          const reachable = index <= Math.max(activeIndex, 1) || item.id === "landing";
          const isActive = item.id === stage;
          return (
            <button
              key={item.id}
              type="button"
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                isActive
                  ? "border-[rgba(34,211,238,0.5)] bg-[rgba(34,211,238,0.12)] text-[#a5f3fc]"
                  : reachable
                    ? "border-[var(--line)] text-[var(--text-muted)] hover:border-[rgba(34,211,238,0.35)]"
                    : "cursor-not-allowed border-transparent text-[var(--text-dim)] opacity-40"
              }`}
              disabled={!reachable}
              onClick={() => onNavigate(item.id)}
            >
              {item.label}
            </button>
          );
        })}
        <button type="button" className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={onReset}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Reset
        </button>
      </nav>
    </header>
  );
}
