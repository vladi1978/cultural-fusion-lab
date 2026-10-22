import { describe, expect, it } from "vitest";
import { validateOperationalTransfer } from "./transfer-validation";
import type { CreativeFrame } from "./types";

const frame = {
  sourceDomains: [
    {
      name: "Culture A",
      origin: "Region A",
      essence: "Anticipatory coordination",
      coreMechanics: ["Anticipate needs before requests"],
    },
    {
      name: "Culture B",
      origin: "Region B",
      essence: "Shared reliability",
      coreMechanics: ["Coordinate collective safety"],
    },
  ],
  experientialGoals: ["Improve reliability"],
  requirements: ["Serve workers"],
  offBrief: ["Generic rental service"],
  evidenceProbes: [],
} satisfies CreativeFrame;

const validInput = {
  transfers: [
    {
      sourceDomain: "Culture A",
      sourceMechanism: "Anticipate needs before requests",
      operatingDecision: "Prepare the next service action before the worker requests it",
      participantAction: "The worker confirms whether the prepared action is useful",
      dependency: "Requires permission to use the worker's stated preferences",
    },
    {
      sourceDomain: "Culture B",
      sourceMechanism: "Coordinate collective safety",
      operatingDecision: "Coordinate service handoffs through a shared safety protocol",
      participantAction: "Participants confirm the handoff before proceeding",
      dependency: "Requires agreement on a common operating procedure",
    },
  ],
  crossCulturalDependency:
    "Anticipatory preparation determines when a handoff is needed, while collective coordination determines whether that handoff can proceed safely.",
  removalConsequences: [
    "Without anticipation, the service reacts too late to prepare handoffs",
    "Without collective coordination, prepared handoffs cannot be executed reliably",
  ],
  feasibilityUnknowns: [
    "Whether participants will consistently follow the handoff protocol",
  ],
  pilotTest:
    "Test twenty supervised handoffs and record preparation failures and coordination failures",
};

describe("operational cultural transfer validation", () => {
  it("accepts a structurally complete transfer", () => {
    expect(validateOperationalTransfer(frame, validInput).passed).toBe(true);
  });

  it("rejects a missing cultural source", () => {
    expect(
      validateOperationalTransfer(frame, {
        ...validInput,
        transfers: validInput.transfers.slice(0, 1),
      }).passed,
    ).toBe(false);
  });

  it("rejects invented source mechanisms", () => {
    expect(
      validateOperationalTransfer(frame, {
        ...validInput,
        transfers: [
          {
            ...validInput.transfers[0],
            sourceMechanism: "Invented mechanism",
          },
          validInput.transfers[1],
        ],
      }).passed,
    ).toBe(false);
  });

  it("rejects missing cross-cultural dependency", () => {
    expect(
      validateOperationalTransfer(frame, {
        ...validInput,
        crossCulturalDependency: "",
      }).passed,
    ).toBe(false);
  });

  it("rejects missing feasibility assumptions", () => {
    expect(
      validateOperationalTransfer(frame, {
        ...validInput,
        feasibilityUnknowns: [],
      }).passed,
    ).toBe(false);
  });
});
