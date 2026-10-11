import { describe, expect, it } from "vitest";

import { identifyAffinities } from "./affinities";
import { generateConceptCandidates } from "./concepts";
import {
  AGENT_MOCK_LABEL,
  MOCK_AGENT_ENTITIES,
  MOCK_AGENT_EVIDENCE,
} from "./fixtures/agent-mock-fixtures";
import { interpretObjective } from "./interpret";
import { AgentError } from "./types";

describe("evidence provenance rules", () => {
  it("labels mock fixture affinities without inventing API scores", () => {
    expect(AGENT_MOCK_LABEL).toContain("not Qloo");
    const affinities = identifyAffinities({
      entities: MOCK_AGENT_ENTITIES,
      evidence: MOCK_AGENT_EVIDENCE,
      provenanceByEntityId: Object.fromEntries(
        MOCK_AGENT_ENTITIES.map((e) => [e.id, "mock_demo" as const]),
      ),
    });

    expect(affinities.length).toBeGreaterThan(0);
    expect(affinities.some((a) => a.sharedTags.includes("night"))).toBe(true);
    expect(affinities.every((a) => a.evidenceIds.length > 0)).toBe(true);
    expect(affinities.every((a) => a.basis !== "api_reported_score")).toBe(
      true,
    );
  });

  it("requires evidence references on every generated cultural claim", () => {
    const interpreted = interpretObjective({
      creativeObjective: "Create a sonic hospitality kit",
      culturalInterest: "jazz",
      outputCategory: "product",
      mode: "demo",
    });

    const { concepts } = generateConceptCandidates({
      interpreted,
      entities: MOCK_AGENT_ENTITIES,
      evidence: MOCK_AGENT_EVIDENCE,
      affinities: identifyAffinities({
        entities: MOCK_AGENT_ENTITIES,
        evidence: MOCK_AGENT_EVIDENCE,
        provenanceByEntityId: Object.fromEntries(
          MOCK_AGENT_ENTITIES.map((e) => [e.id, "mock_demo" as const]),
        ),
      }),
      seedKey: "test",
    });

    for (const concept of concepts) {
      const cultural = concept.claims.filter(
        (c) => c.kind === "cultural_reference",
      );
      expect(cultural.length).toBeGreaterThan(0);
      for (const claim of cultural) {
        expect(claim.evidenceIds.length).toBeGreaterThan(0);
      }
    }
  });

  it("fails closed when concepts cannot be grounded", () => {
    const interpreted = interpretObjective({
      creativeObjective: "Create something",
      culturalInterest: "jazz",
      outputCategory: "brand",
      mode: "demo",
    });

    expect(() =>
      generateConceptCandidates({
        interpreted,
        entities: MOCK_AGENT_ENTITIES.slice(0, 2),
        evidence: [],
        affinities: [],
        seedKey: "x",
      }),
    ).toThrow(AgentError);
  });
});
