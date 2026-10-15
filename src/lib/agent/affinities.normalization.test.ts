import { describe, expect, it } from "vitest";
import { identifyAffinities } from "./affinities";
import type { CulturalEntity, EvidenceItem } from "../types";

describe("cultural attribute normalization", () => {
  it("recognizes equivalent formatting across categories without inventing scores", () => {
    const entities: CulturalEntity[] = [
      {
        id: "artist",
        name: "Fictional Artist",
        category: "music",
        description: "Synthetic fixture",
        affinity: 0.5,
        tags: ["jazz", "live-music"],
      },
      {
        id: "venue",
        name: "Fictional Venue",
        category: "places",
        description: "Synthetic fixture",
        affinity: 0.5,
        tags: ["jazz", "live music"],
      },
    ];

    const evidence: EvidenceItem[] = entities.map((entity) => ({
      id: `ev-${entity.id}`,
      source: "mock_demo",
      label: "Synthetic evidence",
      detail: "Test fixture only",
      relatedEntityIds: [entity.id],
      createdAt: "2026-10-15T00:00:00.000Z",
    }));

    const affinities = identifyAffinities({
      entities,
      evidence,
      provenanceByEntityId: {
        artist: "mock_demo",
        venue: "mock_demo",
      },
      culturalInterest: "jazz",
    });

    expect(affinities.some(
      (affinity) =>
        affinity.basis === "shared_tag" &&
        affinity.sharedTags.includes("live music") &&
        affinity.evidenceIds.length > 0 &&
        affinity.apiReportedScore === undefined
    )).toBe(true);
  });
});
