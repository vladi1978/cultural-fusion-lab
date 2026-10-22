import type { ConceptSpec } from "../../types";
import type { CreativeFrame } from "./types";
import { assessCreativeFidelity } from "./fidelity";

/** Diagnostic triage, not a semantic judge. Never treat needs_review as approval. */
export type FidelityDisposition = "rejected" | "needs_review" | "provisionally_accepted";
export interface FidelityTriage {
  disposition: FidelityDisposition;
  reasons: string[];
  /** This result cannot establish semantic equivalence or cultural authenticity. */
  semanticVerificationRequired: boolean;
}

/**
 * Conservative bridge between lexical checks and future semantic adjudication.
 * The category contract is supplied by the caller, never inferred from examples.
 * No hardcoded cultures, industries, products, or paraphrase dictionaries.
 */
export function triageCreativeFidelity(
  frame: CreativeFrame,
  spec: ConceptSpec,
  options: { expectedOutputCategory?: string; declaredOutputCategory?: string } = {},
): FidelityTriage {
  const lexical = assessCreativeFidelity(frame, spec);
  const reasons: string[] = [];
  const expected = options.expectedOutputCategory?.trim().toLowerCase();
  const declared = options.declaredOutputCategory?.trim().toLowerCase();
  if (expected && declared && expected !== declared) {
    return { disposition: "rejected", reasons: [`Declared output category ${declared} conflicts with requested ${expected}`], semanticVerificationRequired: false };
  }
  if (expected && !declared) reasons.push("Output form has not been independently declared or verified");
  if (!lexical.accepted) reasons.push(...lexical.failures.map(f => `Lexical evidence insufficient: ${f}`));
  if (reasons.length) return { disposition: "needs_review", reasons, semanticVerificationRequired: true };

  const warnings = ["Lexical checks passed; semantic and cultural validity remain unverified"];
  if (lexical.warnings?.length) warnings.push(...lexical.warnings);
  if (frame.offBrief.length) {
    warnings.push("Off-brief exclusions require semantic verification; provisional status is not confirmation of compliance");
  }

  return {
    disposition: "provisionally_accepted",
    reasons: warnings,
    semanticVerificationRequired: true,
  };
}
