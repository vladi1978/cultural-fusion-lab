/**
 * Subjective heuristic metrics for offline evaluation.
 * These are lab instrumentation scores — NOT scientifically validated
 * consumer predictions, virality forecasts, or Qloo Taste Graph metrics.
 */

import type {
  AgentExplorationResult,
  AgentMutationResult,
  EvaluatedConcept,
} from "../agent/types";
import type { SubjectiveMetrics } from "./types";

export function computeSubjectiveMetrics(
  result: AgentExplorationResult,
  mutation?: AgentMutationResult,
): SubjectiveMetrics {
  const concepts = result.concepts;
  const notes = [
    "Heuristic scores only — offline synthetic fixtures.",
    "Not scientifically validated consumer predictions.",
    "Not Qloo-verified affinity or purchase-intent metrics.",
  ];

  if (concepts.length === 0) {
    return {
      avgRelevance: 0,
      avgOriginality: 0,
      avgEvidenceCoverageHeuristic: 0,
      conceptDiversity: 0,
      notes,
    };
  }

  const avgRelevance = avg(concepts.map((c) => c.evaluation.relevance));
  const avgOriginality = avg(concepts.map((c) => c.evaluation.originality));
  const avgEvidenceCoverageHeuristic = avg(
    concepts.map((c) => c.evaluation.evidenceCoverage),
  );
  const conceptDiversity = computeConceptDiversity(concepts);

  let mutationConsistency: number | undefined;
  if (mutation) {
    mutationConsistency = scoreMutationConsistency(mutation);
    notes.push(
      `Mutation consistency heuristic=${mutationConsistency.toFixed(3)} (structural, not market validity).`,
    );
  }

  return {
    avgRelevance: round3(avgRelevance),
    avgOriginality: round3(avgOriginality),
    avgEvidenceCoverageHeuristic: round3(avgEvidenceCoverageHeuristic),
    conceptDiversity: round3(conceptDiversity),
    mutationConsistency,
    notes,
  };
}

/**
 * Diversity based on influence-set Jaccard distance across concept pairs.
 * 1 = maximally distinct influence sets; 0 = identical.
 */
export function computeConceptDiversity(concepts: EvaluatedConcept[]): number {
  if (concepts.length < 2) return 0;
  const sets = concepts.map(
    (c) => new Set(c.culturalInfluences.map((e) => e.id)),
  );

  let total = 0;
  let pairs = 0;
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      total += 1 - jaccard(sets[i]!, sets[j]!);
      pairs += 1;
    }
  }
  return pairs === 0 ? 0 : total / pairs;
}

function scoreMutationConsistency(mutation: AgentMutationResult): number {
  const original = mutation.originalConcept;
  const mutated = mutation.mutatedConcept;
  let score = 0;

  if (mutated.parentConceptId === original.id) score += 0.25;
  if (mutated.mutationNote) score += 0.15;
  if (mutated.id !== original.id) score += 0.15;

  const orig = new Set(original.culturalInfluences.map((e) => e.id));
  const next = new Set(mutated.culturalInfluences.map((e) => e.id));
  const intersection = [...orig].filter((id) => next.has(id)).length;
  const union = new Set([...orig, ...next]).size;
  // Expect partial overlap (one swap): ~2/3 for three influences
  const overlap = union === 0 ? 0 : intersection / union;
  if (overlap > 0.3 && overlap < 1) score += 0.25;

  const grounded = mutated.claims.every((c) => c.evidenceIds.length > 0);
  if (grounded) score += 0.2;

  return round3(Math.min(1, score));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const v of a) if (b.has(v)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
