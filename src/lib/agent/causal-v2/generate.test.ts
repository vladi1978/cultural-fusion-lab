import { describe, expect, it } from "vitest";
import { generateCausalDraft } from "./generate";
import type { GenerateCausalDraftInput } from "./generate";

const input: GenerateCausalDraftInput = {
  opportunity: {
    id: "op-1",
    kind: "complementarity",
    title: "Craft and listening",
    supportingEntityIds: ["a", "b"],
    supportingSignalIds: [],
    whyCreativelyUseful: "Test the combination of craft and listening.",
    designImplication: "Combine making and listening in one prototype.",
    uncertainty: "No real audience validation.",
    unsupportedAssumptions: [],
    evidenceIds: ["evidence-1"],
    status: "accepted",
    relationshipIds: [],
  },
  influences: [
    {
      id: "a", name: "Craft Studio", category: "brands",
      description: "", affinity: 0.5, tags: ["craft"],
    },
    {
      id: "b", name: "Listening Room", category: "places",
      description: "", affinity: 0.5, tags: ["listening"],
    },
  ],
  interpreted: {
    rawObjective: "Design a cultural product",
    culturalInterest: "jazz",
    outputCategory: "product",
    intentTokens: [],
    themes: [],
    summary: "",
  },
};

describe("P2.2 causal generator", () => {
  it("produces distinct decisions from two supported cultural attributes", () => {
    const draft = generateCausalDraft(input);
    expect(draft).not.toBeNull();
    expect(draft?.decision.options).toHaveLength(2);
    expect(
      draft?.decision.consequencesByOption[draft.decision.options[0]]
    ).not.toEqual(
      draft?.decision.consequencesByOption[draft.decision.options[1]]
    );
    expect(draft?.observations).toHaveLength(2);
  });

  it("rejects rejected opportunities", () => {
    expect(generateCausalDraft({
      ...input,
      opportunity: { ...input.opportunity, status: "rejected" },
    })).toBeNull();
  });

  it("rejects missing cultural support", () => {
    expect(generateCausalDraft({
      ...input,
      influences: input.influences.slice(0, 1),
    })).toBeNull();
  });
});

describe("P2.6 operational decision consistency", () => {
  it("keeps the decision paths distinct for craft and listening", () => {
    const draft = generateCausalDraft(input);
    expect(draft).not.toBeNull();
    if (!draft) return;

    expect(draft.action.verb).toBe("assemble");
    expect(draft.decision.options).toHaveLength(2);

    const outcomes = draft.decision.options.map(
      option => draft.decision.consequencesByOption[option]
    );

    expect(new Set(outcomes).size).toBe(2);
    expect(outcomes.some(outcome => outcome.includes("locked"))).toBe(true);
    expect(outcomes.some(outcome => outcome.includes("without"))).toBe(true);
  });
});
