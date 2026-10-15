import { describe, expect, it } from "vitest";
import {
  validateCausalDraft,
  type CausalConceptDraft,
} from "./types";

const fixture: CausalConceptDraft = {
  id: "experimental-1",
  opportunityId: "opportunity-1",
  outputCategory: "product",
  observations: [
    { entityId: "entity-a", signal: "craft", evidenceIds: ["ev-a"] },
    { entityId: "entity-b", signal: "listening", evidenceIds: ["ev-b"] },
  ],
  opportunityHypothesis: "Test whether craft and listening can jointly shape use.",
  action: {
    actor: "Participant",
    verb: "assemble",
    object: "a configurable prototype",
    observableResult: "A completed configuration",
  },
  decision: {
    actor: "Participant",
    question: "Which configuration should be tested?",
    options: ["A", "B"],
    consequencesByOption: {
      A: "Configuration A is tested",
      B: "Configuration B is tested",
    },
  },
  constraint: {
    rule: "A configuration must be completed before testing",
    enforcement: "Block testing until a configuration exists",
  },
  consequence: "The selected configuration produces an observable test result",
  causalExplanation: "Creative hypothesis: the observations motivate a configurable use test.",
  differentiationHypothesis: "Test whether user-selected configurations matter.",
  pilotExperiment: "Compare completion and comprehension across configurations.",
  evidenceBoundary: "Synthetic fixture; no Qloo or demand claims.",
};

describe("P2.1 causal generator contract", () => {
  it("accepts a structurally complete experimental draft", () => {
    expect(validateCausalDraft(fixture).valid).toBe(true);
  });

  it("rejects a missing decision consequence", () => {
    const broken = {
      ...fixture,
      decision: {
        ...fixture.decision,
        consequencesByOption: { A: "Configuration A is tested" },
      },
    };
    expect(validateCausalDraft(broken).valid).toBe(false);
  });

  it("rejects unsupported observations without evidence references", () => {
    const broken = {
      ...fixture,
      observations: [
        { entityId: "entity-a", signal: "craft", evidenceIds: [] },
        fixture.observations[1]!,
      ],
    };
    expect(validateCausalDraft(broken).valid).toBe(false);
  });
});
