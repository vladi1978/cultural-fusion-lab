import type {
  CulturalCluster,
  CulturalEntity,
  EntityCategory,
  EvidenceItem,
  ExplorationRequest,
  ExplorationResult,
  FusionConcept,
  OutputCategory,
} from "../types";
import type { QlooEntity, QlooEntityType, QlooTag } from "./schemas";

const SUBTYPE_TO_CATEGORY: Record<string, EntityCategory> = {
  "urn:entity:artist": "music",
  "urn:entity:movie": "film",
  "urn:entity:tv_show": "film",
  "urn:entity:brand": "brands",
  "urn:entity:place": "places",
  "urn:entity:locality": "places",
  "urn:entity:person": "other",
  "urn:entity:book": "other",
  "urn:entity:podcast": "other",
  "urn:entity:videogame": "other",
};

export const DISCOVERY_ENTITY_TYPES: QlooEntityType[] = [
  "urn:entity:artist",
  "urn:entity:movie",
  "urn:entity:brand",
  "urn:entity:place",
];

export function mapSubtypeToCategory(
  subtype?: string,
  type?: string,
): EntityCategory {
  if (subtype && SUBTYPE_TO_CATEGORY[subtype]) {
    return SUBTYPE_TO_CATEGORY[subtype];
  }
  if (type && SUBTYPE_TO_CATEGORY[type]) {
    return SUBTYPE_TO_CATEGORY[type];
  }
  return "other";
}

export function mapQlooEntityToCultural(entity: QlooEntity): CulturalEntity {
  const reportedAffinity = entity.query?.affinity ?? entity.affinity;
  const affinityRaw = reportedAffinity ?? entity.popularity ?? 0.5;
  const affinity = Math.max(0, Math.min(1, Number(affinityRaw) || 0.5));
  const description =
    entity.properties?.description ||
    entity.properties?.short_description ||
    `Qloo entity (${entity.subtype ?? entity.type ?? entity.types?.[0] ?? "unknown type"}).`;

  const tags = (entity.tags ?? [])
    .map((t) => t.name || t.id)
    .filter(Boolean)
    .slice(0, 24);

  return {
    id: entity.entity_id,
    name: entity.name,
    category: mapSubtypeToCategory(
      entity.subtype,
      entity.type ??
        entity.types?.find((type) => mapSubtypeToCategory(type) !== "other") ??
        entity.types?.[0],
    ),
    description,
    affinity: Math.round(affinity * 1000) / 1000,
    apiReportedAffinity:
      reportedAffinity !== undefined &&
      Number.isFinite(reportedAffinity) &&
      reportedAffinity >= 0 &&
      reportedAffinity <= 1
        ? reportedAffinity
        : undefined,
    tags,
  };
}

export function clusterCulturalEntities(
  entities: CulturalEntity[],
): CulturalCluster[] {
  const order: EntityCategory[] = [
    "music",
    "film",
    "brands",
    "places",
    "fashion",
    "food",
    "other",
  ];
  const labels: Record<EntityCategory, string> = {
    music: "Music",
    film: "Film & TV",
    brands: "Brands",
    places: "Places",
    fashion: "Fashion",
    food: "Food & Drink",
    other: "Other",
  };

  return order
    .map((category) => ({
      category,
      label: labels[category],
      entities: entities.filter((e) => e.category === category),
    }))
    .filter((c) => c.entities.length > 0);
}

function conceptTitles(
  output: OutputCategory,
  interest: string,
): [string, string, string] {
  const stem = interest.trim() || "cultural signal";
  if (output === "brand") {
    return [`House of ${stem}`, `${stem} Latitude Co.`, `Parallel ${stem} Studio`];
  }
  if (output === "experience") {
    return [
      `${stem} Night Laboratory`,
      `The ${stem} Crossing`,
      `${stem} Listening Circuit`,
    ];
  }
  return [
    `${stem} Resonance Kit`,
    `Atlas ${stem} Object System`,
    `Signalcraft ${stem} Edition`,
  ];
}

/**
 * Build fusion concepts from verified entities.
 * Concept copy is always labeled agent_hypothesis — never claimed as Qloo prediction.
 */
export function buildConceptsFromEntities(
  request: ExplorationRequest,
  entities: CulturalEntity[],
  evidenceBaseIds: string[],
): { concepts: FusionConcept[]; evidence: EvidenceItem[] } {
  const titles = conceptTitles(request.outputCategory, request.culturalInterest);
  const evidence: EvidenceItem[] = [];
  const concepts: FusionConcept[] = titles.map((title, i) => {
    const influences = [
      entities[i % entities.length]!,
      entities[(i + 2) % entities.length]!,
      entities[(i + 4) % entities.length]!,
    ];
    const hypId = `ev-hyp-live-${i}-${Date.now()}`;
    evidence.push({
      id: hypId,
      source: "agent_hypothesis",
      label: `Hypothesis: ${title}`,
      detail: `Creative positioning for a ${request.outputCategory} around “${request.creativeObjective}”. Not a predictive purchase, virality, or consumer-simulation claim.`,
      relatedEntityIds: influences.map((e) => e.id),
      createdAt: new Date().toISOString(),
    });

    return {
      id: `live-concept-${i}-${influences[0]!.id.slice(0, 8)}`,
      title,
      positioning: `A ${request.outputCategory} concept for audiences drawn to ${request.culturalInterest}${
        request.location ? ` in ${request.location}` : ""
      }, grounded in Taste Graph entities while the narrative remains a hypothesis.`,
      outputCategory: request.outputCategory,
      culturalInfluences: influences,
      evidenceIds: [...evidenceBaseIds, hypId],
      summary: `Blends ${influences.map((e) => e.name).join(", ")} into a ${request.outputCategory} narrative.`,
    };
  });

  return { concepts, evidence };
}

export function buildLiveExplorationResult(options: {
  request: ExplorationRequest;
  entities: CulturalEntity[];
  tags: QlooTag[];
  endpointNotes: string[];
  searchEntityIds?: string[];
  insightsEntityIds?: string[];
  insightsSeedIds?: string[];
}): ExplorationResult {
  const now = new Date().toISOString();
  const apiEvidence: EvidenceItem = {
    id: `ev-api-${Date.now()}`,
    source: "verified_api",
    label: "Qloo Taste Graph entities",
    detail: `Entities returned by documented Qloo endpoints (${options.endpointNotes.join(
      "; ",
    )}). Affinity/popularity values come from the API response when present.`,
    relatedEntityIds: options.entities.map((e) => e.id),
    createdAt: now,
  };

  const searchEvidence: EvidenceItem | null =
    options.searchEntityIds?.length
      ? {
          id: `ev-qloo-search-${Date.now()}`,
          source: "verified_api",
          label: "Qloo Search results",
          detail: "Entities returned by GET /search. Search alone does not establish an indirect Taste Graph relationship.",
          relatedEntityIds: options.searchEntityIds,
          createdAt: now,
        }
      : null;

  const insightsEvidence: EvidenceItem | null =
    options.insightsEntityIds?.length
      ? {
          id: `ev-qloo-insights-${Date.now()}`,
          source: "verified_api",
          label: "Qloo Insights results",
          detail: "Entities returned by GET /v2/insights using collected seed entities. Relationship relevance must still be validated.",
          relatedEntityIds: options.insightsEntityIds,
          insightSeedEntityIds: options.insightsSeedIds ?? [],
          createdAt: now,
        }
      : null;

  const tagEvidence: EvidenceItem | null =
    options.tags.length > 0
      ? {
          id: `ev-tags-${Date.now()}`,
          source: "verified_api",
          label: "Qloo tags",
          detail: `Tag search hits: ${options.tags
            .slice(0, 8)
            .map((t) => t.name)
            .join(", ")}.`,
          createdAt: now,
        }
      : null;

  const evidenceIds = [apiEvidence.id, ...(tagEvidence ? [tagEvidence.id] : [])];
  const { concepts, evidence: hypEvidence } = buildConceptsFromEntities(
    options.request,
    options.entities,
    evidenceIds,
  );

  return {
    mode: "live",
    request: options.request,
    clusters: clusterCulturalEntities(options.entities),
    entities: options.entities,
    concepts,
    evidence: [
      apiEvidence,
      ...(searchEvidence ? [searchEvidence] : []),
      ...(insightsEvidence ? [insightsEvidence] : []),
      ...(tagEvidence ? [tagEvidence] : []),
      ...hypEvidence,
    ],
    generatedAt: now,
    disclaimer:
      "LIVE MODE — Entity/tag rows marked verified API data come from Qloo. Concept positioning text is agent-generated hypothesis, not a Qloo forecast.",
  };
}
