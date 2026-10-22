import type { CreativeFrame } from "./types";

export interface CulturalTransfer {
  domain: string;
  origin: string;
  sourceMechanisms: string[];
  designObligation: string;
}

export interface TransferContract {
  transfers: CulturalTransfer[];
  combinationRule: string;
  feasibilityRule: string;
  evidenceRule: string;
  exclusions: string[];
}

export function buildTransferContract(
  frame: CreativeFrame,
): TransferContract {
  return {
    transfers: frame.sourceDomains.map((domain) => ({
      domain: domain.name,
      origin: domain.origin,
      sourceMechanisms: [...domain.coreMechanics],
      designObligation:
        `Translate at least one mechanism from ${domain.name} ` +
        "into an observable operating rule. Explain which " +
        "participant action or service decision changes and why. " +
        "Do not assume the original cultural activity or " +
        "infrastructure must be reproduced.",
    })),
    combinationRule:
      "At least one essential operating decision must depend " +
      "on mechanisms from two different cultural domains. " +
      "Explain what would fail or materially change if either " +
      "domain were removed. Do not merely combine two features.",
    feasibilityRule:
      "Do not assume that local infrastructure, partnerships, " +
      "staffing, demand, or technology already exists. " +
      "Identify unverified dependencies and propose a small " +
      "experiment to test the most important one.",
    evidenceRule:
      "Distinguish cultural interpretation, creative hypothesis, " +
      "fictional demo metadata, and independently verified evidence. " +
      "Never present a hypothesis as an established fact.",
    exclusions: [...frame.offBrief],
  };
}


/**
 * Provides the exact structural slots required for cultural transfer.
 * Empty decisions are intentional: the model must design them.
 * This template is NOT evidence of a valid cultural transfer.
 */
export function buildOperationalTransferTemplate(frame: CreativeFrame) {
  return {
    transfers: frame.sourceDomains.map((domain) => ({
      sourceDomain: domain.name,
      sourceMechanism: domain.coreMechanics[0] ?? "",
      operatingDecision: "",
      participantAction: "",
      dependency: "",
    })),
    crossCulturalDependency: "",
    removalConsequences: frame.sourceDomains.map(() => ""),
    feasibilityUnknowns: [] as string[],
    pilotTest: "",
  };
}
