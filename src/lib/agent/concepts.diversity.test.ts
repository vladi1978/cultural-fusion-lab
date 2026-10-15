import { describe, expect, it } from "vitest";

import { generateConceptCandidates } from "./concepts";
import type { InterpretedObjective } from "./types";

const interpreted: InterpretedObjective = {
  rawObjective: "Design a late-night hospitality product for curious travelers",
  culturalInterest: "jazz",
  location: "Lisbon",
  outputCategory: "product",
  intentTokens: ["hospitality", "travelers", "jazz"],
  themes: ["nocturnal", "hospitality", "sonic"],
  summary: "test",
};

const entities = [
  {
    id: "e1",
    name: "Quartet",
    category: "music" as const,
    description: "x",
    affinity: 0.8,
    tags: ["jazz", "quiet"],
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

describe("concept diversity (Engine V2)", () => {
  it("produces mechanically distinct concepts from category diversity (1–3)", () => {
    const { concepts } = generateConceptCandidates({
      interpreted,
      entities,
      evidence: [
        {
          id: "ev",
          source: "mock_demo",
          label: "bundle",
          detail: "fixture",
          relatedEntityIds: entities.map((e) => e.id),
          createdAt: "2026-10-11T00:00:00.000Z",
        },
      ],
      affinities: [],
      seedKey: "div",
    });

    expect(concepts.length).toBeGreaterThanOrEqual(1);
    expect(concepts.length).toBeLessThanOrEqual(3);
    expect(new Set(concepts.map((c) => c.title)).size).toBe(concepts.length);
    expect(
      new Set(concepts.map((c) => c.spec?.mechanismId)).size,
    ).toBe(concepts.length);
    expect(
      new Set(concepts.map((c) => c.spec?.mechanicFingerprint)).size,
    ).toBe(concepts.length);

    // Not the forced intimate/communal/systems trio
    expect(concepts.every((c) => c.spec?.mechanismId)).toBe(true);
    expect(
      concepts.some((c) =>
        /spatial_circuit|narrative_chapters|sonic_set|brand_drop/.test(
          c.spec!.mechanismId,
        ),
      ),
    ).toBe(true);
  });

  it("accepts a single strong concept without padding when category diversity is low", () => {
    const musicOnly = [
      entities[0]!,
      {
        id: "e1b",
        name: "Second Quartet",
        category: "music" as const,
        description: "x",
        affinity: 0.7,
        tags: ["jazz", "listening"],
      },
    ];
    const { concepts, quality } = generateConceptCandidates({
      interpreted,
      entities: musicOnly,
      evidence: [
        {
          id: "ev",
          source: "mock_demo",
          label: "bundle",
          detail: "fixture",
          relatedEntityIds: musicOnly.map((e) => e.id),
          createdAt: "2026-10-11T00:00:00.000Z",
        },
      ],
      affinities: [],
      seedKey: "one",
    });

    expect(concepts).toHaveLength(1);
    expect(concepts[0]!.spec?.mechanismId).toBe("sonic_set");
    expect(quality.candidatesAccepted).toBe(1);
  });
});
