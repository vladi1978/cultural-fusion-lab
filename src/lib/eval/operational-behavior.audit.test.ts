import { describe, expect, it } from "vitest";
import { EVAL_SCENARIOS } from "./scenarios";
import { runExplorationAgent } from "../agent/orchestrator";

describe("P1.18-F2 operational behavior audit", () => {
  it("reports observed actions and operating rules without inferring decisions", async () => {
    let total = 0;
    let withRules = 0;
    let withoutRules = 0;

    for (const scenario of EVAL_SCENARIOS.filter(
      s => s.id.startsWith("H")
    )) {
      const result = await runExplorationAgent(scenario.request, {
        source: scenario.createSource(),
        now: () => "2026-10-11T00:00:00.000Z",
      });

      for (const concept of result.concepts) {
        const spec = concept.spec;
        total++;

        if (spec?.operatingRules?.length) {
          withRules++;
        } else {
          withoutRules++;
        }

        console.log(JSON.stringify({
          scenario: scenario.id,
          concept: concept.title,
          program: spec?.operatingProgramId ?? "unknown",
          structuralFingerprint: spec?.structuralFingerprint ?? null,
          mechanics: spec?.mechanics ?? null,
          actions: spec?.journey.map(step => ({
            actor: step.actor,
            action: step.action,
            influenceCount: step.influenceEntityIds.length,
          })) ?? [],
          explicitRules: spec?.operatingRules?.map(rule => rule.rule) ?? [],
        }));
      }
    }

    console.log("\\n=== P1.18-F2 OPERATIONAL BEHAVIOR ===");
    console.log("Concepts:", total);
    console.log("With explicit rules:", withRules);
    console.log("Without explicit rules:", withoutRules);

    expect(total).toBe(26);
    expect(withRules + withoutRules).toBe(total);
  });
});
