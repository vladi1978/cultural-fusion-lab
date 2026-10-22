import type { CreativeFrame } from "./types";

export interface OperationalTransfer {
  sourceDomain: string;
  sourceMechanism: string;
  operatingDecision: string;
  participantAction: string;
  dependency: string;
}

export interface TransferValidationInput {
  transfers: OperationalTransfer[];
  crossCulturalDependency: string;
  removalConsequences: string[];
  feasibilityUnknowns: string[];
  pilotTest: string;
}

export interface TransferValidationResult {
  passed: boolean;
  failures: string[];
}

export function validateOperationalTransfer(
  frame: CreativeFrame,
  input: TransferValidationInput,
): TransferValidationResult {
  const failures: string[] = [];

  if (!Array.isArray(input.transfers)) {
    return {
      passed: false,
      failures: ["Missing structured cultural transfers"],
    };
  }

  for (const domain of frame.sourceDomains) {
    const matches = input.transfers.filter(
      (transfer) => transfer.sourceDomain === domain.name,
    );

    if (matches.length !== 1) {
      failures.push(
        `Expected exactly one transfer for ${domain.name}`,
      );
      continue;
    }

    const transfer = matches[0];

    if (!domain.coreMechanics.includes(transfer.sourceMechanism)) {
      failures.push(
        `Unrecognized source mechanism for ${domain.name}`,
      );
    }

    for (const field of [
      "operatingDecision",
      "participantAction",
      "dependency",
    ] as const) {
      if (
        typeof transfer[field] !== "string" ||
        transfer[field].trim().length < 20
      ) {
        failures.push(
          `Missing substantive ${field} for ${domain.name}`,
        );
      }
    }
  }

  if (input.transfers.length !== frame.sourceDomains.length) {
    failures.push("Unexpected or duplicated cultural transfers");
  }

  if (
    typeof input.crossCulturalDependency !== "string" ||
    input.crossCulturalDependency.trim().length < 40
  ) {
    failures.push("Missing cross-cultural dependency explanation");
  }

  if (
    !Array.isArray(input.removalConsequences) ||
    input.removalConsequences.length !== frame.sourceDomains.length ||
    input.removalConsequences.some(
      (item) => typeof item !== "string" || item.trim().length < 20,
    )
  ) {
    failures.push("Missing consequences of removing a cultural source");
  }

  if (
    !Array.isArray(input.feasibilityUnknowns) ||
    input.feasibilityUnknowns.length === 0
  ) {
    failures.push("Missing feasibility unknowns");
  }

  if (
    typeof input.pilotTest !== "string" ||
    input.pilotTest.trim().length < 30
  ) {
    failures.push("Missing concrete pilot test");
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}
