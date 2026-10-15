"use client";

import { GitBranch, Layers3, Sparkles } from "lucide-react";

import type { FusionConcept } from "@/lib/types";
import { OUTPUT_CATEGORY_LABELS } from "@/lib/types";

const MECHANISM_META: Record<
  string,
  { label: string; accent: string; ring: string }
> = {
  spatial_circuit: {
    label: "Spatial circuit",
    accent: "text-[#a5f3fc]",
    ring: "ring-cyan/35",
  },
  narrative_chapters: {
    label: "Narrative chapters",
    accent: "text-[#ddd6fe]",
    ring: "ring-violet/40",
  },
  sonic_set: {
    label: "Sonic set",
    accent: "text-[#fde68a]",
    ring: "ring-[rgba(212,168,83,0.45)]",
  },
  brand_drop: {
    label: "Brand drop",
    accent: "text-[#fda4af]",
    ring: "ring-rose-400/40",
  },
  material_layer: {
    label: "Material layer",
    accent: "text-[#86efac]",
    ring: "ring-emerald-400/35",
  },
  hospitality_course: {
    label: "Hospitality course",
    accent: "text-[#fcd34d]",
    ring: "ring-amber-300/40",
  },
  tension_dual: {
    label: "Tension dual-path",
    accent: "text-[#c4b5fd]",
    ring: "ring-violet/50",
  },
  // Legacy direction fallbacks
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

  const countLabel =
    concepts.length === 1
      ? "One quality-gated proposal"
      : `${concepts.length} quality-gated proposals`;

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
            {countLabel} with distinct operating mechanics. Lab scores are
            structural heuristics — not market predictions or Qloo forecasts.
          </p>
        </div>
      </div>

      <div
        className={`grid gap-5 ${
          concepts.length === 1
            ? "max-w-xl"
            : concepts.length === 2
              ? "md:grid-cols-2"
              : "xl:grid-cols-3"
        }`}
      >
        {concepts.map((concept, index) => {
          const selected = selectedId === concept.id;
          const mechanismKey =
            concept.spec?.mechanismId ?? concept.directionId ?? "sonic_set";
          const direction =
            MECHANISM_META[mechanismKey] ?? MECHANISM_META.sonic_set!;
          const narrative = concept.narrative;
          const spec = concept.spec;
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
                <span className="badge badge-violet">{direction.label}</span>
                <span className="badge badge-demo">
                  {OUTPUT_CATEGORY_LABELS[concept.outputCategory]}
                </span>
              </div>

              <h3 className="font-display text-2xl leading-[1.15] tracking-tight text-white">
                {concept.title}
              </h3>

              {spec ? (
                <div className="mt-5 space-y-4">
                  <NarrativeBlock label="Proposition">
                    {spec.proposition}
                  </NarrativeBlock>
                  <NarrativeBlock label="Audience & context">
                    {`${spec.audience} ${spec.context}`}
                  </NarrativeBlock>
                  <NarrativeBlock label="Operating mechanics">
                    {spec.mechanics}
                  </NarrativeBlock>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">
                      User journey
                    </p>
                    <ol className="mt-1.5 space-y-1.5 text-sm leading-relaxed text-[var(--text-muted)]">
                      {spec.journey.slice(0, 3).map((step, i) => (
                        <li key={step.id}>
                          <span className={direction.accent}>
                            {i + 1}. {step.actor}
                          </span>
                          {": "}
                          {step.action}
                        </li>
                      ))}
                    </ol>
                  </div>
                  <NarrativeBlock label="Differentiation hypothesis">
                    {spec.differentiationHypothesis}
                  </NarrativeBlock>
                  <div className="rounded-xl border border-[rgba(212,168,83,0.28)] bg-[rgba(212,168,83,0.08)] px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#fde68a]">
                      Evidence vs hypothesis
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[#fde68a]/90">
                      {spec.evidenceBoundary}
                    </p>
                  </div>

                  {spec.opportunityTrace ? (
                    <details className="rounded-xl border border-[var(--line)] bg-[rgba(5,8,16,0.3)] px-3 py-2">
                      <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">
                        Opportunity trace ({spec.opportunityKind ?? "hypothesis"})
                      </summary>
                      <ol className="mt-2 space-y-2">
                        {spec.opportunityTrace.steps.map((step) => (
                          <li
                            key={`${step.stage}-${step.label}`}
                            className="text-xs leading-relaxed text-[var(--text-muted)]"
                          >
                            <span className={direction.accent}>
                              {step.label}
                              {step.hypothesis ? " · hypothesis" : " · observed"}
                            </span>
                            <br />
                            {step.detail}
                          </li>
                        ))}
                      </ol>
                    </details>
                  ) : null}

                  <details className="rounded-xl border border-[var(--line)] bg-[rgba(5,8,16,0.3)] px-3 py-2">
                    <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">
                      Spec details (rationales, pilot, risks)
                    </summary>
                    <div className="mt-3 space-y-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">
                          Causal rationales
                        </p>
                        <ul className="mt-1 space-y-2">
                          {spec.rationales.slice(0, 3).map((r) => (
                            <li
                              key={r.id}
                              className="text-xs leading-relaxed text-[var(--text-muted)]"
                            >
                              <span className={direction.accent}>
                                {r.attributeOrSignal}
                              </span>
                              {" — "}
                              {r.creativeInterpretation}{" "}
                              <em className="text-[var(--text-dim)] not-italic">
                                ({r.whyItProducesMechanic})
                              </em>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <NarrativeBlock label="Pilot experiment">
                        {spec.pilotExperiment}
                      </NarrativeBlock>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">
                          Risks & unknowns
                        </p>
                        <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-[var(--text-muted)]">
                          {spec.risksAndUnknowns.map((risk) => (
                            <li key={risk}>{risk}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">
                          Feasibility assumptions
                        </p>
                        <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-[var(--text-muted)]">
                          {spec.feasibilityAssumptions.map((a) => (
                            <li key={a}>{a}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </details>
                </div>
              ) : narrative ? (
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
                  {concept.culturalInfluences.map((entity) => {
                    const role = spec?.influenceMap.find(
                      (m) => m.entityId === entity.id,
                    )?.role;
                    return (
                      <li
                        key={entity.id}
                        className="rounded-lg border border-[var(--line)] bg-[rgba(5,8,16,0.35)] px-2.5 py-1.5 text-xs text-[var(--text)]"
                      >
                        <span className={direction.accent}>
                          {entity.category}
                          {role ? `/${role}` : ""}
                        </span>
                        {" · "}
                        {entity.name}
                      </li>
                    );
                  })}
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
                    Structural heuristics only — not consumer demand, virality,
                    or Qloo Taste Graph scores.
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
