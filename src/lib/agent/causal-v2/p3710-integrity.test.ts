import { describe, expect, it } from "vitest";
import { EVAL_SCENARIOS } from "../../eval/scenarios";
import { runExplorationAgent } from "../orchestrator";
import type { OpportunityHypothesis } from "../opportunity-types";
import { generateCausalDraftsFromExploration } from "./from-exploration";

const expectedCounts: Record<string, number> = {
  "H01-product-jazz-lisbon": 4,
  "H02-product-streetwear-tokyo": 3,
  "H03-brand-anime-seoul": 1,
};

describe("P3.7.10 end-to-end evidence integrity", () => {
  for (const scenario of EVAL_SCENARIOS) {
    const expected = expectedCounts[scenario.id];
    if (expected === undefined) continue;

    it(`${scenario.id}: every observation has valid attribution`, async () => {
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

      expect(drafts).toHaveLength(expected);

      const evidenceById = new Map(
        evidence.map(item => [item.id, item]),
      );

      const opportunityById = new Map(
        opportunities.map(item => [item.id, item]),
      );

      for (const draft of drafts) {
        const opportunity = opportunityById.get(draft.opportunityId);
        expect(opportunity).toBeDefined();

        if (!opportunity) continue;

        expect(draft.observations).toHaveLength(2);

        for (const observation of draft.observations) {
          expect(
            opportunity.supportingEntityIds,
          ).toContain(observation.entityId);

          expect(observation.evidenceIds.length).toBeGreaterThan(0);

          for (const evidenceId of observation.evidenceIds) {
            const item = evidenceById.get(evidenceId);

            expect(
              item,
              `Missing evidence: ${evidenceId}`,
            ).toBeDefined();

            expect(
              opportunity.evidenceIds,
              `Evidence not authorized by opportunity: ${evidenceId}`,
            ).toContain(evidenceId);

            expect(
              item?.relatedEntityIds,
              `Evidence ${evidenceId} is not linked to ${observation.entityId}`,
            ).toContain(observation.entityId);

            expect(
              item?.source,
              "Synthetic evaluation must not be labeled as verified API evidence",
            ).not.toBe("verified_api");
          }
        }
      }
    });
  }
});
