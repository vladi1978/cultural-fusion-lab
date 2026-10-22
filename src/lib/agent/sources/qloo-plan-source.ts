/**
 * Live Qloo source built on documented filters.
 *
 * Discovery (hard budget, default 5 requests, never retried):
 *   1. GET /v2/tags for up to two topic phrases (the declared interest, then the most specific objective word).
 *   2. GET /v2/insights per target entity type, signalled by compatible tag ids, with filter.location.query for places.
 *   3. At most one GET /search, only for a GENERIC topic word the framing step proposed.
 * Speculative named queries (a venue or brand the model "remembered") are never sent. If no compatible signal tag
 * exists for a target type, that Insights call is skipped and the trace says so; nothing is invented to fill the gap.
 *
 * Every entity is one Qloo returned, with its Qloo id, retrieval path, signal tags and place facts preserved.
 */
import "server-only";

import type { AdapterOptions } from "../../qloo/adapter";
import { assertLiveModeAllowed } from "../../qloo/live-gate";
import { getInsights, searchEntities, searchTags } from "../../qloo/endpoints";
import { QlooError } from "../../qloo/errors";
import { buildLiveExplorationResult, mapQlooEntityToCultural } from "../../qloo/mapper";
import type { QlooTag } from "../../qloo/schemas";
import type { CulturalEntity } from "../../types";
import type { CollectedBundle, CulturalEvidenceSource, CulturalSourceContext } from "../types";
import { AgentError } from "../types";
import { ValidationBudgetError } from "../../validation-session";
import { chooseFilterTags, chooseSignalTags, isSpeculativeNamedQuery, targetTypesFor, topicPhrasesOf } from "./qloo-discovery";

export interface QlooPlanSourceOptions extends AdapterOptions {
  /** Hard ceiling on Qloo HTTP requests for one collection. */
  maxRequests?: number;
}

const PLACE = "urn:entity:place" as const;
/** Documented tag-type filter (comma list verified live 2026-10-22): the two namespaces that carry place tags. */
const PLACE_TAG_TYPES = "urn:tag:genre:place,urn:tag:category:place";
const HARD_FATAL = new Set(["UNAUTHORIZED", "FORBIDDEN", "RATE_LIMITED", "TIMEOUT", "NOT_CONFIGURED"]);

export function createQlooPlanSource(options: QlooPlanSourceOptions = {}): CulturalEvidenceSource {
  const maxRequests = Math.max(1, Math.min(options.maxRequests ?? 5, 10));
  return {
    id: "qloo",
    async collect(context: CulturalSourceContext): Promise<CollectedBundle> {
      if (!options.bypassLiveGate) assertLiveModeAllowed();
      let used = 0;
      const callOpts = { fetchImpl: options.fetchImpl, config: options.config };
      const trace: string[] = [];
      const entityMap = new Map<string, CulturalEntity>();
      const searchIds = new Set<string>();
      const insightIds = new Set<string>();
      const request = context.request;

      try {
        const phrases = topicPhrasesOf(request);
        const targets = targetTypesFor(request);
        const placeTarget = targets.includes(PLACE);
        const otherTargets = targets.filter(t => t !== PLACE);
        const guard = (err: unknown) => { if (err instanceof ValidationBudgetError || (err instanceof QlooError && HARD_FATAL.has(err.code))) throw err; };

        // The one generic-topic search (step 3) keeps a reserved request so Insights cannot starve it.
        const seen = new Set<string>();
        const generic = context.plan.searches.filter(s => {
          if (isSpeculativeNamedQuery(s.query, request)) {
            trace.push(`search "${s.query}" ${s.entityType} not sent (speculative named query)`);
            return false;
          }
          const key = `${s.entityType}|${s.query.trim().toLowerCase()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return s.entityType !== "urn:entity:place" && s.entityType !== "urn:entity:locality";
        });
        const probe = generic[0];
        const insightsCeiling = maxRequests - (probe ? 1 : 0);

        const lookup = async (phrase: string, types?: string): Promise<QlooTag[]> => {
          used++;
          let found: QlooTag[] = [];
          try {
            found = await searchTags({ "filter.query": phrase, "filter.tag.types": types, take: 10 }, callOpts);
          } catch (err) { guard(err); }
          trace.push(`GET /v2/tags "${phrase}"${types ? ` types=[${types}]` : ""} -> ${found.length}: ${found.slice(0, 4).map(t => `${t.name} [${t.type ?? "?"}]`).join(", ") || "none"}`);
          return found;
        };

        // 1. Signal path for non-place targets (brands etc.): unrestricted topic tags -> taste signal.
        if (otherTargets.length) {
          const tags: QlooTag[] = [];
          for (const phrase of phrases.slice(0, Math.max(0, Math.min(phrases.length, maxRequests - targets.length)))) {
            for (const t of await lookup(phrase)) if (!tags.some(x => x.id === t.id)) tags.push(t);
          }
          for (const target of otherTargets) {
            const signal = chooseSignalTags(tags, target, phrases);
            if (!signal.length) { trace.push(`GET /v2/insights ${target} skipped (no compatible signal tag matched the topic)`); continue; }
            if (used >= insightsCeiling) { trace.push(`GET /v2/insights ${target} skipped (request budget used)`); continue; }
            used++;
            try {
              const insights = await getInsights({ "filter.type": target, "signal.interests.tags": signal.map(t => t.id).join(","), take: 8 }, callOpts);
              trace.push(`GET /v2/insights ${target} signal tags=[${signal.map(t => t.name).join(", ")}] -> ${insights.length}: ${insights.slice(0, 3).map(e => e.name).join(", ") || "none"}`);
              for (const e of insights) {
                insightIds.add(e.entity_id);
                if (!entityMap.has(e.entity_id)) entityMap.set(e.entity_id, mapQlooEntityToCultural(e, { retrievedVia: "insights", signalTagIds: signal.map(t => t.id), signalTagNames: signal.map(t => t.name), tagUse: "signal" }));
              }
            } catch (err) { guard(err); trace.push(`GET /v2/insights ${target} unavailable (non-auth error)`); }
          }
        }

        // 2. Places: place-type tag lookup per topic phrase (documented filter.tag.types, probes 2026-10-22), then the
        // documented HARD filter filter.tags, one tag per call. Round 0 tries each phrase's best tag; a second candidate
        // for a phrase is tried only if its first returned nothing and budget remains, so no phrase starves another.
        if (placeTarget) {
          const placeTags = new Map<string, QlooTag[]>();
          for (const phrase of phrases) {
            if (used >= insightsCeiling - 1) { trace.push(`GET /v2/tags "${phrase}" (places) skipped (request budget used)`); continue; }
            placeTags.set(phrase, await lookup(phrase, PLACE_TAG_TYPES));
          }
          const plan = chooseFilterTags([...placeTags.values()].flat(), PLACE, phrases.filter(p => placeTags.has(p)));
          for (const { phrase, candidates } of plan) if (!candidates.length) trace.push(`GET /v2/insights ${PLACE} "${phrase}" skipped (no place tag matched this topic)`);
          const satisfied = new Set<string>();
          for (let round = 0; round < 2; round++) {
            for (const { phrase, candidates } of plan) {
              const tag = candidates[round];
              if (!tag || satisfied.has(phrase)) continue;
              if (used >= insightsCeiling) { trace.push(`GET /v2/insights ${PLACE} filter.tags=[${tag.name}] skipped (request budget used)`); continue; }
              used++;
              try {
                const insights = await getInsights({ "filter.type": PLACE, "filter.tags": tag.id, "filter.location.query": request.location?.trim() || undefined, take: 8 }, callOpts);
                trace.push(`GET /v2/insights ${PLACE} filter.tags=[${tag.name}] location="${request.location ?? ""}" -> ${insights.length}: ${insights.slice(0, 3).map(e => e.name).join(", ") || "none"}`);
                if (insights.length) satisfied.add(phrase);
                for (const e of insights) {
                  insightIds.add(e.entity_id);
                  if (!entityMap.has(e.entity_id)) entityMap.set(e.entity_id, mapQlooEntityToCultural(e, { retrievedVia: "insights", signalTagIds: [tag.id], signalTagNames: [tag.name], tagUse: "filter" }));
                }
              } catch (err) { guard(err); trace.push(`GET /v2/insights ${PLACE} filter.tags=[${tag.name}] unavailable (non-auth error)`); }
            }
          }
        }

        // 3. One generic-topic search, never a remembered proper name.
        if (probe && used < maxRequests) {
          used++;
          try {
            const found = await searchEntities({ query: probe.query, type: probe.entityType, take: 5 }, callOpts);
            trace.push(`GET /search "${probe.query}" ${probe.entityType} -> ${found.length}: ${found.slice(0, 3).map(e => e.name).join(", ") || "none"}`);
            for (const e of found) {
              searchIds.add(e.entity_id);
              if (!entityMap.has(e.entity_id)) entityMap.set(e.entity_id, mapQlooEntityToCultural(e, { retrievedVia: "search" }));
            }
          } catch (err) {
            if (err instanceof ValidationBudgetError || (err instanceof QlooError && HARD_FATAL.has(err.code))) throw err;
            trace.push(`GET /search "${probe.query}" unavailable (non-auth error)`);
          }
        }
      } catch (err) {
        if (err instanceof ValidationBudgetError) throw err;
        throw new AgentError("SOURCE_FAILURE", err instanceof Error ? err.message : "Qloo collection failed.");
      }

      // Visible in the server terminal so spend of the (user-approved, capped) Qloo budget is auditable.
      console.log(`[CFL QLOO] requests used: ${used} of ${maxRequests}`);
      for (const t of trace) console.log(`[CFL QLOO] ${t}`);
      const entities = [...entityMap.values()];
      if (entities.length < 2) {
        throw new AgentError("SOURCE_FAILURE", `Qloo returned only ${entities.length} entities for the topic and location filters. No evidence was invented. ${trace.join(" | ")}`);
      }
      const result = buildLiveExplorationResult({
        request: { ...context.request, mode: "live" },
        entities,
        tags: [],
        searchEntityIds: [...searchIds],
        insightsEntityIds: [...insightIds],
        insightsSeedIds: [],
        endpointNotes: trace,
      });
      const provenanceByEntityId: CollectedBundle["provenanceByEntityId"] = {};
      for (const e of result.entities) provenanceByEntityId[e.id] = "verified_api";
      return {
        entities: result.entities,
        evidence: result.evidence.filter(ev => ev.source === "verified_api").map(ev => ({ ...ev, relatedEntityIds: ev.relatedEntityIds ?? result.entities.map(e => e.id) })),
        provenanceByEntityId,
        collectionNotes: [
          "LIVE SOURCE (documented tag, location and type filters) - entities marked verified_api were returned by Qloo.",
          ...trace.map(t => `Qloo call: ${t}`),
          `Qloo requests used: ${used} of ${maxRequests}.`,
        ],
      };
    },
  };
}
