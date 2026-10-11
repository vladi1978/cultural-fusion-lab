import type { CulturalEntity, EvidenceItem, OutputCategory } from "../types";
import { conflictsForInfluences } from "./conflicts";
import type {
  ConceptClaim,
  CreativeDirectionId,
  CrossCategoryAffinity,
  EvidenceConflict,
  EvaluatedConcept,
  InterpretedObjective,
} from "./types";
import { AgentError } from "./types";

interface CreativeDirection {
  id: CreativeDirectionId;
  audience: string;
  valueProposition: string;
  mechanic: string;
}

const DIRECTIONS: CreativeDirection[] = [
  {
    id: "intimate",
    audience: "small groups seeking ritual attention",
    valueProposition: "slow, sensory intimacy over scale",
    mechanic: "guided one-to-few encounters",
  },
  {
    id: "communal",
    audience: "social explorers who gather in public culture",
    valueProposition: "shared discovery and belonging",
    mechanic: "rotating group circuits and open tables",
  },
  {
    id: "systems",
    audience: "builders who want modular cultural tooling",
    valueProposition: "recombinable components across contexts",
    mechanic: "kit/platform pieces that reconfigure per setting",
  },
];

/**
 * Generate three explainable, meaningfully different concept candidates.
 * Every cultural claim must reference evidence IDs (traceable).
 */
export function generateConceptCandidates(options: {
  interpreted: InterpretedObjective;
  entities: CulturalEntity[];
  evidence: EvidenceItem[];
  affinities: CrossCategoryAffinity[];
  conflicts?: EvidenceConflict[];
  seedKey: string;
}): { concepts: EvaluatedConcept[]; hypothesisEvidence: EvidenceItem[] } {
  const {
    interpreted,
    entities,
    evidence,
    affinities,
    conflicts = [],
    seedKey,
  } = options;

  if (entities.length < 3) {
    throw new AgentError(
      "EMPTY_EVIDENCE",
      "Need at least three cultural entities to generate concept candidates.",
      `Collected ${entities.length} entities.`,
    );
  }

  const patterns = buildDiverseInfluencePatterns(entities, conflicts);
  const hypothesisEvidence: EvidenceItem[] = [];
  const now = new Date().toISOString();
  const concepts: EvaluatedConcept[] = [];

  for (let index = 0; index < 3; index++) {
    const direction = DIRECTIONS[index]!;
    const influences = patterns[index]!;
    const title = conceptTitle(interpreted.outputCategory, interpreted, direction);
    const localConflicts = conflictsForInfluences(influences, conflicts);

    const affinityIds = affinities
      .filter((aff) =>
        influences.some(
          (inf) =>
            inf.id === aff.leftEntityId || inf.id === aff.rightEntityId,
        ),
      )
      .map((aff) => aff.id)
      .slice(0, 4);

    const entityEvidenceIds = evidence
      .filter((e) =>
        e.relatedEntityIds?.some((id) =>
          influences.some((inf) => inf.id === id),
        ),
      )
      .map((e) => e.id);

    if (entityEvidenceIds.length === 0) {
      throw new AgentError(
        "CLAIM_UNGROUNDED",
        "Cannot create a concept without traceable cultural evidence references.",
        `Concept index ${index} had no evidence-linked influences.`,
      );
    }

    const hypId = `ev-hyp-concept-${seedKey}-${index}`;
    hypothesisEvidence.push({
      id: hypId,
      source: "agent_hypothesis",
      label: `Hypothesis: ${title}`,
      detail: `Deterministic ${direction.id} direction for a ${interpreted.outputCategory} around “${interpreted.rawObjective}”. Creative synthesis only — not a predictive purchase, virality, or consumer-simulation claim.`,
      relatedEntityIds: influences.map((e) => e.id),
      createdAt: now,
    });

    const claims = buildClaims({
      title,
      influences,
      entityEvidenceIds,
      hypId,
      affinities: affinities.filter((a) => affinityIds.includes(a.id)),
      conflicts: localConflicts,
      interpreted,
      direction,
      index,
    });
    assertClaimsGrounded(claims);

    const locationBit = interpreted.location
      ? ` in ${interpreted.location}`
      : "";

    concepts.push({
      id: `agent-concept-${seedKey}-${index}`,
      title,
      positioning: `${capitalize(direction.id)} ${interpreted.outputCategory} for ${direction.audience}${locationBit}. Value: ${direction.valueProposition}. Mechanic: ${direction.mechanic}. Cultural interest “${interpreted.culturalInterest}” anchors the story; narrative remains an agent hypothesis.`,
      outputCategory: interpreted.outputCategory,
      culturalInfluences: influences,
      evidenceIds: unique([...entityEvidenceIds, hypId]),
      summary: `${direction.id} blend of ${influences.map((e) => e.name).join(", ")} for: ${interpreted.rawObjective}`,
      claims,
      affinityIds,
      directionId: direction.id,
      conflictIds: localConflicts.map((c) => c.id),
      evaluation: {
        relevance: 0,
        originality: 0,
        evidenceCoverage: 0,
        overall: 0,
        notes: [],
      },
    });
  }

  rejectNearDuplicates(concepts);
  return { concepts, hypothesisEvidence };
}

function conceptTitle(
  output: OutputCategory,
  interpreted: InterpretedObjective,
  direction: CreativeDirection,
): string {
  const stem = interpreted.culturalInterest.trim() || "cultural signal";
  const theme = interpreted.themes[0] ?? "fusion";

  if (output === "brand") {
    if (direction.id === "intimate") return `${stem} Chamber Co.`;
    if (direction.id === "communal") return `Commons of ${stem}`;
    return `${stem} Modular Studio`;
  }

  if (output === "experience") {
    if (direction.id === "intimate") return `${stem} Private Listening`;
    if (direction.id === "communal") return `${stem} Night Commons`;
    return `${theme} Circuit: ${stem}`;
  }

  if (direction.id === "intimate") return `${stem} Ritual Object`;
  if (direction.id === "communal") return `${stem} Gathering Kit`;
  return `${stem} Recombine System`;
}

function buildClaims(options: {
  title: string;
  influences: CulturalEntity[];
  entityEvidenceIds: string[];
  hypId: string;
  affinities: CrossCategoryAffinity[];
  conflicts: EvidenceConflict[];
  interpreted: InterpretedObjective;
  direction: CreativeDirection;
  index: number;
}): ConceptClaim[] {
  const {
    title,
    influences,
    entityEvidenceIds,
    hypId,
    affinities,
    conflicts,
    interpreted,
    direction,
    index,
  } = options;

  const claims: ConceptClaim[] = influences.map((entity, i) => ({
    id: `claim-ref-${index}-${i}`,
    statement: `Cultural anchor: “${entity.name}” (${entity.category}) informs the ${direction.id} ${interpreted.outputCategory} direction “${title}”.`,
    evidenceIds: entityEvidenceIds.slice(0, 3),
    kind: "cultural_reference" as const,
  }));

  for (const claim of claims) {
    if (claim.evidenceIds.length === 0) {
      claim.evidenceIds = [...entityEvidenceIds];
    }
  }

  claims.push({
    id: `claim-pos-${index}`,
    statement: `Positioning hypothesis (${direction.id}): ${title} serves ${direction.audience} via ${direction.mechanic}.`,
    evidenceIds: [hypId, ...entityEvidenceIds.slice(0, 2)],
    kind: "positioning_hypothesis",
  });

  for (const [ai, aff] of affinities.slice(0, 2).entries()) {
    claims.push({
      id: `claim-aff-${index}-${ai}`,
      statement: `Cross-category inference (${aff.basis}): ${aff.leftCategory} ↔ ${aff.rightCategory}${
        aff.sharedTags.length ? ` via tags [${aff.sharedTags.join(", ")}]` : ""
      }. ${aff.note}`,
      evidenceIds: [...aff.evidenceIds],
      kind: "affinity_inference",
    });
  }

  for (const [ci, conflict] of conflicts.slice(0, 2).entries()) {
    claims.push({
      id: `claim-conflict-${index}-${ci}`,
      statement: `Unresolved conflict labeled (not resolved): ${conflict.note}`,
      evidenceIds: [...entityEvidenceIds.slice(0, 2), hypId],
      kind: "positioning_hypothesis",
    });
  }

  return claims;
}

function assertClaimsGrounded(claims: ConceptClaim[]): void {
  for (const claim of claims) {
    if (!claim.evidenceIds.length) {
      throw new AgentError(
        "CLAIM_UNGROUNDED",
        "A cultural claim was generated without evidence references.",
        claim.statement,
      );
    }
  }
}

/**
 * Build three influence sets that differ by direction strategy:
 * - intimate: prefer place/music first, minimize conflicts
 * - communal: prefer brands/places with social tags
 * - systems: maximize category spread / modular mix
 * Fingerprints must be distinct whenever ≥4 entities are available.
 */
function buildDiverseInfluencePatterns(
  entities: CulturalEntity[],
  conflicts: EvidenceConflict[],
): CulturalEntity[][] {
  const byCategory = new Map<string, CulturalEntity[]>();
  for (const entity of entities) {
    const list = byCategory.get(entity.category) ?? [];
    list.push(entity);
    byCategory.set(entity.category, list);
  }

  const conflictPenalty = (picks: CulturalEntity[]): number =>
    conflictsForInfluences(picks, conflicts).length;

  const intimate = pickPattern(entities, byCategory, {
    preferCategories: ["places", "music", "food"],
    rotate: 0,
    minimizeConflicts: true,
    conflictPenalty,
  });
  const communal = pickPattern(entities, byCategory, {
    preferCategories: ["brands", "places", "film"],
    rotate: 1,
    minimizeConflicts: true,
    conflictPenalty,
  });
  const systems = pickPattern(entities, byCategory, {
    preferCategories: ["brands", "music", "fashion", "film"],
    rotate: 2,
    minimizeConflicts: false,
    conflictPenalty,
  });

  const patterns = [intimate, communal, systems];
  enforceDistinctFingerprints(patterns, entities, {
    preferCategoriesByIndex: [
      ["places", "music", "food"],
      ["brands", "places", "film"],
      ["brands", "music", "fashion", "film"],
    ],
    conflictPenalty,
  });
  return patterns;
}

function pickPattern(
  entities: CulturalEntity[],
  byCategory: Map<string, CulturalEntity[]>,
  options: {
    preferCategories: string[];
    rotate: number;
    minimizeConflicts: boolean;
    conflictPenalty: (picks: CulturalEntity[]) => number;
  },
): CulturalEntity[] {
  const categories = [
    ...options.preferCategories.filter((c) => byCategory.has(c)),
    ...[...byCategory.keys()].filter(
      (c) => !options.preferCategories.includes(c),
    ),
  ];

  let best: CulturalEntity[] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let attempt = 0; attempt < Math.max(8, entities.length * 2); attempt++) {
    const offset = options.rotate + attempt;
    const picks: CulturalEntity[] = [];

    for (const cat of categories) {
      if (picks.length >= 3) break;
      const bucket = byCategory.get(cat)!;
      const start = offset % bucket.length;
      const candidate =
        bucket.slice(start).find((e) => !picks.some((p) => p.id === e.id)) ??
        bucket.find((e) => !picks.some((p) => p.id === e.id));
      if (candidate) picks.push(candidate);
    }

    for (let k = 0; picks.length < 3 && k < entities.length; k++) {
      const candidate = entities[(offset + k) % entities.length]!;
      if (!picks.some((p) => p.id === candidate.id)) picks.push(candidate);
    }

    const unique = uniqueEntities(picks).slice(0, 3);
    if (unique.length < 3) continue;

    const penalty = options.minimizeConflicts
      ? options.conflictPenalty(unique) * 10
      : options.conflictPenalty(unique);
    const categorySpread = new Set(unique.map((e) => e.category)).size;
    const score = penalty - categorySpread;
    if (score < bestScore) {
      bestScore = score;
      best = unique;
    }
  }

  return (
    best ??
    uniqueEntities([
      entities[options.rotate % entities.length]!,
      entities[(options.rotate + 1) % entities.length]!,
      entities[(options.rotate + 2) % entities.length]!,
    ]).slice(0, 3)
  );
}

function enforceDistinctFingerprints(
  patterns: CulturalEntity[][],
  entities: CulturalEntity[],
  options: {
    preferCategoriesByIndex: string[][];
    conflictPenalty: (picks: CulturalEntity[]) => number;
  },
): void {
  const catalog = enumerateTriplets(entities);
  if (catalog.length < 3) {
    // Fewer than three distinct triplets possible — keep best-effort patterns.
    return;
  }

  const assigned = new Set<string>();
  for (let i = 0; i < patterns.length; i++) {
    const preferred = options.preferCategoriesByIndex[i] ?? [];
    const ranked = [...catalog].sort((a, b) => {
      const score = (picks: CulturalEntity[]) => {
        const cats = new Set(picks.map((e) => e.category)).size;
        const preferHits = picks.filter((e) =>
          preferred.includes(e.category),
        ).length;
        return (
          options.conflictPenalty(picks) * 8 - cats * 2 - preferHits
        );
      };
      return score(a) - score(b);
    });

    const current = patterns[i]!;
    const currentFp = fingerprintOf(current);
    if (!assigned.has(currentFp)) {
      assigned.add(currentFp);
      continue;
    }

    const replacement =
      ranked.find((candidate) => !assigned.has(fingerprintOf(candidate))) ??
      ranked[0]!;
    patterns[i] = replacement;
    assigned.add(fingerprintOf(replacement));
  }

  // Final pass: if any collision remains, force unused triplets in order.
  const used = new Set(patterns.map((p) => fingerprintOf(p)));
  if (used.size === patterns.length) return;

  const unused = catalog.filter((t) => !used.has(fingerprintOf(t)));
  const seen = new Set<string>();
  for (let i = 0; i < patterns.length; i++) {
    const fp = fingerprintOf(patterns[i]!);
    if (!seen.has(fp)) {
      seen.add(fp);
      continue;
    }
    const next = unused.shift();
    if (!next) break;
    patterns[i] = next;
    seen.add(fingerprintOf(next));
  }
}

function enumerateTriplets(entities: CulturalEntity[]): CulturalEntity[][] {
  const out: CulturalEntity[][] = [];
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      for (let k = j + 1; k < entities.length; k++) {
        out.push([entities[i]!, entities[j]!, entities[k]!]);
      }
    }
  }
  return out;
}

function rejectNearDuplicates(concepts: EvaluatedConcept[]): void {
  for (let i = 0; i < concepts.length; i++) {
    for (let j = i + 1; j < concepts.length; j++) {
      const a = concepts[i]!;
      const b = concepts[j]!;
      const titleSim =
        normalizeTitle(a.title) === normalizeTitle(b.title) ||
        tokenJaccard(
          normalizeTitle(a.title).split(/\s+/),
          normalizeTitle(b.title).split(/\s+/),
        ) > 0.85;
      const influenceIdsA = a.culturalInfluences.map((e) => e.id);
      const influenceIdsB = b.culturalInfluences.map((e) => e.id);
      const sameInfluences =
        fingerprintOf(a.culturalInfluences) ===
        fingerprintOf(b.culturalInfluences);
      const influenceSim =
        sameInfluences ||
        jaccard(new Set(influenceIdsA), new Set(influenceIdsB)) > 0.99;
      const directionSame = a.directionId && a.directionId === b.directionId;

      // Reject identical influence sets always; near-identical sets only when
      // direction also collapsed (directions should already differ).
      if (titleSim || sameInfluences || (influenceSim && directionSame)) {
        throw new AgentError(
          "VALIDATION",
          "Near-duplicate concept candidates were produced and rejected.",
          `${a.title} ≈ ${b.title}`,
        );
      }
    }
  }
}

function fingerprintOf(entities: CulturalEntity[]): string {
  return entities
    .map((e) => e.id)
    .sort()
    .join("|");
}

function uniqueEntities(list: CulturalEntity[]): CulturalEntity[] {
  const seen = new Set<string>();
  const out: CulturalEntity[] = [];
  for (const entity of list) {
    if (seen.has(entity.id)) continue;
    seen.add(entity.id);
    out.push(entity);
  }
  return out;
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const v of a) if (b.has(v)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function tokenJaccard(a: string[], b: string[]): number {
  return jaccard(new Set(a.filter(Boolean)), new Set(b.filter(Boolean)));
}
