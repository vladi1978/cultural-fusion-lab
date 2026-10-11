/**
 * Conflict awareness for explicit contradictory metadata.
 * Different genres/interests are NOT assumed incompatible unless opposing
 * intensity/mood tags are present. Unresolved conflicts are labeled, not invented away.
 */

import type { CulturalEntity } from "../types";
import type { EvidenceConflict } from "./types";

/**
 * Explicit opposition pairs supported by tag metadata.
 * Presence of both poles across entities is a conflict signal.
 */
const OPPOSITION_PAIRS: readonly [string, string][] = [
  ["quiet", "loud"],
  ["soft", "aggressive"],
  ["intimate", "crowd"],
  ["calm", "aggressive"],
  ["acoustic", "distortion"],
];

export function detectEvidenceConflicts(
  entities: CulturalEntity[],
): EvidenceConflict[] {
  const conflicts: EvidenceConflict[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const left = entities[i]!;
      const right = entities[j]!;
      const leftTags = normalizeTags(left.tags);
      const rightTags = normalizeTags(right.tags);

      for (const [a, b] of OPPOSITION_PAIRS) {
        const forward =
          leftTags.has(a) && rightTags.has(b);
        const reverse =
          leftTags.has(b) && rightTags.has(a);
        if (!forward && !reverse) continue;

        const opposition: [string, string] = forward ? [a, b] : [b, a];
        const key = [left.id, right.id, opposition[0], opposition[1]]
          .sort()
          .join("::");
        if (seen.has(key)) continue;
        seen.add(key);

        conflicts.push({
          id: `conflict-${left.id.slice(0, 6)}-${right.id.slice(0, 6)}-${opposition[0]}`,
          leftEntityId: left.id,
          rightEntityId: right.id,
          leftTags: [...leftTags],
          rightTags: [...rightTags],
          opposition,
          status: "unresolved",
          note: `Unresolved metadata conflict: “${left.name}” carries “${opposition[0]}” while “${right.name}” carries “${opposition[1]}”. Different genres alone are not treated as incompatible; this flag requires explicit opposing tags. No explanatory story was invented.`,
        });
      }
    }
  }

  return conflicts.slice(0, 12);
}

export function conflictsForInfluences(
  influences: CulturalEntity[],
  allConflicts: EvidenceConflict[],
): EvidenceConflict[] {
  const ids = new Set(influences.map((e) => e.id));
  return allConflicts.filter(
    (c) => ids.has(c.leftEntityId) && ids.has(c.rightEntityId),
  );
}

function normalizeTags(tags: string[]): Set<string> {
  const out = new Set<string>();
  for (const tag of tags) {
    for (const part of tag.toLowerCase().split(/[\s/_-]+/)) {
      if (part.length > 1) out.add(part);
    }
  }
  return out;
}
