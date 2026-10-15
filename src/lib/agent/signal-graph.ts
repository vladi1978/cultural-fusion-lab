/**
 * Build a typed CulturalSignalGraph from collected evidence.
 * Does not invent Qloo relationships or behavioral patterns.
 */

import type { CulturalEntity, EvidenceItem, EvidenceSource } from "../types";
import { extractSignals } from "./mutation-transform";
import type {
  CrossCategoryAffinity,
  EvidenceConflict,
} from "./types";
import type {
  CulturalSignalGraph,
  ObservedSignalNode,
  SignalRelationship,
} from "./opportunity-types";

export function buildCulturalSignalGraph(options: {
  entities: CulturalEntity[];
  evidence: EvidenceItem[];
  affinities: CrossCategoryAffinity[];
  conflicts: EvidenceConflict[];
  provenanceByEntityId: Record<string, EvidenceSource>;
  mode: "demo" | "live";
}): CulturalSignalGraph {
  const {
    entities,
    evidence,
    affinities,
    conflicts,
    provenanceByEntityId,
    mode,
  } = options;

  const signals: ObservedSignalNode[] = [];
  for (const entity of entities) {
    const provenance = provenanceByEntityId[entity.id] ?? "agent_hypothesis";
    const evidenceIds = evidence
      .filter((e) => e.relatedEntityIds?.includes(entity.id))
      .map((e) => e.id);

    signals.push({
      id: `sig-${entity.id}-category`,
      entityId: entity.id,
      signal: entity.category,
      kind: "category",
      provenance,
      evidenceIds: [...evidenceIds],
    });

    for (const tag of entity.tags) {
      const normalized = tag.toLowerCase().trim();
      if (normalized.length < 2) continue;
      signals.push({
        id: `sig-${entity.id}-tag-${normalized}`,
        entityId: entity.id,
        signal: normalized,
        kind: "tag",
        provenance,
        evidenceIds: [...evidenceIds],
      });
    }

    // Normalized extractSignals that literally appear in tags stay as tags above;
    // only add non-tag normalized hits as attributes when grounded in corpus.
    const corpus = `${entity.name} ${entity.description} ${entity.tags.join(" ")}`.toLowerCase();
    for (const s of extractSignals(entity)) {
      const key = s.toLowerCase();
      if (entity.tags.some((t) => t.toLowerCase() === key)) continue;
      if (key === entity.category) continue;
      if (!corpus.includes(key) && !entity.tags.some((t) => t.toLowerCase().includes(key))) {
        continue;
      }
      if (signals.some((n) => n.entityId === entity.id && n.signal === key)) continue;
      signals.push({
        id: `sig-${entity.id}-attr-${key}`,
        entityId: entity.id,
        signal: key,
        kind: "normalized_attribute",
        provenance,
        evidenceIds: [...evidenceIds],
      });
    }
  }

  const relationships: SignalRelationship[] = [];

  for (const aff of affinities) {
    const leftProv = provenanceByEntityId[aff.leftEntityId] ?? "agent_hypothesis";
    const rightProv =
      provenanceByEntityId[aff.rightEntityId] ?? "agent_hypothesis";
    relationships.push({
      id: `rel-${aff.id}`,
      leftEntityId: aff.leftEntityId,
      rightEntityId: aff.rightEntityId,
      basis: aff.basis,
      sharedSignals: [...aff.sharedTags],
      evidenceIds: [...aff.evidenceIds],
      confidenceNote:
        aff.basis === "shared_tag"
          ? "Observed shared tag strings on collected entities — not a Qloo affinity score."
          : aff.basis === "api_reported_score"
            ? "Echoes an upstream API-reported score already present on the entity payload — not invented here."
            : "Co-collection only — weak structural link; labeled hypothesis, not verified cultural affinity.",
      provenanceMix: uniqueProv([leftProv, rightProv]),
    });
  }

  for (const conflict of conflicts) {
    const leftProv =
      provenanceByEntityId[conflict.leftEntityId] ?? "agent_hypothesis";
    const rightProv =
      provenanceByEntityId[conflict.rightEntityId] ?? "agent_hypothesis";
    relationships.push({
      id: `rel-${conflict.id}`,
      leftEntityId: conflict.leftEntityId,
      rightEntityId: conflict.rightEntityId,
      basis: "explicit_conflict",
      sharedSignals: [...conflict.opposition],
      evidenceIds: evidence
        .filter(
          (e) =>
            e.relatedEntityIds?.includes(conflict.leftEntityId) ||
            e.relatedEntityIds?.includes(conflict.rightEntityId),
        )
        .map((e) => e.id),
      confidenceNote:
        "Explicit opposing tags labeled unresolved — not a verified affinity and not a resolved synthesis.",
      provenanceMix: uniqueProv([leftProv, rightProv]),
    });
  }

  const uncertainties: string[] = [
    "Signal graph encodes only collected entity attributes and evidence-linked relationships.",
    "No Qloo Taste Graph edges, behavioral patterns, or market demand are invented.",
  ];
  if (mode === "demo") {
    uncertainties.push(
      "Demo mode: entity attributes are mock_demo fixtures, not live Taste Graph data.",
    );
  }
  if (relationships.some((r) => r.basis === "co_collected")) {
    uncertainties.push(
      "Some relationships are co-collection only and must not be read as verified affinity.",
    );
  }
  if (conflicts.length > 0) {
    uncertainties.push(
      `${conflicts.length} unresolved explicit tag opposition(s) are present.`,
    );
  }
  if (entities.length < 3) {
    uncertainties.push("Sparse entity neighborhood — opportunity confidence is limited.");
  }

  return {
    entities,
    signals,
    relationships,
    conflicts,
    uncertainties,
    mode,
    provenanceByEntityId,
  };
}

function uniqueProv(list: EvidenceSource[]): EvidenceSource[] {
  return [...new Set(list)];
}
