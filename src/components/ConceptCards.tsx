"use client";

import { GitBranch, Layers3 } from "lucide-react";

import type { FusionConcept } from "@/lib/types";
import { OUTPUT_CATEGORY_LABELS } from "@/lib/types";

export function ConceptCards({
  concepts,
  selectedId,
  onSelect,
  onOpenMutation,
  onSelectEvidence,
}: {
  concepts: FusionConcept[];
  selectedId?: string;
  onSelect: (concept: FusionConcept) => void;
  onOpenMutation: (concept: FusionConcept) => void;
  onSelectEvidence: (evidenceIds: string[]) => void;
}) {
  if (concepts.length === 0) {
    return null;
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="font-display text-2xl text-white">Fusion Concepts</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Three concept directions from the deterministic agent. Positioning is
          hypothesis; cultural anchors cite evidence. Scores are lab heuristics,
          not Qloo forecasts.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {concepts.map((concept, index) => {
          const selected = selectedId === concept.id;
          const evaluation = concept.evaluation;
          return (
            <article
              key={concept.id}
              className={`panel flex flex-col p-5 transition ${
                selected ? "panel-strong ring-1 ring-cyan/40" : ""
              }`}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="badge badge-cyan">Concept 0{index + 1}</span>
                <span className="badge badge-violet">
                  {OUTPUT_CATEGORY_LABELS[concept.outputCategory]}
                </span>
              </div>

              <h3 className="font-display text-xl leading-snug text-white">
                {concept.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                {concept.positioning}
              </p>

              {evaluation ? (
                <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-[var(--line)] bg-[rgba(5,8,16,0.35)] px-2.5 py-2 text-center">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[var(--text-dim)]">
                      Rel
                    </p>
                    <p className="font-mono text-xs text-cyan">
                      {evaluation.relevance.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[var(--text-dim)]">
                      Orig
                    </p>
                    <p className="font-mono text-xs text-[#c4b5fd]">
                      {evaluation.originality.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[var(--text-dim)]">
                      Evid
                    </p>
                    <p className="font-mono text-xs text-[var(--gold)]">
                      {evaluation.evidenceCoverage.toFixed(2)}
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">
                  Cultural influences
                </p>
                <ul className="space-y-1.5">
                  {concept.culturalInfluences.map((entity) => (
                    <li
                      key={entity.id}
                      className="rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-xs text-[var(--text)]"
                    >
                      <span className="text-[var(--cyan)]">{entity.category}</span>
                      {" · "}
                      {entity.name}
                    </li>
                  ))}
                </ul>
              </div>

              {concept.mutationNote ? (
                <p className="mt-3 text-xs text-[var(--gold)]">
                  {concept.mutationNote}
                </p>
              ) : null}

              <div className="mt-auto flex flex-wrap gap-2 pt-5">
                <button
                  type="button"
                  className="btn btn-ghost !px-3 !py-2 text-xs"
                  onClick={() => {
                    onSelect(concept);
                    onSelectEvidence(concept.evidenceIds);
                  }}
                >
                  <Layers3 className="h-3.5 w-3.5" aria-hidden />
                  Evidence
                </button>
                <button
                  type="button"
                  className="btn btn-gold !px-3 !py-2 text-xs"
                  onClick={() => onOpenMutation(concept)}
                >
                  <GitBranch className="h-3.5 w-3.5" aria-hidden />
                  Mutate
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
