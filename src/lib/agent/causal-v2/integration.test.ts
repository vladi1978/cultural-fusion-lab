import type { OpportunityHypothesis } from "../opportunity-types";
import { describe, expect, it } from "vitest";
import { EVAL_SCENARIOS } from "../../eval/scenarios";
import { runExplorationAgent } from "../orchestrator";
import { generateCausalDraft } from "./generate";

describe("P2.3 causal generator integration", () => {
  it("generates causal drafts from actual Jazz/Lisbon opportunities", async () => {
    const scenario = EVAL_SCENARIOS.find(
      s => s.id === "H01-product-jazz-lisbon"
    );

    expect(scenario).toBeDefined();
    if (!scenario) return;

    const opportunities: OpportunityHypothesis[] = [];

    const result = await runExplorationAgent(scenario.request, {
      source: scenario.createSource(),
      now: () => "2026-10-11T00:00:00.000Z",
      onOpportunities: items => opportunities.push(...items),
    });

    console.log("Accepted opportunities:", opportunities.length);

    expect(opportunities.length).toBeGreaterThan(0);

    const interpreted = {
      rawObjective: scenario.request.creativeObjective,
      culturalInterest: scenario.request.culturalInterest,
      location: scenario.request.location,
      outputCategory: scenario.request.outputCategory,
      intentTokens: [],
      themes: [],
      summary: scenario.request.creativeObjective,
    };

    const drafts = opportunities
      .map(opportunity => generateCausalDraft({
        opportunity,
        influences: result.entities ?? [],
        interpreted,
      }))
      .filter(draft => draft !== null);

    console.log("Generated causal drafts:", drafts.length);

    for (const draft of drafts) {
      console.log(JSON.stringify({
        opportunityId: draft.opportunityId,
        observations: draft.observations,
        action: draft.action,
        decision: draft.decision,
        constraint: draft.constraint,
        consequence: draft.consequence,
      }, null, 2));
    }

    expect(drafts.length).toBeGreaterThan(0);

    for (const draft of drafts) {
      const consequences = draft.decision.options.map(
        option => draft.decision.consequencesByOption[option]
      );

      expect(new Set(consequences).size).toBe(consequences.length);
      const sameSignal =
        draft.observations[0]?.signal === draft.observations[1]?.signal;

      if (sameSignal && draft.action.verb !== "reveal" && draft.action.verb !== "route") {
        expect(draft.action.verb).toBe("converge");
        expect(draft.observations[0]?.entityId).not.toBe(
          draft.observations[1]?.entityId,
        );
      } else if (
        draft.action.verb !== "reveal" &&
        draft.action.verb !== "route"
      ) {
        expect(draft.observations[0]?.signal).not.toBe(
          draft.observations[1]?.signal,
        );
      }
    }
  });
});
