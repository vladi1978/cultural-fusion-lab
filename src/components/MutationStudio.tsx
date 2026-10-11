"use client";

import { ArrowRight, RefreshCw, Shuffle } from "lucide-react";

import { getMutationCandidates } from "@/lib/demo-data";
import type { CulturalEntity, FusionConcept } from "@/lib/types";

function InfluenceCard({
  label,
  entity,
  tone,
}: {
  label: string;
  entity?: CulturalEntity;
  tone: "before" | "after";
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        tone === "before"
          ? "border-[var(--line)] bg-[rgba(5,8,16,0.45)]"
          : "border-[rgba(34,211,238,0.35)] bg-[rgba(34,211,238,0.08)]"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">
        {label}
      </p>
      {entity ? (
        <>
          <p className="mt-1 font-display text-lg text-white">{entity.name}</p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {entity.category}
            {entity.tags[0] ? ` · ${entity.tags[0]}` : ""}
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-[var(--text-dim)]">Select an influence</p>
      )}
    </div>
  );
}

export function MutationStudio({
  concept,
  entities,
  replaceEntityId,
  newEntityId,
  onReplaceChange,
  onNewChange,
  onMutate,
  onBack,
  isLoading,
}: {
  concept: FusionConcept;
  entities: CulturalEntity[];
  replaceEntityId: string;
  newEntityId: string;
  onReplaceChange: (id: string) => void;
  onNewChange: (id: string) => void;
  onMutate: () => void;
  onBack: () => void;
  isLoading: boolean;
}) {
  const candidates = getMutationCandidates(
    entities,
    concept.culturalInfluences.map((e) => e.id),
  );
  const outgoing = concept.culturalInfluences.find(
    (e) => e.id === replaceEntityId,
  );
  const incoming = candidates.find((e) => e.id === newEntityId);

  return (
    <section className="panel space-y-5 p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-white sm:text-3xl">
            Mutation Studio
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            Swap one cultural influence and re-author the concept. Evidence
            provenance is preserved; the evolved narrative stays labeled as
            hypothesis.
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Back to concepts
        </button>
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-[rgba(5,8,16,0.45)] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">
          Before — selected concept
        </p>
        <h3 className="mt-1 font-display text-xl text-white">{concept.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
          {concept.narrative?.whatItIs ?? concept.summary}
        </p>
        {concept.narrative ? (
          <p className="mt-2 text-xs text-[var(--text-dim)]">
            Serves: {concept.narrative.whoItServes}
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <InfluenceCard label="Outgoing influence" entity={outgoing} tone="before" />
        <div className="hidden justify-center md:flex">
          <ArrowRight className="h-5 w-5 text-cyan" aria-hidden />
        </div>
        <InfluenceCard label="Incoming influence" entity={incoming} tone="after" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="replace-entity">
            Influence to replace
          </label>
          <select
            id="replace-entity"
            className="field-select"
            value={replaceEntityId}
            onChange={(e) => onReplaceChange(e.target.value)}
          >
            {concept.culturalInfluences.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.name} ({entity.category})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="new-entity">
            Replacement influence
          </label>
          <select
            id="new-entity"
            className="field-select"
            value={newEntityId}
            onChange={(e) => onNewChange(e.target.value)}
          >
            {candidates.length === 0 ? (
              <option value="">No alternate entities available</option>
            ) : (
              candidates.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name} ({entity.category})
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      <div className="rounded-2xl border border-[rgba(34,211,238,0.25)] bg-[rgba(34,211,238,0.06)] px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#a5f3fc]">
          After — expected evolution
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
          {outgoing && incoming
            ? `“${outgoing.name}” leaves the influence set; “${incoming.name}” becomes the new cultural hinge. The ${concept.directionId ?? "concept"} direction is re-authored around that swap, then re-evaluated with claim→evidence links intact.`
            : "Choose both sides of the swap to preview how the concept will evolve."}
        </p>
        <p className="mt-2 text-xs text-[var(--text-dim)]">
          Does not claim predictive purchase intent, virality, or consumer
          simulation. Demo affinities remain fictional.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn btn-primary"
          disabled={isLoading || !replaceEntityId || !newEntityId}
          onClick={onMutate}
        >
          {isLoading ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
              Mutating…
            </>
          ) : (
            <>
              <Shuffle className="h-4 w-4" aria-hidden />
              Generate Variant
            </>
          )}
        </button>
      </div>
    </section>
  );
}
