import type { EvidenceItem } from "../../types";

/**
 * Returns only evidence explicitly associated with an entity
 * and referenced by the opportunity.
 *
 * This establishes attribution, not cultural affinity,
 * market demand, or external verification.
 */
export function attributableEvidenceIds(
  entityId: string,
  opportunityEvidenceIds: string[],
  evidence: EvidenceItem[],
): string[] {
  const allowed = new Set(opportunityEvidenceIds);

  return [...new Set(
    evidence
      .filter(
        item =>
          allowed.has(item.id) &&
          item.relatedEntityIds?.includes(entityId),
      )
      .map(item => item.id),
  )];
}
