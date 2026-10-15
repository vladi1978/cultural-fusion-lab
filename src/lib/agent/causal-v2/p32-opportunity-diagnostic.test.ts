import { describe, it } from "vitest";
import { EVAL_SCENARIOS } from "../../eval/scenarios";
import { runExplorationAgent } from "../orchestrator";
import type { OpportunityHypothesis } from "../opportunity-types";
import { generateCausalDraftsFromExploration } from "./from-exploration";

describe("P3.2 opportunity pipeline diagnostic", () => {
  for (const id of [
    "H01-product-jazz-lisbon",
    "H02-product-streetwear-tokyo",
    "H03-brand-anime-seoul",
  ]) {
    it(id, async () => {
      const scenario = EVAL_SCENARIOS.find(item => item.id === id);
      if (!scenario) throw new Error(`Missing scenario: ${id}`);

      const opportunities: OpportunityHypothesis[] = [];

      const result = await runExplorationAgent(scenario.request, {
        source: scenario.createSource(),
        now: () => "2026-10-11T00:00:00.000Z",
        onOpportunities: items => opportunities.push(...items),
      });

      const interpreted = {
        rawObjective: scenario.request.creativeObjective,
        culturalInterest: scenario.request.culturalInterest,
        location: scenario.request.location,
        outputCategory: scenario.request.outputCategory,
        intentTokens: [],
        themes: [],
        summary: scenario.request.creativeObjective,
      };

      const drafts = generateCausalDraftsFromExploration({
        opportunities,
        entities: result.entities ?? [],
        interpreted,
      });

      console.log("\nSCENARIO:", id);
      console.log("ENTITIES:", result.entities?.length ?? 0);
      console.log("SELECTED OPPORTUNITIES:", opportunities.length);
      console.log("CAUSAL DRAFTS:", drafts.length);

      for (const opportunity of opportunities) {
        const supporters = opportunity.supportingEntityIds.map(
          entityId => result.entities?.find(entity => entity.id === entityId)
        );

        console.log(JSON.stringify({
          opportunityId: opportunity.id,
          kind: opportunity.kind,
          status: opportunity.status,
          supportingEntities: supporters.map(entity => ({
            id: entity?.id,
            tags: entity?.tags,
          })),
          evidenceIds: opportunity.evidenceIds,
        }, null, 2));
      }

      console.log(
        "AGENT TRACE:",
        JSON.stringify(result.agentTrace ?? [], null, 2).slice(0, 5000)
      );
    });
  }
});
