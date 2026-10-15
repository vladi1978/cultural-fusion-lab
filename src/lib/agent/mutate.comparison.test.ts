import { describe, expect, it } from "vitest";

import { createMockFixtureSource } from "./fixtures/agent-mock-fixtures";
import { runExplorationAgent, runMutationAgent } from "./orchestrator";
import { AgentError } from "./types";

describe("mutation comparison", () => {
  it("creates a material places→film transformation with valid evidence links", async () => {
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

    // Prefer an intimate concept that still has a place influence when possible.
    const concept =
      exploration.concepts.find((c) =>
        c.culturalInfluences.some((e) => e.category === "places"),
      ) ?? exploration.concepts[0]!;

    const outgoing =
      concept.culturalInfluences.find((e) => e.category === "places") ??
      concept.culturalInfluences[0]!;

    const incoming =
      exploration.entities.find(
        (e) =>
          e.category === "film" &&
          !concept.culturalInfluences.some((inf) => inf.id === e.id),
      ) ??
      exploration.entities.find(
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
    expect(mutation.mutatedConcept.outputCategory).toBe("experience");
    expect(mutation.mutatedConcept.title).not.toMatch(/Variant/i);
    expect(mutation.mutatedConcept.title).not.toBe(concept.title);

    const before = concept.narrative!;
    const after = mutation.mutatedConcept.narrative!;
    expect(after.whatItIs).not.toBe(before.whatItIs);
    expect(after.howItWorks).not.toBe(before.howItWorks);
    expect(after.whoItServes).not.toBe(before.whoItServes);
    expect(after.distinctive).not.toBe(before.distinctive);

    if (incoming.category === "film") {
      expect(after.whatItIs + after.howItWorks).toMatch(
        /chapter|screening|narrative|scene|story/i,
      );
      expect(after.whatItIs).not.toMatch(/reserved seats, low light/i);
    }

    const diffs = mutation.mutationDiffs ?? mutation.mutatedConcept.mutationDiffs;
    expect(diffs?.length).toBeGreaterThanOrEqual(4);
    expect(diffs!.filter((d) => d.changed).length).toBeGreaterThanOrEqual(3);

    for (const claim of mutation.mutatedConcept.claims) {
      expect(claim.evidenceIds.length).toBeGreaterThan(0);
      for (const id of claim.evidenceIds) {
        expect(mutation.evidence.some((e) => e.id === id)).toBe(true);
      }
    }

    // Objective preserved
    expect(mutation.mutatedConcept.mutationNote).toMatch(
      /late-night hospitality experience/i,
    );
  });

  it("is deterministic across repeated identical mutations", async () => {
    const source = createMockFixtureSource();
    const exploration = await runExplorationAgent(
      {
        creativeObjective: "Design a jazz hospitality product",
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
        e.category !== outgoing.category &&
        !concept.culturalInfluences.some((inf) => inf.id === e.id),
    )!;

    const req = {
      mode: "demo" as const,
      conceptId: concept.id,
      replaceEntityId: outgoing.id,
      newEntityId: incoming.id,
      exploration: exploration.request,
      concepts: exploration.concepts,
      entities: exploration.entities,
      evidence: exploration.evidence,
    };

    const a = await runMutationAgent(req, { source });
    const b = await runMutationAgent(req, { source });

    expect(a.mutatedConcept.title).toBe(b.mutatedConcept.title);
    expect(a.mutatedConcept.narrative).toEqual(b.mutatedConcept.narrative);
    expect(a.mutatedConcept.mutationDiffs).toEqual(b.mutatedConcept.mutationDiffs);
    expect(a.mutatedConcept.id).toBe(b.mutatedConcept.id);
  });

  it("fails closed when metadata cannot support differentiation", async () => {
    const source = createMockFixtureSource();
    const exploration = await runExplorationAgent(
      {
        creativeObjective: "Design a jazz hospitality product",
        culturalInterest: "jazz",
        outputCategory: "product",
        mode: "demo",
      },
      { source },
    );

    const concept = exploration.concepts[0]!;
    const outgoing = concept.culturalInfluences[0]!;

    // Craft a near-duplicate same-category entity with identical tags.
    const weakIncoming = {
      ...outgoing,
      id: `${outgoing.id}-weak-twin`,
      name: `${outgoing.name} Twin`,
      tags: [...outgoing.tags],
    };

    await expect(
      runMutationAgent(
        {
          mode: "demo",
          conceptId: concept.id,
          replaceEntityId: outgoing.id,
          newEntityId: weakIncoming.id,
          exploration: exploration.request,
          concepts: exploration.concepts,
          entities: [...exploration.entities, weakIncoming],
          evidence: exploration.evidence,
        },
        { source },
      ),
    ).rejects.toMatchObject({
      name: "AgentError",
      code: "INSUFFICIENT_DIFFERENTIATION",
    } satisfies Partial<AgentError>);
  });
});
