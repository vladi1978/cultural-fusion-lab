import type { FusionConcept } from "../types";

export type SimilarityDimension =
  | "proposition"
  | "mechanics"
  | "journey"
  | "operatingRules"
  | "differentiation";

export interface SimilarityFinding {
  leftId: string;
  rightId: string;
  overall: number;
  dimensions: Record<SimilarityDimension, number>;
  flagged: boolean;
}

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this",
  "into", "their", "where", "while", "through", "using",
  "a", "an", "of", "to", "in", "on", "by", "as", "is",
]);

function tokens(text: string, removable: string[]): Set<string> {
  let normalized = text.toLowerCase().normalize("NFKD")
    .replace(/[\\u0300-\\u036f]/g, "");

  for (const phrase of removable) {
    const escaped = phrase.toLowerCase()
      .replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
    if (escaped) {
      normalized = normalized.replace(
        new RegExp(escaped, "g"), " "
      );
    }
  }

  return new Set(
    normalized.split(/[^a-z0-9]+/)
      .filter(word => word.length > 2 && !STOP_WORDS.has(word))
  );
}

function similarity(a: string, b: string, removable: string[]): number {
  const left = tokens(a, removable);
  const right = tokens(b, removable);

  if (!left.size || !right.size) return 0;

  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection++;
  }

  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
}

function textFields(concept: FusionConcept) {
  const spec = concept.spec;

  return {
    proposition: spec?.proposition ?? concept.summary,
    mechanics: spec?.mechanics ?? concept.positioning,
    journey: spec?.journey.map(step =>
      `${step.actor} ${step.action}`).join(" ") ?? "",
    operatingRules: spec?.operatingRules?.map(rule =>
      rule.rule).join(" ") ?? "",
    differentiation: spec?.differentiationHypothesis ?? "",
  };
}

export function compareConcepts(
  left: FusionConcept,
  right: FusionConcept,
  removableTerms: string[] = [],
): SimilarityFinding {
  const a = textFields(left);
  const b = textFields(right);

  const removable = [
    ...removableTerms,
    left.title,
    right.title,
  ];

  const dimensions: Record<SimilarityDimension, number> = {
    proposition: similarity(a.proposition, b.proposition, removable),
    mechanics: similarity(a.mechanics, b.mechanics, removable),
    journey: similarity(a.journey, b.journey, removable),
    operatingRules: similarity(
      a.operatingRules, b.operatingRules, removable
    ),
    differentiation: similarity(
      a.differentiation, b.differentiation, removable
    ),
  };

  const weights: Record<SimilarityDimension, number> = {
    proposition: 0.25,
    mechanics: 0.30,
    journey: 0.20,
    operatingRules: 0.15,
    differentiation: 0.10,
  };

  const available = (Object.keys(dimensions) as SimilarityDimension[])
    .filter(key => a[key].trim() && b[key].trim());

  const weightTotal = available.reduce(
    (sum, key) => sum + weights[key], 0
  );

  const overall = weightTotal
    ? available.reduce(
        (sum, key) => sum + dimensions[key] * weights[key], 0
      ) / weightTotal
    : 0;

  return {
    leftId: left.id,
    rightId: right.id,
    overall: Number(overall.toFixed(3)),
    dimensions,
    flagged: overall >= 0.72 ||
      (dimensions.proposition >= 0.8 &&
       dimensions.mechanics >= 0.8),
  };
}

export function auditConceptSimilarity(
  concepts: FusionConcept[],
  removableTerms: string[] = [],
): SimilarityFinding[] {
  const findings: SimilarityFinding[] = [];

  for (let i = 0; i < concepts.length; i++) {
    for (let j = i + 1; j < concepts.length; j++) {
      findings.push(
        compareConcepts(concepts[i]!, concepts[j]!, removableTerms)
      );
    }
  }

  return findings;
}
