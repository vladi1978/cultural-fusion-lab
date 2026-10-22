"use client";

import type { FusionConcept } from "@/lib/types";

/** Shows which design decisions rest on validated Qloo evidence, with Qloo ids, or says plainly that none do. */
export function EvidenceDecisionsPanel({ concept }: { concept: FusionConcept }) {
  const spec = concept.spec;
  const sufficiency = spec?.evidenceSufficiency;
  if (!spec || !sufficiency || sufficiency.status === "not_applicable") return null;
  const decisions = spec.evidenceDecisions ?? [];

  return (
    <section className="panel space-y-3 p-5" aria-label="Evidence-grounded decisions">
      <div>
        <h3 className="font-display text-xl text-white">Decisions grounded in Qloo evidence</h3>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Only entities that passed geographic and topical validation may ground a decision. Zero is a valid result.
        </p>
      </div>
      <p className="text-sm font-semibold text-white">
        {sufficiency.status === "sufficient" ? "Validated evidence available" : "Evidence insufficient"}
        <span className="ml-2 font-normal text-slate-300">{sufficiency.reason}</span>
      </p>

      {decisions.length ? (
        <ul className="space-y-2 text-sm text-slate-300">
          {decisions.map((d) => (
            <li key={d.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
              <span className="text-[11px] uppercase tracking-wide text-cyan-300">{d.kind}</span>
              <p className="mt-1 text-white">{d.decision}</p>
              <p className="mt-1 text-xs text-slate-400">Relies on: {d.basis}</p>
              <ul className="mt-1 space-y-0.5 text-xs text-slate-400">
                {d.entities.map((e) => (
                  <li key={e.id}>
                    {e.name} · Qloo id {e.qlooEntityId ?? e.id} · via {e.retrievedVia ?? "unknown"}
                    {e.address ? ` · ${e.address}` : ""}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-400">No operating decision in this concept is grounded in Qloo evidence.</p>
      )}

      {sufficiency.rejections.length ? (
        <details className="text-xs text-slate-400">
          <summary className="cursor-pointer text-slate-300">Evidence not used ({sufficiency.rejections.length})</summary>
          <ul className="mt-1 space-y-0.5">
            {sufficiency.rejections.map((r) => (
              <li key={r.entityId}>{r.name}: {r.reason}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
