import { afterEach, describe, expect, it, vi } from "vitest";

import { buildUrl, qlooRequest } from "./client";
import { QlooError } from "./errors";
import {
  MOCK_LABEL,
  MOCK_RATE_LIMIT_HEADERS,
  MOCK_SEARCH_ARTISTS_RESPONSE,
} from "./fixtures/mock-responses";

describe("qlooRequest (mock transport)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends X-Api-Key header (documented auth) and never Bearer", async () => {
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("X-Api-Key")).toBe("test-key-not-real");
      expect(headers.get("Authorization")).toBeNull();
      expect(String(input)).toContain("/search?");
      expect(String(input)).toContain("query=jazz");
      return new Response(JSON.stringify(MOCK_SEARCH_ARTISTS_RESPONSE), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const payload = await qlooRequest({
      path: "/search",
      query: { query: "jazz", type: "urn:entity:artist" },
      fetchImpl,
      config: {
        apiKey: "test-key-not-real",
        baseUrl: "https://hackathon.api.qloo.com",
        timeoutMs: 5000,
      },
    });

    expect((payload as { __mock?: string }).__mock).toContain("MOCK");
    expect(MOCK_LABEL).toContain("not Qloo");
  });

  it("maps 429 responses to RATE_LIMITED with retry-after seconds", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ error: "rate limit" }), {
        status: 429,
        headers: { ...MOCK_RATE_LIMIT_HEADERS },
      });
    });

    await expect(
      qlooRequest({
        path: "/v2/insights",
        query: { "filter.type": "urn:entity:brand" },
        fetchImpl,
        config: {
          apiKey: "test-key-not-real",
          baseUrl: "https://hackathon.api.qloo.com",
          timeoutMs: 5000,
        },
      }),
    ).rejects.toMatchObject({
      code: "RATE_LIMITED",
      retryAfterSeconds: 30,
    } satisfies Partial<QlooError>);
  });

  it("maps abort/timeout to TIMEOUT", async () => {
    const fetchImpl = vi.fn(async () => {
      const err = new Error("Aborted");
      err.name = "AbortError";
      throw err;
    });

    await expect(
      qlooRequest({
        path: "/v2/tags",
        query: { "filter.query": "jazz" },
        fetchImpl,
        config: {
          apiKey: "test-key-not-real",
          baseUrl: "https://hackathon.api.qloo.com",
          timeoutMs: 10,
        },
      }),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("builds hackathon URLs without inventing undocumented path prefixes", () => {
    expect(
      buildUrl("https://hackathon.api.qloo.com", "/search", {
        query: "test",
        type: "urn:entity:movie",
      }),
    ).toBe(
      "https://hackathon.api.qloo.com/search?query=test&type=urn%3Aentity%3Amovie",
    );
    expect(
      buildUrl("https://hackathon.api.qloo.com/", "/v2/insights", {
        "filter.type": "urn:entity:brand",
      }),
    ).toBe(
      "https://hackathon.api.qloo.com/v2/insights?filter.type=urn%3Aentity%3Abrand",
    );
  });
});
