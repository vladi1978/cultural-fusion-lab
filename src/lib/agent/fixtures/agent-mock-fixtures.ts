/**
 * CLEARLY LABELED MOCK FIXTURES FOR AGENT UNIT TESTS ONLY.
 * Not Qloo Taste Graph data. Not live insights.
 */

import type { CulturalEntity, EvidenceItem } from "../../types";
import type { CollectedBundle, CulturalEvidenceSource } from "../types";

export const AGENT_MOCK_LABEL =
  "MOCK FIXTURE — agent unit-test data only; not Qloo Taste Graph output";

export const MOCK_AGENT_ENTITIES: CulturalEntity[] = [
  {
    id: "mock-artist-1",
    name: "Mock Neon Quartet",
    category: "music",
    description: "Fictional artist fixture for agent tests.",
    affinity: 0.82,
    tags: ["jazz", "night", "listening"],
  },
  {
    id: "mock-film-1",
    name: "Mock Midnight Atlas",
    category: "film",
    description: "Fictional film fixture for agent tests.",
    affinity: 0.77,
    tags: ["jazz", "night", "city"],
  },
  {
    id: "mock-brand-1",
    name: "Mock Lumen Atelier",
    category: "brands",
    description: "Fictional brand fixture for agent tests.",
    affinity: 0.7,
    tags: ["jazz", "craft", "listening"],
  },
  {
    id: "mock-place-1",
    name: "Mock Canal Listening Room",
    category: "places",
    description: "Fictional place fixture for agent tests.",
    affinity: 0.74,
    tags: ["jazz", "night", "listening"],
  },
  {
    id: "mock-brand-2",
    name: "Mock Parallel Studio",
    category: "brands",
    description: "Secondary brand fixture for mutation tests.",
    affinity: 0.61,
    tags: ["jazz", "craft"],
  },
];

export const MOCK_AGENT_EVIDENCE: EvidenceItem[] = [
  {
    id: "ev-mock-agent-bundle",
    source: "mock_demo",
    label: "Mock agent collection bundle",
    detail: `${AGENT_MOCK_LABEL}. Bundle used for offline orchestration tests.`,
    relatedEntityIds: MOCK_AGENT_ENTITIES.map((e) => e.id),
    createdAt: "2026-10-11T00:00:00.000Z",
  },
];

/** Injected source that returns labeled fixtures without calling Qloo. */
export function createMockFixtureSource(
  overrides?: Partial<CollectedBundle>,
): CulturalEvidenceSource {
  return {
    id: "demo",
    async collect(): Promise<CollectedBundle> {
      const entities = overrides?.entities ?? MOCK_AGENT_ENTITIES;
      const evidence = overrides?.evidence ?? MOCK_AGENT_EVIDENCE;
      const provenanceByEntityId =
        overrides?.provenanceByEntityId ??
        Object.fromEntries(entities.map((e) => [e.id, "mock_demo" as const]));

      return {
        entities,
        evidence,
        provenanceByEntityId,
        collectionNotes: [
          AGENT_MOCK_LABEL,
          ...(overrides?.collectionNotes ?? []),
        ],
      };
    },
    async suggestReplacements({ outgoing }) {
      const candidates = MOCK_AGENT_ENTITIES.filter((e) => e.id !== outgoing.id);
      return {
        candidates,
        evidence: [
          {
            id: "ev-mock-mut-cand",
            source: "mock_demo",
            label: "Mock mutation candidates",
            detail: AGENT_MOCK_LABEL,
            relatedEntityIds: candidates.map((c) => c.id),
            createdAt: "2026-10-11T00:00:00.000Z",
          },
        ],
      };
    },
  };
}

/** Source that fails collection — for failure-handling tests. */
export function createFailingSource(): CulturalEvidenceSource {
  return {
    id: "demo",
    async collect() {
      return {
        entities: [],
        evidence: [],
        provenanceByEntityId: {},
        collectionNotes: [AGENT_MOCK_LABEL, "Forced empty collection."],
      };
    },
  };
}
