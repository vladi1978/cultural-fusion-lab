import { describe, expect, it } from "vitest";

import { generateConceptCandidates } from "./concepts";
import type { InterpretedObjective } from "./types";

const interpreted: InterpretedObjective = {
  rawObjective: "Design a late-night hospitality product for curious travelers",
  culturalInterest: "jazz",
  location: "Lisbon",
  outputCategory: "product",
  intentTokens: ["hospitality", "travelers", "jazz", "night"],
  themes: ["nocturnal", "hospitality", "sonic"],
  summary: "test",
};

const entities = [
  {
    id: "e1",
    name: "Harbor Quartet",
    category: "music" as const,
    description: "x",
    affinity: 0.8,
    tags: ["jazz", "night"],
  },
  {
    id: "e2",
    name: "Canal Room",
    category: "places" as const,
    description: "x",
    affinity: 0.7,
    tags: ["jazz", "listening"],
  },
  {
    id: "e3",
    name: "Vinyl Clay",
    category: "brands" as const,
    description: "x",
    affinity: 0.7,
    tags: ["jazz", "craft"],
  },
  {
    id: "e4",
    name: "Blue Hour",
    category: "film" as const,
    description: "x",
    affinity: 0.6,
    tags: ["jazz", "night"],
  },
  {
    id: "e5",
    name: "Parallel Press",
    category: "brands" as const,
    description: "x",
    affinity: 0.55,
    tags: ["jazz", "craft"],
  },
];

const evidence = [
  {
    id: "ev",
    source: "mock_demo" as const,
    label: "bundle",
    detail: "fixture",
    relatedEntityIds: entities.map((e) => e.id),
    createdAt: "2026-10-11T00:00:00.000Z",
  },
];

describe("concept narrative quality", () => {
  it("produces concrete differentiated narratives without dumping the raw objective", () => {
    const { concepts } = generateConceptCandidates({
      interpreted,
      entities,
      evidence,
      affinities: [],
      seedKey: "narr",
    });

    expect(concepts).toHaveLength(3);
    for (const concept of concepts) {
      expect(concept.narrative).toBeTruthy();
      const n = concept.narrative!;
      expect(n.whatItIs.length).toBeGreaterThan(40);
      expect(n.whoItServes.length).toBeGreaterThan(20);
      expect(n.howItWorks.length).toBeGreaterThan(40);
      expect(n.distinctive.length).toBeGreaterThan(20);
      expect(n.inspiredBy).toMatch(/Influences:/);
      expect(n.evidenceBoundary).toMatch(/hypothes/i);
      // Must not simply paste the full user objective into the proposal body.
      expect(n.whatItIs).not.toContain(interpreted.rawObjective);
      expect(n.howItWorks).not.toContain(interpreted.rawObjective);
      // Claims remain grounded
      expect(concept.claims.every((c) => c.evidenceIds.length > 0)).toBe(true);
    }

    const directions = new Set(concepts.map((c) => c.directionId));
    expect(directions.size).toBe(3);

    const whats = concepts.map((c) => c.narrative!.whatItIs);
    expect(new Set(whats).size).toBe(3);

    expect(concepts.some((c) => /intimacy|private|ritual/i.test(c.narrative!.distinctive))).toBe(
      true,
    );
    expect(concepts.some((c) => /belonging|shared|commons/i.test(c.narrative!.distinctive))).toBe(
      true,
    );
    expect(concepts.some((c) => /modular|recombin|kit\/platform/i.test(c.narrative!.distinctive))).toBe(
      true,
    );
  });

  it("keeps claim→evidence integrity across narrative claims", () => {
    const { concepts, hypothesisEvidence } = generateConceptCandidates({
      interpreted,
      entities,
      evidence,
      affinities: [],
      seedKey: "ev",
    });
    const allEvidenceIds = new Set([
      ...evidence.map((e) => e.id),
      ...hypothesisEvidence.map((e) => e.id),
    ]);
    for (const concept of concepts) {
      for (const claim of concept.claims) {
        for (const id of claim.evidenceIds) {
          expect(allEvidenceIds.has(id) || concept.evidenceIds.includes(id)).toBe(
            true,
          );
        }
      }
    }
  });
});
