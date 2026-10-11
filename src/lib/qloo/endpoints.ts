/**
 * Typed wrappers for documented Qloo endpoints.
 *
 * - GET /search — Hackathon Devpost notice (query, type)
 * - GET /v2/tags — docs.qloo.com Tags OpenAPI
 * - GET /v2/insights — docs.qloo.com Insights OpenAPI
 */

import "server-only";

import { qlooRequest, type FetchLike, type QlooClientConfig } from "./client";
import { QlooError } from "./errors";
import {
  parseEntitiesResponse,
  parseTagsResponse,
  toQueryRecord,
  validateInsightsParams,
  validateSearchParams,
  validateTagsParams,
  type QlooEntity,
  type QlooInsightsParams,
  type QlooSearchParams,
  type QlooTag,
  type QlooTagsParams,
} from "./schemas";

export interface EndpointCallOptions {
  fetchImpl?: FetchLike;
  config?: QlooClientConfig;
  signal?: AbortSignal;
}

/** GET /search — resolve entities by free-text query. */
export async function searchEntities(
  params: QlooSearchParams,
  options: EndpointCallOptions = {},
): Promise<QlooEntity[]> {
  const validationError = validateSearchParams(params);
  if (validationError) {
    throw new QlooError("VALIDATION", validationError);
  }

  const payload = await qlooRequest({
    path: "/search",
    query: toQueryRecord({
      query: params.query.trim(),
      type: params.type,
      take: params.take ?? 8,
    }),
    ...options,
  });

  return parseEntitiesResponse(payload);
}

/** GET /v2/tags — search Taste Graph tags. */
export async function searchTags(
  params: QlooTagsParams,
  options: EndpointCallOptions = {},
): Promise<QlooTag[]> {
  const validationError = validateTagsParams(params);
  if (validationError) {
    throw new QlooError("VALIDATION", validationError);
  }

  const payload = await qlooRequest({
    path: "/v2/tags",
    query: toQueryRecord({
      "filter.query": params["filter.query"],
      "filter.tag.types": params["filter.tag.types"],
      take: params.take ?? 10,
      page: params.page ?? 1,
      "feature.typo_tolerance": params["feature.typo_tolerance"],
    }),
    ...options,
  });

  return parseTagsResponse(payload);
}

/** GET /v2/insights — taste-based entity recommendations. */
export async function getInsights(
  params: QlooInsightsParams,
  options: EndpointCallOptions = {},
): Promise<QlooEntity[]> {
  const validationError = validateInsightsParams(params);
  if (validationError) {
    throw new QlooError("VALIDATION", validationError);
  }

  const payload = await qlooRequest({
    path: "/v2/insights",
    query: toQueryRecord({
      "filter.type": params["filter.type"],
      "signal.interests.entities": params["signal.interests.entities"],
      "signal.interests.tags": params["signal.interests.tags"],
      "filter.location.query": params["filter.location.query"],
      "filter.tags": params["filter.tags"],
      take: params.take ?? 8,
      page: params.page,
    }),
    ...options,
  });

  return parseEntitiesResponse(payload);
}

/**
 * Lightweight auth probe using documented Insights parameters.
 * Success means the key is accepted for at least one Insights call.
 * Does not prove full hackathon entitlement for every endpoint.
 */
export async function probeAuthentication(
  options: EndpointCallOptions = {},
): Promise<{ ok: true } | { ok: false; error: QlooError }> {
  try {
    await getInsights(
      {
        "filter.type": "urn:entity:brand",
        take: 1,
      },
      options,
    );
    return { ok: true };
  } catch (err) {
    if (err instanceof QlooError) {
      return { ok: false, error: err };
    }
    return {
      ok: false,
      error: new QlooError("NETWORK", "Authentication probe failed.", {
        cause: err,
      }),
    };
  }
}
