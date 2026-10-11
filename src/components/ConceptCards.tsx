"use client";

import { GitBranch, Layers3, Sparkles } from "lucide-react";

import type { FusionConcept } from "@/lib/types";
import { OUTPUT_CATEGORY_LABELS } from "@/lib/types";

const DIRECTION_META: Record<
  string,
  { label: string; accent: string; ring: string }
> = {
  intimate: {
    label: "Intimate",
    accent: "text-[#a5f3fc]",
    ring: "ring-cyan/35",
  },
  communal: {
    label: "Communal",
    accent: "text-[#ddd6fe]",
    ring: "ring-violet/40",
  },
  systems: {
    label: "Systems",
    accent: "text-[#fde68a]",
    ring: "ring-[rgba(212,168,83,0.45)]",
  },
};

function NarrativeBlock({
  label,
  children,
}: {
  label: string;
  children: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">
        {label}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">
        {children}
      </p>
    </div>
  );
}

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
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#a5f3fc]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Primary results
          </p>
          <h2 className="font-display text-3xl tracking-tight text-white sm:text-4xl">
            Fusion Concepts
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">
            Three directionally distinct proposals. Compare what each is, who it
            serves, and how it works — then choose one to mutate. Lab scores are
            heuristics, not market predictions or Qloo forecasts.
          </p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {concepts.map((concept, index) => {
          const selected = selectedId === concept.id;
          const directionKey = concept.directionId ?? "intimate";
          const direction = DIRECTION_META[directionKey] ?? DIRECTION_META.intimate!;
          const narrative = concept.narrative;
          const evaluation = concept.evaluation;

          return (
            <article
              key={concept.id}
              className={`concept-card relative flex flex-col overflow-hidden p-6 transition ${
                selected ? `ring-2 ${direction.ring}` : ""
              }`}
              style={{ animationDelay: `${index * 90}ms` }}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan/70 via-violet/50 to-[rgba(212,168,83,0.65)] opacity-80" />

              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="badge badge-cyan">0{index + 1}</span>
                <span className={`badge badge-violet`}>{direction.label}</span>
                <span className="badge badge-demo">
                  {OUTPUT_CATEGORY_LABELS[concept.outputCategory]}
                </span>
              </div>

              <h3 className="font-display text-2xl leading-[1.15] tracking-tight text-white">
                {concept.title}
              </h3>

              {narrative ? (
                <div className="mt-5 space-y-4">
                  <NarrativeBlock label="What it is">
                    {narrative.whatItIs}
                  </NarrativeBlock>
                  <NarrativeBlock label="Who it serves">
                    {narrative.whoItServes}
                  </NarrativeBlock>
                  <NarrativeBlock label="How it works">
                    {narrative.howItWorks}
                  </NarrativeBlock>
                  <NarrativeBlock label="What makes it distinctive">
                    {narrative.distinctive}
                  </NarrativeBlock>
                  <NarrativeBlock label="Cultural influences">
                    {narrative.inspiredBy}
                  </NarrativeBlock>
                  <div className="rounded-xl border border-[rgba(212,168,83,0.28)] bg-[rgba(212,168,83,0.08)] px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#fde68a]">
                      Evidence vs hypothesis
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[#fde68a]/90">
                      {narrative.evidenceBoundary}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">
                  {concept.positioning}
                </p>
              )}

              <div className="mt-5">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">
                  Influence set
                </p>
                <ul className="space-y-1.5">
                  {concept.culturalInfluences.map((entity) => (
                    <li
                      key={entity.id}
                      className="rounded-lg border border-[var(--line)] bg-[rgba(5,8,16,0.35)] px-2.5 py-1.5 text-xs text-[var(--text)]"
                    >
                      <span className={direction.accent}>{entity.category}</span>
                      {" · "}
                      {entity.name}
                    </li>
                  ))}
                </ul>
              </div>

              {concept.mutationNote ? (
                <p className="mt-4 rounded-xl border border-[rgba(212,168,83,0.3)] bg-[rgba(212,168,83,0.08)] px-3 py-2 text-xs leading-relaxed text-[#fde68a]">
                  {concept.mutationNote}
                </p>
              ) : null}

              {evaluation ? (
                <details className="mt-4 rounded-xl border border-[var(--line)] bg-[rgba(5,8,16,0.3)] px-3 py-2">
                  <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">
                    Lab fit scores (heuristic only)
                  </summary>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[10px] text-[var(--text-dim)]">Rel</p>
                      <p className="font-mono text-xs text-cyan">
                        {evaluation.relevance.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--text-dim)]">Orig</p>
                      <p className="font-mono text-xs text-[#c4b5fd]">
                        {evaluation.originality.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--text-dim)]">Evid</p>
                      <p className="font-mono text-xs text-[var(--gold)]">
                        {evaluation.evidenceCoverage.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-[var(--text-dim)]">
                    Not consumer demand, virality, or Qloo Taste Graph scores.
                  </p>
                </details>
              ) : null}

              <div className="mt-auto flex flex-wrap gap-2 pt-6">
                <button
                  type="button"
                  className="btn btn-ghost !px-3 !py-2 text-xs"
                  onClick={() => {
                    onSelect(concept);
                    onSelectEvidence(concept.evidenceIds);
                  }}
                >
                  <Layers3 className="h-3.5 w-3.5" aria-hidden />
                  Show evidence
                </button>
                <button
                  type="button"
                  className="btn btn-gold !px-3 !py-2 text-xs"
                  onClick={() => {
                    onSelect(concept);
                    onOpenMutation(concept);
                  }}
                >
                  <GitBranch className="h-3.5 w-3.5" aria-hidden />
                  Mutate this concept
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
