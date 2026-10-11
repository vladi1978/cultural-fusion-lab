/**
 * High-level Qloo Taste Graph adapter for exploration + mutation.
 *
 * Live Mode is fail-closed via live-gate until a real API key authenticates
 * and QLOO_LIVE_ENABLED=true. This module has not been verified against a
 * live hackathon key in this environment.
 */

import "server-only";

import type {
  CulturalEntity,
  EvidenceItem,
  ExplorationRequest,
  ExplorationResult,
  FusionConcept,
  MutationRequest,
  MutationResult,
} from "../types";
import type { FetchLike, QlooClientConfig } from "./client";
import { isQlooConfigured } from "./client";
import { getInsights, searchEntities, searchTags } from "./endpoints";
import { QlooError } from "./errors";
import { assertLiveModeAllowed } from "./live-gate";
import {
  buildLiveExplorationResult,
  DISCOVERY_ENTITY_TYPES,
  mapQlooEntityToCultural,
} from "./mapper";
import type { QlooEntity, QlooEntityType, QlooTag } from "./schemas";

export { QlooError } from "./errors";
export { isQlooConfigured };

/** Back-compat aliases used by API routes. */
export class QlooNotConfiguredError extends QlooError {
  constructor(message = "Qloo API is not configured.") {
    super("NOT_CONFIGURED", message);
    this.name = "QlooNotConfiguredError";
  }
}

export class QlooNotImplementedError extends QlooError {
  constructor(feature: string) {
    super(
      "LIVE_DISABLED",
      `${feature} is locked until Live Mode authentication succeeds.`,
    );
    this.name = "QlooNotImplementedError";
  }
}

export interface AdapterOptions {
  fetchImpl?: FetchLike;
  config?: QlooClientConfig;
  /** Skip live-gate (unit tests only). */
  bypassLiveGate?: boolean;
}

async function safeSearch(
  query: string,
  type: QlooEntityType,
  options: AdapterOptions,
): Promise<QlooEntity[]> {
  try {
    return await searchEntities(
      { query, type, take: 6 },
      { fetchImpl: options.fetchImpl, config: options.config },
    );
  } catch (err) {
    if (err instanceof QlooError && err.code === "VALIDATION") throw err;
    // Soft-skip missing entity-type coverage; hard-fail auth/rate-limit.
    if (
      err instanceof QlooError &&
      (err.code === "UNAUTHORIZED" ||
        err.code === "FORBIDDEN" ||
        err.code === "RATE_LIMITED" ||
        err.code === "TIMEOUT" ||
        err.code === "NOT_CONFIGURED")
    ) {
      throw err;
    }
    return [];
  }
}

async function safeTags(
  query: string,
  options: AdapterOptions,
): Promise<QlooTag[]> {
  try {
    return await searchTags(
      {
        "filter.query": query,
        take: 8,
        "feature.typo_tolerance": true,
      },
      { fetchImpl: options.fetchImpl, config: options.config },
    );
  } catch (err) {
    if (
      err instanceof QlooError &&
      (err.code === "UNAUTHORIZED" ||
        err.code === "FORBIDDEN" ||
        err.code === "RATE_LIMITED" ||
        err.code === "TIMEOUT" ||
        err.code === "NOT_CONFIGURED")
    ) {
      throw err;
    }
    // Tags may be limited on some hackathon entitlements — continue without.
    return [];
  }
}

export async function exploreWithQloo(
  request: ExplorationRequest,
  options: AdapterOptions = {},
): Promise<ExplorationResult> {
  if (!options.bypassLiveGate) {
    assertLiveModeAllowed();
  } else if (!isQlooConfigured() && !options.config) {
    throw new QlooError("NOT_CONFIGURED", "Qloo is not configured.");
  }

  const interest = request.culturalInterest.trim();
  const endpointNotes: string[] = [];
  const entityMap = new Map<string, CulturalEntity>();

  for (const type of DISCOVERY_ENTITY_TYPES) {
    const found = await safeSearch(interest, type, options);
    if (found.length) {
      endpointNotes.push(`GET /search type=${type} (${found.length})`);
    }
    for (const entity of found) {
      entityMap.set(entity.entity_id, mapQlooEntityToCultural(entity));
    }
  }

  const tags = await safeTags(interest, options);
  if (tags.length) {
    endpointNotes.push(`GET /v2/tags (${tags.length})`);
  }

  const seedIds = [...entityMap.keys()].slice(0, 5);
  if (seedIds.length > 0) {
    for (const type of DISCOVERY_ENTITY_TYPES) {
      try {
        const insights = await getInsights(
          {
            "filter.type": type,
            "signal.interests.entities": seedIds.join(","),
            "signal.interests.tags": tags
              .slice(0, 3)
              .map((t) => t.id)
              .join(","),
            "filter.location.query": request.location?.trim() || undefined,
            take: 6,
          },
          { fetchImpl: options.fetchImpl, config: options.config },
        );
        if (insights.length) {
          endpointNotes.push(`GET /v2/insights type=${type} (${insights.length})`);
        }
        for (const entity of insights) {
          if (!entityMap.has(entity.entity_id)) {
            entityMap.set(entity.entity_id, mapQlooEntityToCultural(entity));
          }
        }
      } catch (err) {
        if (
          err instanceof QlooError &&
          (err.code === "UNAUTHORIZED" ||
            err.code === "FORBIDDEN" ||
            err.code === "RATE_LIMITED" ||
            err.code === "TIMEOUT")
        ) {
          throw err;
        }
      }
    }
  }

  const entities = [...entityMap.values()].sort(
    (a, b) => b.affinity - a.affinity,
  );

  if (entities.length < 3) {
    throw new QlooError(
      "UPSTREAM",
      "Qloo returned too few entities to build a cultural neighborhood. Try a broader interest or verify API entitlements.",
      {
        safeDetails: `Collected ${entities.length} entities. Endpoints touched: ${
          endpointNotes.join("; ") || "none"
        }.`,
      },
    );
  }

  return buildLiveExplorationResult({
    request: { ...request, mode: "live" },
    entities,
    tags,
    endpointNotes:
      endpointNotes.length > 0 ? endpointNotes : ["no endpoint notes"],
  });
}

export async function mutateWithQloo(
  request: MutationRequest,
  options: AdapterOptions = {},
): Promise<MutationResult> {
  if (!options.bypassLiveGate) {
    assertLiveModeAllowed();
  } else if (!isQlooConfigured() && !options.config) {
    throw new QlooError("NOT_CONFIGURED", "Qloo is not configured.");
  }

  const original = request.concepts.find((c) => c.id === request.conceptId);
  if (!original) {
    throw new QlooError("VALIDATION", "Concept not found for mutation.");
  }

  const outgoing = original.culturalInfluences.find(
    (e) => e.id === request.replaceEntityId,
  );
  if (!outgoing) {
    throw new QlooError(
      "VALIDATION",
      "Selected influence to replace was not found on the concept.",
    );
  }

  const seedIds = original.culturalInfluences
    .filter((e) => e.id !== outgoing.id)
    .map((e) => e.id);

  const filterType = categoryToEntityType(outgoing.category);
  let candidates: CulturalEntity[] = [];

  try {
    const insights = await getInsights(
      {
        "filter.type": filterType,
        "signal.interests.entities": seedIds.join(","),
        take: 10,
      },
      { fetchImpl: options.fetchImpl, config: options.config },
    );
    candidates = insights
      .map(mapQlooEntityToCultural)
      .filter(
        (e) =>
          e.id !== outgoing.id &&
          !original.culturalInfluences.some((inf) => inf.id === e.id),
      );
  } catch (err) {
    if (err instanceof QlooError) throw err;
    throw new QlooError("UPSTREAM", "Mutation insights lookup failed.", {
      cause: err,
    });
  }

  const incoming =
    candidates.find((e) => e.id === request.newEntityId) ?? candidates[0];

  if (!incoming) {
    throw new QlooError(
      "UPSTREAM",
      "Qloo did not return a suitable replacement influence for this mutation.",
    );
  }

  const newInfluences = original.culturalInfluences.map((e) =>
    e.id === outgoing.id ? incoming : e,
  );

  const apiEvidence: EvidenceItem = {
    id: `ev-mut-api-${Date.now()}`,
    source: "verified_api",
    label: "Qloo mutation candidate",
    detail: `Replacement “${incoming.name}” sourced from GET /v2/insights (filter.type=${filterType}).`,
    relatedEntityIds: [incoming.id],
    createdAt: new Date().toISOString(),
  };

  const hypEvidence: EvidenceItem = {
    id: `ev-mut-hyp-${Date.now()}`,
    source: "agent_hypothesis",
    label: "Variant positioning shift",
    detail: `Hypothesis: introducing ${incoming.name} reframes the concept. Not a predictive claim.`,
    relatedEntityIds: [incoming.id],
    createdAt: new Date().toISOString(),
  };

  const mutatedConcept: FusionConcept = {
    ...original,
    id: `${original.id}-mut-${incoming.id.slice(0, 8)}`,
    title: `${original.title} · ${incoming.name.split(" ")[0]} Variant`,
    parentConceptId: original.id,
    mutationNote: `Swapped ${outgoing.name} → ${incoming.name}`,
    culturalInfluences: newInfluences,
    evidenceIds: [...original.evidenceIds, apiEvidence.id, hypEvidence.id],
    positioning: `${original.positioning} Mutation emphasizes ${incoming.name} as the new cultural hinge.`,
    summary: `Variant of “${original.title}” with ${incoming.name} replacing ${outgoing.name}.`,
  };

  return {
    mode: "live",
    originalConcept: original,
    mutatedConcept,
    evidence: [...request.evidence, apiEvidence, hypEvidence],
    generatedAt: new Date().toISOString(),
    disclaimer:
      "LIVE MODE — Replacement entity marked verified API data comes from Qloo. Narrative text is agent hypothesis.",
  };
}

function categoryToEntityType(
  category: CulturalEntity["category"],
): QlooEntityType {
  switch (category) {
    case "music":
      return "urn:entity:artist";
    case "film":
      return "urn:entity:movie";
    case "brands":
      return "urn:entity:brand";
    case "places":
      return "urn:entity:place";
    default:
      return "urn:entity:brand";
  }
}
