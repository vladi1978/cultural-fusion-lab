import { describe, expect, it, vi } from "vitest";

import { exploreWithQloo } from "./adapter";
import {
  MOCK_INSIGHTS_RESPONSE,
  MOCK_LABEL,
  MOCK_SEARCH_ARTISTS_RESPONSE,
  MOCK_SEARCH_BRANDS_RESPONSE,
  MOCK_SEARCH_MOVIES_RESPONSE,
  MOCK_SEARCH_PLACES_RESPONSE,
  MOCK_TAGS_RESPONSE,
} from "./fixtures/mock-responses";
import { mapQlooEntityToCultural } from "./mapper";
import { parseEntitiesResponse } from "./schemas";

function mockFetchRouter(input: string | URL): Response {
  const url = String(input);
  let body: unknown = { success: true, results: { entities: [] } };

  if (url.includes("/search?") && url.includes("urn%3Aentity%3Aartist")) {
    body = MOCK_SEARCH_ARTISTS_RESPONSE;
  } else if (url.includes("/search?") && url.includes("urn%3Aentity%3Amovie")) {
    body = MOCK_SEARCH_MOVIES_RESPONSE;
  } else if (url.includes("/search?") && url.includes("urn%3Aentity%3Abrand")) {
    body = MOCK_SEARCH_BRANDS_RESPONSE;
  } else if (url.includes("/search?") && url.includes("urn%3Aentity%3Aplace")) {
    body = MOCK_SEARCH_PLACES_RESPONSE;
  } else if (url.includes("/v2/tags")) {
    body = MOCK_TAGS_RESPONSE;
  } else if (url.includes("/v2/insights")) {
    body = MOCK_INSIGHTS_RESPONSE;
  }

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("exploreWithQloo with labeled mock responses", () => {
  it("builds a live-shaped exploration result from mock fixtures only", async () => {
    expect(MOCK_LABEL).toContain("MOCK FIXTURE");

    const fetchImpl = vi.fn(async (input: string | URL) =>
      mockFetchRouter(input),
    );

    const result = await exploreWithQloo(
      {
        creativeObjective: "Late-night hospitality product",
        culturalInterest: "jazz",
        location: "Lisbon",
        outputCategory: "product",
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

    expect(result.mode).toBe("live");
    expect(result.entities.length).toBeGreaterThanOrEqual(3);
    expect(result.concepts).toHaveLength(3);
    expect(
      result.evidence.some((e) => e.source === "verified_api"),
    ).toBe(true);
    expect(
      result.evidence.some((e) => e.source === "agent_hypothesis"),
    ).toBe(true);
    expect(result.disclaimer).toMatch(/LIVE MODE/i);
    expect(fetchImpl).toHaveBeenCalled();
  });

  it("maps mock entities without claiming predictive scores", () => {
    const entity = parseEntitiesResponse(MOCK_SEARCH_MOVIES_RESPONSE)[0]!;
    const cultural = mapQlooEntityToCultural(entity);
    expect(cultural.name).toBe("Mock Midnight Atlas");
    expect(cultural.affinity).toBeCloseTo(0.91);
    expect(cultural.description).toMatch(/Fictional|fixture|unit tests/i);
  });
});
