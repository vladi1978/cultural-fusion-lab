"use client";

import { RefreshCw, Shuffle } from "lucide-react";

import { getMutationCandidates } from "@/lib/demo-data";
import type { CulturalEntity, FusionConcept } from "@/lib/types";

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

  return (
    <section className="panel space-y-5 p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-white">Mutation Studio</h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            Change one cultural influence to generate a conceptual variant.
            Variants remain labeled mock / hypothesis data.
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Back to concepts
        </button>
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-[rgba(5,8,16,0.45)] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">
          Selected concept
        </p>
        <h3 className="mt-1 font-display text-xl text-white">{concept.title}</h3>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{concept.summary}</p>
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
        <p className="text-xs text-[var(--text-dim)]">
          Does not claim predictive purchase intent, virality, or consumer
          simulation.
        </p>
      </div>
    </section>
  );
}
