import { describe, expect, it } from "vitest";
import { EVAL_SCENARIOS } from "../../eval/scenarios";
import { runExplorationAgent } from "../orchestrator";
import type { OpportunityHypothesis } from "../opportunity-types";
import { generateCausalDraftsFromExploration } from "./from-exploration";
import { executeCausalDecision } from "./execute";

describe("P4.8.4 — Music × Place route", () => {
  it("generates two distinct simulated paths with attributable evidence", async () => {
    const scenario = EVAL_SCENARIOS.find(
      item => item.id === "H02-product-streetwear-tokyo",
    );

    expect(scenario).toBeDefined();
    if (!scenario) return;

    const opportunities: OpportunityHypothesis[] = [];

    const result = await runExplorationAgent(scenario.request, {
      source: scenario.createSource(),
      now: () => "2026-10-11T00:00:00.000Z",
      onOpportunities: items => opportunities.push(...items),
    });

    const evidence = result.evidence ?? [];

    const drafts = generateCausalDraftsFromExploration({
      opportunities,
      entities: result.entities ?? [],
      evidence,
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

    const route = drafts.find(draft => draft.action.verb === "route");

    expect(route).toBeDefined();
    if (!route) return;

    expect(route.opportunityId).toContain("eval-sw-artist");
    expect(route.opportunityId).toContain("eval-sw-place");
    expect(route.observations).toHaveLength(2);

    const evidenceById = new Map(evidence.map(item => [item.id, item]));

    for (const observation of route.observations) {
      expect(observation.evidenceIds.length).toBeGreaterThan(0);

      for (const id of observation.evidenceIds) {
        expect(evidenceById.get(id)?.relatedEntityIds).toContain(
          observation.entityId,
        );
        expect(evidenceById.get(id)?.source).not.toBe("verified_api");
      }
    }

    const [optionA, optionB] = route.decision.options;

    const a = executeCausalDecision(route, {
      selectedOption: optionA,
    });

    const b = executeCausalDecision(route, {
      selectedOption: optionB,
    });

    expect(a.accepted).toBe(true);
    expect(b.accepted).toBe(true);

    expect(a.state).toBe("preview");
    expect(b.state).toBe("preview");

    expect(a.explanation).toContain("place → music");
    expect(b.explanation).toContain("open exploration");
    expect(a.explanation).not.toBe(b.explanation);

    const invalid = executeCausalDecision(route, {
      selectedOption: "Invented third route",
    });

    expect(invalid.accepted).toBe(false);
    expect(invalid.state).toBe("unsupported");
  });
});
