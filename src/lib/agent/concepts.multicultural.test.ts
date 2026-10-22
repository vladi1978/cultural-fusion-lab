import { describe, expect, it } from "vitest";
import { generateConceptCandidates } from "./concepts";
import { auditConceptSimilarity } from "../eval/concept-similarity";
import type { InterpretedObjective } from "./types";
import type { CulturalEntity } from "../types";

const scenarios: {
  name: string;
  objective: string;
  interest: string;
  location: string;
  output: InterpretedObjective["outputCategory"];
  entities: CulturalEntity[];
}[] = [
  {
    name: "Korean-Brazilian festival",
    objective: "Design an immersive cultural festival combining Korean street food and Brazilian dance",
    interest: "Korean street food and Brazilian dance",
    location: "São Paulo, Brazil",
    output: "experience",
    entities: [
      { id: "kf", name: "Seoul Market Kitchen", category: "food", description: "Korean street food", affinity: 0.8, tags: ["street", "food", "fermentation"] },
      { id: "b", name: "Brazilian Dance Square", category: "places", description: "Brazilian dance gathering", affinity: 0.8, tags: ["dance", "festival", "public"] },
      { id: "bm", name: "Brazilian Rhythm Collective", category: "music", description: "Live Brazilian rhythms", affinity: 0.7, tags: ["rhythm", "dance", "live"] },
    ],
  },
  {
    name: "Moroccan-Scandinavian product",
    objective: "Create a functional home product combining Moroccan craftsmanship and Scandinavian design",
    interest: "Moroccan craftsmanship and Scandinavian design",
    location: "Copenhagen, Denmark",
    output: "product",
    entities: [
      { id: "mc", name: "Moroccan Artisan Studio", category: "brands", description: "Traditional craft studio", affinity: 0.8, tags: ["craft", "handmade", "ceramic"] },
      { id: "sf", name: "Nordic Textile Design", category: "fashion", description: "Minimal textile design", affinity: 0.8, tags: ["textile", "utility", "material"] },
      { id: "sd", name: "Scandinavian Design House", category: "brands", description: "Functional home design", affinity: 0.7, tags: ["design", "craft", "minimal"] },
    ],
  },
  {
    name: "Technology and heritage education",
    objective: "Design an interactive educational experience combining digital technology and cultural heritage",
    interest: "digital technology and cultural heritage",
    location: "Mexico City, Mexico",
    output: "experience",
    entities: [
      { id: "hp", name: "Heritage Museum", category: "places", description: "Cultural heritage exhibitions", affinity: 0.8, tags: ["heritage", "museum", "learning"] },
      { id: "df", name: "Digital Story Archive", category: "film", description: "Interactive cultural storytelling", affinity: 0.8, tags: ["digital", "story", "archive"] },
      { id: "tb", name: "Interactive Learning Studio", category: "brands", description: "Educational technology experiences", affinity: 0.7, tags: ["technology", "interactive", "learning"] },
    ],
  },
];


describe("P9.183 functional need end-to-end integration", () => {
  it("P9.183: explicit glare reduction reaches final concept", () => {
    const base = scenarios.find(
      (scenario) => scenario.name === "Moroccan-Scandinavian product",
    );
    if (!base) throw new Error("Missing multicultural product fixture");

    const objective =
      "Design a Moroccan-Scandinavian table lamp to reduce glare";

    const interpreted: InterpretedObjective = {
      rawObjective: objective,
      culturalInterest: base.interest,
      location: base.location,
      outputCategory: "product",
      intentTokens: objective.toLowerCase().split(/\\W+/).filter(Boolean),
      themes: base.interest.toLowerCase().split(/\\W+/).filter(Boolean),
      summary: objective,
    };

    const result = generateConceptCandidates({
      interpreted,
      entities: base.entities,
      evidence: [{
        id: "p9183-synthetic-evidence",
        source: "mock_demo",
        label: "Synthetic cultural evidence",
        detail: "Not Qloo data",
        relatedEntityIds: base.entities.map((entity) => entity.id),
        createdAt: "2026-10-15T00:00:00.000Z",
      }],
      affinities: [],
      seedKey: "P9.183-explicit-glare",
    });

    expect(result.concepts.length).toBeGreaterThan(0);

    const mechanisms = result.concepts.map(
      (concept) => concept.spec?.mechanics ?? "",
    );

    const supported = mechanisms.filter(
      (mechanics) =>
        mechanics.includes(
          "Functional mechanism: status: proposed; origin: engineering_hypothesis; functional evidence: not_established;",
        ),
    );


    console.log("P9.184 FUNCTIONAL INTEGRATION DIAGNOSTIC", JSON.stringify(
      result.concepts.map((concept) => ({
        title: concept.title,
        mechanismId: concept.spec?.mechanismId,
        operatingProgramId: concept.spec?.operatingProgramId,
        influenceMap: concept.spec?.influenceMap,
        proposition: concept.spec?.proposition,
        mechanics: concept.spec?.mechanics,
      })),
      null,
      2,
    ));

    expect(supported.length).toBeGreaterThan(0);

    for (const mechanics of supported) {
      expect(mechanics).toMatch(/removable textile shade sleeve/i);
      expect(mechanics).toMatch(/light distribution and glare/i);
      expect(mechanics).toMatch(/heat and electrical safety/i);
      expect(mechanics).toMatch(/Cultural design transfer:/i);
      expect(mechanics).toMatch(/observed: ceramic/i);
      expect(mechanics).toMatch(/observed: textile/i);
    }
  });
});


describe("P9.194 adjustable organizer end-to-end integration", () => {
  it("P9.194: adjustable organizer reaches final concept", () => {
    const base = scenarios.find(
      (scenario) => scenario.name === "Moroccan-Scandinavian product",
    );
    if (!base) throw new Error("Missing multicultural product fixture");

    const objective =
      "Design a Moroccan-Scandinavian organizer tray for objects of different sizes";

    const interpreted: InterpretedObjective = {
      rawObjective: objective,
      culturalInterest: base.interest,
      location: base.location,
      outputCategory: "product",
      intentTokens: objective.toLowerCase().split(/\W+/).filter(Boolean),
      themes: base.interest.toLowerCase().split(/\W+/).filter(Boolean),
      summary: objective,
    };

    const result = generateConceptCandidates({
      interpreted,
      entities: base.entities,
      evidence: [{
        id: "p9194-synthetic-evidence",
        source: "mock_demo",
        label: "Synthetic cultural evidence",
        detail: "Not Qloo data",
        relatedEntityIds: base.entities.map((entity) => entity.id),
        createdAt: "2026-10-15T00:00:00.000Z",
      }],
      affinities: [],
      seedKey: "P9.194-adjustable-organizer",
    });

    expect(result.concepts.length).toBeGreaterThan(0);

    const matching = result.concepts.filter((concept) => {
      const mechanics = concept.spec?.mechanics ?? "";
      return (
        /organizer tray/i.test(
          `${concept.title} ${concept.spec?.proposition ?? ""}`,
        ) &&
        mechanics.includes(
          "Functional mechanism: status: proposed; origin: engineering_hypothesis; functional evidence: not_established;",
        )
      );
    });

    expect(
      matching.map((concept) => ({
        title: concept.title,
        mechanics: concept.spec?.mechanics,
      })),
    ).not.toHaveLength(0);

    for (const concept of matching) {
      const mechanics = concept.spec?.mechanics ?? "";
      expect(mechanics).toMatch(/repositionable internal dividers/i);
      expect(mechanics).toMatch(/move the dividers/i);
      expect(mechanics).toMatch(/retrieval time/i);
      expect(mechanics).toMatch(/existing adjustable organizers/i);
      expect(mechanics).toMatch(/observed: ceramic/i);
      expect(mechanics).toMatch(/functional evidence: not_established/i);
    }
  });
});


describe("P9.195 functional need adversarial integration", () => {
  it("P9.195: generic organizer does not invent adjustable storage", () => {
    const base = scenarios.find(
      (scenario) => scenario.name === "Moroccan-Scandinavian product",
    );
    if (!base) throw new Error("Missing multicultural product fixture");

    const objective =
      "Design a Moroccan-Scandinavian organizer tray";

    const interpreted: InterpretedObjective = {
      rawObjective: objective,
      culturalInterest: base.interest,
      location: base.location,
      outputCategory: "product",
      intentTokens: objective.toLowerCase().split(/\W+/).filter(Boolean),
      themes: base.interest.toLowerCase().split(/\W+/).filter(Boolean),
      summary: objective,
    };

    const result = generateConceptCandidates({
      interpreted,
      entities: base.entities,
      evidence: [{
        id: "p9195-synthetic-evidence",
        source: "mock_demo",
        label: "Synthetic cultural evidence",
        detail: "Not Qloo data",
        relatedEntityIds: base.entities.map((entity) => entity.id),
        createdAt: "2026-10-15T00:00:00.000Z",
      }],
      affinities: [],
      seedKey: "P9.195-generic-organizer",
    });

    expect(result.concepts.length).toBeGreaterThan(0);

    for (const concept of result.concepts) {
      const mechanics = concept.spec?.mechanics ?? "";

      if (mechanics.includes("Functional mechanism:")) {
        expect(mechanics).toContain(
          "Functional mechanism: status: insufficient_evidence;",
        );
      }
      expect(mechanics).not.toMatch(/repositionable internal dividers/i);
      expect(mechanics).not.toMatch(/move the dividers/i);
      expect(mechanics).not.toMatch(/retrieval time/i);
    }
  });
});


describe("P9.201 final product fidelity integration", () => {
  it("does not substitute apparel for an explicitly requested organizer tray", () => {
    const base = scenarios.find(
      (scenario) => scenario.name === "Moroccan-Scandinavian product",
    );
    if (!base) throw new Error("Missing multicultural product fixture");

    const objective = "Design a Moroccan-Scandinavian organizer tray";

    const interpreted: InterpretedObjective = {
      rawObjective: objective,
      culturalInterest: base.interest,
      location: base.location,
      outputCategory: "product",
      intentTokens: objective.toLowerCase().split(/\\W+/).filter(Boolean),
      themes: base.interest.toLowerCase().split(/\\W+/).filter(Boolean),
      summary: objective,
    };

    const result = generateConceptCandidates({
      interpreted,
      entities: base.entities,
      evidence: [{
        id: "p9201-synthetic-evidence",
        source: "mock_demo",
        label: "Synthetic cultural evidence",
        detail: "Not Qloo data",
        relatedEntityIds: base.entities.map((entity) => entity.id),
        createdAt: "2026-10-15T00:00:00.000Z",
      }],
      affinities: [],
      seedKey: "P9.201-organizer-fidelity",
    });

    expect(result.concepts.length).toBeGreaterThan(0);

    for (const concept of result.concepts) {
      const mechanics = concept.spec?.mechanics ?? "";
      const proposition = concept.spec?.proposition ?? "";
      const content = `${mechanics} ${proposition}`;

      expect(concept.spec?.mechanismId).not.toBe("material_layer");
      expect(content).not.toMatch(
        /layered garment|garment kit|reconfigurable .* garment/i,
      );
    }
  });
});


describe("P9.203 chair functional integration", () => {
  it("delivers an explicit seat-height mechanism in the final concept", () => {
    const base = scenarios.find(
      (scenario) => scenario.name === "Moroccan-Scandinavian product",
    );
    if (!base) throw new Error("Missing multicultural product fixture");

    const objective =
      "Design a Moroccan-Scandinavian chair for different desk heights";

    const interpreted: InterpretedObjective = {
      rawObjective: objective,
      culturalInterest: base.interest,
      location: base.location,
      outputCategory: "product",
      intentTokens: objective.toLowerCase().split(/\\W+/).filter(Boolean),
      themes: base.interest.toLowerCase().split(/\\W+/).filter(Boolean),
      summary: objective,
    };

    const entities: CulturalEntity[] = [
      {
        id: "p9203-wood",
        name: "Scandinavian Woodworking Studio",
        category: "brands",
        description: "Woodworking and furniture construction",
        affinity: 0.8,
        tags: ["woodworking", "craft", "furniture"],
      },
      ...base.entities,
    ];

    const result = generateConceptCandidates({
      interpreted,
      entities,
      evidence: [{
        id: "p9203-synthetic-evidence",
        source: "mock_demo",
        label: "Synthetic cultural evidence",
        detail: "Not Qloo data",
        relatedEntityIds: entities.map((entity) => entity.id),
        createdAt: "2026-10-15T00:00:00.000Z",
      }],
      affinities: [],
      seedKey: "P9.203-chair-functional",
    });

    expect(result.concepts.length).toBeGreaterThan(0);

    const supported = result.concepts.filter((concept) => {
      const mechanics = concept.spec?.mechanics ?? "";
      return mechanics.includes(
        "Functional mechanism: status: proposed; origin: engineering_hypothesis;",
      ) && mechanics.includes("locking seat-height adjustment");
    });

    expect(supported.length).toBeGreaterThan(0);

    for (const concept of supported) {
      const mechanics = concept.spec?.mechanics ?? "";

      expect(mechanics).toContain("functional evidence: not_established;");
      expect(mechanics).toMatch(/adjustment time/i);
      expect(mechanics).toMatch(/structural loading/i);
      expect(mechanics).toMatch(/existing height-adjustable chairs/i);
      expect(mechanics).toContain(
        "Functional differentiation assessment: status: comparison_required;",
      );
      expect(mechanics).toMatch(/baseline: Identify and document an existing comparable chair/i);
      expect(mechanics).toContain("competitive evidence: not_established;");
      expect(mechanics).toContain("performance evidence: not_established;");
      expect(mechanics).toContain("novelty claim allowed: false;");
      expect(mechanics).toMatch(/comparative performance.*have not been demonstrated/i);
      expect(mechanics).toMatch(/Cultural design transfer:/i);
    }
  });
});

describe("P9.79 multicultural concept diversity diagnostic", () => {
  it.each([
    ["table lamp", "Design a functional home table lamp combining Moroccan craftsmanship and Scandinavian design", /\blamp\b/i, /illuminate|lighting|light/i],
    ["coffee brewing kit", "Design a functional home coffee brewing kit combining Moroccan craftsmanship and Scandinavian design", /coffee brewing kit|brewing kit/i, /measure|filter/i],
    ["organizer tray", "Design a functional home organizer tray combining Moroccan craftsmanship and Scandinavian design", /organizer tray/i, /hold|organize/i],
    ["chair", "Design a functional home chair combining Moroccan craftsmanship and Scandinavian design", /\bchair\b/i, /support|seat/i],
    ["shelf", "Design a functional home bookshelf combining Moroccan craftsmanship and Scandinavian design", /shelf|bookshelf|shelving/i, /hold|display/i],
    ["planter", "Design a functional home planter combining Moroccan craftsmanship and Scandinavian design", /\bplanter\b/i, /contain|plant/i],
  ])("P9.139: %s survives full concept generation", (object, objective, objectPattern, functionPattern) => {
    const base = scenarios.find(
      (scenario) => scenario.name === "Moroccan-Scandinavian product",
    );
    if (!base) throw new Error("Missing multicultural product fixture");

    const interpreted: InterpretedObjective = {
      rawObjective: objective,
      culturalInterest: base.interest,
      location: base.location,
      outputCategory: "product",
      intentTokens: objective.toLowerCase().split(/\W+/).filter(Boolean),
      themes: base.interest.toLowerCase().split(/\W+/).filter(Boolean),
      summary: objective,
    };

    const result = generateConceptCandidates({
      interpreted,
      entities: base.entities,
      evidence: [{
        id: "physical-product-fixture",
        source: "mock_demo",
        label: "Synthetic physical product evidence",
        detail: "Not Qloo data",
        relatedEntityIds: base.entities.map((entity) => entity.id),
        createdAt: "2026-10-15T00:00:00.000Z",
      }],
      affinities: [],
      seedKey: `P9.139-${object}`,
    });

    expect(result.concepts.length).toBeGreaterThan(0);

    for (const concept of result.concepts) {
      const spec = concept.spec;
      expect(spec).toBeDefined();
      expect(`${concept.title} ${spec?.proposition}`).toMatch(objectPattern);
      expect(`${spec?.proposition} ${spec?.mechanics}`).toMatch(functionPattern);
      expect(spec?.proposition.toLowerCase()).not.toMatch(/drop sku/);
      expect(spec?.journey).toHaveLength(3);

      // P9.143: cultural transfer must reach the accepted concept.
      const mechanics = spec?.mechanics ?? "";
      expect(mechanics).toContain("Cultural design transfer:");

      // P9.147: a physical material signal must survive full generation.
      expect(mechanics).toMatch(
        /observed: ceramic; status: hypothesis; proposed design: Evaluate a ceramic/i,
      );
      expect(mechanics).toMatch(
        /Source: Moroccan Artisan Studio; observed: ceramic/i,
      );

      // P9.150: cultural transfer targets real physical components.
      const componentMap: Record<string, string> = {
        "table lamp": "base",
        "coffee brewing kit": "filter holder",
        "organizer tray": "tray body",
        "chair": "seat",
        "shelf": "horizontal shelf",
        "planter": "plant container",
      };

      // P9.168: verify functional mechanism in generated concepts.
      expect(mechanics).toContain("Functional mechanism: status:");

      if (object === "table lamp") {
        if (
          mechanics.includes("observed: ceramic; status: hypothesis;") &&
          mechanics.includes("observed: textile; status: hypothesis;")
        ) {
          expect(mechanics).toContain(
            "Functional mechanism: status: insufficient_evidence; origin: not_established; functional evidence: not_established;",
          );
          expect(mechanics).not.toMatch(/removable textile shade sleeve/i);
          expect(mechanics).not.toMatch(/light distribution and glare/i);
        }
      }

      if (object === "organizer tray") {
        expect(mechanics).toContain(
          "Functional mechanism: status: insufficient_evidence; origin: not_established; functional evidence: not_established;",
        );
        expect(mechanics).not.toMatch(
          /repositionable internal dividers/i,
        );
        expect(mechanics).not.toMatch(/move the dividers/i);
        expect(mechanics).not.toMatch(/retrieval time/i);
        expect(mechanics).not.toMatch(
          /existing adjustable organizers/i,
        );
      }

      if (object === "chair" || object === "shelf") {
        expect(mechanics).not.toMatch(
          /repositionable internal dividers/i,
        );
      }

      if (object === "planter") {
        expect(mechanics).toContain(
          "Functional mechanism: status: insufficient_evidence; origin: not_established; functional evidence: not_established;",
        );
        expect(mechanics).not.toMatch(/removable textile shade sleeve/i);
      }

      const primaryComponent = componentMap[object];
      expect(primaryComponent).toBeDefined();
      expect(mechanics).toContain(
        `Evaluate a ceramic construction or finish for the ${primaryComponent}.`,
      );

      // P9.151: verify the second cultural contribution independently.
      const secondComponents: Record<string, string> = {
        "table lamp": "shade",
        "coffee brewing kit": "measuring scoop",
        "organizer tray": "raised edge",
        "chair": "backrest",
        "shelf": "mounting or support structure",
        "planter": "drainage provision",
      };

      const secondComponent = secondComponents[object];
      expect(secondComponent).toBeDefined();

      const textileSourceSelected = mechanics.includes(
        "Source: Nordic Textile Design;",
      );

      if (textileSourceSelected) {
        if (object === "planter" || object === "shelf") {
          // Textile transfers to drainage or mounting structures
          // require engineering review.
          expect(mechanics).toContain(
            "observed: textile; status: insufficient_evidence;",
          );
          expect(mechanics).toContain(
            "Material-component compatibility requires engineering review",
          );
          expect(mechanics).not.toContain(
            `Evaluate a woven or textile-based surface treatment for the ${secondComponent}.`,
          );
        } else {
          expect(mechanics).toContain(
            "observed: textile; status: hypothesis;",
          );
          expect(mechanics).toContain(
            `Evaluate a woven or textile-based surface treatment for the ${secondComponent}.`,
          );
        }
      } else {
        expect(mechanics).toContain(
          "status: insufficient_evidence;",
        );
      }


      // A second source must remain independently traceable.
      expect(mechanics).toContain("Source:");
      expect(mechanics).toMatch(
        /status: (hypothesis|insufficient_evidence)/,
      );


      expect(mechanics).toContain("Source:");
      expect(mechanics).toContain("observed:");
      expect(mechanics).toContain("proposed design:");
      expect(mechanics).toContain("verification:");

      // A proposed cultural transfer must never be presented as verified.
      expect(mechanics).toMatch(
        /status: (hypothesis|insufficient_evidence)/,
      );
      expect(mechanics).not.toMatch(
        /culturally proven|verified cultural law|guaranteed demand/i,
      );
    }
  });

  for (const scenario of scenarios) {
    it(scenario.name, () => {
      const interpreted: InterpretedObjective = {
        rawObjective: scenario.objective,
        culturalInterest: scenario.interest,
        location: scenario.location,
        outputCategory: scenario.output,
        intentTokens: scenario.objective.toLowerCase().split(/\W+/).filter(Boolean),
        themes: scenario.interest.toLowerCase().split(/\W+/).filter(Boolean),
        summary: scenario.objective,
      };

      let result: ReturnType<typeof generateConceptCandidates>;
      try {
        result = generateConceptCandidates({
        interpreted,
        entities: scenario.entities,
        evidence: [{
          id: "fixture-evidence",
          source: "mock_demo",
          label: "Synthetic diagnostic fixture",
          detail: "Not Qloo data",
          relatedEntityIds: scenario.entities.map((entity) => entity.id),
          createdAt: "2026-10-15T00:00:00.000Z",
        }],
        affinities: [],
        seedKey: scenario.name,
        });
      } catch (error) {
        console.error("P9.119 QUALITY DIAGNOSTIC:", error);
        throw error;
      }

      const findings = auditConceptSimilarity(
        result.concepts,
        [scenario.interest, scenario.location],
      );

      console.log(JSON.stringify({
        scenario: scenario.name,
        accepted: result.concepts.length,
        concepts: result.concepts.map((concept) => ({
          title: concept.title,
          mechanism: concept.spec?.mechanismId,
          program: concept.spec?.operatingProgramId,
          proposition: concept.spec?.proposition,
        })),
        flaggedPairs: findings.filter((finding) => finding.flagged),
      }, null, 2));

      // P9.87 home-product intent regression
      if (scenario.name === "Moroccan-Scandinavian product") {
        // Validate the final concepts, not a particular mechanism.
        // A valid result may contain fewer than three concepts.
        expect(result.concepts.length).toBeGreaterThan(0);

        // P9.93 concrete home-product regression
        // Every accepted concept must identify a tangible home object.
        // Distribution mechanics alone do not satisfy the objective.
        const homeObjects =
          /\b(lamp|lighting fixture|shelf|shelving|table|chair|stool|cabinet|storage unit|vase|planter|tray|room divider|wall panel|rug|cushion|ceramic vessel)\b/i;

        for (const concept of result.concepts) {
          const spec = concept.spec!;
          expect(spec.proposition).toMatch(homeObjects);
          expect(concept.title).toMatch(/Organizer Tray/i);
          expect(concept.title).not.toMatch(/Drops/i);
          const description = [
            spec.proposition,
            spec.audience,
            spec.context,
            spec.mechanics,
          ].join(" ").toLowerCase();

          expect(description).not.toMatch(
            /garment|apparel|wearers|clothing|fashion brand/,
          );
        }
      }

      expect(result.concepts.length).toBeGreaterThanOrEqual(1);
      expect(result.concepts.length).toBeLessThanOrEqual(3);
    });
  }
});
