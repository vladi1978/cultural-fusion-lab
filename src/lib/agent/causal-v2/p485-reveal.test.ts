import { describe, expect, it } from "vitest";
import { EVAL_SCENARIOS } from "../../eval/scenarios";
import { runExplorationAgent } from "../orchestrator";
import type { OpportunityHypothesis } from "../opportunity-types";
import { generateCausalDraftsFromExploration } from "./from-exploration";
import { executeCausalDecision } from "./execute";

describe("P4.8.5 — Place × Film reveal", () => {
  it.each([
    "H01-product-jazz-lisbon",
    "H02-product-streetwear-tokyo",
  ])("%s: generates an attributable reveal with distinct paths", async id => {
    const scenario = EVAL_SCENARIOS.find(item => item.id === id);
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

    const reveal = drafts.find(draft => draft.action.verb === "reveal");

    expect(reveal).toBeDefined();
    if (!reveal) return;

    const opportunity = opportunities.find(
      item => item.id === reveal.opportunityId,
    );

    expect(opportunity).toBeDefined();
    if (!opportunity) return;

    const entities = result.entities ?? [];
    const categories = reveal.observations.map(observation =>
      entities.find(entity => entity.id === observation.entityId)?.category,
    );

    expect(categories).toContain("places");
    expect(categories).toContain("film");

    const evidenceById = new Map(evidence.map(item => [item.id, item]));

    for (const observation of reveal.observations) {
      expect(opportunity.supportingEntityIds).toContain(observation.entityId);
      expect(observation.evidenceIds.length).toBeGreaterThan(0);

      for (const evidenceId of observation.evidenceIds) {
        expect(opportunity.evidenceIds).toContain(evidenceId);
        expect(evidenceById.get(evidenceId)?.relatedEntityIds).toContain(
          observation.entityId,
        );
        expect(evidenceById.get(evidenceId)?.source).not.toBe("verified_api");
      }
    }

    const [optionA, optionB] = reveal.decision.options;

    const a = executeCausalDecision(reveal, { selectedOption: optionA });
    const b = executeCausalDecision(reveal, { selectedOption: optionB });

    expect(a.accepted).toBe(true);
    expect(b.accepted).toBe(true);
    expect(a.state).toBe("preview");
    expect(b.state).toBe("preview");

    expect(a.explanation).toContain("spatial interaction");
    expect(b.explanation).toContain("direct visual reveal");
    expect(a.explanation).not.toBe(b.explanation);

    const invalid = executeCausalDecision(reveal, {
      selectedOption: "Unsupported third path",
    });

    expect(invalid.accepted).toBe(false);
    expect(invalid.state).toBe("unsupported");
  });
});
