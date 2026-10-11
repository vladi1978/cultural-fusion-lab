/**
 * Demo cultural evidence source.
 * Uses deterministic fictional sample data — NEVER claimed as Qloo insights.
 */

import { generateDemoExploration, getMutationCandidates } from "../../demo-data";
import type { EvidenceItem } from "../../types";
import type {
  CollectedBundle,
  CulturalEvidenceSource,
  CulturalSourceContext,
} from "../types";

export function createDemoSource(): CulturalEvidenceSource {
  return {
    id: "demo",
    async collect(context: CulturalSourceContext): Promise<CollectedBundle> {
      const demo = generateDemoExploration({
        ...context.request,
        mode: "demo",
      });

      const provenanceByEntityId: CollectedBundle["provenanceByEntityId"] = {};
      for (const entity of demo.entities) {
        provenanceByEntityId[entity.id] = "mock_demo";
      }

      // Attach entity IDs onto the primary mock evidence for affinity tracing.
      const evidence: EvidenceItem[] = demo.evidence.map((item) =>
        item.source === "mock_demo"
          ? {
              ...item,
              relatedEntityIds: demo.entities.map((e) => e.id),
              detail: `${item.detail} [Agent collection via demo source — labeled mock fixtures only.]`,
            }
          : item,
      );

      const planNote = context.plan.searches
        .slice(0, 4)
        .map((s) => `${s.category}:${s.query}`)
        .join("; ");

      return {
        entities: demo.entities,
        evidence,
        provenanceByEntityId,
        collectionNotes: [
          "DEMO SOURCE — fictional deterministic sample data; not Qloo Taste Graph output.",
          `Planned searches (not executed against Qloo): ${planNote || "none"}.`,
          ...context.plan.notes,
        ],
      };
    },

    async suggestReplacements({ request, outgoing }) {
      const candidates = getMutationCandidates(
        request.entities,
        request.concepts
          .find((c) => c.id === request.conceptId)
          ?.culturalInfluences.map((e) => e.id) ?? [outgoing.id],
      );

      const evidence: EvidenceItem[] = [
        {
          id: `ev-demo-mut-cand-${Date.now()}`,
          source: "mock_demo",
          label: "Demo mutation candidates",
          detail:
            "Replacement candidates drawn from the local demo entity pool. Not Qloo insights.",
          relatedEntityIds: candidates.map((c) => c.id),
          createdAt: new Date().toISOString(),
        },
      ];

      return { candidates, evidence };
    },
  };
}
