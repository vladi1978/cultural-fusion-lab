import { describe, expect, it } from "vitest";

import {
  AGENT_MOCK_LABEL,
  createFailingSource,
  createMockFixtureSource,
  MOCK_AGENT_ENTITIES,
} from "./fixtures/agent-mock-fixtures";
import { runExplorationAgent, runMutationAgent } from "./orchestrator";
import { AgentError } from "./types";

const baseRequest = {
  creativeObjective: "Design a late-night hospitality product for curious travelers",
  culturalInterest: "jazz",
  location: "Lisbon",
  outputCategory: "product" as const,
  mode: "demo" as const,
};

describe("deterministic agent orchestration", () => {
  it("runs interpret → plan → collect → affinities → concepts → evaluate", async () => {
    const result = await runExplorationAgent(baseRequest, {
      source: createMockFixtureSource(),
      now: () => "2026-10-11T12:00:00.000Z",
    });

    expect(AGENT_MOCK_LABEL).toMatch(/MOCK FIXTURE/);
    expect(result.mode).toBe("demo");
    expect(result.agentTrace.engine).toBe("deterministic-v1");
    expect(result.agentTrace.steps.map((s) => s.id)).toEqual([
      "interpret",
      "plan",
      "collect",
      "relevance",
      "conflicts",
      "affinities",
      "concepts",
      "evaluate",
    ]);
    expect(result.concepts).toHaveLength(3);
    expect(result.disclaimer).toMatch(/DEMO MODE/i);
    expect(result.agentTrace.warnings.some((w) => /not Qloo/i.test(w))).toBe(
      true,
    );
  });

  it("keeps verified/mock evidence separate from agent hypotheses", async () => {
    const result = await runExplorationAgent(baseRequest, {
      source: createMockFixtureSource(),
    });

    const sources = new Set(result.evidence.map((e) => e.source));
    expect(sources.has("mock_demo")).toBe(true);
    expect(sources.has("agent_hypothesis")).toBe(true);
    expect(sources.has("verified_api")).toBe(false);

    for (const concept of result.concepts) {
      expect(concept.claims?.length).toBeGreaterThan(0);
      for (const claim of concept.claims ?? []) {
        expect(claim.evidenceIds.length).toBeGreaterThan(0);
        for (const evidenceId of claim.evidenceIds) {
          expect(result.evidence.some((e) => e.id === evidenceId)).toBe(true);
        }
      }
      expect(concept.evaluation?.evidenceCoverage).toBeGreaterThan(0);
    }
  });

  it("does not invent unsupported affinity relationships without evidence", async () => {
    // Topically jazz-relevant, but pairwise unique tags (no shared-tag edges).
    const lonely: typeof MOCK_AGENT_ENTITIES = [
      {
        id: "lonely-1",
        name: "Lonely Fixture",
        category: "music",
        description: "No cross tags",
        affinity: 0.5,
        tags: ["jazz", "unique-aaaa"],
      },
      {
        id: "lonely-2",
        name: "Lonely Fixture B",
        category: "film",
        description: "No cross tags",
        affinity: 0.5,
        tags: ["jazz", "unique-bbbb"],
      },
      {
        id: "lonely-3",
        name: "Lonely Fixture C",
        category: "brands",
        description: "No cross tags",
        affinity: 0.5,
        tags: ["jazz", "unique-cccc"],
      },
      {
        id: "lonely-4",
        name: "Lonely Fixture D",
        category: "places",
        description: "No cross tags",
        affinity: 0.5,
        tags: ["jazz", "unique-dddd"],
      },
    ];

    const result = await runExplorationAgent(baseRequest, {
      source: createMockFixtureSource({
        entities: lonely,
        evidence: [
          {
            id: "ev-lonely",
            source: "mock_demo",
            label: "Lonely mock bundle",
            detail: AGENT_MOCK_LABEL,
            relatedEntityIds: lonely.map((e) => e.id),
            createdAt: "2026-10-11T00:00:00.000Z",
          },
        ],
        provenanceByEntityId: Object.fromEntries(
          lonely.map((e) => [e.id, "mock_demo" as const]),
        ),
      }),
    });

    // Co-collected affinities may exist, but none may claim api_reported_score.
    expect(
      result.affinities.every((a) => a.basis !== "api_reported_score"),
    ).toBe(true);
    for (const aff of result.affinities) {
      expect(aff.evidenceIds.length).toBeGreaterThan(0);
      expect(aff.apiReportedScore).toBeUndefined();
    }
  });

  it("mutates a concept and re-evaluates with grounded claims", async () => {
    const exploration = await runExplorationAgent(baseRequest, {
      source: createMockFixtureSource(),
    });
    const concept = exploration.concepts[0]!;
    const outgoing = concept.culturalInfluences[0]!;
    const incoming = MOCK_AGENT_ENTITIES.find(
      (e) =>
        e.id !== outgoing.id &&
        !concept.culturalInfluences.some((inf) => inf.id === e.id),
    )!;

    const mutation = await runMutationAgent(
      {
        mode: "demo",
        conceptId: concept.id,
        replaceEntityId: outgoing.id,
        newEntityId: incoming.id,
        exploration: baseRequest,
        concepts: exploration.concepts,
        entities: exploration.entities,
        evidence: exploration.evidence,
      },
      { source: createMockFixtureSource() },
    );

    expect(mutation.mutatedConcept.parentConceptId).toBe(concept.id);
    expect(mutation.mutatedConcept.mutationNote).toMatch(/Swapped/);
    expect(mutation.mutatedConcept.evaluation.overall).toBeGreaterThan(0);
    expect(
      mutation.mutatedConcept.claims.every((c) => c.evidenceIds.length > 0),
    ).toBe(true);
    expect(mutation.agentTrace.steps.some((s) => s.id === "mutate")).toBe(true);
    expect(mutation.disclaimer).toMatch(/DEMO MODE/i);
  });

  it("handles empty collection failures safely", async () => {
    await expect(
      runExplorationAgent(baseRequest, { source: createFailingSource() }),
    ).rejects.toMatchObject({
      name: "AgentError",
      code: "EMPTY_EVIDENCE",
    } satisfies Partial<AgentError>);
  });

  it("rejects mutation of unknown concepts", async () => {
    await expect(
      runMutationAgent(
        {
          mode: "demo",
          conceptId: "missing",
          replaceEntityId: "x",
          newEntityId: "y",
          exploration: baseRequest,
          concepts: [],
          entities: MOCK_AGENT_ENTITIES,
          evidence: [],
        },
        { source: createMockFixtureSource() },
      ),
    ).rejects.toMatchObject({ code: "MISSING_CONCEPT" });
  });
});
