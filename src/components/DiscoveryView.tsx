"use client";

import type { CulturalCluster, CulturalEntity } from "@/lib/types";
import { ENTITY_CATEGORY_LABELS } from "@/lib/types";

import { CulturalNetwork } from "./CulturalNetwork";

export function DiscoveryView({
  clusters,
  entities,
  onContinue,
}: {
  clusters: CulturalCluster[];
  entities: CulturalEntity[];
  onContinue: () => void;
}) {
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-white">Cultural Discovery</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Connected sample entities grouped by category. Affinity scores are
            fictional demo values.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={onContinue}>
          View Fusion Concepts
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <CulturalNetwork entities={entities} />
        <div className="space-y-3">
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
                      <span className="shrink-0 font-mono text-xs text-[var(--gold)]">
                        {entity.affinity.toFixed(2)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {entity.tags.slice(0, 3).map((tag) => (
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
      </div>
    </section>
  );
}
