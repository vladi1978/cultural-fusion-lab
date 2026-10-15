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
 *
 * Separates:
 * - Structural / measurable heuristics (influence topical fit, claim grounding, mechanism presence)
 * - Subjective creativity / commercial viability (NOT scored as fact)
 *
 * Scores are lab instrumentation — not Qloo predictions or market forecasts.
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

  let relevance = clamp(0.65 * topicalAvg + 0.35 * topicalHitRate);
  notes.push(
    "Relevance heuristic = topical fit of influences (measurable). Not a creativity or demand score.",
  );

  const categories = new Set(concept.culturalInfluences.map((e) => e.category));
  const mechanismBonus = concept.spec?.mechanismId ? 0.2 : concept.directionId ? 0.1 : 0;
  const journeyBonus =
    concept.spec && concept.spec.journey.length >= 3 ? 0.15 : 0;
  const originality = clamp(
    0.4 * Math.min(1, categories.size / 3) +
      0.2 * Math.min(1, concept.affinityIds.length / 2) +
      0.2 * mechanismBonus +
      0.1 * journeyBonus +
      0.1 * (concept.mutationNote ? 0.9 : 0.5),
  );
  notes.push(
    "Originality heuristic rewards category spread + distinct mechanism structure — structural only; not proof of real-world originality.",
  );

  const groundedClaims = concept.claims.filter((c) => c.evidenceIds.length > 0);
  const culturalClaims = concept.claims.filter(
    (c) => c.kind === "cultural_reference",
  );
  const rationaleGrounding =
    concept.spec && concept.spec.rationales.length >= 3 ? 0.15 : 0;
  const evidenceCoverage = clamp(
    0.45 * (groundedClaims.length / Math.max(1, concept.claims.length)) +
      0.25 *
        (culturalClaims.every((c) => c.evidenceIds.length > 0) ? 1 : 0.2) +
      0.15 * Math.min(1, concept.evidenceIds.length / 3) +
      rationaleGrounding,
  );
  notes.push(
    `Evidence coverage checks claim→evidence links (${groundedClaims.length}/${concept.claims.length} grounded).`,
  );

  if (concept.spec) {
    notes.push(
      "ConceptSpec present: quality gates already enforced structural acceptance separately from these scores.",
    );
  }

  if ((concept.conflictIds?.length ?? 0) > 0) {
    notes.push(
      `Concept includes ${concept.conflictIds!.length} labeled unresolved conflict(s).`,
    );
  }

  if (totalEntityCount < 3) {
    notes.push("Sparse entity neighborhood reduced confidence.");
  }

  // Blend quality-gate structural scores when available (still not creativity proof)
  if (concept.qualityGate?.accepted && concept.spec) {
    relevance = clamp(0.85 * relevance + 0.15);
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
