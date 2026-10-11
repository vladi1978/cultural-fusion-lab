import { ListTree } from "lucide-react";

import type { AgentTraceSummary } from "@/lib/types";

export function AgentTracePanel({ trace }: { trace?: AgentTraceSummary }) {
  if (!trace) {
    return (
      <aside className="panel p-5">
        <h3 className="font-display text-lg text-white">Agent Trace</h3>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Workflow steps appear here after an exploration run.
        </p>
      </aside>
    );
  }

  return (
    <aside className="panel p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-display text-lg text-white">Agent Trace</h3>
        <span className="badge badge-violet">{trace.engine}</span>
      </div>
      <p className="mb-3 text-xs text-[var(--text-dim)]">
        Deterministic orchestration (no paid LLM). Affinities: {trace.affinityCount}.
      </p>
      {trace.warnings.length > 0 ? (
        <ul className="mb-3 space-y-1">
          {trace.warnings.slice(0, 3).map((warning) => (
            <li
              key={warning}
              className="rounded-lg border border-[rgba(212,168,83,0.35)] bg-[rgba(212,168,83,0.08)] px-2.5 py-1.5 text-[11px] text-[#fde68a]"
            >
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
      <ol className="space-y-2">
        {trace.steps.map((step) => (
          <li
            key={`${step.id}-${step.at}`}
            className="rounded-xl border border-[var(--line)] bg-[rgba(5,8,16,0.35)] px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <ListTree className="h-3.5 w-3.5 text-cyan" aria-hidden />
              <p className="text-xs font-semibold text-white">{step.title}</p>
              <span
                className={`ml-auto badge ${
                  step.status === "ok"
                    ? "badge-cyan"
                    : step.status === "empty"
                      ? "badge-violet"
                      : "badge-mock"
                }`}
              >
                {step.status}
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
              {step.detail}
            </p>
          </li>
        ))}
      </ol>
    </aside>
  );
}
