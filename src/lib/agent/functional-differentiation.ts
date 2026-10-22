import type { FunctionalMechanism } from "./functional-mechanism";

export interface FunctionalDifferentiation {
  status: "comparison_required" | "insufficient_evidence";
  baseline: string;
  proposedDifference: string;
  measurementPlan: string;
  competitiveEvidence: "not_established";
  performanceEvidence: "not_established";
  noveltyClaimAllowed: false;
  conclusion: string;
}

export function assessFunctionalDifferentiation(
  object: string,
  mechanism: FunctionalMechanism,
): FunctionalDifferentiation {
  const product = object.trim();

  if (!product || mechanism.status !== "proposed") {
    return {
      status: "insufficient_evidence",
      baseline: "No verified comparison baseline established.",
      proposedDifference: "No justified functional difference established.",
      measurementPlan:
        "Identify an explicit functional need and a testable mechanism.",
      competitiveEvidence: "not_established",
      performanceEvidence: "not_established",
      noveltyClaimAllowed: false,
      conclusion:
        "Insufficient evidence to assess functional differentiation or novelty.",
    };
  }

  return {
    status: "comparison_required",
    baseline: `Identify and document an existing comparable ${product} with the same primary user function.`,
    proposedDifference: mechanism.mechanism,
    measurementPlan:
      `${mechanism.measurableEffect} ${mechanism.verification}`,
    competitiveEvidence: "not_established",
    performanceEvidence: "not_established",
    noveltyClaimAllowed: false,
    conclusion:
      "A testable functional difference has been proposed, but comparative performance, market differentiation, and novelty have not been demonstrated.",
  };
}
