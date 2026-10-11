import {
  extractIntentTerms,
  scoreEntityRelevance,
  tokenizeMeaningful,
} from "./relevance";
import type {
  InterpretedObjective,
  EvaluatedConcept,
  ConceptEvaluation,
} from "./types";

/**
 * Deterministic evaluation of concept candidates.
 * Scores are heuristic lab metrics — not Qloo predictions or market forecasts.
 * Relevance is based on influence topical fit, not title substring tricks.
 */
export function evaluateConcepts(options: {
  concepts: EvaluatedConcept[];
  interpreted: InterpretedObjective;
  totalEntityCount: number;
}): EvaluatedConcept[] {
  return options.concepts
    .map((concept) => {
      const evaluation = scoreConcept(
        concept,
        options.interpreted,
        options.totalEntityCount,
      );
      return { ...concept, evaluation };
    })
    .sort((a, b) => b.evaluation.overall - a.evaluation.overall);
}

export function evaluateSingleConcept(options: {
  concept: EvaluatedConcept;
  interpreted: InterpretedObjective;
  totalEntityCount: number;
}): EvaluatedConcept {
  return {
    ...options.concept,
    evaluation: scoreConcept(
      options.concept,
      options.interpreted,
      options.totalEntityCount,
    ),
  };
}

function scoreConcept(
  concept: EvaluatedConcept,
  interpreted: InterpretedObjective,
  totalEntityCount: number,
): ConceptEvaluation {
  const notes: string[] = [];
  const interestTerms = tokenizeMeaningful(interpreted.culturalInterest);
  const intentTerms = extractIntentTerms(interpreted);
  const primaryCount = Math.max(1, interestTerms.length);

  const influenceScores = concept.culturalInfluences.map((entity) =>
    scoreEntityRelevance(entity, intentTerms, primaryCount),
  );
  const topicalAvg =
    influenceScores.reduce((s, row) => s + row.score, 0) /
    Math.max(1, influenceScores.length);
  const topicalHitRate =
    influenceScores.filter((row) => row.relevant).length /
    Math.max(1, influenceScores.length);

  const relevance = clamp(0.65 * topicalAvg + 0.35 * topicalHitRate);
  notes.push(
    "Relevance heuristic uses whole-token topical fit of influences (not title substring tricks; not a Qloo score).",
  );

  const categories = new Set(concept.culturalInfluences.map((e) => e.category));
  const directionBonus = concept.directionId ? 0.15 : 0;
  const originality = clamp(
    0.45 * Math.min(1, categories.size / 3) +
      0.25 * Math.min(1, concept.affinityIds.length / 2) +
      0.15 * directionBonus +
      0.15 * (concept.mutationNote ? 0.9 : 0.55),
  );
  notes.push(
    "Originality heuristic rewards category spread + distinct creative direction — creative metric only; not inflated for marketing.",
  );

  const groundedClaims = concept.claims.filter((c) => c.evidenceIds.length > 0);
  const culturalClaims = concept.claims.filter(
    (c) => c.kind === "cultural_reference",
  );
  const evidenceCoverage = clamp(
    0.5 * (groundedClaims.length / Math.max(1, concept.claims.length)) +
      0.3 *
        (culturalClaims.every((c) => c.evidenceIds.length > 0) ? 1 : 0.2) +
      0.2 * Math.min(1, concept.evidenceIds.length / 3),
  );
  notes.push(
    `Evidence coverage checks claim→evidence links (${groundedClaims.length}/${concept.claims.length} grounded).`,
  );

  if ((concept.conflictIds?.length ?? 0) > 0) {
    notes.push(
      `Concept includes ${concept.conflictIds!.length} labeled unresolved conflict(s).`,
    );
  }

  if (totalEntityCount < 3) {
    notes.push("Sparse entity neighborhood reduced confidence.");
  }

  const overall = clamp(
    0.4 * relevance + 0.25 * originality + 0.35 * evidenceCoverage,
  );

  return {
    relevance: round3(relevance),
    originality: round3(originality),
    evidenceCoverage: round3(evidenceCoverage),
    overall: round3(overall),
    notes,
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
