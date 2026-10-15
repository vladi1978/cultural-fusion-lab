/**
 * P1.18-D: Two independent identities for operating programs.
 * Structural identity is a conservative family/flow signature,
 * not a proof of full semantic equivalence.
 */

export interface ProgramIdentityInput {
  programId: string;
  outputCategory: string;
  opportunityKind: string;
  hingeId: string;
  secondaryId: string;
  primarySignal: string;
  secondarySignal: string;
  ruleIds: string[];
  journey: Array<{
    actor: string;
    influenceEntityIds: string[];
  }>;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\\s+/g, "_");
}

export function buildProgramIdentity(input: ProgramIdentityInput) {
  const culturalFingerprint = [
    input.hingeId,
    input.secondaryId,
    input.primarySignal,
    input.secondarySignal,
  ].map(normalize).join("|");

  const structuralFingerprint = [
    input.programId,
    input.outputCategory,
    input.opportunityKind,
    input.ruleIds.map(normalize).join(">"),
    input.journey.map(step =>
      `${normalize(step.actor)}:${step.influenceEntityIds.length}`
    ).join(">"),
  ].map(normalize).join("|");

  return { culturalFingerprint, structuralFingerprint };
}
