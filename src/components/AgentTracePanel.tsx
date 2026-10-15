import { ListTree } from "lucide-react";

import type { AgentTraceSummary } from "@/lib/types";

import { CollapsiblePanel } from "./CollapsiblePanel";

function TraceBody({ trace }: { trace: AgentTraceSummary }) {
  return (
    <div>
      <p className="mb-3 text-xs text-[var(--text-dim)]">
        Deterministic orchestration (no paid LLM). Affinities:{" "}
        {trace.affinityCount}.
        {trace.opportunities
          ? ` Opportunities: ${trace.opportunities.accepted} accepted / ${trace.opportunities.rejected} rejected.`
          : ""}
      </p>
      {trace.opportunities && trace.opportunities.summaries.length > 0 ? (
        <details className="mb-3 rounded-lg border border-[var(--line)] bg-[rgba(5,8,16,0.35)] px-2.5 py-2">
          <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">
            Opportunity hypotheses (not demand proof)
          </summary>
          <ul className="mt-2 space-y-1">
            {trace.opportunities.summaries.slice(0, 6).map((row) => (
              <li
                key={row}
                className="text-[11px] leading-relaxed text-[var(--text-muted)]"
              >
                {row}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
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
    </div>
  );
}

export function AgentTracePanel({
  trace,
  collapsible = false,
  defaultOpen = false,
}: {
  trace?: AgentTraceSummary;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  if (!trace) {
    if (collapsible) {
      return (
        <CollapsiblePanel
          title="Agent Trace"
          subtitle="Workflow steps appear after an exploration run."
          defaultOpen={false}
        >
          <p className="text-sm text-[var(--text-muted)]">
            No agent trace yet.
          </p>
        </CollapsiblePanel>
      );
    }
    return (
      <aside className="panel p-5">
        <h3 className="font-display text-lg text-white">Agent Trace</h3>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Workflow steps appear here after an exploration run.
        </p>
      </aside>
    );
  }

  if (!collapsible) {
    return (
      <aside className="panel p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-display text-lg text-white">Agent Trace</h3>
          <span className="badge badge-violet">{trace.engine}</span>
        </div>
        <TraceBody trace={trace} />
      </aside>
    );
  }

  return (
    <CollapsiblePanel
      title="Agent Trace"
      badge={trace.engine}
      subtitle="Technical workflow details — collapsed by default so concepts stay primary."
      defaultOpen={defaultOpen}
    >
      <TraceBody trace={trace} />
    </CollapsiblePanel>
  );
}
