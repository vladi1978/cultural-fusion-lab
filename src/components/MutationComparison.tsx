"use client";

import type { FusionConcept, MutationFieldDiff, MutationResult } from "@/lib/types";

const FIELD_LABELS: Record<MutationFieldDiff["field"], string> = {
  format: "Core format / what it is",
  mechanics: "Experience / product mechanics",
  audience: "Audience participation",
  inspiration: "Cultural inspiration role",
  distinctive: "Distinctive value",
};

export function MutationComparison({
  baseline,
  mutation,
}: {
  baseline: FusionConcept;
  mutation: MutationResult;
}) {
  const diffs =
    mutation.mutationDiffs ?? mutation.mutatedConcept.mutationDiffs ?? [];
  const changed = diffs.filter((d) => d.changed);

  return (
    <section className="panel space-y-5 p-5 sm:p-6">
      <div>
        <h3 className="font-display text-xl text-white sm:text-2xl">
          Mutation comparison
        </h3>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Structured before/after differences. Fields are only marked changed
          when generated text actually differs. Rationales are creative
          interpretations of entity metadata — not verified market effects.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ConceptSummaryCard label="Before" concept={baseline} tone="before" />
        <ConceptSummaryCard
          label="After"
          concept={mutation.mutatedConcept}
          tone="after"
        />
      </div>

      {changed.length > 0 ? (
        <ul className="space-y-3">
          {changed.map((diff) => (
            <li
              key={diff.field}
              className="rounded-2xl border border-[var(--line)] bg-[rgba(5,8,16,0.4)] px-4 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#a5f3fc]">
                  {FIELD_LABELS[diff.field]}
                </p>
                <span
                  className={`badge ${
                    diff.basis === "entity_metadata"
                      ? "badge-verified"
                      : "badge-hypothesis"
                  }`}
                >
                  {diff.basis === "entity_metadata"
                    ? "Entity metadata"
                    : "Creative interpretation"}
                </span>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-[var(--text-dim)]">
                    Before
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                    {diff.before}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-[#a5f3fc]">
                    After
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--text)]">
                    {diff.after}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-[#fde68a]">
                Why: {diff.why}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--text-dim)]">
          No structured field changes were recorded for this mutation.
        </p>
      )}

      {mutation.mutatedConcept.mutationNote ? (
        <p className="text-xs leading-relaxed text-[var(--text-dim)]">
          {mutation.mutatedConcept.mutationNote}
        </p>
      ) : null}
    </section>
  );
}

function ConceptSummaryCard({
  label,
  concept,
  tone,
}: {
  label: string;
  concept: FusionConcept;
  tone: "before" | "after";
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        tone === "before"
          ? "border-[var(--line)] bg-[rgba(5,8,16,0.4)]"
          : "border-[rgba(34,211,238,0.35)] bg-[rgba(34,211,238,0.08)]"
      }`}
    >
      <p
        className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${
          tone === "after" ? "text-[#a5f3fc]" : "text-[var(--text-dim)]"
        }`}
      >
        {label}
      </p>
      <p className="mt-1 font-display text-lg text-white">{concept.title}</p>
      <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">
        {concept.narrative?.whatItIs ?? concept.summary}
      </p>
      <ul className="mt-3 space-y-1">
        {concept.culturalInfluences.map((e) => (
          <li key={e.id} className="text-xs text-[var(--text-dim)]">
            {e.category} · {e.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
