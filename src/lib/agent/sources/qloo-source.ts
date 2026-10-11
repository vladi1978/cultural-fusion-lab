/**
 * Live Qloo cultural evidence source (server-only).
 * Only used when Live Mode is explicitly unlocked and authenticated.
 */

import "server-only";

import type { AdapterOptions } from "../../qloo/adapter";
import { exploreWithQloo, mutateWithQloo } from "../../qloo/adapter";
import type { EvidenceItem, MutationRequest } from "../../types";
import type {
  CollectedBundle,
  CulturalEvidenceSource,
  CulturalSourceContext,
} from "../types";
import { AgentError } from "../types";

export function createQlooSource(
  adapterOptions: AdapterOptions = {},
): CulturalEvidenceSource {
  return {
    id: "qloo",
    async collect(context: CulturalSourceContext): Promise<CollectedBundle> {
      try {
        const result = await exploreWithQloo(
          { ...context.request, mode: "live" },
          adapterOptions,
        );

        const provenanceByEntityId: CollectedBundle["provenanceByEntityId"] =
          {};
        for (const entity of result.entities) {
          provenanceByEntityId[entity.id] = "verified_api";
        }

        const evidence: EvidenceItem[] = result.evidence.map((item) =>
          item.source === "verified_api"
            ? {
                ...item,
                relatedEntityIds:
                  item.relatedEntityIds ?? result.entities.map((e) => e.id),
              }
            : item,
        );

        return {
          entities: result.entities,
          evidence: evidence.filter((e) => e.source === "verified_api"),
          provenanceByEntityId,
          collectionNotes: [
            "LIVE SOURCE — entities/tags marked verified_api come from Qloo responses.",
            "Agent will still label concept positioning as hypothesis.",
            `Plan size: ${context.plan.searches.length} searches.`,
          ],
        };
      } catch (err) {
        throw new AgentError(
          "SOURCE_FAILURE",
          err instanceof Error
            ? err.message
            : "Qloo collection failed during agent orchestration.",
        );
      }
    },

    async suggestReplacements({ request, outgoing, seeds }) {
      try {
        // Reuse mutate adapter path with a temporary concept to obtain candidates
        // via insights; if it fails, fall back to local unused entities only.
        const mutationRequest: MutationRequest = {
          ...request,
          mode: "live",
          replaceEntityId: outgoing.id,
          newEntityId: outgoing.id,
        };

        // Prefer unused entities already in the neighborhood (no invented scores).
        const local = request.entities.filter(
          (e) =>
            e.id !== outgoing.id &&
            !seeds.some((s) => s.id === e.id) &&
            e.category === outgoing.category,
        );

        if (local.length > 0) {
          return {
            candidates: local.slice(0, 8),
            evidence: [
              {
                id: `ev-live-mut-local-${Date.now()}`,
                source: "verified_api",
                label: "Live mutation candidates (collected neighborhood)",
                detail:
                  "Candidates reused from previously collected verified entities. No new affinity scores invented.",
                relatedEntityIds: local.map((e) => e.id),
                createdAt: new Date().toISOString(),
              },
            ],
          };
        }

        // Attempt insights-backed mutation when local pool is empty.
        const probe = await mutateWithQloo(
          {
            ...mutationRequest,
            newEntityId: request.entities[0]?.id ?? outgoing.id,
          },
          adapterOptions,
        );

        const incoming = probe.mutatedConcept.culturalInfluences.find(
          (e) => e.id !== outgoing.id,
        );

        return {
          candidates: incoming ? [incoming] : [],
          evidence: probe.evidence.filter((e) => e.source === "verified_api"),
        };
      } catch (err) {
        throw new AgentError(
          "SOURCE_FAILURE",
          err instanceof Error
            ? err.message
            : "Qloo mutation candidate lookup failed.",
        );
      }
    },
  };
}
