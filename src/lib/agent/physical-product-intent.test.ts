import { describe, expect, it } from "vitest";
import { generateConceptCandidates } from "./concepts";
import type { InterpretedObjective } from "./types";
import type { CulturalEntity } from "../types";

describe("P9.125 explicit physical product intent", () => {
  it("preserves a requested table lamp instead of substituting a ceramic tray", () => {
    const objective =
      "Design a functional table lamp combining Moroccan craftsmanship and Scandinavian design";

    const entities: CulturalEntity[] = [
      {
        id: "mc",
        name: "Moroccan Artisan Studio",
        category: "brands",
        description: "Traditional craft studio",
        affinity: 0.8,
        tags: ["craft", "handmade", "ceramic"],
      },
      {
        id: "sf",
        name: "Nordic Textile Design",
        category: "fashion",
        description: "Minimal textile design",
        affinity: 0.8,
        tags: ["textile", "utility", "material"],
      },
      {
        id: "sd",
        name: "Scandinavian Design House",
        category: "brands",
        description: "Functional home design",
        affinity: 0.7,
        tags: ["design", "craft", "minimal"],
      },
    ];

    const interpreted: InterpretedObjective = {
      rawObjective: objective,
      culturalInterest: "Moroccan craftsmanship and Scandinavian design",
      location: "Copenhagen, Denmark",
      outputCategory: "product",
      intentTokens: objective.toLowerCase().split(/\W+/).filter(Boolean),
      themes: ["moroccan", "craftsmanship", "scandinavian", "design"],
      summary: objective,
    };

    const result = generateConceptCandidates({
      interpreted,
      entities,
      evidence: [{
        id: "lamp-fixture",
        source: "mock_demo",
        label: "Synthetic lamp design fixture",
        detail: "Test evidence, not Qloo data",
        relatedEntityIds: entities.map((entity) => entity.id),
        createdAt: "2026-10-15T00:00:00.000Z",
      }],
      affinities: [],
      seedKey: "explicit-table-lamp",
    });

    expect(result.concepts.length).toBeGreaterThan(0);

    for (const concept of result.concepts) {
      const spec = concept.spec!;
      expect(`${concept.title} ${spec.proposition}`).toMatch(/\blamp\b/i);
      expect(`${spec.proposition} ${spec.mechanics}`).toMatch(
        /\b(illuminate|lighting|light)\b/i,
      );
      expect(`${concept.title} ${spec.proposition}`).not.toMatch(
        /\b(organizer tray|coffee brewing kit|drop SKU)\b/i,
      );
    }
  });
});
