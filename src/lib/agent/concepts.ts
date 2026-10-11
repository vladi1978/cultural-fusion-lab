import type {
  ConceptNarrative,
  CulturalEntity,
  EvidenceItem,
  OutputCategory,
} from "../types";
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
  label: string;
}

const DIRECTIONS: CreativeDirection[] = [
  {
    id: "intimate",
    label: "Intimate",
    audience: "small groups seeking ritual attention",
    valueProposition: "slow, sensory intimacy over scale",
    mechanic: "guided one-to-few encounters",
  },
  {
    id: "communal",
    label: "Communal",
    audience: "social explorers who gather in public culture",
    valueProposition: "shared discovery and belonging",
    mechanic: "rotating group circuits and open tables",
  },
  {
    id: "systems",
    label: "Systems",
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
  mode?: "demo" | "live";
}): { concepts: EvaluatedConcept[]; hypothesisEvidence: EvidenceItem[] } {
  const {
    interpreted,
    entities,
    evidence,
    affinities,
    conflicts = [],
    seedKey,
    mode = "demo",
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
    const title = conceptTitle(
      interpreted.outputCategory,
      interpreted,
      direction,
      influences,
    );
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
    const narrative = buildConceptNarrative({
      interpreted,
      direction,
      influences,
      localConflicts,
      modeLabel: mode,
    });
    hypothesisEvidence.push({
      id: hypId,
      source: "agent_hypothesis",
      label: `Hypothesis: ${title}`,
      detail: `${narrative.whatItIs} ${narrative.evidenceBoundary} Creative synthesis only — not a predictive purchase, virality, or consumer-simulation claim.`,
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
      narrative,
      index,
    });
    assertClaimsGrounded(claims);

    concepts.push({
      id: `agent-concept-${seedKey}-${index}`,
      title,
      positioning: composePositioning(narrative),
      outputCategory: interpreted.outputCategory,
      culturalInfluences: influences,
      evidenceIds: unique([...entityEvidenceIds, hypId]),
      summary: narrative.whatItIs,
      narrative,
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

/** Public helper for mutation / tests — rebuild a concrete narrative from influences. */
export function buildConceptNarrative(options: {
  interpreted: InterpretedObjective;
  direction: CreativeDirection | CreativeDirectionId;
  influences: CulturalEntity[];
  localConflicts?: EvidenceConflict[];
  modeLabel?: "demo" | "live";
}): ConceptNarrative {
  const direction =
    typeof options.direction === "string"
      ? DIRECTIONS.find((d) => d.id === options.direction) ?? DIRECTIONS[0]!
      : options.direction;
  const { interpreted, influences } = options;
  const conflicts = options.localConflicts ?? [];
  const interest = interpreted.culturalInterest.trim();
  const location = interpreted.location?.trim();
  const theme = interpreted.themes[0] ?? "cultural-fusion";
  const byCat = pickByCategory(influences);
  const names = influences.map((e) => e.name);
  const tagPool = uniqueTags(influences).slice(0, 4);
  const tagPhrase = tagPool.length
    ? `signals like ${tagPool.map((t) => `“${t}”`).join(", ")}`
    : `the collected ${interest} neighborhood`;

  const place = byCat.places?.[0];
  const music = byCat.music?.[0];
  const brand = byCat.brands?.[0];
  const film = byCat.film?.[0];
  const food = byCat.food?.[0];
  const fashion = byCat.fashion?.[0];
  const hinge = place ?? music ?? brand ?? influences[0]!;
  const accent = music ?? film ?? brand ?? influences[1] ?? hinge;

  const where = location ? ` in ${location}` : "";
  const output = interpreted.outputCategory;

  let whatItIs: string;
  let whoItServes: string;
  let howItWorks: string;
  let distinctive: string;

  if (direction.id === "intimate") {
    whoItServes = `Hosts and guests who want ${interest} to feel personal${where} — typically 2–6 people, not a crowd.`;
    if (output === "product") {
      whatItIs = `A tactile ${interest} ritual object that stages a short, seated encounter — closer to a chamber instrument than a mass SKU.`;
      howItWorks = `Guests arrive at a calm setting inspired by ${hinge.name}; a facilitator uses cues from ${accent.name} to pace listening, touch, and conversation across a 20–40 minute arc.`;
      distinctive = `Prioritizes slow, sensory intimacy over scale: one shared object, one clear ritual, zero spectacle.`;
    } else if (output === "brand") {
      whatItIs = `A quiet ${interest} house brand built around private membership rituals rather than loud campaigns.`;
      howItWorks = `Members receive limited ritual kits and invitation-only sessions; visual language borrows restraint from ${hinge.name} and sonic pacing from ${accent.name}.`;
      distinctive = `Brand equity comes from scarcity of attention, not logo noise — intimacy is the product.`;
    } else {
      whatItIs = `A private ${interest} listening salon${where}: reserved seats, low light, and a single curated arc.`;
      howItWorks = `Small groups rotate through a space echoing ${place?.name ?? hinge.name}; programming stitches ${music?.name ?? accent.name} with tactile pauses so conversation stays secondary to attention.`;
      distinctive = `The experience sells focus — guided one-to-few encounters instead of nightlife volume.`;
    }
  } else if (direction.id === "communal") {
    whoItServes = `Social explorers who discover ${interest} together${where} — people who want belonging through shared cultural nights.`;
    if (output === "product") {
      whatItIs = `A portable ${interest} gathering kit that turns any table into a short communal circuit.`;
      howItWorks = `Hosts unpack prompts and objects tied to ${hinge.name}; groups rotate roles every few minutes while ${accent.name} sets the social tempo.`;
      distinctive = `Built for shared discovery and belonging — the kit only works when people trade turns.`;
    } else if (output === "brand") {
      whatItIs = `“Commons of ${titleStem(interest)}” — a public-facing brand platform for open cultural tables and night circuits.`;
      howItWorks = `Pop-up commons borrow spatial cues from ${place?.name ?? hinge.name} and narrative cues from ${film?.name ?? accent.name}; community hosts run recurring open sessions.`;
      distinctive = `The brand lives in gatherings first; merch is secondary to the commons.`;
    } else {
      whatItIs = `A ${interest} night commons${where}: open tables, rotating stations, and a shared closing circle.`;
      howItWorks = `Guests move through stations inspired by ${names.slice(0, 2).join(" and ")}; facilitators keep the circuit loose so strangers can join mid-flow.`;
      distinctive = `Designed for social explorers — belonging comes from co-presence, not VIP scarcity.`;
    }
  } else {
    whoItServes = `Builders, operators, and cultural producers who want ${interest} tooling they can reconfigure across venues${where}.`;
    if (output === "product") {
      whatItIs = `A modular ${interest} recombine system — interchangeable parts that reassemble for different rooms and nights.`;
      howItWorks = `Operators snap components derived from ${brand?.name ?? hinge.name}, ${music?.name ?? accent.name}, and ${place?.name ?? fashion?.name ?? influences[2]?.name ?? hinge.name} into venue-specific layouts.`;
      distinctive = `Value is recombinable components across contexts — one system, many configurations.`;
    } else if (output === "brand") {
      whatItIs = `${titleStem(interest)} Modular Studio — a platform brand for remixable cultural kits and venue playbooks.`;
      howItWorks = `Studios license modules; each deployment pairs a spatial pattern (from ${place?.name ?? hinge.name}) with a media pattern (from ${film?.name ?? music?.name ?? accent.name}).`;
      distinctive = `The brand sells a kit/platform that reconfigures per setting rather than a single fixed identity.`;
    } else {
      whatItIs = `A programmable ${interest} circuit experience${where}: stations that operators can reorder like patches on a board.`;
      howItWorks = `Teams assemble a night from modules referencing ${names.join(", ")}; each run logs which station order worked without claiming market proof.`;
      distinctive = `Experience mechanics are modular — remix the path, keep the cultural spine.`;
    }
  }

  // Soft theme coloration without dumping the raw objective string.
  if (theme === "nocturnal" && !/night|nocturnal|after-hours/i.test(whatItIs)) {
    whatItIs = whatItIs.replace(/\.$/, " for after-hours pacing.");
  }
  if (theme === "hospitality" && food) {
    howItWorks = `${howItWorks} A light hospitality beat from ${food.name} keeps the arc welcoming without turning into a restaurant concept.`;
  }

  const inspiredBy = `Influences: ${influences
    .map((e) => `${e.name} (${e.category})`)
    .join(" · ")}. Drawn from ${tagPhrase}.`;

  const conflictNote =
    conflicts.length > 0
      ? ` Unresolved tag tensions were labeled (e.g. ${conflicts[0]!.opposition.join(" vs ")}) and not inventively resolved.`
      : "";

  const evidenceBoundary =
    options.modeLabel === "live"
      ? `Cultural anchors cite verified or collected evidence IDs; the ${direction.label.toLowerCase()} proposal itself is an agent hypothesis — not a Qloo forecast or market validation.`
      : `In Demo Mode, entity anchors are mock demo evidence; the ${direction.label.toLowerCase()} proposal, audience framing, and mechanics are agent hypotheses — not Qloo Taste Graph scores or consumer demand proof.${conflictNote}`;

  return {
    whatItIs,
    whoItServes,
    howItWorks,
    distinctive,
    inspiredBy,
    evidenceBoundary,
  };
}

export function composePositioning(narrative: ConceptNarrative): string {
  return `${narrative.whatItIs} ${narrative.whoItServes} ${narrative.howItWorks} Distinctive: ${narrative.distinctive} ${narrative.inspiredBy} ${narrative.evidenceBoundary}`;
}

function conceptTitle(
  output: OutputCategory,
  interpreted: InterpretedObjective,
  direction: CreativeDirection,
  influences: CulturalEntity[],
): string {
  const interest = titleStem(interpreted.culturalInterest);
  const theme = interpreted.themes[0] ?? "fusion";
  const byCat = pickByCategory(influences);
  const placeBit = shortName(byCat.places?.[0]?.name);
  const musicBit = shortName(byCat.music?.[0]?.name);
  const brandBit = shortName(byCat.brands?.[0]?.name);
  const filmBit = shortName(byCat.film?.[0]?.name);

  if (output === "brand") {
    if (direction.id === "intimate") {
      return placeBit
        ? `${placeBit} Chamber Co.`
        : `${interest} Chamber Co.`;
    }
    if (direction.id === "communal") {
      return `Commons of ${interest}`;
    }
    return brandBit
      ? `${brandBit} Modular Studio`
      : `${interest} Modular Studio`;
  }

  if (output === "experience") {
    if (direction.id === "intimate") {
      return musicBit
        ? `${musicBit} Private Listening`
        : `${interest} Private Listening`;
    }
    if (direction.id === "communal") {
      return placeBit
        ? `${placeBit} Night Commons`
        : `${interest} Night Commons`;
    }
    return filmBit
      ? `${capitalize(theme)} Circuit · ${filmBit}`
      : `${capitalize(theme)} Circuit · ${interest}`;
  }

  if (direction.id === "intimate") {
    return placeBit
      ? `${placeBit} Ritual Object`
      : `${interest} Ritual Object`;
  }
  if (direction.id === "communal") {
    return brandBit
      ? `${brandBit} Gathering Kit`
      : `${interest} Gathering Kit`;
  }
  return musicBit
    ? `${musicBit} Recombine System`
    : `${interest} Recombine System`;
}

function titleStem(interest: string): string {
  const cleaned = interest.trim();
  if (!cleaned) return "Cultural Signal";
  return cleaned
    .split(/\s+/)
    .map((w) => capitalize(w))
    .join(" ");
}

function shortName(name?: string): string | undefined {
  if (!name) return undefined;
  const parts = name.replace(/^Eval\s+/i, "").replace(/^Mock\s+/i, "").split(/\s+/);
  if (parts.length === 1) return parts[0];
  // Prefer first distinctive token (skip very short articles)
  return parts.filter((p) => p.length > 2).slice(0, 2).join(" ");
}

function pickByCategory(
  influences: CulturalEntity[],
): Partial<Record<CulturalEntity["category"], CulturalEntity[]>> {
  const map: Partial<Record<CulturalEntity["category"], CulturalEntity[]>> = {};
  for (const entity of influences) {
    const list = map[entity.category] ?? [];
    list.push(entity);
    map[entity.category] = list;
  }
  return map;
}

function uniqueTags(entities: CulturalEntity[]): string[] {
  const tags: string[] = [];
  for (const entity of entities) {
    for (const tag of entity.tags) {
      if (!tags.includes(tag)) tags.push(tag);
    }
  }
  return tags;
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
  narrative: ConceptNarrative;
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
    narrative,
    index,
  } = options;

  const claims: ConceptClaim[] = influences.map((entity, i) => ({
    id: `claim-ref-${index}-${i}`,
    statement: `Cultural anchor: “${entity.name}” (${entity.category}) informs the ${direction.id} ${interpreted.outputCategory} “${title}”.`,
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
    statement: `Positioning hypothesis (${direction.id}): ${narrative.whatItIs} Serves ${direction.audience} via ${direction.mechanic}.`,
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
