import { describe, expect, it } from "vitest";

import { createMockFixtureSource } from "./fixtures/agent-mock-fixtures";
import { runExplorationAgent, runMutationAgent } from "./orchestrator";

describe("mutation comparison", () => {
  it("explains influence swap and preserves evidence provenance after re-evaluation", async () => {
    const source = createMockFixtureSource();
    const exploration = await runExplorationAgent(
      {
        creativeObjective:
          "Design a late-night hospitality product for curious travelers",
        culturalInterest: "jazz",
        location: "Lisbon",
        outputCategory: "product",
        mode: "demo",
      },
      { source },
    );

    const concept = exploration.concepts[0]!;
    const outgoing = concept.culturalInfluences[0]!;
    const incoming = exploration.entities.find(
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
        exploration: exploration.request,
        concepts: exploration.concepts,
        entities: exploration.entities,
        evidence: exploration.evidence,
      },
      { source },
    );

    expect(mutation.originalConcept.id).toBe(concept.id);
    expect(mutation.mutatedConcept.mutationNote).toMatch(
      new RegExp(`${outgoing.name}.*${incoming.name}`, "i"),
    );
    expect(mutation.mutatedConcept.culturalInfluences.some((e) => e.id === incoming.id)).toBe(
      true,
    );
    expect(
      mutation.mutatedConcept.culturalInfluences.some((e) => e.id === outgoing.id),
    ).toBe(false);

    expect(mutation.mutatedConcept.narrative?.howItWorks).toMatch(/Mutation shift/i);
    expect(mutation.mutatedConcept.narrative?.whatItIs).toBeTruthy();
    expect(mutation.mutatedConcept.evaluation.evidenceCoverage).toBeGreaterThan(0);

    for (const claim of mutation.mutatedConcept.claims) {
      expect(claim.evidenceIds.length).toBeGreaterThan(0);
      for (const id of claim.evidenceIds) {
        expect(mutation.evidence.some((e) => e.id === id)).toBe(true);
      }
    }

    // Before/after concepts differ in title or narrative
    expect(
      mutation.mutatedConcept.title !== mutation.originalConcept.title ||
        mutation.mutatedConcept.summary !== mutation.originalConcept.summary,
    ).toBe(true);
  });
});
