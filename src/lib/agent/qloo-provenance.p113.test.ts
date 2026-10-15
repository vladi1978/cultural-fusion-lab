import { describe, expect, it } from "vitest";
import { identifyAffinities } from "./affinities";
import { mapQlooEntityToCultural } from "../qloo/mapper";

describe("P1.13 Qloo provenance safeguards", () => {
  it("must not treat popularity as an API-reported affinity", () => {
    const artist = mapQlooEntityToCultural({
      entity_id: "artist-1",
      name: "Jazz Ensemble",
      types: ["urn:entity:artist"],
      popularity: 0.9,
      tags: [{ id: "tag-1", name: "jazz" }],
    });

    const place = mapQlooEntityToCultural({
      entity_id: "place-1",
      name: "Listening Room",
      types: ["urn:entity:place"],
      popularity: 0.8,
      tags: [{ id: "tag-1", name: "jazz" }],
    });

    const affinities = identifyAffinities({
      entities: [artist, place],
      evidence: [
        {
          id: "ev-fixture",
          source: "verified_api",
          label: "Simulated Qloo evidence",
          detail: "Test fixture only; not a real API response.",
          relatedEntityIds: [artist.id, place.id],
          createdAt: "2026-10-13T12:00:00.000Z",
        },
      ],
      provenanceByEntityId: {
        [artist.id]: "verified_api",
        [place.id]: "verified_api",
      },
      culturalInterest: "jazz",
    });

    expect(affinities.length).toBeGreaterThan(0);
    expect(affinities.every((a) => a.basis !== "api_reported_score")).toBe(true);
    expect(affinities.every((a) => a.apiReportedScore === undefined)).toBe(true);
  });
});
