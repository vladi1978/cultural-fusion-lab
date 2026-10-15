import { describe, expect, it } from "vitest";
import { EVAL_SCENARIOS } from "../../eval/scenarios";
import { runExplorationAgent } from "../orchestrator";
import type { OpportunityHypothesis } from "../opportunity-types";
import { generateCausalDraftsFromExploration } from "./from-exploration";
import { executeCausalDecision } from "./execute";

describe("P3.5 shared convergence execution", () => {
  it("executes both Anime/Seoul decisions with distinct outcomes", async () => {
    const scenario = EVAL_SCENARIOS.find(
      (item) => item.id === "H03-brand-anime-seoul",
    );

    expect(scenario).toBeDefined();
    if (!scenario) throw new Error("Anime scenario missing");

    let opportunities: OpportunityHypothesis[] = [];

    const result = await runExplorationAgent(scenario.request, {
      source: scenario.createSource(),
      now: () => "2026-10-11T00:00:00.000Z",
      onOpportunities: (items) => {
        opportunities = items;
      },
    });

    const drafts = generateCausalDraftsFromExploration({
      opportunities,
      entities: result.entities,
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

    const draft = drafts.find(
      (item) => item.action.verb === "converge",
    );

    expect(draft).toBeDefined();
    if (!draft) throw new Error("Convergence draft missing");

    expect(draft.observations).toHaveLength(2);
    expect(draft.observations[0]?.signal).toBe("collectible");
    expect(draft.observations[1]?.signal).toBe("collectible");

    const held = executeCausalDecision(draft, {
      selectedOption: draft.decision.options[0],
    });

    const pilot = executeCausalDecision(draft, {
      selectedOption: draft.decision.options[1],
    });

    const invalid = executeCausalDecision(draft, {
      selectedOption: "Unrecognized operation",
    });

    expect(held.accepted).toBe(true);
    expect(held.state).toBe("locked");

    expect(pilot.accepted).toBe(true);
    expect(pilot.state).toBe("released");

    expect(invalid.accepted).toBe(false);
    expect(invalid.state).toBe("unsupported");

    expect(held.state).not.toBe(pilot.state);
  });
});
