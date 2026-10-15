import { describe, expect, it } from "vitest";

import { generateConceptCandidates } from "./concepts";
import { extractSignals } from "./mutation-transform";
import {
  checkOutputCategoryCoherence,
  runQualityGates,
} from "./quality-gates";
import {
  hasRepeatedWords,
  professionalName,
  selectObservedSignal,
  synthesizeConceptCandidates,
} from "./synthesis";
import type { InterpretedObjective } from "./types";

function evidenceFor(ids: string[]) {
  return [
    {
      id: "ev",
      source: "mock_demo" as const,
      label: "bundle",
      detail: "fixture",
      relatedEntityIds: ids,
      createdAt: "2026-10-11T00:00:00.000Z",
    },
  ];
}

describe("adversarial commercial coherence", () => {
  it("rejects repeated-word names (Mercado Course Course Ritual class)", () => {
    expect(hasRepeatedWords("Mercado Course Course Ritual")).toBe(true);
    const name = professionalName(
      "night market",
      {
        id: "fo1",
        name: "Mercado Course Kitchen",
        category: "food",
        description: "course hospitality",
        affinity: 0.8,
        tags: ["market", "culinary"],
      },
      "hospitality_course",
    );
    expect(hasRepeatedWords(name)).toBe(false);
    expect(name).not.toMatch(/Course Course/i);
    expect(name.toLowerCase()).toMatch(/night market|mercado|courses/);
  });

  it("does not accept sonic_set as a streetwear product without explaining a fashion product", () => {
    const interpreted: InterpretedObjective = {
      rawObjective: "Prototype a streetwear product for archival utility culture",
      culturalInterest: "streetwear",
      location: "Tokyo",
      outputCategory: "product",
      intentTokens: ["streetwear", "product", "utility"],
      themes: ["fashion"],
      summary: "test",
    };
    const entities = [
      {
        id: "fa1",
        name: "Layer Utility Co",
        category: "fashion" as const,
        description: "utility apparel",
        affinity: 0.8,
        tags: ["streetwear", "utility", "archive"],
      },
      {
        id: "m2",
        name: "Concrete Breaks",
        category: "music" as const,
        description: "beats",
        affinity: 0.65,
        tags: ["streetwear", "loud"],
      },
      {
        id: "b2",
        name: "Drop Atelier",
        category: "brands" as const,
        description: "membership drops",
        affinity: 0.75,
        tags: ["streetwear", "retail"],
      },
      {
        id: "p2",
        name: "Shibuya Arcade Lot",
        category: "places" as const,
        description: "arcade retail",
        affinity: 0.7,
        tags: ["streetwear", "arcade"],
      },
    ];

    const synthesized = synthesizeConceptCandidates({
      interpreted,
      entities,
      seedKey: "street-product",
    });
    expect(
      synthesized.every((c) => c.mechanismId !== "sonic_set"),
    ).toBe(true);

    const { concepts } = generateConceptCandidates({
      interpreted,
      entities,
      evidence: evidenceFor(entities.map((e) => e.id)),
      affinities: [],
      seedKey: "street-product",
    });

    expect(concepts.length).toBeGreaterThanOrEqual(1);
    expect(concepts.every((c) => c.spec?.mechanismId !== "sonic_set")).toBe(
      true,
    );
    for (const c of concepts) {
      const coherence = checkOutputCategoryCoherence(c.spec!, "product");
      expect(coherence.ok).toBe(true);
      expect(c.spec!.proposition + c.spec!.mechanics).toMatch(
        /\b(product|kit|garment|apparel|sku|edition)\b/i,
      );
      expect(c.title).not.toMatch(/Concrete Breaks Phrase Session/i);
    }
  });

  it("keeps archive as archive — no unsupported archive→documentary jump", () => {
    const fashion = {
      id: "fa1",
      name: "Layer Utility Co",
      category: "fashion" as const,
      description: "utility apparel",
      affinity: 0.8,
      tags: ["streetwear", "utility", "archive"],
    };
    const signals = extractSignals(fashion);
    expect(signals).toContain("archive");
    expect(signals).not.toContain("documentary");
    expect(selectObservedSignal(fashion)).toBe("streetwear");

    const interpreted: InterpretedObjective = {
      rawObjective: "Create a brand platform for archival streetwear culture",
      culturalInterest: "streetwear",
      location: "Tokyo",
      outputCategory: "brand",
      intentTokens: ["streetwear", "brand", "archive"],
      themes: ["fashion"],
      summary: "test",
    };
    const entities = [
      fashion,
      {
        id: "b2",
        name: "Drop Atelier",
        category: "brands" as const,
        description: "membership drops",
        affinity: 0.75,
        tags: ["streetwear", "retail"],
      },
      {
        id: "p2",
        name: "Shibuya Arcade Lot",
        category: "places" as const,
        description: "arcade retail",
        affinity: 0.7,
        tags: ["streetwear", "arcade"],
      },
    ];
    const { concepts } = generateConceptCandidates({
      interpreted,
      entities,
      evidence: evidenceFor(entities.map((e) => e.id)),
      affinities: [],
      seedKey: "archive-signal",
    });
    for (const c of concepts) {
      const blob = c.spec!.rationales
        .map((r) => `${r.attributeOrSignal} ${r.creativeInterpretation}`)
        .join(" ");
      expect(blob).not.toMatch(/archive[^.]{0,40}documentary/i);
      if (c.spec!.mechanismId === "material_layer") {
        expect(blob.toLowerCase()).toMatch(/archive|utility|streetwear|fashion/);
        expect(blob.toLowerCase()).not.toContain("documentary");
      }
    }
  });

  it("hospitality product names cleanly and states a product form", () => {
    const interpreted: InterpretedObjective = {
      rawObjective: "Prototype a product for communal market food culture",
      culturalInterest: "night market",
      location: "Mexico City",
      outputCategory: "product",
      intentTokens: ["market", "product", "food"],
      themes: ["culinary"],
      summary: "test",
    };
    const entities = [
      {
        id: "fo1",
        name: "Mercado Course Kitchen",
        category: "food" as const,
        description: "course hospitality",
        affinity: 0.82,
        tags: ["market", "culinary", "shared"],
      },
      {
        id: "p3",
        name: "Alameda Stall Circuit",
        category: "places" as const,
        description: "stall path",
        affinity: 0.78,
        tags: ["market", "night"],
      },
      {
        id: "b3",
        name: "Comal Commons",
        category: "brands" as const,
        description: "shared brand",
        affinity: 0.7,
        tags: ["market", "craft"],
      },
    ];
    const { concepts } = generateConceptCandidates({
      interpreted,
      entities,
      evidence: evidenceFor(entities.map((e) => e.id)),
      affinities: [],
      seedKey: "mercado",
    });
    expect(concepts.length).toBeGreaterThanOrEqual(1);
    for (const c of concepts) {
      expect(hasRepeatedWords(c.title)).toBe(false);
      expect(c.title).not.toMatch(/Course Course/i);
      expect(checkOutputCategoryCoherence(c.spec!, "product").ok).toBe(true);
    }
    const hospitality = concepts.find(
      (c) => c.spec?.mechanismId === "hospitality_course",
    );
    expect(hospitality).toBeTruthy();
    expect(hospitality!.spec!.proposition).toMatch(/\bproduct\b/i);
    expect(hospitality!.spec!.mechanics).toMatch(/\b(kit|card|prop)/i);
  });

  it("experience concepts keep participation + sequence; brand concepts keep touchpoints", () => {
    const experienceReq: InterpretedObjective = {
      rawObjective:
        "Design a late-night hospitality experience for curious travelers",
      culturalInterest: "jazz",
      location: "Lisbon",
      outputCategory: "experience",
      intentTokens: ["jazz", "hospitality", "experience"],
      themes: ["sonic"],
      summary: "test",
    };
    const jazzEntities = [
      {
        id: "m1",
        name: "Harbor Quartet",
        category: "music" as const,
        description: "listening set",
        affinity: 0.8,
        tags: ["jazz", "night", "listening"],
      },
      {
        id: "p1",
        name: "Canal Room",
        category: "places" as const,
        description: "listening room",
        affinity: 0.75,
        tags: ["jazz", "listening"],
      },
      {
        id: "b1",
        name: "Vinyl Clay",
        category: "brands" as const,
        description: "craft label",
        affinity: 0.7,
        tags: ["jazz", "craft"],
      },
    ];
    const exp = generateConceptCandidates({
      interpreted: experienceReq,
      entities: jazzEntities,
      evidence: evidenceFor(jazzEntities.map((e) => e.id)),
      affinities: [],
      seedKey: "jazz-exp",
    });
    for (const c of exp.concepts) {
      expect(checkOutputCategoryCoherence(c.spec!, "experience").ok).toBe(true);
      expect(c.spec!.journey.length).toBeGreaterThanOrEqual(3);
    }

    const brandReq: InterpretedObjective = {
      ...experienceReq,
      rawObjective: "Create a consumer brand for intimate jazz culture",
      outputCategory: "brand",
    };
    const brand = generateConceptCandidates({
      interpreted: brandReq,
      entities: jazzEntities,
      evidence: evidenceFor(jazzEntities.map((e) => e.id)),
      affinities: [],
      seedKey: "jazz-brand",
    });
    for (const c of brand.concepts) {
      expect(checkOutputCategoryCoherence(c.spec!, "brand").ok).toBe(true);
      expect(
        `${c.spec!.proposition} ${c.spec!.mechanics}`,
      ).toMatch(/\b(brand|touchpoint|membership|identity|positioning)\b/i);
    }
  });

  it("quality gate rejects structurally complete but commercially incoherent product copy", () => {
    const interpreted: InterpretedObjective = {
      rawObjective: "Prototype a streetwear product",
      culturalInterest: "streetwear",
      outputCategory: "product",
      intentTokens: ["streetwear"],
      themes: [],
      summary: "test",
    };
    const entities = [
      {
        id: "m2",
        name: "Concrete Breaks",
        category: "music" as const,
        description: "beats",
        affinity: 0.65,
        tags: ["streetwear", "loud"],
      },
      {
        id: "fa1",
        name: "Layer Utility Co",
        category: "fashion" as const,
        description: "utility apparel",
        affinity: 0.8,
        tags: ["streetwear", "utility"],
      },
    ];
    const synth = synthesizeConceptCandidates({
      interpreted: {
        ...interpreted,
        culturalInterest: "jazz",
        rawObjective: "Prototype a jazz listening product",
      },
      entities: [
        entities[0]!,
        {
          id: "p1",
          name: "Canal Room",
          category: "places" as const,
          description: "room",
          affinity: 0.7,
          tags: ["jazz", "listening"],
        },
      ],
      seedKey: "incoherent",
    });
    // Force an experience-shaped proposition onto a product freeze for gate test
    const base = synth[0]?.spec;
    expect(base).toBeTruthy();
    const incoherent = {
      ...base!,
      frozenOutputCategory: "product" as const,
      frozenObjective: interpreted.rawObjective,
      name: "Concrete Breaks Phrase Session",
      proposition:
        "An experience where streetwear is scored as phrase → break → reprise, not as a static salon.",
      mechanics:
        "Time-boxed phrases. Participation is listen/respond within the set. Layout is secondary to arrangement.",
      differentiationHypothesis: "No bridge stated.",
    };
    const gate = runQualityGates({
      spec: incoherent,
      interpreted,
      acceptedFingerprints: [],
      evidenceEntityIds: new Set(["m2", "fa1", "p1"]),
    });
    expect(gate.accepted).toBe(false);
    expect(
      gate.failures.some(
        (f) =>
          f.startsWith("output_category_coherence") ||
          f.startsWith("professional_naming") ||
          f.startsWith("causal_bridge"),
      ),
    ).toBe(true);
  });

  it("remains deterministic after coherence hardening", () => {
    const interpreted: InterpretedObjective = {
      rawObjective: "Design a late-night hospitality experience for curious travelers",
      culturalInterest: "jazz",
      location: "Lisbon",
      outputCategory: "experience",
      intentTokens: ["jazz"],
      themes: [],
      summary: "test",
    };
    const entities = [
      {
        id: "m1",
        name: "Harbor Quartet",
        category: "music" as const,
        description: "listening set",
        affinity: 0.8,
        tags: ["jazz", "night"],
      },
      {
        id: "p1",
        name: "Canal Room",
        category: "places" as const,
        description: "listening room",
        affinity: 0.75,
        tags: ["jazz", "listening"],
      },
      {
        id: "b1",
        name: "Vinyl Clay",
        category: "brands" as const,
        description: "craft",
        affinity: 0.7,
        tags: ["jazz", "craft"],
      },
    ];
    const a = generateConceptCandidates({
      interpreted,
      entities,
      evidence: evidenceFor(entities.map((e) => e.id)),
      affinities: [],
      seedKey: "det-cohere",
    });
    const b = generateConceptCandidates({
      interpreted,
      entities,
      evidence: evidenceFor(entities.map((e) => e.id)),
      affinities: [],
      seedKey: "det-cohere",
    });
    expect(a.concepts.map((c) => c.id)).toEqual(b.concepts.map((c) => c.id));
    expect(a.concepts.map((c) => c.title)).toEqual(b.concepts.map((c) => c.title));
  });
});
