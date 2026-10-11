import type { EntityCategory } from "../types";
import type { QlooEntityType } from "../qloo/schemas";
import type { InterpretedObjective, PlannedSearch, SearchPlan } from "./types";

const CATEGORY_TYPES: {
  entityType: QlooEntityType;
  category: EntityCategory;
  weight: number;
}[] = [
  { entityType: "urn:entity:artist", category: "music", weight: 3 },
  { entityType: "urn:entity:movie", category: "film", weight: 3 },
  { entityType: "urn:entity:brand", category: "brands", weight: 3 },
  { entityType: "urn:entity:place", category: "places", weight: 2 },
  { entityType: "urn:entity:person", category: "other", weight: 1 },
];

/**
 * Plan documented Qloo search calls from interpreted intent.
 * Does not call the API — only produces a deterministic search plan.
 */
export function planSearches(interpreted: InterpretedObjective): SearchPlan {
  const queries = buildQueries(interpreted);
  const searches: PlannedSearch[] = [];

  for (const [qi, query] of queries.entries()) {
    for (const [ti, typeDef] of CATEGORY_TYPES.entries()) {
      // Keep plan focused: primary query × core types, secondary query × subset.
      if (qi > 0 && typeDef.weight < 3) continue;
      searches.push({
        id: `plan-${qi}-${ti}`,
        query,
        entityType: typeDef.entityType,
        category: typeDef.category,
        rationale: `Probe ${typeDef.category} neighborhood for “${query}” to ground ${interpreted.outputCategory} ideation.`,
      });
    }
  }

  const notes = [
    "Search plan uses documented entity type URNs only.",
    "No affinity scores are assumed at planning time.",
    interpreted.location
      ? `Location hint “${interpreted.location}” will be passed to insights filters when live collection runs.`
      : "No location filter planned.",
  ];

  return {
    searches,
    tagQuery: interpreted.culturalInterest,
    notes,
  };
}

function buildQueries(interpreted: InterpretedObjective): string[] {
  const primary = interpreted.culturalInterest;
  const themeHint = interpreted.themes[0];
  const secondaryParts = [
    primary,
    themeHint && themeHint !== "cultural-fusion" ? themeHint : null,
    interpreted.intentTokens[0] ?? null,
  ].filter(Boolean) as string[];

  const secondary = secondaryParts.join(" ");
  if (secondary.toLowerCase() === primary.toLowerCase()) {
    return [primary];
  }
  return [primary, secondary];
}
