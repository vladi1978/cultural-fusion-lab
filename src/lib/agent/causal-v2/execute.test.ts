import { describe, expect, it } from "vitest";
import { executeCausalDecision } from "./execute";
import type { CausalConceptDraft } from "./types";

function draft(verb: string, options: [string, string]): CausalConceptDraft {
  return {
    id: "test",
    opportunityId: "op-test",
    outputCategory: "product",
    observations: [
      { entityId: "a", signal: "night", evidenceIds: ["e1"] },
      { entityId: "b", signal: "listening", evidenceIds: ["e2"] },
    ],
    opportunityHypothesis: "Test",
    action: {
      actor: "Participant",
      verb,
      object: "prototype",
      observableResult: "observable outcome",
    },
    decision: {
      actor: "Participant",
      question: "Choose a path",
      options,
      consequencesByOption: {
        [options[0]]: "Outcome A",
        [options[1]]: "Outcome B",
      },
    },
    constraint: {
      rule: "Test rule",
      enforcement: "Test enforcement",
    },
    consequence: "Test consequence",
    causalExplanation: "Test causal explanation",
    differentiationHypothesis: "Test differentiation",
    pilotExperiment: "Test pilot",
    evidenceBoundary: "Synthetic test data",
  };
}

describe("P2.7 executable causal decisions", () => {
  it("enforces a night access window", () => {
    const concept = draft("unlock", [
      "Activate the night access window",
      "Offer an unrestricted listening preview",
    ]);

    expect(executeCausalDecision(concept, {
      selectedOption: concept.decision.options[0],
      withinTimeWindow: false,
    }).state).toBe("locked");

    expect(executeCausalDecision(concept, {
      selectedOption: concept.decision.options[0],
      withinTimeWindow: true,
    }).state).toBe("unlocked");

    expect(executeCausalDecision(concept, {
      selectedOption: concept.decision.options[1],
    }).state).toBe("preview");
  });

  it("enforces the listening checkpoint", () => {
    const concept = draft("assemble", [
      "Complete the listening checkpoint before release",
      "Release the artifact without the listening checkpoint",
    ]);

    expect(executeCausalDecision(concept, {
      selectedOption: concept.decision.options[0],
      listeningCompleted: false,
    }).state).toBe("locked");

    expect(executeCausalDecision(concept, {
      selectedOption: concept.decision.options[0],
      listeningCompleted: true,
    }).state).toBe("released");

    expect(executeCausalDecision(concept, {
      selectedOption: concept.decision.options[1],
    }).state).toBe("released");
  });

  it("rejects an unknown option", () => {
    const concept = draft("unlock", ["A", "B"]);

    expect(executeCausalDecision(concept, {
      selectedOption: "Unknown",
    }).state).toBe("unsupported");
  });
});
