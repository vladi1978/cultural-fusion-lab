import { describe, expect, it, vi } from "vitest";
import { exploreWithQloo } from "./adapter";

describe("Qloo Insights seed diversity", () => {
  it("uses relevant seeds from both music and brands when available", async () => {
    let insightsSeedIds: string[] = [];

    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      const type = url.searchParams.get("type");

      let entities: Array<Record<string, unknown>> = [];

      if (url.pathname === "/search" && type === "urn:entity:artist") {
        entities = Array.from({ length: 6 }, (_, i) => ({
          entity_id: `artist-${i}`,
          name: `Jazz Artist ${i}`,
          types: ["urn:entity:artist"],
          tags: [{ id: "jazz", name: "jazz" }],
        }));
      }

      if (url.pathname === "/search" && type === "urn:entity:brand") {
        entities = [{
          entity_id: "brand-1",
          name: "Jazz Listening Brand",
          types: ["urn:entity:brand"],
          tags: [{ id: "jazz", name: "jazz" }],
        }];
      }

      if (url.pathname === "/v2/insights") {
        insightsSeedIds = (
          url.searchParams.get("signal.interests.entities") ?? ""
        ).split(",").filter(Boolean);
      }

      return new Response(
        JSON.stringify({ success: true, results: entities }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    await exploreWithQloo(
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

    console.log("INSIGHTS SEEDS:", insightsSeedIds);
    console.log("MOCK REQUESTS:", fetchImpl.mock.calls.length);

    expect(insightsSeedIds.some(id => id.startsWith("artist-"))).toBe(true);
    expect(insightsSeedIds).toContain("brand-1");
    expect(insightsSeedIds.length).toBeLessThanOrEqual(3);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
