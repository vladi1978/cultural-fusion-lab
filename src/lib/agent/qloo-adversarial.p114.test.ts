import { describe, expect, it, vi } from "vitest";
import { runExplorationAgent } from "./orchestrator";
import { createQlooSource } from "./sources/qloo-source";

describe("P1.14 adversarial Qloo-to-agent integration", () => {
  it("accepts verified indirect Insights and rejects unrelated Search results", async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);

      const isInsights = url.includes("/v2/insights");
      const isBrand = url.includes("urn%3Aentity%3Abrand");

      const type = isInsights
        ? "urn:entity:place"
        : isBrand
          ? "urn:entity:brand"
          : "urn:entity:artist";

      const names = isInsights
        ? ["Lisbon Listening Room", "Lisbon Cultural Venue"]
        : isBrand
          ? ["Jazz Heritage Studio", "Golf Equipment"]
          : ["Jazz Ensemble", "Jazz Quartet", "Jazz Collective"];

      return new Response(
        JSON.stringify({
          success: true,
          results: names.map((name, index) => ({
            entity_id: `${type}-${index}`,
            name,
            types: [type],
            popularity: 0.8,
            tags: [{ id: "tag-community", name: "community" }],
          })),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const result = await runExplorationAgent(
      {
        creativeObjective: "Create a jazz-inspired cultural hospitality experience",
        culturalInterest: "jazz",
        location: "Lisbon",
        outputCategory: "experience",
        mode: "live",
      },
      {
        source: createQlooSource({
          bypassLiveGate: true,
          fetchImpl,
          config: {
            apiKey: "test-key-not-real",
            baseUrl: "https://hackathon.api.qloo.com",
            timeoutMs: 5000,
          },
        }),
        now: () => "2026-10-13T12:00:00.000Z",
      },
    );

    const names = result.entities.map((entity) => entity.name);

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(names).toContain("Jazz Ensemble");
    expect(names).toContain("Lisbon Listening Room");
    expect(names).toContain("Lisbon Cultural Venue");
    expect(names).not.toContain("Golf Equipment");

    const insights = result.evidence.find(
      (item) => item.label === "Qloo Insights results",
    );

    expect(insights?.source).toBe("verified_api");
    expect(insights?.insightSeedEntityIds?.length).toBeGreaterThan(0);
    expect(insights?.relatedEntityIds?.length).toBe(2);

    const seedIds = new Set(insights?.insightSeedEntityIds ?? []);
    expect(
      result.entities.some(
        (entity) => seedIds.has(entity.id) && entity.name.includes("Jazz"),
      ),
    ).toBe(true);

    expect(result.agentTrace.relevance?.kept).toBeGreaterThanOrEqual(5);
    expect(result.concepts.length).toBeGreaterThanOrEqual(1);
    expect(result.evidence.some((item) => item.source === "mock_demo")).toBe(false);
  });
});
