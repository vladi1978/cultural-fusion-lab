import type {
  CulturalCluster,
  CulturalEntity,
  EntityCategory,
  EvidenceItem,
  ExplorationRequest,
  ExplorationResult,
  FusionConcept,
  MutationRequest,
  MutationResult,
  OutputCategory,
} from "./types";
import { DEMO_DISCLAIMER } from "./types";

/** Simple deterministic hash for stable demo variety */
function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(arr: readonly T[], seed: number, offset: number): T {
  return arr[(seed + offset) % arr.length]!;
}

function affinity(seed: number, i: number): number {
  const raw = ((seed * (i + 3) * 2654435761) >>> 0) % 1000;
  return Math.round((0.55 + (raw / 1000) * 0.4) * 100) / 100;
}

const MUSIC_POOL = [
  { name: "Neon Archive Collective", tags: ["synthwave", "underground"] },
  { name: "Silk Frequency", tags: ["ambient", "ritual"] },
  { name: "Midnight Souk Ensemble", tags: ["fusion", "live"] },
  { name: "Chrome Lotus", tags: ["alt-pop", "diaspora"] },
  { name: "Harbor Pulse Orchestra", tags: ["cinematic", "city"] },
] as const;

const FILM_POOL = [
  { name: "Atlas After Hours", tags: ["neo-noir", "city"] },
  { name: "Glass Market Diaries", tags: ["documentary", "craft"] },
  { name: "Orbit of Ordinary Gods", tags: ["speculative", "myth"] },
  { name: "Second Language", tags: ["indie", "identity"] },
  { name: "Terminal Bloom", tags: ["art-house", "future"] },
] as const;

const BRAND_POOL = [
  { name: "Lumen & Clay", tags: ["design", "objects"] },
  { name: "Northwind Atelier", tags: ["apparel", "slow"] },
  { name: "Kite & Kiln", tags: ["home", "ritual"] },
  { name: "Parallax Provisions", tags: ["F&B", "limited"] },
  { name: "Verdant Circuit", tags: ["wellness", "tech"] },
] as const;

const PLACE_POOL = [
  { name: "Canal District Night Markets", tags: ["night", "gathering"] },
  { name: "Rooftop Listening Rooms", tags: ["intimate", "sound"] },
  { name: "Harbor Foundry Halls", tags: ["industrial", "gallery"] },
  { name: "Lantern Arcade", tags: ["retail", "play"] },
] as const;

const FASHION_POOL = [
  { name: "Modular Outerwear Guild", tags: ["utility", "layer"] },
  { name: "Iridescent Tailoring Lab", tags: ["couture", "light"] },
  { name: "Archive Denim Circle", tags: ["vintage", "repair"] },
] as const;

const FOOD_POOL = [
  { name: "Ferment & Fire Counters", tags: ["umami", "share"] },
  { name: "Citrus Smoke Kitchen", tags: ["bright", "evening"] },
  { name: "Midnight Tea Chemistry", tags: ["ritual", "slow"] },
] as const;

function buildEntities(
  interest: string,
  location: string | undefined,
  seed: number,
): CulturalEntity[] {
  const loc = location?.trim() || "global cities";
  const entities: CulturalEntity[] = [];

  const push = (
    category: EntityCategory,
    pool: readonly { name: string; tags: readonly string[] }[],
    count: number,
    baseOffset: number,
  ) => {
    for (let i = 0; i < count; i++) {
      const item = pick(pool, seed, baseOffset + i);
      entities.push({
        id: `demo-${category}-${i}-${seed % 997}`,
        name: item.name,
        category,
        description: `Fictional ${category} signal loosely themed around “${interest}” and ${loc}. Not sourced from Qloo.`,
        affinity: affinity(seed, baseOffset + i),
        tags: [
          ...item.tags,
          interest.toLowerCase().slice(0, 24),
          // Fictional cross-category design signals for deterministic demos.
          // These are sample attributes, never Qloo-reported affinities.
          ...(
            category === "music" ||
            category === "food" ||
            category === "places"
              ? ["participation", "ritual"]
              : []
          ),
          ...(
            category === "music" ||
            category === "film" ||
            category === "brands"
              ? ["storytelling", "community"]
              : []
          ),
          ...(
            category === "fashion" ||
            category === "brands" ||
            category === "places"
              ? ["craft", "material"]
              : []
          ),
        ].filter((tag, index, all) => all.indexOf(tag) === index),
      });
    }
  };

  push("music", MUSIC_POOL, 3, 0);
  push("film", FILM_POOL, 3, 10);
  push("brands", BRAND_POOL, 3, 20);
  push("places", PLACE_POOL, 2, 30);
  push("fashion", FASHION_POOL, 2, 40);
  push("food", FOOD_POOL, 2, 50);

  return entities.sort((a, b) => b.affinity - a.affinity);
}

function clusterEntities(entities: CulturalEntity[]): CulturalCluster[] {
  const order: EntityCategory[] = [
    "music",
    "film",
    "brands",
    "places",
    "fashion",
    "food",
    "other",
  ];
  const labels: Record<EntityCategory, string> = {
    music: "Music",
    film: "Film & TV",
    brands: "Brands",
    places: "Places",
    fashion: "Fashion",
    food: "Food & Drink",
    other: "Other",
  };

  return order
    .map((category) => ({
      category,
      label: labels[category],
      entities: entities.filter((e) => e.category === category),
    }))
    .filter((c) => c.entities.length > 0);
}

function conceptTitles(
  output: OutputCategory,
  interest: string,
  seed: number,
): string[] {
  const stem = interest.trim() || "cultural signal";
  const sets: Record<OutputCategory, string[]> = {
    product: [
      `${stem} Resonance Kit`,
      `Atlas ${stem} Object System`,
      `Signalcraft ${stem} Edition`,
    ],
    brand: [
      `House of ${stem}`,
      `${stem} Latitude Co.`,
      `Parallel ${stem} Studio`,
    ],
    experience: [
      `${stem} Night Laboratory`,
      `The ${stem} Crossing`,
      `${stem} Listening Circuit`,
    ],
  };
  const base = sets[output];
  return [0, 1, 2].map((i) => pick(base, seed, i));
}

function buildConcepts(
  request: ExplorationRequest,
  entities: CulturalEntity[],
  seed: number,
): { concepts: FusionConcept[]; evidence: EvidenceItem[] } {
  const titles = conceptTitles(
    request.outputCategory,
    request.culturalInterest,
    seed,
  );
  const evidence: EvidenceItem[] = [
    {
      id: `ev-mock-${seed}`,
      source: "mock_demo",
      label: "Demo cultural neighborhood",
      detail:
        "Entities and affinities were generated from a deterministic local sample set for UI walkthroughs. No Qloo API call was made.",
      createdAt: new Date().toISOString(),
    },
    {
      id: `ev-hyp-${seed}`,
      source: "agent_hypothesis",
      label: "Conceptual fusion heuristic",
      detail:
        "Concept cards combine adjacent sample entities into product/brand/experience narratives. These are creative hypotheses, not validated market forecasts.",
      createdAt: new Date().toISOString(),
    },
  ];

  const concepts: FusionConcept[] = titles.map((title, i) => {
    const influences = [
      entities[i % entities.length]!,
      entities[(i + 3) % entities.length]!,
      entities[(i + 6) % entities.length]!,
    ];
    const hypId = `ev-hyp-concept-${i}-${seed}`;
    evidence.push({
      id: hypId,
      source: "agent_hypothesis",
      label: `Hypothesis: ${title}`,
      detail: `Positions a ${request.outputCategory} around “${request.creativeObjective}” by blending sample influences. Not a predictive purchase or virality claim.`,
      relatedEntityIds: influences.map((e) => e.id),
      createdAt: new Date().toISOString(),
    });

    return {
      id: `concept-${i}-${seed % 991}`,
      title,
      positioning: `A ${request.outputCategory} concept for audiences drawn to ${request.culturalInterest}${
        request.location ? ` in ${request.location}` : ""
      }, framed through sensory storytelling rather than demographic stereotypes.`,
      outputCategory: request.outputCategory,
      culturalInfluences: influences,
      evidenceIds: [`ev-mock-${seed}`, hypId],
      summary: `Blends ${influences.map((e) => e.name).join(", ")} into a coherent ${request.outputCategory} narrative aligned with: ${request.creativeObjective}`,
    };
  });

  return { concepts, evidence };
}

export function generateDemoExploration(
  request: ExplorationRequest,
): ExplorationResult {
  const seed = hashSeed(
    [
      request.creativeObjective,
      request.culturalInterest,
      request.location ?? "",
      request.outputCategory,
    ].join("|"),
  );

  const entities = buildEntities(
    request.culturalInterest,
    request.location,
    seed,
  );
  const { concepts, evidence } = buildConcepts(request, entities, seed);

  return {
    mode: "demo",
    request,
    clusters: clusterEntities(entities),
    entities,
    concepts,
    evidence,
    generatedAt: new Date().toISOString(),
    disclaimer: DEMO_DISCLAIMER,
  };
}

export function generateDemoMutation(
  request: MutationRequest,
): MutationResult {
  const original = request.concepts.find((c) => c.id === request.conceptId);
  if (!original) {
    throw new Error("Concept not found for mutation.");
  }

  const outgoing = original.culturalInfluences.find(
    (e) => e.id === request.replaceEntityId,
  );
  const incoming =
    request.entities.find((e) => e.id === request.newEntityId) ??
    request.entities.find((e) => e.id !== request.replaceEntityId);

  if (!outgoing || !incoming) {
    throw new Error("Unable to resolve entities for mutation.");
  }

  if (outgoing.id === incoming.id) {
    throw new Error("Select a different cultural influence to mutate.");
  }

  const newInfluences = original.culturalInfluences.map((e) =>
    e.id === outgoing.id ? incoming : e,
  );

  const evidenceItem: EvidenceItem = {
    id: `ev-mut-${Date.now()}`,
    source: "mock_demo",
    label: "Demo mutation variant",
    detail: `Replaced “${outgoing.name}” with “${incoming.name}” to produce a conceptual variant. Still fictional demo data — not a Qloo insight.`,
    relatedEntityIds: newInfluences.map((e) => e.id),
    createdAt: new Date().toISOString(),
  };

  const hypItem: EvidenceItem = {
    id: `ev-mut-hyp-${Date.now()}`,
    source: "agent_hypothesis",
    label: "Variant positioning shift",
    detail: `Hypothesis: introducing ${incoming.name} (${incoming.category}) reframes the concept toward ${incoming.tags.slice(0, 2).join(" / ") || "adjacent taste cues"}.`,
    relatedEntityIds: [incoming.id],
    createdAt: new Date().toISOString(),
  };

  const mutatedConcept: FusionConcept = {
    ...original,
    id: `${original.id}-mut-${incoming.id.slice(-6)}`,
    title: `${original.title} · ${incoming.name.split(" ")[0]} Variant`,
    parentConceptId: original.id,
    mutationNote: `Swapped ${outgoing.name} → ${incoming.name}`,
    culturalInfluences: newInfluences,
    evidenceIds: [...original.evidenceIds, evidenceItem.id, hypItem.id],
    positioning: `${original.positioning} Mutation emphasizes ${incoming.name} as the new cultural hinge.`,
    summary: `Variant of “${original.title}” with ${incoming.name} replacing ${outgoing.name}.`,
  };

  return {
    mode: "demo",
    originalConcept: original,
    mutatedConcept,
    evidence: [...request.evidence, evidenceItem, hypItem],
    generatedAt: new Date().toISOString(),
    disclaimer: DEMO_DISCLAIMER,
  };
}

/** Alternate entities offered in Mutation Studio (demo) */
export function getMutationCandidates(
  entities: CulturalEntity[],
  currentInfluenceIds: string[],
): CulturalEntity[] {
  return entities.filter((e) => !currentInfluenceIds.includes(e.id)).slice(0, 8);
}
