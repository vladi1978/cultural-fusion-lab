import { describe, expect, it } from "vitest";
import type { CausalConceptDraft } from "./types";
import { executeCausalDecision } from "./execute";

const draft = {
  id: "causal-test-configure",
  opportunityId: "opp-test-configure",
  outputCategory: "product",
  opportunityHypothesis: "Test two cultural configurations.",
  action: {
    actor: "Participant",
    verb: "configure",
    object: "Cultural prototype",
    observableResult: "Configuration selected",
  },
  observations: [
    { entityId: "artist", signal: "alt", evidenceIds: ["ev-artist"] },
    { entityId: "place", signal: "city", evidenceIds: ["ev-place"] },
  ],
  decision: {
    actor: "Participant",
    question: "Which cultural attribute should control the prototype?",
    options: [
      "Prioritize alt from Artist",
      "Prioritize city from Place",
    ],
    consequencesByOption: {
      "Prioritize alt from Artist":
        "The prototype prioritizes the alt signal.",
      "Prioritize city from Place":
        "The prototype prioritizes the city signal.",
    },
  },
  constraint: {
    rule: "Both cultural signals remain represented.",
    enforcement: "Compare the selected configurations.",
  },
  consequence: "A configuration is selected.",
  causalExplanation: "The selected signal controls the prototype.",
  differentiationHypothesis: "Different signals may produce different outcomes.",
  pilotExperiment: "Compare both configurations in a small test.",
  evidenceBoundary: "Synthetic test data; no validated market demand.",
} satisfies CausalConceptDraft;

describe("P4.3 configure decision execution", () => {
  it("executes option A with the first cultural signal", () => {
    const result = executeCausalDecision(draft, {
      selectedOption: draft.decision.options[0],
    });

    expect(result.accepted).toBe(true);
    expect(result.state).toBe("preview");
    expect(result.explanation).toContain("alt");
    expect(result.explanation).toContain("Configuration A");
  });

  it("executes option B with the second cultural signal", () => {
    const result = executeCausalDecision(draft, {
      selectedOption: draft.decision.options[1],
    });

    expect(result.accepted).toBe(true);
    expect(result.state).toBe("preview");
    expect(result.explanation).toContain("city");
    expect(result.explanation).toContain("Configuration B");
  });

  it("produces distinguishable outcomes", () => {
    const first = executeCausalDecision(draft, {
      selectedOption: draft.decision.options[0],
    });
    const second = executeCausalDecision(draft, {
      selectedOption: draft.decision.options[1],
    });

    expect(first.explanation).not.toBe(second.explanation);
  });

  it("rejects options outside the decision", () => {
    const result = executeCausalDecision(draft, {
      selectedOption: "Invented option",
    });

    expect(result.accepted).toBe(false);
    expect(result.state).toBe("unsupported");
  });

  it("rejects a configuration with a missing observation", () => {
    const incomplete = {
      ...draft,
      observations: [draft.observations[0]],
    };

    const result = executeCausalDecision(incomplete, {
      selectedOption: draft.decision.options[1],
    });

    expect(result.accepted).toBe(false);
    expect(result.state).toBe("unsupported");
  });
});
