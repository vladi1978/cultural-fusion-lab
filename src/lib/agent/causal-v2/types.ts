/**
 * P2.1 — Experimental causal concept generator contract.
 *
 * Independent of the existing synthesis engine.
 * Cultural observations must not be confused with validated demand
 * or with creative design hypotheses.
 */

export interface CulturalObservation {
  entityId: string;
  signal: string;
  evidenceIds: string[];
}

export interface CausalAction {
  actor: string;
  verb: string;
  object: string;
  observableResult: string;
}

export interface CausalDecision {
  actor: string;
  question: string;
  options: [string, string, ...string[]];
  consequencesByOption: Record<string, string>;
}

export interface CausalConstraint {
  rule: string;
  enforcement: string;
}

export interface CausalConceptDraft {
  id: string;
  opportunityId: string;
  outputCategory: "product" | "brand" | "experience";

  observations: CulturalObservation[];

  opportunityHypothesis: string;

  action: CausalAction;
  decision: CausalDecision;
  constraint: CausalConstraint;

  consequence: string;

  causalExplanation: string;
  differentiationHypothesis: string;
  pilotExperiment: string;

  evidenceBoundary: string;
}

export interface CausalValidationResult {
  valid: boolean;
  failures: string[];
}

/**
 * Structural validation only.
 * Passing does not prove novelty, cultural relevance, or commercial demand.
 */
export function validateCausalDraft(
  draft: CausalConceptDraft,
): CausalValidationResult {
  const failures: string[] = [];

  const required: Array<[string, string]> = [
    ["opportunityId", draft.opportunityId],
    ["opportunityHypothesis", draft.opportunityHypothesis],
    ["action.actor", draft.action.actor],
    ["action.verb", draft.action.verb],
    ["action.object", draft.action.object],
    ["action.observableResult", draft.action.observableResult],
    ["decision.actor", draft.decision.actor],
    ["decision.question", draft.decision.question],
    ["constraint.rule", draft.constraint.rule],
    ["constraint.enforcement", draft.constraint.enforcement],
    ["consequence", draft.consequence],
    ["causalExplanation", draft.causalExplanation],
    ["differentiationHypothesis", draft.differentiationHypothesis],
    ["pilotExperiment", draft.pilotExperiment],
    ["evidenceBoundary", draft.evidenceBoundary],
  ];

  for (const [field, value] of required) {
    if (!value.trim()) failures.push(`${field} is empty`);
  }

  if (draft.observations.length < 2) {
    failures.push("At least two cultural observations are required");
  }

  for (const [index, observation] of draft.observations.entries()) {
    if (!observation.entityId.trim() || !observation.signal.trim()) {
      failures.push(`Observation ${index} lacks entity or signal`);
    }
    if (!observation.evidenceIds.length ||
        observation.evidenceIds.some(id => !id.trim())) {
      failures.push(`Observation ${index} lacks usable evidence IDs`);
    }
  }

  const options = draft.decision.options.map(option => option.trim());

  if (options.length < 2 || new Set(options).size !== options.length ||
      options.some(option => !option)) {
    failures.push("Decision requires distinct, nonempty options");
  }

  for (const option of options) {
    if (!draft.decision.consequencesByOption[option]?.trim()) {
      failures.push(`Missing consequence for decision option: ${option}`);
    }
  }

  return {
    valid: failures.length === 0,
    failures,
  };
}
