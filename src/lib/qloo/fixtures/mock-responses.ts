/**
 * CLEARLY LABELED MOCK API RESPONSES FOR UNIT TESTS ONLY.
 *
 * These payloads are fictional fixtures shaped like documented Qloo responses.
 * They are NOT real Taste Graph data and must never be presented as live Qloo insights.
 */

export const MOCK_LABEL =
  "MOCK FIXTURE — fictional unit-test payload, not Qloo Taste Graph data";

/** Documented Insights-style envelope: { success, results: { entities } } */
export const MOCK_SEARCH_ARTISTS_RESPONSE = {
  __mock: MOCK_LABEL,
  success: true,
  results: {
    entities: [
      {
        name: "Mock Neon Quartet",
        entity_id: "11111111-1111-1111-1111-111111111111",
        type: "urn:entity",
        subtype: "urn:entity:artist",
        popularity: 0.82,
        properties: {
          description: "Fictional artist fixture for unit tests.",
        },
        tags: [
          { id: "urn:tag:genre:media:jazz", name: "Jazz", type: "urn:tag:genre:media" },
        ],
      },
      {
        name: "Mock Harbor Ensemble",
        entity_id: "22222222-2222-2222-2222-222222222222",
        type: "urn:entity",
        subtype: "urn:entity:artist",
        popularity: 0.71,
        properties: {
          description: "Second fictional artist fixture.",
        },
      },
    ],
  },
  duration: 12,
} as const;

export const MOCK_SEARCH_MOVIES_RESPONSE = {
  __mock: MOCK_LABEL,
  success: true,
  results: {
    entities: [
      {
        name: "Mock Midnight Atlas",
        entity_id: "33333333-3333-3333-3333-333333333333",
        type: "urn:entity",
        subtype: "urn:entity:movie",
        query: { affinity: 0.91 },
        properties: {
          description: "Fictional film fixture for unit tests.",
        },
      },
    ],
  },
} as const;

export const MOCK_SEARCH_BRANDS_RESPONSE = {
  __mock: MOCK_LABEL,
  success: true,
  results: {
    entities: [
      {
        name: "Mock Lumen Atelier",
        entity_id: "44444444-4444-4444-4444-444444444444",
        type: "urn:entity",
        subtype: "urn:entity:brand",
        popularity: 0.66,
        properties: {
          description: "Fictional brand fixture for unit tests.",
        },
      },
    ],
  },
} as const;

export const MOCK_SEARCH_PLACES_RESPONSE = {
  __mock: MOCK_LABEL,
  success: true,
  results: {
    entities: [
      {
        name: "Mock Canal Listening Room",
        entity_id: "55555555-5555-5555-5555-555555555555",
        type: "urn:entity",
        subtype: "urn:entity:place",
        popularity: 0.74,
        properties: {
          description: "Fictional place fixture for unit tests.",
        },
      },
    ],
  },
} as const;

/** Documented Tags envelope: { success, results: { tags } } */
export const MOCK_TAGS_RESPONSE = {
  __mock: MOCK_LABEL,
  success: true,
  results: {
    tags: [
      {
        id: "urn:tag:genre:media:jazz",
        name: "Jazz",
        type: "urn:tag:genre:media",
        popularity: 0.9,
      },
      {
        id: "urn:tag:keyword:media:late_night",
        name: "Late Night",
        type: "urn:tag:keyword:media",
        popularity: 0.55,
      },
    ],
  },
  duration: 8,
} as const;

export const MOCK_INSIGHTS_RESPONSE = {
  __mock: MOCK_LABEL,
  success: true,
  results: {
    entities: [
      {
        name: "Mock Signalcraft Brand",
        entity_id: "66666666-6666-6666-6666-666666666666",
        type: "urn:entity",
        subtype: "urn:entity:brand",
        query: { affinity: 0.88 },
        properties: {
          description: "Fictional insights fixture for unit tests.",
        },
      },
      {
        name: "Mock Parallel Studio",
        entity_id: "77777777-7777-7777-7777-777777777777",
        type: "urn:entity",
        subtype: "urn:entity:brand",
        popularity: 0.6,
        properties: {
          description: "Another fictional insights fixture.",
        },
      },
    ],
  },
} as const;

export const MOCK_RATE_LIMIT_HEADERS = {
  "retry-after": "30",
} as const;
