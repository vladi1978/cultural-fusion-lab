import { describe, expect, it } from "vitest";

import { identifyAffinities } from "./affinities";
import { detectEvidenceConflicts } from "./conflicts";
import { generateConceptCandidates } from "./concepts";
import { gateOpportunityHypotheses } from "./opportunity-gates";
import type { OpportunityHypothesis } from "./opportunity-types";
import { createDeterministicReasoningProvider } from "./reasoning/deterministic";
import { buildCulturalSignalGraph } from "./signal-graph";
import type { InterpretedObjective } from "./types";
import { runExplorationAgent, runMutationAgent } from "./orchestrator";
import { createMockFixtureSource } from "./fixtures/agent-mock-fixtures";

const provider = createDeterministicReasoningProvider();

function bundle(entities: { id: string }[]) {
  return [
    {
      id: "ev-bundle",
      source: "mock_demo" as const,
      label: "bundle",
      detail: "fixture",
      relatedEntityIds: entities.map((e) => e.id),
      createdAt: "2026-10-11T00:00:00.000Z",
    },
  ];
}

describe("P1 Cultural Opportunity Intelligence", () => {
  it("accepts strong cross-category complementary signals", () => {
    const interpreted: InterpretedObjective = {
      rawObjective: "Design a late-night hospitality experience for curious travelers",
      culturalInterest: "jazz",
      location: "Lisbon",
      outputCategory: "experience",
      intentTokens: ["jazz", "hospitality"],
      themes: ["sonic"],
      summary: "test",
    };
    const entities = [
      {
        id: "m1",
        name: "Harbor Quartet",
        category: "music" as const,
        description: "listening set",
        affinity: 0.8,
        tags: ["jazz", "listening", "night"],
      },
      {
        id: "p1",
        name: "Canal Room",
        category: "places" as const,
        description: "listening room",
        affinity: 0.75,
        tags: ["jazz", "listening", "intimate"],
      },
      {
        id: "b1",
        name: "Vinyl Clay",
        category: "brands" as const,
        description: "craft",
        affinity: 0.7,
        tags: ["jazz", "craft"],
      },
    ];
    const evidence = bundle(entities);
    const affinities = identifyAffinities({
      entities,
      evidence,
      provenanceByEntityId: Object.fromEntries(
        entities.map((e) => [e.id, "mock_demo" as const]),
      ),
    });
    const graph = provider.buildSignalGraph({
      entities,
      evidence,
      affinities,
      conflicts: [],
      provenanceByEntityId: Object.fromEntries(
        entities.map((e) => [e.id, "mock_demo" as const]),
      ),
      mode: "demo",
      culturalInterest: "jazz",
    });
    const proposed = provider.proposeOpportunities({ graph, interpreted });
    const gated = provider.gateOpportunities({
      opportunities: proposed,
      interpreted,
      graph,
    });
    const accepted = gated.filter((o) => o.status === "accepted");
    expect(accepted.length).toBeGreaterThanOrEqual(1);
    expect(
      accepted.some(
        (o) =>
          o.kind === "complementarity" &&
          o.supportingEntityIds.includes("m1") &&
          o.supportingEntityIds.includes("p1"),
      ),
    ).toBe(true);
    expect(accepted.every((o) => o.evidenceIds.length > 0)).toBe(true);
    expect(accepted.every((o) => o.designImplication.length >= 40)).toBe(true);
    expect(
      accepted.every(
        (o) =>
          !/underserved market|proven demand|consumers will/i.test(
            o.whyCreativelyUseful,
          ),
      ),
    ).toBe(true);
  });

  it("rejects shared-interest-only weak signals", () => {
    const interpreted: InterpretedObjective = {
      rawObjective: "Create a jazz brand",
      culturalInterest: "jazz",
      outputCategory: "brand",
      intentTokens: ["jazz"],
      themes: [],
      summary: "test",
    };
    const entities = [
      {
        id: "m1",
        name: "Only Jazz A",
        category: "music" as const,
        description: "x",
        affinity: 0.5,
        tags: ["jazz"],
      },
      {
        id: "b1",
        name: "Only Jazz B",
        category: "brands" as const,
        description: "x",
        affinity: 0.5,
        tags: ["jazz"],
      },
    ];
    const evidence = bundle(entities);
    const affinities = identifyAffinities({
      entities,
      evidence,
      provenanceByEntityId: Object.fromEntries(
        entities.map((e) => [e.id, "mock_demo" as const]),
      ),
    });
    const graph = buildCulturalSignalGraph({
      entities,
      evidence,
      affinities,
      conflicts: [],
      provenanceByEntityId: Object.fromEntries(
        entities.map((e) => [e.id, "mock_demo" as const]),
      ),
      mode: "demo",
    });
    const proposed = provider.proposeOpportunities({ graph, interpreted });
    const gated = provider.gateOpportunities({
      opportunities: proposed,
      interpreted,
      graph,
    });
    const weak = gated.filter(
      (o) =>
        o.supportingEntityIds.includes("m1") &&
        o.supportingEntityIds.includes("b1"),
    );
    expect(weak.length).toBeGreaterThanOrEqual(1);
    expect(weak.every((o) => o.status === "rejected")).toBe(true);
    expect(
      weak.some((o) =>
        /shared-interest-only|co-collection-only/i.test(o.rejectionReason ?? ""),
      ),
    ).toBe(true);
  });

  it("treats contradictory attributes as tension/contrast — not verified affinity", () => {
    const entities = [
      {
        id: "m1",
        name: "Quiet Trio",
        category: "music" as const,
        description: "soft",
        affinity: 0.7,
        tags: ["jazz", "quiet", "intimate"],
      },
      {
        id: "p1",
        name: "Loud Hall",
        category: "places" as const,
        description: "crowd",
        affinity: 0.7,
        tags: ["jazz", "loud", "crowd"],
      },
    ];
    const conflicts = detectEvidenceConflicts(entities);
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
    const evidence = bundle(entities);
    const affinities = identifyAffinities({
      entities,
      evidence,
      provenanceByEntityId: Object.fromEntries(
        entities.map((e) => [e.id, "mock_demo" as const]),
      ),
    });
    const interpreted: InterpretedObjective = {
      rawObjective: "Design a jazz experience",
      culturalInterest: "jazz",
      outputCategory: "experience",
      intentTokens: ["jazz"],
      themes: [],
      summary: "test",
    };
    const graph = provider.buildSignalGraph({
      entities,
      evidence,
      affinities,
      conflicts,
      provenanceByEntityId: Object.fromEntries(
        entities.map((e) => [e.id, "mock_demo" as const]),
      ),
      mode: "demo",
      culturalInterest: "jazz",
    });
    const gated = provider.gateOpportunities({
      opportunities: provider.proposeOpportunities({ graph, interpreted }),
      interpreted,
      graph,
    });
    const tension = gated.filter((o) => o.kind === "tension" || o.kind === "contrast");
    expect(tension.length).toBeGreaterThanOrEqual(1);
    expect(
      gated
        .filter((o) => o.kind === "convergence" && o.relationshipIds.some((id) => id.includes("conflict")))
        .every((o) => o.status === "rejected"),
    ).toBe(true);
    expect(
      tension.every(
        (o) => !/verified affinity|proven affinity/i.test(o.whyCreativelyUseful),
      ),
    ).toBe(true);
  });

  it("downgrades or limits sparse evidence neighborhoods", () => {
    const interpreted: InterpretedObjective = {
      rawObjective: "Design a jazz experience",
      culturalInterest: "jazz",
      outputCategory: "experience",
      intentTokens: ["jazz"],
      themes: [],
      summary: "test",
    };
    const entities = [
      {
        id: "m1",
        name: "Sparse A",
        category: "music" as const,
        description: "listening",
        affinity: 0.6,
        tags: ["jazz", "listening", "night"],
      },
      {
        id: "p1",
        name: "Sparse B",
        category: "places" as const,
        description: "listening",
        affinity: 0.6,
        tags: ["jazz", "listening", "intimate"],
      },
    ];
    const evidence = bundle(entities);
    const affinities = identifyAffinities({
      entities,
      evidence,
      provenanceByEntityId: Object.fromEntries(
        entities.map((e) => [e.id, "mock_demo" as const]),
      ),
    });
    const graph = provider.buildSignalGraph({
      entities,
      evidence,
      affinities,
      conflicts: [],
      provenanceByEntityId: Object.fromEntries(
        entities.map((e) => [e.id, "mock_demo" as const]),
      ),
      mode: "demo",
      culturalInterest: "jazz",
    });
    expect(graph.uncertainties.some((u) => /sparse/i.test(u))).toBe(true);
    const gated = provider.gateOpportunities({
      opportunities: provider.proposeOpportunities({ graph, interpreted }),
      interpreted,
      graph,
    });
    const usable = gated.filter(
      (o) => o.status === "accepted" || o.status === "downgraded",
    );
    // Sparse neighborhoods should not silently claim full confidence
    expect(
      usable.every(
        (o) =>
          o.status === "downgraded" ||
          /sparse|unknown|not proof/i.test(o.uncertainty),
      ),
    ).toBe(true);
  });

  it("rejects unsupported behavioral / demand claims", () => {
    const interpreted: InterpretedObjective = {
      rawObjective: "Create a product",
      culturalInterest: "jazz",
      outputCategory: "product",
      intentTokens: ["jazz"],
      themes: [],
      summary: "test",
    };
    const bad: OpportunityHypothesis = {
      id: "opp-bad",
      kind: "convergence",
      title: "Fake demand",
      supportingEntityIds: ["a", "b"],
      supportingSignalIds: ["s1"],
      whyCreativelyUseful:
        "This underserved market proves consumers will buy jazz kits.",
      designImplication:
        "Design implication: shape the product via sonic_set mechanism using shared listening cues.",
      uncertainty: "none claimed",
      unsupportedAssumptions: [],
      evidenceIds: ["ev"],
      suggestedMechanismId: "sonic_set",
      status: "accepted",
      relationshipIds: ["rel-x"],
    };
    const graph = buildCulturalSignalGraph({
      entities: [
        {
          id: "a",
          name: "A",
          category: "music",
          description: "x",
          affinity: 0.5,
          tags: ["jazz", "listening"],
        },
        {
          id: "b",
          name: "B",
          category: "places",
          description: "x",
          affinity: 0.5,
          tags: ["jazz", "listening"],
        },
      ],
      evidence: bundle([{ id: "a" }, { id: "b" }]),
      affinities: [],
      conflicts: [],
      provenanceByEntityId: { a: "mock_demo", b: "mock_demo" },
      mode: "demo",
    });
    const gated = gateOpportunityHypotheses({
      opportunities: [bad],
      interpreted,
      graph,
    });
    expect(gated[0]!.status).toBe("rejected");
    expect(gated[0]!.rejectionReason).toMatch(/behavioral|demand/i);
  });

  it("propagates opportunities into mechanism choice, journey, and trace", () => {
    const interpreted: InterpretedObjective = {
      rawObjective: "Prototype a streetwear product for archival utility culture",
      culturalInterest: "streetwear",
      location: "Tokyo",
      outputCategory: "product",
      intentTokens: ["streetwear", "product"],
      themes: ["fashion"],
      summary: "test",
    };
    const entities = [
      {
        id: "fa1",
        name: "Layer Utility Co",
        category: "fashion" as const,
        description: "utility apparel",
        affinity: 0.8,
        tags: ["streetwear", "utility", "archive"],
      },
      {
        id: "b2",
        name: "Drop Atelier",
        category: "brands" as const,
        description: "membership drops",
        affinity: 0.75,
        tags: ["streetwear", "retail", "utility"],
      },
      {
        id: "p2",
        name: "Shibuya Arcade Lot",
        category: "places" as const,
        description: "arcade retail",
        affinity: 0.7,
        tags: ["streetwear", "arcade"],
      },
    ];
    const evidence = bundle(entities);
    const affinities = identifyAffinities({
      entities,
      evidence,
      provenanceByEntityId: Object.fromEntries(
        entities.map((e) => [e.id, "mock_demo" as const]),
      ),
    });
    const graph = provider.buildSignalGraph({
      entities,
      evidence,
      affinities,
      conflicts: [],
      provenanceByEntityId: Object.fromEntries(
        entities.map((e) => [e.id, "mock_demo" as const]),
      ),
      mode: "demo",
      culturalInterest: "streetwear",
    });
    const selected = provider
      .gateOpportunities({
        opportunities: provider.proposeOpportunities({ graph, interpreted }),
        interpreted,
        graph,
      })
      .filter((o) => o.status === "accepted" || o.status === "downgraded");

    const before = generateConceptCandidates({
      interpreted,
      entities,
      evidence,
      affinities,
      seedKey: "prop-before",
      opportunities: [],
    });
    const after = generateConceptCandidates({
      interpreted,
      entities,
      evidence,
      affinities,
      seedKey: "prop-after",
      opportunities: selected,
    });

    expect(after.concepts.length).toBeGreaterThanOrEqual(1);
    const linked = after.concepts.filter((c) => c.spec?.opportunityId);
    expect(linked.length).toBeGreaterThanOrEqual(1);
    for (const c of linked) {
      expect(c.spec!.opportunityTrace?.steps.length).toBeGreaterThanOrEqual(5);
      expect(c.spec!.operatingProgramId).toBeTruthy();
      expect(c.spec!.causalBindings!.length).toBeGreaterThanOrEqual(2);
      expect(c.spec!.operatingRules!.length).toBeGreaterThanOrEqual(2);
      expect(c.spec!.frozenOutputCategory).toBe("product");
      expect(c.spec!.frozenObjective).toBe(interpreted.rawObjective);
    }

    // Material difference vs no-opportunity run (operating program, not labels)
    const afterProg = after.concepts
      .map((c) => c.spec?.operatingProgramFingerprint ?? "")
      .join("|");
    const beforeProg = before.concepts
      .map((c) => c.spec?.operatingProgramFingerprint ?? "")
      .join("|");
    expect(afterProg).not.toEqual(beforeProg);
    expect(
      after.concepts.some((c) => c.spec?.mechanics !== before.concepts[0]?.spec?.mechanics),
    ).toBe(true);
  });

  it("preserves objective/category and stays deterministic", () => {
    const interpreted: InterpretedObjective = {
      rawObjective: "Design a late-night hospitality experience for curious travelers",
      culturalInterest: "jazz",
      location: "Lisbon",
      outputCategory: "experience",
      intentTokens: ["jazz"],
      themes: [],
      summary: "test",
    };
    const entities = [
      {
        id: "m1",
        name: "Harbor Quartet",
        category: "music" as const,
        description: "listening",
        affinity: 0.8,
        tags: ["jazz", "listening", "night"],
      },
      {
        id: "p1",
        name: "Canal Room",
        category: "places" as const,
        description: "listening",
        affinity: 0.75,
        tags: ["jazz", "listening", "intimate"],
      },
      {
        id: "b1",
        name: "Vinyl Clay",
        category: "brands" as const,
        description: "craft",
        affinity: 0.7,
        tags: ["jazz", "craft"],
      },
    ];
    const evidence = bundle(entities);
    const affinities = identifyAffinities({
      entities,
      evidence,
      provenanceByEntityId: Object.fromEntries(
        entities.map((e) => [e.id, "mock_demo" as const]),
      ),
    });
    const graph = provider.buildSignalGraph({
      entities,
      evidence,
      affinities,
      conflicts: [],
      provenanceByEntityId: Object.fromEntries(
        entities.map((e) => [e.id, "mock_demo" as const]),
      ),
      mode: "demo",
      culturalInterest: "jazz",
    });
    const selected = provider
      .gateOpportunities({
        opportunities: provider.proposeOpportunities({ graph, interpreted }),
        interpreted,
        graph,
      })
      .filter((o) => o.status !== "rejected");

    const a = generateConceptCandidates({
      interpreted,
      entities,
      evidence,
      affinities,
      seedKey: "p1-det",
      opportunities: selected,
    });
    const b = generateConceptCandidates({
      interpreted,
      entities,
      evidence,
      affinities,
      seedKey: "p1-det",
      opportunities: selected,
    });
    expect(a.concepts.map((c) => c.id)).toEqual(b.concepts.map((c) => c.id));
    expect(a.concepts.map((c) => c.spec?.opportunityId)).toEqual(
      b.concepts.map((c) => c.spec?.opportunityId),
    );
    for (const c of a.concepts) {
      expect(c.outputCategory).toBe("experience");
      expect(c.spec?.frozenObjective).toBe(interpreted.rawObjective);
    }
  });

  it("labels demo vs verified provenance on the signal graph", () => {
    const entities = [
      {
        id: "v1",
        name: "Verified Artist",
        category: "music" as const,
        description: "x",
        affinity: 0.9,
        tags: ["jazz", "listening"],
      },
      {
        id: "d1",
        name: "Demo Place",
        category: "places" as const,
        description: "x",
        affinity: 0.7,
        tags: ["jazz", "listening"],
      },
    ];
    const evidence = [
      {
        id: "ev-v",
        source: "verified_api" as const,
        label: "live",
        detail: "api",
        relatedEntityIds: ["v1"],
        createdAt: "2026-10-11T00:00:00.000Z",
      },
      {
        id: "ev-d",
        source: "mock_demo" as const,
        label: "demo",
        detail: "mock",
        relatedEntityIds: ["d1"],
        createdAt: "2026-10-11T00:00:00.000Z",
      },
    ];
    const graph = buildCulturalSignalGraph({
      entities,
      evidence,
      affinities: identifyAffinities({
        entities,
        evidence,
        provenanceByEntityId: {
          v1: "verified_api",
          d1: "mock_demo",
        },
      }),
      conflicts: [],
      provenanceByEntityId: { v1: "verified_api", d1: "mock_demo" },
      mode: "live",
    });
    expect(
      graph.signals.some(
        (s) => s.entityId === "v1" && s.provenance === "verified_api",
      ),
    ).toBe(true);
    expect(
      graph.signals.some(
        (s) => s.entityId === "d1" && s.provenance === "mock_demo",
      ),
    ).toBe(true);
    expect(
      graph.relationships.some((r) =>
        r.provenanceMix.includes("verified_api") &&
        r.provenanceMix.includes("mock_demo"),
      ),
    ).toBe(true);
  });

  it("keeps mutation compatibility with opportunity-linked concepts", async () => {
    const source = createMockFixtureSource();
    const exploration = await runExplorationAgent(
      {
        creativeObjective:
          "Design a late-night hospitality experience for curious travelers",
        culturalInterest: "jazz",
        location: "Lisbon",
        outputCategory: "experience",
        mode: "demo",
      },
      { source },
    );
    expect(exploration.agentTrace.engine).toBe("deterministic-v2.1");
    const concept = exploration.concepts[0]!;
    const outgoing = concept.culturalInfluences[0]!;
    const incoming =
      exploration.entities.find(
        (e) =>
          e.id !== outgoing.id &&
          !concept.culturalInfluences.some((inf) => inf.id === e.id),
      ) ?? exploration.entities.find((e) => e.id !== outgoing.id)!;

    const mutation = await runMutationAgent(
      {
        mode: "demo",
        conceptId: concept.id,
        replaceEntityId: outgoing.id,
        newEntityId: incoming.id,
        exploration: exploration.request,
        concepts: exploration.concepts,
        entities: exploration.entities,
        evidence: exploration.evidence,
      },
      { source },
    );
    expect(mutation.mutatedConcept.outputCategory).toBe("experience");
    expect(mutation.mutatedConcept.id).not.toBe(concept.id);
    expect(mutation.mutatedConcept.claims.every((c) => c.evidenceIds.length > 0)).toBe(
      true,
    );
  });
});
