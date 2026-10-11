import { describe, expect, it } from "vitest";

import { detectEvidenceConflicts } from "./conflicts";

describe("conflict awareness", () => {
  it("detects explicit opposing tags without assuming genre incompatibility", () => {
    const conflicts = detectEvidenceConflicts([
      {
        id: "j",
        name: "Soft Quartet",
        category: "music",
        description: "x",
        affinity: 0.7,
        tags: ["jazz", "quiet"],
      },
      {
        id: "m",
        name: "Chrome Distortion",
        category: "music",
        description: "x",
        affinity: 0.7,
        tags: ["metal", "loud"],
      },
      {
        id: "b",
        name: "Neutral Brand",
        category: "brands",
        description: "x",
        affinity: 0.6,
        tags: ["craft"],
      },
    ]);

    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0]?.opposition).toEqual(["quiet", "loud"]);
    expect(conflicts[0]?.status).toBe("unresolved");
    expect(conflicts[0]?.note).toMatch(/not treated as incompatible/i);
  });

  it("does not flag different genres alone as conflicts", () => {
    const conflicts = detectEvidenceConflicts([
      {
        id: "j",
        name: "Soft Quartet",
        category: "music",
        description: "x",
        affinity: 0.7,
        tags: ["jazz"],
      },
      {
        id: "m",
        name: "Chrome Distortion",
        category: "music",
        description: "x",
        affinity: 0.7,
        tags: ["metal"],
      },
      {
        id: "b",
        name: "Neutral Brand",
        category: "brands",
        description: "x",
        affinity: 0.6,
        tags: ["craft"],
      },
    ]);
    expect(conflicts).toHaveLength(0);
  });
});
