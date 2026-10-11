/**
 * Objective topical-relevance gate.
 * Uses whole-token matching (not naive substrings) with stopword filtering.
 * Does not invent Qloo affinity scores.
 */

import type { CulturalEntity } from "../types";
import type {
  EntityRelevanceScore,
  InterpretedObjective,
  RelevanceGateResult,
} from "./types";
import { AgentError } from "./types";

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "for",
  "to",
  "of",
  "in",
  "on",
  "with",
  "by",
  "from",
  "that",
  "this",
  "into",
  "our",
  "their",
  "design",
  "create",
  "build",
  "make",
  "product",
  "brand",
  "experience",
  "cultural",
  "signal",
  "system",
  "object",
  "kit",
  "late",
]);

/** Conservative aliases — not Taste Graph edges. */
const ALIASES: Record<string, readonly string[]> = {
  coffee: ["coffee", "cafe", "espresso"],
  anime: ["anime", "manga"],
  streetwear: ["streetwear", "streetstyle"],
  electronic: ["electronic", "electronica", "synthwave"],
  culinary: ["culinary", "cuisine", "food"],
  wellness: ["wellness", "wellbeing"],
  jazz: ["jazz"],
  hospitality: ["hospitality", "hotel", "lounge"],
  listening: ["listening", "audiophile"],
};

export function tokenizeMeaningful(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s/-]/g, " ")
    .split(/[\s/-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

export function extractIntentTerms(interpreted: InterpretedObjective): string[] {
  const fromInterest = tokenizeMeaningful(interpreted.culturalInterest);
  // Keep multi-word interest as ordered tokens only (no char n-grams).
  const fromObjective = tokenizeMeaningful(interpreted.rawObjective).filter(
    (t) => !STOPWORDS.has(t),
  );
  // Primary topical terms = interest tokens; objective tokens are secondary soft hints.
  const primary = unique([...fromInterest]);
  const secondary = unique(
    fromObjective.filter((t) => !primary.includes(t)),
  ).slice(0, 6);
  return [...primary, ...secondary];
}

export function entityTermSet(entity: CulturalEntity): Set<string> {
  // Category labels are too broad (e.g. interest "electronic music" must not
  // match every music entity solely via category=music).
  const terms = [
    ...tokenizeMeaningful(entity.name),
    ...entity.tags.flatMap((tag) => tokenizeMeaningful(tag)),
    ...tokenizeMeaningful(entity.description).slice(0, 8),
  ];
  return new Set(terms);
}

export function termsMatch(intentTerm: string, entityTerms: Set<string>): boolean {
  const candidates = expandAliases(intentTerm);
  for (const candidate of candidates) {
    if (entityTerms.has(candidate)) return true;
    // Exact token only — reject "jazz" ⊂ "jazzercise"
  }
  return false;
}

function expandAliases(term: string): string[] {
  const base = [term, singularize(term)];
  const aliasHits = ALIASES[term] ?? ALIASES[singularize(term)] ?? [];
  return unique([...base, ...aliasHits]);
}

function singularize(term: string): string {
  if (term.endsWith("ies") && term.length > 4) return `${term.slice(0, -3)}y`;
  if (term.endsWith("s") && !term.endsWith("ss") && term.length > 3) {
    return term.slice(0, -1);
  }
  return term;
}

export function scoreEntityRelevance(
  entity: CulturalEntity,
  intentTerms: string[],
  primaryCount: number,
): EntityRelevanceScore {
  const entityTerms = entityTermSet(entity);
  const primaryTerms = intentTerms.slice(0, Math.max(1, primaryCount));
  const matchedTerms: string[] = [];

  for (const term of primaryTerms) {
    if (termsMatch(term, entityTerms)) matchedTerms.push(term);
  }

  // Soft secondary matches do not alone mark an entity relevant.
  const secondary = intentTerms.slice(primaryCount);
  let secondaryHits = 0;
  for (const term of secondary) {
    if (termsMatch(term, entityTerms)) secondaryHits += 1;
  }

  const primaryRatio =
    matchedTerms.length / Math.max(1, primaryTerms.length);
  const score = Math.min(
    1,
    primaryRatio + (secondaryHits > 0 ? 0.1 * Math.min(1, secondaryHits / 3) : 0),
  );

  // Require at least one primary interest-term hit.
  const relevant = matchedTerms.length > 0;

  return {
    entityId: entity.id,
    score: round3(score),
    matchedTerms,
    relevant,
  };
}

/**
 * Filter entities by topical relevance.
 * Distinguishes empty/insufficient volume from irrelevant neighborhoods.
 */
export function applyRelevanceGate(options: {
  entities: CulturalEntity[];
  interpreted: InterpretedObjective;
}): RelevanceGateResult {
  const interestTerms = tokenizeMeaningful(options.interpreted.culturalInterest);
  const allTerms = extractIntentTerms(options.interpreted);
  const primaryCount = Math.max(1, interestTerms.length);

  const scores = options.entities.map((entity) =>
    scoreEntityRelevance(entity, allTerms, primaryCount),
  );
  const scoreById = new Map(scores.map((s) => [s.entityId, s]));

  const kept = options.entities.filter(
    (e) => scoreById.get(e.id)?.relevant === true,
  );
  const rejected = options.entities.filter(
    (e) => scoreById.get(e.id)?.relevant !== true,
  );

  const notes = [
    `Intent terms (primary interest first): [${allTerms.join(", ")}]`,
    `Whole-token matching only — substring false positives are rejected.`,
    `Kept ${kept.length}/${options.entities.length} topical entities; rejected ${rejected.length}.`,
  ];

  return {
    intentTerms: allTerms,
    kept,
    rejected,
    scores,
    notes,
  };
}

export function assertTopicalNeighborhood(
  gate: RelevanceGateResult,
  collectedCount: number,
): void {
  if (collectedCount === 0) {
    throw new AgentError(
      "EMPTY_EVIDENCE",
      "Cultural evidence collection returned no entities.",
    );
  }

  if (collectedCount < 3) {
    throw new AgentError(
      "EMPTY_EVIDENCE",
      "Insufficient cultural evidence volume to build concepts.",
      `Collected ${collectedCount} entities before relevance filtering.`,
    );
  }

  if (gate.kept.length < 3) {
    const anyPrimaryHit = gate.scores.some((s) => s.matchedTerms.length > 0);
    throw new AgentError(
      "IRRELEVANT_EVIDENCE",
      anyPrimaryHit
        ? "Too few entities are topically relevant to the stated cultural interest."
        : "Collected entities are not topically relevant to the stated cultural interest.",
      `Relevant=${gate.kept.length}, rejected=${gate.rejected.length}. ${gate.notes.join(" ")}`,
    );
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
