/**
 * Synthetic evaluation fixtures — OFFLINE ONLY.
 * Labeled so they cannot be mistaken for verified Qloo Taste Graph data.
 */

import type { CulturalEntity, EvidenceItem } from "../types";
import type {
  AgentExplorationResult,
  CollectedBundle,
  CulturalEvidenceSource,
  EvaluatedConcept,
} from "../agent/types";
import { createMockFixtureSource } from "../agent/fixtures/agent-mock-fixtures";

export const EVAL_FIXTURE_LABEL =
  "OFFLINE EVAL FIXTURE — synthetic data for Cultural Fusion Lab evaluation harness. Not Qloo Taste Graph output.";

export function labeledBundle(
  entities: CulturalEntity[],
  extraNotes: string[] = [],
): CollectedBundle {
  const evidence: EvidenceItem[] = [
    {
      id: `ev-eval-${entities.map((e) => e.id).join("-").slice(0, 40)}`,
      source: "mock_demo",
      label: "Offline eval collection bundle",
      detail: EVAL_FIXTURE_LABEL,
      relatedEntityIds: entities.map((e) => e.id),
      createdAt: "2026-10-11T00:00:00.000Z",
    },
  ];

  return {
    entities,
    evidence,
    provenanceByEntityId: Object.fromEntries(
      entities.map((e) => [e.id, "mock_demo" as const]),
    ),
    collectionNotes: [EVAL_FIXTURE_LABEL, ...extraNotes],
  };
}

export function entity(
  partial: Omit<CulturalEntity, "affinity" | "description"> &
    Partial<Pick<CulturalEntity, "affinity" | "description">>,
): CulturalEntity {
  return {
    description: partial.description ?? `Synthetic eval entity “${partial.name}”.`,
    affinity: partial.affinity ?? 0.65,
    ...partial,
  };
}

/** Cross-category jazz / film / brand / place neighborhood (≥5 topical). */
export const FIXTURE_JAZZ_CROSS = [
  entity({
    id: "eval-jazz-artist",
    name: "Eval Harbor Quartet",
    category: "music",
    tags: ["jazz", "night", "listening"],
  }),
  entity({
    id: "eval-jazz-film",
    name: "Eval Blue Hour",
    category: "film",
    tags: ["night", "city", "jazz"],
  }),
  entity({
    id: "eval-jazz-brand",
    name: "Eval Vinyl & Clay",
    category: "brands",
    tags: ["jazz", "craft", "listening"],
  }),
  entity({
    id: "eval-jazz-place",
    name: "Eval Canal Room",
    category: "places",
    tags: ["jazz", "night", "listening", "hospitality"],
  }),
  entity({
    id: "eval-jazz-brand-2",
    name: "Eval Parallel Press",
    category: "brands",
    tags: ["jazz", "craft"],
  }),
];

export const FIXTURE_STREETWEAR = [
  entity({
    id: "eval-sw-artist",
    name: "Eval Chrome Lotus",
    category: "music",
    tags: ["streetwear", "alt", "city"],
  }),
  entity({
    id: "eval-sw-brand",
    name: "Eval Archive Denim",
    category: "brands",
    tags: ["streetwear", "apparel"],
  }),
  entity({
    id: "eval-sw-place",
    name: "Eval Lantern Arcade",
    category: "places",
    tags: ["retail", "city", "streetwear"],
  }),
  entity({
    id: "eval-sw-film",
    name: "Eval Second Language",
    category: "film",
    tags: ["streetwear", "identity", "city"],
  }),
  entity({
    id: "eval-sw-fashion",
    name: "Eval Night Utility Layer",
    category: "fashion",
    tags: ["streetwear", "utility"],
  }),
];

export const FIXTURE_ANIME = [
  entity({
    id: "eval-anime-film",
    name: "Eval Orbit Myth",
    category: "film",
    tags: ["anime", "speculative"],
  }),
  entity({
    id: "eval-anime-brand",
    name: "Eval Signalcraft Goods",
    category: "brands",
    tags: ["anime", "collectible"],
  }),
  entity({
    id: "eval-anime-music",
    name: "Eval Silk Frequency",
    category: "music",
    tags: ["anime", "ambient"],
  }),
  entity({
    id: "eval-anime-place",
    name: "Eval Neon Gallery",
    category: "places",
    tags: ["anime", "gallery", "night"],
  }),
  entity({
    id: "eval-anime-fashion",
    name: "Eval Orbit Outerwear",
    category: "fashion",
    tags: ["anime", "collectible"],
  }),
];

export const FIXTURE_COFFEE = [
  entity({
    id: "eval-coffee-brand",
    name: "Eval Parallax Provisions",
    category: "brands",
    tags: ["coffee", "specialty"],
  }),
  entity({
    id: "eval-coffee-place",
    name: "Eval Ferment Counter",
    category: "places",
    tags: ["coffee", "hospitality"],
  }),
  entity({
    id: "eval-coffee-music",
    name: "Eval Morning Ensemble",
    category: "music",
    tags: ["coffee", "acoustic", "ritual"],
  }),
  entity({
    id: "eval-coffee-food",
    name: "Eval Citrus Smoke Kitchen",
    category: "food",
    tags: ["coffee", "culinary"],
  }),
  entity({
    id: "eval-coffee-brand-2",
    name: "Eval Cup Circuit Studio",
    category: "brands",
    tags: ["coffee", "craft"],
  }),
];

export const FIXTURE_ELECTRONIC = [
  entity({
    id: "eval-elec-artist",
    name: "Eval Neon Archive",
    category: "music",
    tags: ["electronic", "club"],
  }),
  entity({
    id: "eval-elec-place",
    name: "Eval Foundry Hall",
    category: "places",
    tags: ["electronic", "club", "industrial"],
  }),
  entity({
    id: "eval-elec-film",
    name: "Eval Terminal Bloom",
    category: "film",
    tags: ["future", "electronic"],
  }),
  entity({
    id: "eval-elec-brand",
    name: "Eval Verdant Circuit",
    category: "brands",
    tags: ["electronic", "tech", "nightlife"],
  }),
  entity({
    id: "eval-elec-fashion",
    name: "Eval Voltage Outerwear",
    category: "fashion",
    tags: ["electronic", "utility"],
  }),
];

export const FIXTURE_CULINARY = [
  entity({
    id: "eval-cul-food",
    name: "Eval Midnight Tea Chemistry",
    category: "food",
    tags: ["culinary", "ritual"],
  }),
  entity({
    id: "eval-cul-place",
    name: "Eval Market Hall",
    category: "places",
    tags: ["culinary", "gathering"],
  }),
  entity({
    id: "eval-cul-brand",
    name: "Eval Kite & Kiln",
    category: "brands",
    tags: ["culinary", "home", "ritual"],
  }),
  entity({
    id: "eval-cul-film",
    name: "Eval Glass Market Diaries",
    category: "film",
    tags: ["culinary", "documentary", "craft"],
  }),
  entity({
    id: "eval-cul-music",
    name: "Eval Market Percussion",
    category: "music",
    tags: ["culinary", "ritual"],
  }),
];

export const FIXTURE_WELLNESS = [
  entity({
    id: "eval-well-music",
    name: "Eval Breath Orchestra",
    category: "music",
    tags: ["ambient", "wellness"],
  }),
  entity({
    id: "eval-well-brand",
    name: "Eval Northwind Atelier",
    category: "brands",
    tags: ["wellness", "slow"],
  }),
  entity({
    id: "eval-well-place",
    name: "Eval Rooftop Listening",
    category: "places",
    tags: ["wellness", "intimate"],
  }),
  entity({
    id: "eval-well-fashion",
    name: "Eval Modular Outerwear",
    category: "fashion",
    tags: ["utility", "wellness"],
  }),
  entity({
    id: "eval-well-film",
    name: "Eval Still Frame Ritual",
    category: "film",
    tags: ["wellness", "documentary"],
  }),
];

/** Insufficient evidence (<3 entities) */
export const FIXTURE_INSUFFICIENT = [
  entity({
    id: "eval-insuff-1",
    name: "Eval Lone Artist",
    category: "music",
    tags: ["jazz"],
  }),
  entity({
    id: "eval-insuff-2",
    name: "Eval Lone Brand",
    category: "brands",
    tags: ["craft"],
  }),
];

/** Conflicting cultural tags in one neighborhood (still topically jazz-linked). */
export const FIXTURE_CONFLICTING = [
  entity({
    id: "eval-conf-jazz",
    name: "Eval Soft Quartet",
    category: "music",
    tags: ["jazz", "quiet", "ritual"],
  }),
  entity({
    id: "eval-conf-metal",
    name: "Eval Chrome Distortion",
    category: "music",
    tags: ["jazz", "metal", "loud", "aggressive"],
  }),
  entity({
    id: "eval-conf-brand",
    name: "Eval Split Signal Co",
    category: "brands",
    tags: ["jazz", "metal"],
  }),
  entity({
    id: "eval-conf-brand-2",
    name: "Eval Quiet Objects",
    category: "brands",
    tags: ["jazz", "quiet", "craft"],
  }),
  entity({
    id: "eval-conf-place",
    name: "Eval Dual Venue",
    category: "places",
    tags: ["jazz", "club", "cafe"],
  }),
  entity({
    id: "eval-conf-film",
    name: "Eval Noise Documentary",
    category: "film",
    tags: ["jazz", "documentary", "loud"],
  }),
];

/** Entities irrelevant to stated interest (golf vs jazz) */
export const FIXTURE_IRRELEVANT = [
  entity({
    id: "eval-irr-1",
    name: "Eval Fairway Club",
    category: "places",
    tags: ["golf", "sport"],
  }),
  entity({
    id: "eval-irr-2",
    name: "Eval Putter Brand",
    category: "brands",
    tags: ["golf", "equipment"],
  }),
  entity({
    id: "eval-irr-3",
    name: "Eval Green Documentary",
    category: "film",
    tags: ["golf", "documentary"],
  }),
  entity({
    id: "eval-irr-4",
    name: "Eval Country Playlist",
    category: "music",
    tags: ["country", "sport"],
  }),
];

export function sourceFromEntities(
  entities: CulturalEntity[],
  notes: string[] = [],
): CulturalEvidenceSource {
  return createMockFixtureSource(labeledBundle(entities, notes));
}

export function emptySource(): CulturalEvidenceSource {
  return createMockFixtureSource({
    entities: [],
    evidence: [],
    provenanceByEntityId: {},
    collectionNotes: [EVAL_FIXTURE_LABEL, "Forced empty collection."],
  });
}

/** Crafted result with an ungrounded cultural claim (adversarial regression). */
export function syntheticUngroundedClaimResult(): AgentExplorationResult {
  const entities = FIXTURE_JAZZ_CROSS.slice(0, 3);
  const evidence: EvidenceItem[] = [
    {
      id: "ev-synth-ok",
      source: "mock_demo",
      label: "Partial evidence",
      detail: EVAL_FIXTURE_LABEL,
      relatedEntityIds: [entities[0]!.id],
      createdAt: "2026-10-11T00:00:00.000Z",
    },
  ];

  const badConcept: EvaluatedConcept = {
    id: "synth-bad-concept",
    title: "Synthetic Bad Concept",
    positioning: "Crafted adversarial concept for eval harness.",
    outputCategory: "product",
    culturalInfluences: entities,
    evidenceIds: ["ev-synth-ok", "ev-missing-never-created"],
    summary: "Adversarial",
    claims: [
      {
        id: "claim-ungrounded",
        statement: `Cultural anchor: “${entities[1]!.name}” is a verified Qloo affinity driver.`,
        evidenceIds: ["ev-missing-never-created"],
        kind: "cultural_reference",
      },
    ],
    affinityIds: [],
    evaluation: {
      relevance: 0.9,
      originality: 0.9,
      evidenceCoverage: 0.9,
      overall: 0.9,
      notes: ["Synthetic inflated heuristic — must not override objective fail."],
    },
  };

  return {
    mode: "demo",
    request: {
      creativeObjective: "Adversarial unsupported claim case",
      culturalInterest: "jazz",
      outputCategory: "product",
      mode: "demo",
    },
    clusters: [],
    entities,
    concepts: [badConcept, badConcept, badConcept],
    affinities: [],
    evidence,
    generatedAt: "2026-10-11T00:00:00.000Z",
    disclaimer: EVAL_FIXTURE_LABEL,
    agentTrace: {
      engine: "deterministic-v1",
      mode: "demo",
      steps: [],
      affinityCount: 0,
      warnings: [EVAL_FIXTURE_LABEL],
    },
  };
}

/** Crafted result mistaking demo shared tags for verified Qloo affinities. */
export function syntheticFakeVerifiedAffinityResult(): AgentExplorationResult {
  const entities = FIXTURE_JAZZ_CROSS.slice(0, 3);
  const evidence: EvidenceItem[] = [
    {
      id: "ev-synth-demo",
      source: "mock_demo",
      label: "Demo tags only",
      detail: EVAL_FIXTURE_LABEL,
      relatedEntityIds: entities.map((e) => e.id),
      createdAt: "2026-10-11T00:00:00.000Z",
    },
  ];

  const concept: EvaluatedConcept = {
    id: "synth-fake-aff",
    title: "Synthetic Fake Affinity Concept",
    positioning: "Should fail objective validation.",
    outputCategory: "brand",
    culturalInfluences: entities,
    evidenceIds: ["ev-synth-demo"],
    summary: "Adversarial affinity misuse",
    claims: [
      {
        id: "claim-fake-aff",
        statement:
          "Cross-category inference (api_reported_score): music ↔ film via verified Qloo affinity.",
        evidenceIds: ["ev-synth-demo"],
        kind: "affinity_inference",
      },
    ],
    affinityIds: ["aff-fake"],
    evaluation: {
      relevance: 0.8,
      originality: 0.8,
      evidenceCoverage: 0.8,
      overall: 0.8,
      notes: [],
    },
  };

  return {
    mode: "demo",
    request: {
      creativeObjective: "Adversarial fake verified affinity",
      culturalInterest: "jazz",
      outputCategory: "brand",
      mode: "demo",
    },
    clusters: [],
    entities,
    concepts: [concept, { ...concept, id: "c2", title: "Dup A" }, { ...concept, id: "c3", title: "Dup B" }],
    affinities: [
      {
        id: "aff-fake",
        leftEntityId: entities[0]!.id,
        rightEntityId: entities[1]!.id,
        leftCategory: "music",
        rightCategory: "film",
        basis: "api_reported_score",
        sharedTags: ["night"],
        apiReportedScore: 0.99,
        evidenceIds: ["ev-synth-demo"],
        note: "INVALID: demo tags presented as verified Qloo affinity.",
      },
    ],
    evidence,
    generatedAt: "2026-10-11T00:00:00.000Z",
    disclaimer: EVAL_FIXTURE_LABEL,
    agentTrace: {
      engine: "deterministic-v1",
      mode: "demo",
      steps: [],
      affinityCount: 1,
      warnings: [EVAL_FIXTURE_LABEL],
    },
  };
}
