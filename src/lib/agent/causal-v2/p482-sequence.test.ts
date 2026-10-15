import { describe, expect, it } from "vitest";
import { EVAL_SCENARIOS } from "../../eval/scenarios";
import { runExplorationAgent } from "../orchestrator";
import type { OpportunityHypothesis } from "../opportunity-types";
import { generateCausalDraftsFromExploration } from "./from-exploration";
import { executeCausalDecision } from "./execute";

describe("P4.8.2 — Music × Film sequence", () => {
  it("generates distinct executable reveal orders with cultural attribution", async () => {
    const scenario = EVAL_SCENARIOS.find(
      (item) => item.id === "H02-product-streetwear-tokyo",
    );

    expect(scenario).toBeDefined();
    if (!scenario) return;

    const opportunities: OpportunityHypothesis[] = [];

    const result = await runExplorationAgent(scenario.request, {
      source: scenario.createSource(),
      now: () => "2026-10-11T00:00:00.000Z",
      onOpportunities: items => opportunities.push(...items),
    });

    const drafts = generateCausalDraftsFromExploration({
      opportunities,
      entities: result.entities ?? [],
      interpreted: {
        rawObjective: scenario.request.creativeObjective,
        culturalInterest: scenario.request.culturalInterest,
        location: scenario.request.location,
        outputCategory: scenario.request.outputCategory,
        intentTokens: [],
        themes: [],
        summary: scenario.request.creativeObjective,
      },
      evidence: result.evidence ?? [],
    });

    const sequence = drafts.find(
      (draft) => draft.action.verb === "sequence",
    );

    expect(sequence).toBeDefined();
    if (!sequence) return;

    expect(sequence.opportunityId).toContain("eval-sw-artist");
    expect(sequence.opportunityId).toContain("eval-sw-film");
    expect(sequence.observations).toHaveLength(2);
    expect(sequence.observations.every(
      (observation) => observation.evidenceIds.length > 0,
    )).toBe(true);

    const [optionA, optionB] = sequence.decision.options;

    const a = executeCausalDecision(sequence, {
      selectedOption: optionA,
    });
    const b = executeCausalDecision(sequence, {
      selectedOption: optionB,
    });

    expect(a.accepted).toBe(true);
    expect(b.accepted).toBe(true);
    expect(a.state).toBe("preview");
    expect(b.state).toBe("preview");
    expect(a.explanation).toContain("music → film");
    expect(b.explanation).toContain("film → music");
    expect(a.explanation).not.toBe(b.explanation);

    const invalid = executeCausalDecision(sequence, {
      selectedOption: "Invented third option",
    });

    expect(invalid.accepted).toBe(false);
    expect(invalid.state).toBe("unsupported");
  });
});
