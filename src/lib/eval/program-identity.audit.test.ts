import { describe, expect, it } from "vitest";
import { EVAL_SCENARIOS } from "./scenarios";
import { runExplorationAgent } from "../agent/orchestrator";

describe("P1.18-E2 structural identity audit", () => {
  it("reports structural fingerprint collisions without filtering concepts", async () => {
    const items: Array<{
      scenario: string;
      title: string;
      program: string;
      cultural?: string;
      structural?: string;
    }> = [];

    for (const scenario of EVAL_SCENARIOS.filter(s => /^H\d{2}-/.test(s.id))) {
      const result = await runExplorationAgent(scenario.request, {
        source: scenario.createSource(),
        now: () => "2026-10-11T00:00:00.000Z",
      });

      for (const concept of result.concepts) {
        items.push({
          scenario: scenario.id,
          title: concept.title,
          program: concept.spec?.operatingProgramId ?? "unknown",
          cultural: concept.spec?.culturalFingerprint,
          structural: concept.spec?.structuralFingerprint,
        });
      }
    }

    const groups = new Map<string, typeof items>();

    for (const item of items) {
      if (!item.structural) continue;
      const group = groups.get(item.structural) ?? [];
      group.push(item);
      groups.set(item.structural, group);
    }

    const collisions = [...groups.entries()]
      .filter(([, group]) => group.length > 1);

    console.log("\\n=== P1.18-E2 STRUCTURAL IDENTITY AUDIT ===");
    console.log("Concepts:", items.length);
    console.log("With structural identity:", items.filter(i => i.structural).length);
    console.log("Without structural identity:", items.filter(i => !i.structural).length);
    console.log("Collision groups:", collisions.length);

    const missing = items.filter(item => !item.structural);
    const missingByProgram = new Map<string, number>();

    for (const item of missing) {
      missingByProgram.set(
        item.program,
        (missingByProgram.get(item.program) ?? 0) + 1
      );
    }

    console.log(
      "Missing identities by program:",
      JSON.stringify(
        [...missingByProgram.entries()]
          .sort((a, b) => b[1] - a[1])
      )
    );

    console.log(
      "Missing identity concepts:",
      JSON.stringify(
        missing.map(({ scenario, title, program }) => ({
          scenario,
          title,
          program
        }))
      )
    );

    for (const [fingerprint, group] of collisions) {
      console.log(JSON.stringify({
        fingerprint,
        concepts: group.map(({ scenario, title, program }) => ({
          scenario, title, program
        })),
      }));
    }

    expect(items.length).toBeGreaterThan(0);
  });
});
