import { describe, expect, it } from "vitest";
import type { OpportunityHypothesis } from "../opportunity-types";
import { runExplorationAgent } from "../orchestrator";
import { EVAL_SCENARIOS } from "../../eval/scenarios";
import { generateCausalDraftsFromExploration } from "./from-exploration";
import { validateCausalDraft } from "./types";

describe("P2.9 exploration-to-causal integration", () => {
  it("converts accepted Jazz/Lisbon opportunities into valid causal drafts", async () => {
    const scenario = EVAL_SCENARIOS.find(
      item => item.id === "H01-product-jazz-lisbon",
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
    });

    expect(opportunities.length).toBeGreaterThan(0);
    expect(drafts.length).toBeGreaterThan(0);

    for (const draft of drafts) {
      expect(validateCausalDraft(draft).valid).toBe(true);
      expect(
        opportunities.some(
          opportunity =>
            opportunity.id === draft.opportunityId &&
            opportunity.status === "accepted",
        ),
      ).toBe(true);
    }

    console.log(
      "P2.9 integration:",
      opportunities.length,
      "accepted opportunities →",
      drafts.length,
      "valid causal drafts",
    );
  });
});
