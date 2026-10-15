import type { CulturalEntity, EvidenceItem } from "../types";
import type { CrossCategoryAffinity } from "./types";

/**
 * Identify potential cross-category links WITHOUT inventing Qloo affinity scores.
 *
 * Allowed bases:
 * - shared_tag: same normalized tag string on two entities (from collected data)
 * - co_collected: appeared together in the same collection pass (weak; hypothesis)
 * - api_reported_score: only when an entity already carries an API-provided score
 *   and we pair it with a different-category entity that shares a tag
 *
 * Every affinity requires evidenceIds.
 */
export function identifyAffinities(options: {
  entities: CulturalEntity[];
  evidence: EvidenceItem[];
  provenanceByEntityId: Record<string, EvidenceItem["source"]>;
  culturalInterest?: string;
}): CrossCategoryAffinity[] {
  const { entities, evidence, provenanceByEntityId } = options;
  const byCategory = new Map<string, CulturalEntity[]>();
  for (const entity of entities) {
    const list = byCategory.get(entity.category) ?? [];
    list.push(entity);
    byCategory.set(entity.category, list);
  }

  const categories = [...byCategory.keys()];
  const affinities: CrossCategoryAffinity[] = [];
  const seen = new Set<string>();

  const evidenceForEntity = (entityId: string): string[] =>
    evidence
      .filter((e) => e.relatedEntityIds?.includes(entityId))
      .map((e) => e.id);

  for (let i = 0; i < categories.length; i++) {
    for (let j = i + 1; j < categories.length; j++) {
      const leftCat = categories[i]!;
      const rightCat = categories[j]!;
      const leftEntities = byCategory.get(leftCat) ?? [];
      const rightEntities = byCategory.get(rightCat) ?? [];

      for (const left of leftEntities) {
        for (const right of rightEntities) {
          const sharedTags = intersectTags(left.tags, right.tags);
          const pairKey = [left.id, right.id].sort().join("::");
          if (seen.has(pairKey)) continue;

          const leftEvidence = evidenceForEntity(left.id);
          const rightEvidence = evidenceForEntity(right.id);
          const evidenceIds = unique([
            ...leftEvidence,
            ...rightEvidence,
          ]);

          if (evidenceIds.length === 0) {
            // Require traceable evidence — skip ungrounded pairs.
            continue;
          }

          if (sharedTags.length > 0) {
            seen.add(pairKey);
            const leftSource = provenanceByEntityId[left.id];
            const rightSource = provenanceByEntityId[right.id];
            const bothVerified =
              leftSource === "verified_api" && rightSource === "verified_api";

            // Prefer API-reported scores only when present on the entity payload
            // (mapped into CulturalEntity.affinity from upstream). Still not an
            // invented edge — we only echo the reported score as context.
            const apiReportedScore =
              bothVerified &&
              typeof left.apiReportedAffinity === "number" &&
              Number.isFinite(left.apiReportedAffinity) &&
              left.apiReportedAffinity >= 0 &&
              left.apiReportedAffinity <= 1
                ? left.apiReportedAffinity
                : undefined;

            affinities.push({
              id: `aff-${pairKey.slice(0, 24)}`,
              leftEntityId: left.id,
              rightEntityId: right.id,
              leftCategory: left.category,
              rightCategory: right.category,
              basis: apiReportedScore !== undefined
                ? "api_reported_score"
                : "shared_tag",
              sharedTags,
              apiReportedScore,
              evidenceIds,
              note:
                apiReportedScore !== undefined
                  ? `Shared tags (${sharedTags.join(", ")}). Score ${apiReportedScore} was reported on a collected entity payload — not an invented Taste Graph edge.`
                  : `Shared tags (${sharedTags.join(", ")}) across ${left.category} and ${right.category}. This is an evidence-linked overlap, not a fabricated Qloo relationship.`,
            });
            continue;
          }

          // Co-collection without shared tags is a weak creative hint only.
          if (
            leftEvidence.length > 0 &&
            rightEvidence.length > 0 &&
            affinities.filter((a) => a.basis === "co_collected").length < 4
          ) {
            seen.add(pairKey);
            affinities.push({
              id: `aff-co-${pairKey.slice(0, 20)}`,
              leftEntityId: left.id,
              rightEntityId: right.id,
              leftCategory: left.category,
              rightCategory: right.category,
              basis: "co_collected",
              sharedTags: [],
              evidenceIds,
              note:
                "Co-collected in the same agent pass. Labeled as a creative adjacency hypothesis — not a verified Qloo affinity edge.",
            });
          }
        }
      }
    }
  }

  // Rank observed cross-category overlaps before applying the display cap.
  // Generic interest-only links and co-collection must not crowd out
  // richer shared-attribute relationships.
  const genericInterestTags = new Set(
    (options.culturalInterest ?? "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );
  const normalizedInterest = normalizeTag(options.culturalInterest ?? "");
  if (normalizedInterest) genericInterestTags.add(normalizedInterest);

  const ranked = [...affinities].sort((a, b) => {
    const meaningfulCount = (aff: CrossCategoryAffinity) =>
      aff.sharedTags.filter(
        (tag) => !genericInterestTags.has(normalizeTag(tag)),
      ).length;

    const score = (aff: CrossCategoryAffinity) =>
      meaningfulCount(aff) * 100 +
      (aff.basis === "api_reported_score" ? 20 : 0) +
      (aff.basis === "shared_tag" ? 10 : 0);

    return score(b) - score(a) || a.id.localeCompare(b.id);
  });

  // Preserve cross-category coverage among meaningful observed overlaps.
  // Do not promote shared-interest-only or co-collected links into strong evidence.
  const meaningfulCount = (aff: CrossCategoryAffinity) =>
    aff.sharedTags.filter(
      (tag) => !genericInterestTags.has(normalizeTag(tag)),
    ).length;

  const selected: CrossCategoryAffinity[] = [];
  const selectedIds = new Set<string>();
  const coveredCategoryPairs = new Set<string>();

  for (const aff of ranked) {
    if (selected.length >= 12) break;
    if (meaningfulCount(aff) === 0) continue;

    const categoryPair = [aff.leftCategory, aff.rightCategory]
      .sort()
      .join("::");

    if (coveredCategoryPairs.has(categoryPair)) continue;

    selected.push(aff);
    selectedIds.add(aff.id);
    coveredCategoryPairs.add(categoryPair);
  }

  for (const aff of ranked) {
    if (selected.length >= 12) break;
    if (selectedIds.has(aff.id)) continue;

    selected.push(aff);
    selectedIds.add(aff.id);
  }

  return selected;
}

function intersectTags(a: string[], b: string[]): string[] {
  const setB = new Set(b.map(normalizeTag));
  return [...new Set(a.map(normalizeTag).filter((t) => t && setB.has(t)))];
}

function normalizeTag(tag: string): string {
  return tag
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}
