/**
 * Offline evaluation scenarios (happy path + adversarial).
 * All use synthetic fixtures — never live Qloo calls.
 */

import type { ExplorationRequest } from "../types";
import {
  emptySource,
  FIXTURE_ANIME,
  FIXTURE_COFFEE,
  FIXTURE_CONFLICTING,
  FIXTURE_CULINARY,
  FIXTURE_ELECTRONIC,
  FIXTURE_INSUFFICIENT,
  FIXTURE_IRRELEVANT,
  FIXTURE_JAZZ_CROSS,
  FIXTURE_STREETWEAR,
  FIXTURE_WELLNESS,
  sourceFromEntities,
  syntheticFakeVerifiedAffinityResult,
  syntheticUngroundedClaimResult,
} from "./fixtures";
import type { EvalScenario } from "./types";

function req(
  partial: Omit<ExplorationRequest, "mode"> & { mode?: "demo" },
): ExplorationRequest {
  return { mode: "demo", ...partial };
}

export const EVAL_SCENARIOS: EvalScenario[] = [
  // —— Happy / diverse (product, brand, experience + cross-category) ——
  {
    id: "H01-product-jazz-lisbon",
    name: "Product · jazz hospitality (Lisbon)",
    kind: "happy",
    description:
      "Cross-category music/film/brand/place neighborhood for a hospitality product.",
    request: req({
      creativeObjective:
        "Design a late-night hospitality product for culturally curious travelers",
      culturalInterest: "jazz",
      location: "Lisbon",
      outputCategory: "product",
    }),
    expectedOutcome: "success",
    createSource: () => sourceFromEntities(FIXTURE_JAZZ_CROSS),
    runMutation: true,
  },
  {
    id: "H02-product-streetwear-tokyo",
    name: "Product · streetwear (Tokyo)",
    kind: "happy",
    description: "Apparel-leaning product with music/brand/place blend.",
    request: req({
      creativeObjective: "Create a modular streetwear product system for city nights",
      culturalInterest: "streetwear",
      location: "Tokyo",
      outputCategory: "product",
    }),
    expectedOutcome: "success",
    createSource: () => sourceFromEntities(FIXTURE_STREETWEAR),
  },
  {
    id: "H03-brand-anime-seoul",
    name: "Brand · anime (Seoul)",
    kind: "happy",
    description: "Brand concept across film/music/brand/place.",
    request: req({
      creativeObjective: "Build a collectible brand world for anime-curious adults",
      culturalInterest: "anime",
      location: "Seoul",
      outputCategory: "brand",
    }),
    expectedOutcome: "success",
    createSource: () => sourceFromEntities(FIXTURE_ANIME),
    runMutation: true,
  },
  {
    id: "H04-brand-coffee-melbourne",
    name: "Brand · specialty coffee (Melbourne)",
    kind: "happy",
    description: "Food/place/brand cross-category brand concept.",
    request: req({
      creativeObjective: "Launch a specialty coffee brand with ritual hospitality cues",
      culturalInterest: "specialty coffee",
      location: "Melbourne",
      outputCategory: "brand",
    }),
    expectedOutcome: "success",
    createSource: () => sourceFromEntities(FIXTURE_COFFEE),
  },
  {
    id: "H05-experience-electronic-berlin",
    name: "Experience · electronic (Berlin)",
    kind: "happy",
    description: "Nightclub/cultural experience with electronic signals.",
    request: req({
      creativeObjective: "Design a nocturnal listening experience for electronic music fans",
      culturalInterest: "electronic music",
      location: "Berlin",
      outputCategory: "experience",
    }),
    expectedOutcome: "success",
    createSource: () => sourceFromEntities(FIXTURE_ELECTRONIC),
  },
  {
    id: "H06-experience-culinary-cdmx",
    name: "Experience · culinary (Mexico City)",
    kind: "happy",
    description: "Culinary gathering experience across food/place/film.",
    request: req({
      creativeObjective: "Create a communal culinary experience rooted in market culture",
      culturalInterest: "culinary",
      location: "Mexico City",
      outputCategory: "experience",
    }),
    expectedOutcome: "success",
    createSource: () => sourceFromEntities(FIXTURE_CULINARY),
    runMutation: true,
  },
  {
    id: "H07-product-wellness-cross",
    name: "Product · wellness cross-category",
    kind: "happy",
    description: "Music/brand/place/fashion wellness product blend.",
    request: req({
      creativeObjective: "Design a wellness product that feels like a personal listening ritual",
      culturalInterest: "wellness",
      outputCategory: "product",
    }),
    expectedOutcome: "success",
    createSource: () => sourceFromEntities(FIXTURE_WELLNESS),
  },
  {
    id: "H08-brand-jazz-no-location",
    name: "Brand · jazz without location",
    kind: "happy",
    description: "Brand output with cross-category jazz fixtures, no location filter.",
    request: req({
      creativeObjective: "Create a brand platform for intimate jazz culture",
      culturalInterest: "jazz",
      outputCategory: "brand",
    }),
    expectedOutcome: "success",
    createSource: () => sourceFromEntities(FIXTURE_JAZZ_CROSS),
  },
  {
    id: "H09-experience-streetwear-cross",
    name: "Experience · streetwear city circuit",
    kind: "happy",
    description: "Experience category with streetwear cross-signals.",
    request: req({
      creativeObjective: "Stage a city walking experience for streetwear communities",
      culturalInterest: "streetwear",
      location: "Osaka",
      outputCategory: "experience",
    }),
    expectedOutcome: "success",
    createSource: () => sourceFromEntities(FIXTURE_STREETWEAR),
  },
  {
    id: "H10-product-coffee-cross",
    name: "Product · coffee object system",
    kind: "happy",
    description: "Product concepts from coffee/food/place neighborhood.",
    request: req({
      creativeObjective: "Design a home coffee ritual product kit",
      culturalInterest: "coffee",
      outputCategory: "product",
    }),
    expectedOutcome: "success",
    createSource: () => sourceFromEntities(FIXTURE_COFFEE),
    runMutation: true,
  },

  // —— Adversarial ——
  {
    id: "A01-insufficient-evidence",
    name: "Adversarial · insufficient evidence",
    kind: "adversarial",
    description: "Fewer than 3 entities must fail closed with EMPTY_EVIDENCE.",
    request: req({
      creativeObjective: "Design anything",
      culturalInterest: "jazz",
      outputCategory: "product",
    }),
    expectedOutcome: "agent_error",
    expectedErrorCode: "EMPTY_EVIDENCE",
    createSource: () => sourceFromEntities(FIXTURE_INSUFFICIENT),
  },
  {
    id: "A02-empty-results",
    name: "Adversarial · empty collection",
    kind: "adversarial",
    description: "Empty source results must fail closed.",
    request: req({
      creativeObjective: "Design a product with no cultural signal",
      culturalInterest: "unknown-signal",
      outputCategory: "brand",
    }),
    expectedOutcome: "agent_error",
    expectedErrorCode: "EMPTY_EVIDENCE",
    createSource: () => emptySource(),
  },
  {
    id: "A03-conflicting-signals",
    name: "Adversarial · conflicting signals",
    kind: "adversarial",
    description:
      "Jazz vs metal conflict neighborhood — must remain objectively valid if claims stay grounded (heuristics may be messy).",
    request: req({
      creativeObjective: "Design a hospitality product for quiet jazz evenings",
      culturalInterest: "jazz",
      outputCategory: "product",
    }),
    expectedOutcome: "success",
    createSource: () =>
      sourceFromEntities(FIXTURE_CONFLICTING, [
        "Conflicting tags intentionally injected for adversarial evaluation.",
      ]),
  },
  {
    id: "A04-irrelevant-entities",
    name: "Adversarial · irrelevant entities",
    kind: "adversarial",
    description:
      "Golf entities for a jazz objective must fail closed as IRRELEVANT_EVIDENCE (not EMPTY_EVIDENCE).",
    request: req({
      creativeObjective: "Design a late-night jazz hospitality product",
      culturalInterest: "jazz",
      outputCategory: "product",
    }),
    expectedOutcome: "agent_error",
    expectedErrorCode: "IRRELEVANT_EVIDENCE",
    createSource: () =>
      sourceFromEntities(FIXTURE_IRRELEVANT, [
        "Irrelevant entities intentionally injected (golf vs jazz).",
      ]),
  },
  {
    id: "A05-ungrounded-claim-synthetic",
    name: "Adversarial · unsupported cultural claim",
    kind: "adversarial",
    description:
      "Synthetic result with missing evidence refs and false verified-Qloo language must fail objective validation.",
    request: req({
      creativeObjective: "Adversarial unsupported claim",
      culturalInterest: "jazz",
      outputCategory: "product",
    }),
    expectedOutcome: "success",
    createSource: () => sourceFromEntities(FIXTURE_JAZZ_CROSS),
    syntheticResult: syntheticUngroundedClaimResult(),
    expectObjectiveFailures: [
      "claim_traceability",
      "unsupported_cultural_claims",
    ],
  },
  {
    id: "A06-fake-verified-affinity",
    name: "Adversarial · demo tags as verified Qloo affinity",
    kind: "adversarial",
    description:
      "Synthetic api_reported_score affinity backed only by mock_demo must fail validation.",
    request: req({
      creativeObjective: "Adversarial fake affinity",
      culturalInterest: "jazz",
      outputCategory: "brand",
    }),
    expectedOutcome: "success",
    createSource: () => sourceFromEntities(FIXTURE_JAZZ_CROSS),
    syntheticResult: syntheticFakeVerifiedAffinityResult(),
    expectObjectiveFailures: [
      "demo_not_verified_qloo_affinity",
      "unsupported_cultural_claims",
    ],
  },
  {
    id: "A07-duplicate-concepts-synthetic",
    name: "Adversarial · duplicate concepts",
    kind: "adversarial",
    description:
      "Synthetic duplicate concept titles/influences must fail duplicate_concepts check.",
    request: req({
      creativeObjective: "Adversarial duplicates",
      culturalInterest: "jazz",
      outputCategory: "product",
    }),
    expectedOutcome: "success",
    createSource: () => sourceFromEntities(FIXTURE_JAZZ_CROSS),
    syntheticResult: (() => {
      const base = syntheticUngroundedClaimResult();
      return {
        ...base,
        concepts: base.concepts.map((c, i) => ({
          ...c,
          id: `dup-${i}`,
          title: "Identical Title",
          culturalInfluences: base.concepts[0]!.culturalInfluences,
          claims: [
            {
              id: `claim-dup-${i}`,
              statement: `Cultural anchor: “${base.entities[0]!.name}” informs the product.`,
              evidenceIds: [base.evidence[0]!.id],
              kind: "cultural_reference" as const,
            },
          ],
          evidenceIds: [base.evidence[0]!.id],
        })),
      };
    })(),
    expectObjectiveFailures: ["duplicate_concepts"],
  },
];

export function getScenarioById(id: string): EvalScenario | undefined {
  return EVAL_SCENARIOS.find((s) => s.id === id);
}
