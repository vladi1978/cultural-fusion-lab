import { describe, expect, it, vi } from "vitest";
import { exploreWithQloo } from "./adapter";

describe("Qloo Live discovery diversity diagnostic", () => {
  it("identifies a music-only collection without inventing other categories", async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);
      const isArtist = url.includes("/search?") &&
        url.includes("urn%3Aentity%3Aartist");

      const entities = isArtist
        ? Array.from({ length: 6 }, (_, i) => ({
            entity_id: `artist-${i}`,
            name: `Jazz Artist ${i}`,
            types: ["urn:entity:artist"],
            tags: [{ id: "tag-jazz", name: "jazz" }],
          }))
        : [];

      return new Response(
        JSON.stringify({ success: true, results: entities }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const result = await exploreWithQloo(
      {
        creativeObjective: "Jazz-inspired Lisbon experience",
        culturalInterest: "jazz",
        location: "Lisbon",
        outputCategory: "experience",
        mode: "live",
      },
      {
        bypassLiveGate: true,
        fetchImpl,
        config: {
          apiKey: "test-key-not-real",
          baseUrl: "https://hackathon.api.qloo.com",
          timeoutMs: 5000,
        },
      },
    );

    const categories = [...new Set(result.entities.map(e => e.category))];

    console.log("OFFLINE CATEGORIES:", categories);
    console.log("OFFLINE ENTITIES:", result.entities.length);
    console.log("MOCK REQUESTS:", fetchImpl.mock.calls.length);

    expect(categories).toEqual(["music"]);
    expect(result.entities).toHaveLength(6);
    expect(fetchImpl.mock.calls.length).toBeLessThanOrEqual(3);

    const apiEvidence = result.evidence.find(
      e => e.source === "verified_api" &&
        e.label === "Qloo Taste Graph entities",
    );

    expect(apiEvidence?.detail).toContain(
      "GET /v2/insights type=urn:entity:place (0 results)",
    );
  });
});
