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

describe("concept narrative / ConceptSpec quality", () => {
  it("produces concrete ConceptSpecs without dumping the raw objective", () => {
    const { concepts } = generateConceptCandidates({
      interpreted,
      entities,
      evidence,
      affinities: [],
      seedKey: "narr",
    });

    expect(concepts.length).toBeGreaterThanOrEqual(1);
    expect(concepts.length).toBeLessThanOrEqual(3);

    for (const concept of concepts) {
      expect(concept.spec).toBeTruthy();
      const s = concept.spec!;
      expect(s.proposition.length).toBeGreaterThan(24);
      expect(s.journey.length).toBeGreaterThanOrEqual(3);
      expect(s.mechanics.length).toBeGreaterThan(40);
      expect(s.rationales.length).toBeGreaterThanOrEqual(3);
      expect(s.evidenceBoundary).toMatch(/hypothes|creative interpretation/i);
      expect(s.frozenObjective).toBe(interpreted.rawObjective);
      expect(s.frozenOutputCategory).toBe(interpreted.outputCategory);
      expect(s.proposition).not.toContain(interpreted.rawObjective);
      expect(s.mechanics).not.toContain(interpreted.rawObjective);
      expect(concept.claims.every((c) => c.evidenceIds.length > 0)).toBe(true);
      expect(concept.narrative).toBeTruthy();
    }

    const mechanisms = new Set(concepts.map((c) => c.spec!.mechanismId));
    expect(mechanisms.size).toBe(concepts.length);
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

  it("is deterministic across repeated runs", () => {
    const a = generateConceptCandidates({
      interpreted,
      entities,
      evidence,
      affinities: [],
      seedKey: "det",
    });
    const b = generateConceptCandidates({
      interpreted,
      entities,
      evidence,
      affinities: [],
      seedKey: "det",
    });
    expect(a.concepts.map((c) => c.id)).toEqual(b.concepts.map((c) => c.id));
    expect(a.concepts.map((c) => c.spec?.mechanicFingerprint)).toEqual(
      b.concepts.map((c) => c.spec?.mechanicFingerprint),
    );
  });
});
