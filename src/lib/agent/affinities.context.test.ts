import { describe, expect, it } from "vitest";
import { identifyAffinities } from "./affinities";
import type { CulturalEntity, EvidenceItem } from "../types";

describe("context-aware affinity ranking", () => {
  it("prioritizes shared attributes other than the requested interest", () => {
    const entities: CulturalEntity[] = [
      {
        id: "music-a",
        name: "Jazz Artist",
        category: "music",
        description: "Fictional test entity",
        affinity: 0.8,
        tags: ["jazz", "coffee"],
      },
      {
        id: "food-a",
        name: "Coffee Venue",
        category: "food",
        description: "Fictional test entity",
        affinity: 0.7,
        tags: ["jazz", "coffee"],
      },
      {
        id: "brand-a",
        name: "Jazz Brand",
        category: "brands",
        description: "Fictional test entity",
        affinity: 0.7,
        tags: ["jazz"],
      },
    ];

    const evidence: EvidenceItem[] = [{
      id: "ev-test",
      source: "mock_demo",
      label: "Fictional test evidence",
      detail: "Synthetic fixture only",
      relatedEntityIds: entities.map((entity) => entity.id),
      createdAt: "2026-10-11T00:00:00.000Z",
    }];

    const provenanceByEntityId = Object.fromEntries(
      entities.map((entity) => [entity.id, "mock_demo" as const]),
    );

    const rank = (culturalInterest: string) =>
      identifyAffinities({
        entities,
        evidence,
        provenanceByEntityId,
        culturalInterest,
      });

    const jazz = rank("jazz");
    const coffee = rank("coffee");

    expect(jazz[0]?.sharedTags).toContain("coffee");
    expect(coffee[0]?.sharedTags).toContain("jazz");
    expect(jazz.every((affinity) => affinity.evidenceIds.length > 0)).toBe(true);
    expect(coffee.every((affinity) => affinity.evidenceIds.length > 0)).toBe(true);
  });
});
