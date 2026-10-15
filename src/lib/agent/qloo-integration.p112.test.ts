import { describe, expect, it, vi } from "vitest";
import { runExplorationAgent } from "./orchestrator";
import { createQlooSource } from "./sources/qloo-source";

const request = {
  creativeObjective: "Create a jazz-inspired cultural hospitality experience",
  culturalInterest: "jazz",
  location: "Lisbon",
  outputCategory: "experience" as const,
  mode: "live" as const,
};

describe("P1.12 Qloo-to-agent integration", () => {
  it("processes Qloo-shaped responses through the complete agent", async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);
      const type = url.includes("/v2/insights")
        ? "urn:entity:place"
        : url.includes("urn%3Aentity%3Abrand")
          ? "urn:entity:brand"
          : "urn:entity:artist";

      const names =
        type === "urn:entity:artist"
          ? ["Jazz Ensemble", "Jazz Quartet", "Jazz Collective"]
          : type === "urn:entity:brand"
            ? ["Jazz Listening Club", "Jazz Heritage Studio"]
            : ["Lisbon Cultural Venue", "Historic Listening Room"];

      return new Response(
        JSON.stringify({
          success: true,
          results: names.map((name, index) => ({
            entity_id: `${type}-${index}`,
            name,
            types: [type],
            popularity: 0.8,
            tags: [
              { name: "jazz" },
              { name: "community" },
              { name: "ritual" },
            ],
          })),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const result = await runExplorationAgent(request, {
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
    });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(result.mode).toBe("live");
    expect(result.agentTrace.engine).toBe("deterministic-v2.1");
    expect(result.agentTrace.relevance?.kept).toBeGreaterThanOrEqual(3);
    expect(result.agentTrace.steps.map((step) => step.id)).toContain(
      "opportunities",
    );
    expect(result.agentTrace.steps.map((step) => step.id)).toContain(
      "evaluate",
    );
    expect(result.concepts.length).toBeGreaterThanOrEqual(1);
    expect(result.concepts.length).toBeLessThanOrEqual(3);
    expect(result.evidence.some((e) => e.source === "verified_api")).toBe(true);
    expect(result.evidence.some((e) => e.source === "agent_hypothesis")).toBe(true);
    expect(result.evidence.some((e) => e.source === "mock_demo")).toBe(false);
    expect(result.disclaimer).toMatch(/LIVE MODE/);
  });
});
