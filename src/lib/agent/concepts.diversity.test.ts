import { describe, expect, it } from "vitest";

import { generateConceptCandidates } from "./concepts";
import { AgentError } from "./types";
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

describe("concept diversity", () => {
  it("produces three directionally different concepts", () => {
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

    expect(concepts).toHaveLength(3);
    expect(new Set(concepts.map((c) => c.directionId)).size).toBe(3);
    expect(new Set(concepts.map((c) => c.title)).size).toBe(3);

    const fingerprints = concepts.map((c) =>
      c.culturalInfluences
        .map((e) => e.id)
        .sort()
        .join("|"),
    );
    expect(new Set(fingerprints).size).toBe(3);

    // Concrete directional differentiation
    expect(concepts.map((c) => c.directionId).sort()).toEqual([
      "communal",
      "intimate",
      "systems",
    ]);
    expect(concepts.some((c) => /Ritual Object|Private Listening|Chamber/i.test(c.title))).toBe(
      true,
    );
    expect(concepts.some((c) => /Gathering|Commons|Night Commons/i.test(c.title))).toBe(
      true,
    );
    expect(concepts.some((c) => /Recombine|Modular|Circuit/i.test(c.title))).toBe(
      true,
    );

    // Value / audience / mechanic differ across directions
    const positionings = concepts.map((c) => c.positioning);
    expect(positionings.some((p) => /slow, sensory intimacy/i.test(p))).toBe(true);
    expect(positionings.some((p) => /shared discovery/i.test(p))).toBe(true);
    expect(positionings.some((p) => /recombinable components/i.test(p))).toBe(true);
  });

  it("rejects three near-duplicate influence sets", () => {
    const tiny = entities.slice(0, 3);
    expect(() =>
      generateConceptCandidates({
        interpreted,
        entities: tiny,
        evidence: [
          {
            id: "ev",
            source: "mock_demo",
            label: "bundle",
            detail: "fixture",
            relatedEntityIds: tiny.map((e) => e.id),
            createdAt: "2026-10-11T00:00:00.000Z",
          },
        ],
        affinities: [],
        seedKey: "dup",
      }),
    ).toThrow(AgentError);
  });
});
