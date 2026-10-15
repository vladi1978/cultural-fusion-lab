/**
 * Documented Qloo request/response shapes used by Cultural Fusion Lab.
 *
 * Sources verified against:
 * - docs.qloo.com — API Onboarding (X-Api-Key), Insights OpenAPI (GET /v2/insights),
 *   Tags OpenAPI (GET /v2/tags)
 * - Qloo Hackathon Devpost notice — GET /search?query=&type= with X-Api-Key
 *   on https://hackathon.api.qloo.com
 *
 * Parsers are intentionally tolerant of optional fields so unit tests and future
 * live responses can evolve without inventing undocumented required parameters.
 */

/** Entity type URNs documented for Insights `filter.type` / hackathon search `type`. */
export const QLOO_ENTITY_TYPES = [
  "urn:entity:artist",
  "urn:entity:book",
  "urn:entity:brand",
  "urn:entity:movie",
  "urn:entity:person",
  "urn:entity:place",
  "urn:entity:podcast",
  "urn:entity:tv_show",
  "urn:entity:videogame",
  "urn:entity:locality",
] as const;

export type QlooEntityType = (typeof QLOO_ENTITY_TYPES)[number];

export function isQlooEntityType(value: string): value is QlooEntityType {
  return (QLOO_ENTITY_TYPES as readonly string[]).includes(value);
}

export interface QlooTagRef {
  id: string;
  name?: string;
  type?: string;
}

export interface QlooEntityProperties {
  description?: string;
  short_description?: string;
  image?: { url?: string };
  [key: string]: unknown;
}

export interface QlooEntity {
  entity_id: string;
  name: string;
  type?: string;
  subtype?: string;
  types?: string[];
  properties?: QlooEntityProperties;
  popularity?: number;
  /** Present on some Insights results; optional affinity toward the query signal. */
  affinity?: number;
  query?: { affinity?: number };
  tags?: QlooTagRef[];
}

export interface QlooTag {
  id: string;
  name: string;
  type?: string;
  popularity?: number;
}

/** GET /search — hackathon notice query params */
export interface QlooSearchParams {
  query: string;
  type?: QlooEntityType;
  take?: number;
}

/** GET /v2/tags — docs.qloo.com OpenAPI */
export interface QlooTagsParams {
  "filter.query"?: string;
  "filter.tag.types"?: string;
  take?: number;
  page?: number;
  "feature.typo_tolerance"?: boolean;
}

/** GET /v2/insights — docs.qloo.com OpenAPI (subset we use) */
export interface QlooInsightsParams {
  "filter.type": QlooEntityType;
  "signal.interests.entities"?: string;
  "signal.interests.tags"?: string;
  "filter.location.query"?: string;
  "filter.tags"?: string;
  take?: number;
  page?: number;
}

export interface QlooEntitiesResponse {
  success?: boolean;
  duration?: number;
  results?: {
    entities?: QlooEntity[];
    duration?: number;
  };
}

export interface QlooTagsResponse {
  success?: boolean;
  duration?: number;
  results?: {
    tags?: QlooTag[];
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseTagRef(value: unknown): QlooTagRef | null {
  const rec = asRecord(value);
  if (!rec) return null;
  const id = asString(rec.id) ?? asString(rec.tag_id) ?? asString(rec.urn);
  if (!id) return null;
  return {
    id,
    name: asString(rec.name),
    type: asString(rec.type),
  };
}

export function parseQlooEntity(value: unknown): QlooEntity | null {
  const rec = asRecord(value);
  if (!rec) return null;

  const entityId =
    asString(rec.entity_id) ?? asString(rec.id) ?? asString(rec.entityId);
  const name = asString(rec.name);
  if (!entityId || !name) return null;

  const properties = asRecord(rec.properties) as QlooEntityProperties | null;
  const queryRec = asRecord(rec.query);
  const tagsRaw = Array.isArray(rec.tags) ? rec.tags : [];
  const tags = tagsRaw
    .map(parseTagRef)
    .filter((t): t is QlooTagRef => t !== null);

  return {
    entity_id: entityId,
    name,
    type: asString(rec.type),
    subtype: asString(rec.subtype),
    types: Array.isArray(rec.types)
      ? rec.types
          .map(asString)
          .filter((value): value is string => value !== undefined)
      : undefined,
    properties: properties ?? undefined,
    popularity: asNumber(rec.popularity),
    affinity: asNumber(rec.affinity),
    query: queryRec
      ? { affinity: asNumber(queryRec.affinity) }
      : undefined,
    tags: tags.length ? tags : undefined,
  };
}

export function parseQlooTag(value: unknown): QlooTag | null {
  const rec = asRecord(value);
  if (!rec) return null;
  const id = asString(rec.id) ?? asString(rec.tag_id);
  const name = asString(rec.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    type: asString(rec.type),
    popularity: asNumber(rec.popularity),
  };
}

/**
 * Normalize search/insights payloads into entities.
 * Accepts documented `{ results: { entities } }` and labeled mock variants.
 */
export function parseEntitiesResponse(payload: unknown): QlooEntity[] {
  if (Array.isArray(payload)) {
    return payload
      .map(parseQlooEntity)
      .filter((e): e is QlooEntity => e !== null);
  }

  const root = asRecord(payload);
  if (!root) return [];

  const results = asRecord(root.results);
  const entitiesCandidate =
    (Array.isArray(root.results) && root.results) ||
    (results && Array.isArray(results.entities) && results.entities) ||
    (Array.isArray(root.entities) && root.entities) ||
    (Array.isArray(root.data) && root.data) ||
    [];

  return entitiesCandidate
    .map(parseQlooEntity)
    .filter((e): e is QlooEntity => e !== null);
}

export function parseTagsResponse(payload: unknown): QlooTag[] {
  if (Array.isArray(payload)) {
    return payload.map(parseQlooTag).filter((t): t is QlooTag => t !== null);
  }

  const root = asRecord(payload);
  if (!root) return [];
  const results = asRecord(root.results);
  const tagsCandidate =
    (results && Array.isArray(results.tags) && results.tags) ||
    (Array.isArray(root.tags) && root.tags) ||
    [];

  return tagsCandidate
    .map(parseQlooTag)
    .filter((t): t is QlooTag => t !== null);
}

export function validateSearchParams(params: QlooSearchParams): string | null {
  if (!params.query?.trim()) return "search.query is required.";
  if (params.type && !isQlooEntityType(params.type)) {
    return `search.type must be a documented urn:entity:* value.`;
  }
  if (params.take !== undefined && (params.take < 1 || params.take > 50)) {
    return "search.take must be between 1 and 50.";
  }
  return null;
}

export function validateTagsParams(params: QlooTagsParams): string | null {
  const hasQuery = Boolean(params["filter.query"]?.trim());
  const hasTypes = Boolean(params["filter.tag.types"]?.trim());
  if (!hasQuery && !hasTypes) {
    return "tags requires filter.query or filter.tag.types.";
  }
  if (params.take !== undefined && (params.take < 1 || params.take > 50)) {
    return "tags.take must be between 1 and 50.";
  }
  if (params.page !== undefined && (params.page < 1 || params.page > 100)) {
    return "tags.page must be between 1 and 100.";
  }
  return null;
}

export function validateInsightsParams(params: QlooInsightsParams): string | null {
  if (!params["filter.type"] || !isQlooEntityType(params["filter.type"])) {
    return "insights.filter.type is required and must be a documented entity URN.";
  }
  if (params.take !== undefined && (params.take < 1 || params.take > 50)) {
    return "insights.take must be between 1 and 50.";
  }
  return null;
}

export function toQueryRecord(
  params: Record<string, string | number | boolean | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    out[key] = String(value);
  }
  return out;
}
