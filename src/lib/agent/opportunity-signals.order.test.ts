import { runQualityGates } from "./quality-gates";
import { describe, expect, it } from "vitest";
import type { CulturalEntity } from "../types";
import type { OpportunityHypothesis } from "./opportunity-types";
import { resolveOpportunitySignals } from "./opportunity-signals";

const entities: CulturalEntity[] = [
  {
    id: "m1",
    name: "Harbor Quartet",
    category: "music",
    description: "Music collective",
    affinity: 0.8,
    tags: ["jazz", "listening", "craft"],
  },
  {
    id: "p1",
    name: "Canal Room",
    category: "places",
    description: "Cultural venue",
    affinity: 0.75,
    tags: ["jazz", "listening", "craft"],
  },
];

const opportunity: OpportunityHypothesis = {
  id: "opp-order-test",
  kind: "complementarity",
  title: "Music and place complementarity",
  supportingEntityIds: ["m1", "p1"],
  supportingSignalIds: [
    "sig-m1-tag-craft",
    "sig-p1-tag-craft",
  ],
  whyCreativelyUseful: "Craft is the supported creative bridge.",
  designImplication: "Test a collaborative making program.",
  uncertainty: "Hypothesis only.",
  unsupportedAssumptions: ["No demand evidence."],
  evidenceIds: ["ev"],
  suggestedMechanismId: "sonic_set",
  status: "accepted",
  relationshipIds: [],
};

describe("P1.1 signal order invariance", () => {
  it("prioritizes explicitly supported signals regardless of tag order", () => {
    const reordered = entities.map((entity) => ({
      ...entity,
      tags: [...entity.tags].reverse(),
    }));

    const first = resolveOpportunitySignals({
      opportunity,
      entities,
      culturalInterest: "jazz",
    });

    const second = resolveOpportunitySignals({
      opportunity,
      entities: reordered,
      culturalInterest: "jazz",
    });

    expect(first.primary).toBe("craft");
    expect(second.primary).toBe("craft");
    expect(first.primary).toBe(second.primary);
  });
});

import { compileConceptFromOpportunity } from "./opportunity-compiler";
import type { InterpretedObjective } from "./types";

describe("P1.1 supported signal controls program selection", () => {
  it("selects craft program when craft is explicitly supported alongside listening", () => {
    const objective: InterpretedObjective = {
      rawObjective: "Design a late-night hospitality experience for curious travelers",
      culturalInterest: "jazz",
      location: "Lisbon",
      outputCategory: "experience",
      intentTokens: ["jazz", "hospitality"],
      themes: ["sonic"],
      summary: "controlled counterfactual",
    };

    const spec = compileConceptFromOpportunity({
      opportunity,
      mechanismId: "sonic_set",
      interpreted: objective,
      influences: entities,
    });

    expect(spec).not.toBeNull();
    expect(spec?.operatingProgramId).toBe("craft_cocreate");
    expect(spec?.mechanics).toMatch(/make|assemble|checkpoint|craft/i);
    expect(spec?.pilotExperiment).toMatch(/checkpoint|co-create|craft|make/i);
  });
});

describe("P1.1 controlled cultural counterfactual", () => {
  it("changes program, mechanics, journey and pilot when supported signal changes", () => {
    const objective: InterpretedObjective = {
      rawObjective: "Design a late-night hospitality experience for curious travelers",
      culturalInterest: "jazz",
      location: "Lisbon",
      outputCategory: "experience",
      intentTokens: ["jazz", "hospitality"],
      themes: ["sonic"],
      summary: "controlled counterfactual",
    };

    const listeningOpportunity: OpportunityHypothesis = {
      ...opportunity,
      supportingSignalIds: [
        "sig-m1-tag-listening",
        "sig-p1-tag-listening",
      ],
    };

    const craftSpec = compileConceptFromOpportunity({
      opportunity,
      mechanismId: "sonic_set",
      interpreted: objective,
      influences: entities,
    });

    const listeningSpec = compileConceptFromOpportunity({
      opportunity: listeningOpportunity,
      mechanismId: "sonic_set",
      interpreted: objective,
      influences: entities,
    });

    expect(craftSpec).not.toBeNull();
    expect(listeningSpec).not.toBeNull();

    expect(craftSpec?.operatingProgramId).toBe("craft_cocreate");
    expect(listeningSpec?.operatingProgramId).toBe("acoustic_spatial");

    expect(craftSpec?.mechanics).not.toEqual(listeningSpec?.mechanics);
    expect(craftSpec?.pilotExperiment).not.toEqual(listeningSpec?.pilotExperiment);

    const craftJourney = craftSpec?.journey.map((step) => step.action).join("|");
    const listeningJourney = listeningSpec?.journey.map((step) => step.action).join("|");

    expect(craftJourney).not.toEqual(listeningJourney);
    expect(craftSpec?.operatingProgramFingerprint).not.toEqual(
      listeningSpec?.operatingProgramFingerprint,
    );
  });
});

describe("P1.1 causal binding referential integrity", () => {
  it("every binding references a real rule, journey step, metric and opportunity evidence", () => {
    const objective: InterpretedObjective = {
      rawObjective: "Design a late-night hospitality experience for curious travelers",
      culturalInterest: "jazz",
      location: "Lisbon",
      outputCategory: "experience",
      intentTokens: ["jazz", "hospitality"],
      themes: ["sonic"],
      summary: "causal integrity",
    };

    for (const supportedSignal of ["craft", "listening"]) {
      const selectedOpportunity: OpportunityHypothesis = {
        ...opportunity,
        supportingSignalIds: [
          `sig-m1-tag-${supportedSignal}`,
          `sig-p1-tag-${supportedSignal}`,
        ],
      };

      const spec = compileConceptFromOpportunity({
        opportunity: selectedOpportunity,
        mechanismId: "sonic_set",
        interpreted: objective,
        influences: entities,
      });

      expect(spec).not.toBeNull();

      const rules = spec!.operatingRules ?? [];
      const bindings = spec!.causalBindings ?? [];
      const ruleIds = new Set(rules.map((rule) => rule.id));
      const journeyIds = new Set(spec!.journey.map((step) => step.id));
      const evidenceIds = new Set(selectedOpportunity.evidenceIds);

      expect(rules.length).toBeGreaterThanOrEqual(2);
      expect(bindings.length).toBeGreaterThanOrEqual(2);

      for (const binding of bindings) {
        expect(binding.opportunityId).toBe(selectedOpportunity.id);
        expect(ruleIds.has(binding.operatingRuleId)).toBe(true);
        expect(binding.journeyStepIds.length).toBeGreaterThan(0);

        for (const stepId of binding.journeyStepIds) {
          expect(journeyIds.has(stepId)).toBe(true);
        }

        expect(binding.pilotMetricId.length).toBeGreaterThan(0);
        expect(spec!.pilotExperiment).toContain(binding.pilotMetricId);

        expect(binding.evidenceIds.length).toBeGreaterThan(0);

        for (const evidenceId of binding.evidenceIds) {
          expect(evidenceIds.has(evidenceId)).toBe(true);
        }
      }
    }
  });
});


describe("P1.1 rejects broken causal references", () => {
  it("rejects a binding referencing a nonexistent operating rule", () => {
    const objective: InterpretedObjective = {
      rawObjective: "Design a late-night hospitality experience for curious travelers",
      culturalInterest: "jazz",
      location: "Lisbon",
      outputCategory: "experience",
      intentTokens: ["jazz", "hospitality"],
      themes: ["sonic"],
      summary: "causal integrity adversarial test",
    };

    const spec = compileConceptFromOpportunity({
      opportunity,
      mechanismId: "sonic_set",
      interpreted: objective,
      influences: entities,
    });

    expect(spec).not.toBeNull();
    const bindings = spec?.causalBindings ?? [];
    expect(bindings.length).toBeGreaterThan(0);

    const corrupted = {
      ...spec!,
      causalBindings: bindings.map((binding, index) =>
        index === 0
          ? { ...binding, operatingRuleId: "nonexistent-rule-999" }
          : binding,
      ),
    };

    const report = runQualityGates({
      spec: corrupted,
      interpreted: objective,
      acceptedFingerprints: [],
      evidenceEntityIds: new Set(entities.map((entity) => entity.id)),
    });

    const integrity = report.checks.find(
      (check) => check.id === "causal_reference_integrity",
    );

    expect(integrity).toBeDefined();
    expect(integrity?.passed).toBe(false);
  });
});
