"use client";

import type {
  CulturalAffinityLink,
  CulturalCluster,
  CulturalEntity,
  EvidenceItem,
} from "@/lib/types";
import { ENTITY_CATEGORY_LABELS } from "@/lib/types";

import { CulturalNetwork } from "./CulturalNetwork";

export function DiscoveryView({
  clusters,
  entities,
  affinities,
  evidence,
  mode,
  onContinue,
}: {
  clusters: CulturalCluster[];
  entities: CulturalEntity[];
  affinities?: CulturalAffinityLink[];
  evidence?: EvidenceItem[];
  mode?: "demo" | "live";
  onContinue: () => void;
}) {
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-white sm:text-3xl">
            Cultural Discovery
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Inspect the neighborhood behind your concepts. Numeric demo
            affinities are hidden so they cannot be mistaken for Qloo scores.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={onContinue}>
          Back to Fusion Concepts
        </button>
      </div>

      <CulturalNetwork
        entities={entities}
        affinities={affinities}
        evidence={evidence}
        mode={mode}
      />

      <div className="grid gap-3 md:grid-cols-2">
        {clusters.map((cluster) => (
          <div key={cluster.category} className="panel p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#a5f3fc]">
                {ENTITY_CATEGORY_LABELS[cluster.category]}
              </h3>
              <span className="badge badge-violet">
                {cluster.entities.length}
              </span>
            </div>
            <ul className="space-y-2">
              {cluster.entities.map((entity) => (
                <li
                  key={entity.id}
                  className="rounded-xl border border-[var(--line)] bg-[rgba(5,8,16,0.4)] px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {entity.name}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        {entity.description}
                      </p>
                    </div>
                    {mode === "demo" ? (
                      <span className="badge badge-demo shrink-0 !normal-case tracking-normal">
                        Demo entity
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {entity.tags.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--text-dim)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
