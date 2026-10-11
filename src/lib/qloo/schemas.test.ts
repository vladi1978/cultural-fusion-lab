import { describe, expect, it } from "vitest";

import {
  MOCK_LABEL,
  MOCK_SEARCH_ARTISTS_RESPONSE,
  MOCK_TAGS_RESPONSE,
} from "./fixtures/mock-responses";
import {
  parseEntitiesResponse,
  parseTagsResponse,
  validateInsightsParams,
  validateSearchParams,
  validateTagsParams,
} from "./schemas";

describe("Qloo schema parsers (mock fixtures)", () => {
  it("parses documented entities envelope from labeled mock search payload", () => {
    expect(MOCK_SEARCH_ARTISTS_RESPONSE.__mock).toContain("MOCK FIXTURE");
    const entities = parseEntitiesResponse(MOCK_SEARCH_ARTISTS_RESPONSE);
    expect(entities).toHaveLength(2);
    expect(entities[0]?.entity_id).toBe(
      "11111111-1111-1111-1111-111111111111",
    );
    expect(entities[0]?.subtype).toBe("urn:entity:artist");
    expect(entities[0]?.name).toBe("Mock Neon Quartet");
  });

  it("parses documented tags envelope from labeled mock tags payload", () => {
    expect(MOCK_TAGS_RESPONSE.__mock).toBe(MOCK_LABEL);
    const tags = parseTagsResponse(MOCK_TAGS_RESPONSE);
    expect(tags).toHaveLength(2);
    expect(tags[0]?.id).toBe("urn:tag:genre:media:jazz");
  });

  it("validates search / tags / insights params per documented constraints", () => {
    expect(validateSearchParams({ query: "" })).toMatch(/required/i);
    expect(
      validateSearchParams({ query: "jazz", type: "urn:entity:movie", take: 5 }),
    ).toBeNull();
    expect(validateTagsParams({})).toMatch(/filter\.query/i);
    expect(validateTagsParams({ "filter.query": "jazz", take: 10 })).toBeNull();
    expect(
      validateInsightsParams({
        "filter.type": "urn:entity:brand",
        take: 8,
      }),
    ).toBeNull();
    expect(
      validateInsightsParams({
        "filter.type": "brand" as unknown as "urn:entity:brand",
      }),
    ).toMatch(/filter\.type/i);
  });
});
