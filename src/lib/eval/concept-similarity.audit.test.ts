
import { describe, it } from "vitest";
import { EVAL_SCENARIOS } from "./scenarios";
import { runExplorationAgent } from "../agent/orchestrator";
import { compareConcepts } from "./concept-similarity";

describe("P1.17-B offline originality audit", () => {
  it("measures similarity after candidate filtering", async () => {
    const items: Array<{
      scenario: string;
      title: string;
      concept: any;
      interest: string;
    }> = [];

    for (const scenario of EVAL_SCENARIOS.filter(
      (s) => /^H\d{2}-/.test(s.id)
    )) {
      const result = await runExplorationAgent(scenario.request, {
        source: scenario.createSource(),
        now: () => "2026-10-11T00:00:00.000Z",
      });

      for (const concept of result.concepts) {
        items.push({
          scenario: scenario.id,
          title: concept.title,
          concept,
          interest: scenario.request.culturalInterest,
        });
      }
    }

    const pairs = [];

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const left = items[i]!;
        const right = items[j]!;
        const finding = compareConcepts(
          left.concept,
          right.concept,
          [left.interest, right.interest]
        );

        pairs.push({
          left: `${left.scenario}: ${left.title}`,
          right: `${right.scenario}: ${right.title}`,
          score: Number(finding.overall.toFixed(3)),
          flagged: finding.flagged,
          crossCategory: left.scenario !== right.scenario,
        });
      }
    }

    const flagged = pairs.filter((p) => p.flagged);

    console.log("\\n=== P1.17-B AFTER FILTER ===");
    console.log("Scenarios:", 10);
    console.log("Generated concepts:", items.length);
    console.log("Pair comparisons:", pairs.length);
    console.log("Flagged pairs:", flagged.length);
    console.log(
      "Cross-category flagged:",
      flagged.filter((p) => p.crossCategory).length
    );
    console.log("\\nALL FLAGGED PAIRS");
    flagged.forEach((p) => console.log(JSON.stringify(p)));
    console.log("\\nTOP 10 MOST SIMILAR");
    pairs
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .forEach((p) => console.log(JSON.stringify(p)));
  });
});
