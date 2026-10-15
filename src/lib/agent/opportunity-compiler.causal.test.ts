import { describe, expect, it } from "vitest";

import type { CulturalEntity } from "../types";
import { identifyAffinities } from "./affinities";
import { generateConceptCandidates } from "./concepts";
import { compileConceptFromOpportunity } from "./opportunity-compiler";
import { selectableOpportunities } from "./opportunity-gates";
import { runQualityGates } from "./quality-gates";
import { createDeterministicReasoningProvider } from "./reasoning/deterministic";
import type { InterpretedObjective } from "./types";

const provider = createDeterministicReasoningProvider();

const interpreted: InterpretedObjective = {
  rawObjective:
    "Design a late-night hospitality experience for curious travelers",
  culturalInterest: "jazz",
  location: "Lisbon",
  outputCategory: "experience",
  intentTokens: ["jazz", "hospitality"],
  themes: ["sonic"],
  summary: "causal",
};

function evidence(entities: { id: string }[]) {
  return [
    {
      id: "ev",
      source: "mock_demo" as const,
      label: "b",
      detail: "d",
      relatedEntityIds: entities.map((e) => e.id),
      createdAt: "2026-10-11T00:00:00.000Z",
    },
  ];
}

function stripMeta(s: string): string {
  return s
    .replace(/Opportunity lens[\s\S]*$/i, "")
    .replace(/Opportunity cue:[^.]*\./gi, "")
    .replace(/Mid beat applies[^.]+\./gi, "")
    .trim();
}

describe("P1.1 causal opportunity compiler", () => {
  it("listening×places vs craft×brands differ materially (not wording)", () => {
    const listeningEntities = [
      {
        id: "m1",
        name: "Harbor Quartet",
        category: "music" as const,
        description: "listening set",
        affinity: 0.8,
        tags: ["jazz", "listening", "night"],
      },
      {
        id: "p1",
        name: "Canal Room",
        category: "places" as const,
        description: "listening room",
        affinity: 0.75,
        tags: ["jazz", "listening", "intimate"],
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
    const craftEntities = [
      {
        id: "m1",
        name: "Harbor Quartet",
        category: "music" as const,
        description: "atelier set",
        affinity: 0.8,
        tags: ["jazz", "craft", "atelier"],
      },
      {
        id: "b1",
        name: "Vinyl Clay",
        category: "brands" as const,
        description: "craft label",
        affinity: 0.7,
        tags: ["jazz", "craft", "retail"],
      },
      {
        id: "f1",
        name: "Blue Hour",
        category: "film" as const,
        description: "night cinema",
        affinity: 0.65,
        tags: ["jazz", "night", "documentary"],
      },
    ];

    const run = (entities: CulturalEntity[], seed: string) => {
      const ev = evidence(entities);
      const affinities = identifyAffinities({
        entities,
        evidence: ev,
        provenanceByEntityId: Object.fromEntries(
          entities.map((e) => [e.id, "mock_demo" as const]),
        ),
      });
      const graph = provider.buildSignalGraph({
        entities,
        evidence: ev,
        affinities,
        conflicts: [],
        provenanceByEntityId: Object.fromEntries(
          entities.map((e) => [e.id, "mock_demo" as const]),
        ),
        mode: "demo",
        culturalInterest: "jazz",
      });
      const selected = selectableOpportunities(
        provider.gateOpportunities({
          opportunities: provider.proposeOpportunities({ graph, interpreted }),
          interpreted,
          graph,
        }),
      );
      return generateConceptCandidates({
        interpreted,
        entities,
        evidence: ev,
        affinities,
        seedKey: seed,
        opportunities: selected,
      });
    };

    const A = run(listeningEntities, "listen");
    const B = run(craftEntities, "craft");

    const a = A.concepts.find((c) => c.spec?.opportunityId)?.spec;
    const b = B.concepts.find((c) => c.spec?.opportunityId)?.spec;
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();

    expect(a!.operatingProgramId).toBe("acoustic_spatial");
    expect(b!.operatingProgramId).toBe("craft_cocreate");
    expect(a!.operatingProgramFingerprint).not.toEqual(
      b!.operatingProgramFingerprint,
    );

    // Material fields — not names/traces alone
    expect(a!.mechanics).not.toEqual(b!.mechanics);
    expect(a!.proposition).not.toEqual(b!.proposition);
    expect(a!.pilotExperiment).not.toEqual(b!.pilotExperiment);
    expect(a!.mechanics).toMatch(/listen gate|listening/i);
    expect(b!.mechanics).toMatch(/make|assemble|checkpoint|craft/i);
    expect(a!.pilotExperiment).toMatch(/listen gate|listening/i);
    expect(b!.pilotExperiment).toMatch(/checkpoint|co-create|craft|make/i);

    const aJourney = a!.journey.map((j) => stripMeta(j.action)).join("|");
    const bJourney = b!.journey.map((j) => stripMeta(j.action)).join("|");
    expect(aJourney).not.toEqual(bJourney);
    expect(aJourney).toMatch(/listen gate|zone/i);
    expect(bJourney).toMatch(/assemble|checkpoint|make/i);

    // Typed causal bindings — not keyword-only proof
    expect(a!.causalBindings!.length).toBeGreaterThanOrEqual(2);
    expect(b!.causalBindings!.length).toBeGreaterThanOrEqual(2);
    expect(
      a!.causalBindings!.every((bind) => bind.journeyStepIds.length >= 1),
    ).toBe(true);
  });

  it("no-opportunity counterfactual removes specialized operating program", () => {
    const entities = [
      {
        id: "m1",
        name: "Harbor Quartet",
        category: "music" as const,
        description: "listening set",
        affinity: 0.8,
        tags: ["jazz", "listening", "night"],
      },
      {
        id: "p1",
        name: "Canal Room",
        category: "places" as const,
        description: "listening room",
        affinity: 0.75,
        tags: ["jazz", "listening", "intimate"],
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
    const ev = evidence(entities);
    const affinities = identifyAffinities({
      entities,
      evidence: ev,
      provenanceByEntityId: Object.fromEntries(
        entities.map((e) => [e.id, "mock_demo" as const]),
      ),
    });
    const graph = provider.buildSignalGraph({
      entities,
      evidence: ev,
      affinities,
      conflicts: [],
      provenanceByEntityId: Object.fromEntries(
        entities.map((e) => [e.id, "mock_demo" as const]),
      ),
      mode: "demo",
      culturalInterest: "jazz",
    });
    const selected = selectableOpportunities(
      provider.gateOpportunities({
        opportunities: provider.proposeOpportunities({ graph, interpreted }),
        interpreted,
        graph,
      }),
    );

    const withOpp = generateConceptCandidates({
      interpreted,
      entities,
      evidence: ev,
      affinities,
      seedKey: "cf",
      opportunities: selected,
    });
    const without = generateConceptCandidates({
      interpreted,
      entities,
      evidence: ev,
      affinities,
      seedKey: "cf",
      opportunities: [],
    });

    const driven = withOpp.concepts.find((c) => c.spec?.opportunityId)?.spec;
    expect(driven?.operatingProgramId).toBe("acoustic_spatial");
    expect(driven?.mechanics).toMatch(/listen gate/i);

    // Catalog clone of same specialized program must not appear without opportunity
    expect(
      without.concepts.every(
        (c) => c.spec?.operatingProgramId !== "acoustic_spatial",
      ),
    ).toBe(true);
    expect(
      without.concepts.every((c) => !c.spec?.opportunityId),
    ).toBe(true);

    // Catalog sonic_set (if present) must not equal opportunity mechanics
    const catalogSonic = without.concepts.find(
      (c) => c.spec?.mechanismId === "sonic_set",
    )?.spec;
    if (catalogSonic && driven) {
      expect(catalogSonic.mechanics).not.toEqual(driven.mechanics);
      expect(catalogSonic.pilotExperiment).not.toEqual(driven.pilotExperiment);
      expect(catalogSonic.mechanics).not.toMatch(/listen gate/i);
    }
  });

  it("rejects superficial framing without compiled program bindings", () => {
    const fake = {
      name: "Jazz Session",
      proposition: "An experience where jazz is scored as phrase → break → reprise.",
      audience:
        "Listeners. Opportunity lens (complementarity hypothesis): jointly legible.",
      context: "x",
      journey: [
        {
          id: "step-1",
          actor: "Host",
          action: "Start. Opportunity cue: open with observed jazz.",
          influenceEntityIds: ["m1"],
        },
        {
          id: "step-2",
          actor: "Guest",
          action: "Hold. Mid beat applies the opportunity design implication (complementarity).",
          influenceEntityIds: ["m1"],
        },
        {
          id: "step-3",
          actor: "Host",
          action: "Close.",
          influenceEntityIds: ["m1"],
        },
      ],
      mechanics: "Time-boxed phrases. Participation is listen/respond within the set. Layout is secondary to arrangement.",
      influenceMap: [
        {
          entityId: "m1",
          entityName: "A",
          category: "music" as const,
          role: "hinge" as const,
          signalsUsed: ["jazz"],
        },
        {
          entityId: "p1",
          entityName: "B",
          category: "places" as const,
          role: "texture" as const,
          signalsUsed: ["jazz"],
        },
      ],
      differentiationHypothesis: "Differs somehow.",
      feasibilityAssumptions: ["Hosts can run it."],
      risksAndUnknowns: ["Unknown transfer.", "No demand evidence."],
      pilotExperiment:
        "Run a 90-minute pilot with 8–12 guests; count completed steps; median clarity ≥3.",
      evidenceBoundary: "Hypothesis only — mock demo creative interpretation.",
      rationales: [
        {
          id: "r1",
          featureId: "operating_mechanics",
          featureDescription: "Time-boxed phrases for operating mechanics detail here.",
          influenceEntityId: "m1",
          attributeOrSignal: "jazz",
          creativeInterpretation:
            "Supported category reading. Creative design hypothesis: treat as OS.",
          whyItProducesMechanic:
            "Observed attribute jazz implies sonic set progression rules for teachable pilots.",
        },
        {
          id: "r2",
          featureId: "step-1",
          featureDescription: "Start phrase",
          influenceEntityId: "m1",
          attributeOrSignal: "jazz",
          creativeInterpretation: "Creative design hypothesis: opening inherits hinge.",
          whyItProducesMechanic: "Binding step 1 to hinge keeps journey non-interchangeable.",
        },
        {
          id: "r3",
          featureId: "step-2",
          featureDescription: "Mid",
          influenceEntityId: "m1",
          attributeOrSignal: "jazz",
          creativeInterpretation: "Creative design hypothesis: mid keeps mechanism family.",
          whyItProducesMechanic: "Repeating hinge rule mid-journey makes mechanic teachable.",
        },
      ],
      frozenObjective: interpreted.rawObjective,
      frozenOutputCategory: "experience" as const,
      mechanicFingerprint: "sonic_set|experience|music|jazz|x|opp:complementarity:opp-x",
      mechanismId: "sonic_set",
      opportunityId: "opp-x",
      opportunityKind: "complementarity" as const,
      opportunityTrace: {
        opportunityId: "opp-x",
        opportunityKind: "complementarity" as const,
        steps: [
          {
            stage: "observed_signal" as const,
            label: "o",
            detail: "d",
            hypothesis: false,
            evidenceIds: ["ev"],
          },
          {
            stage: "opportunity_hypothesis" as const,
            label: "o",
            detail: "d",
            hypothesis: true,
            evidenceIds: ["ev"],
          },
          {
            stage: "design_decision" as const,
            label: "o",
            detail: "d",
            hypothesis: true,
            evidenceIds: ["ev"],
          },
          {
            stage: "concept_mechanism" as const,
            label: "o",
            detail: "d",
            hypothesis: true,
            evidenceIds: ["ev"],
          },
          {
            stage: "proposed_pilot" as const,
            label: "o",
            detail: "d",
            hypothesis: true,
            evidenceIds: ["ev"],
          },
        ],
      },
    };

    const gate = runQualityGates({
      spec: fake,
      interpreted,
      acceptedFingerprints: [],
      evidenceEntityIds: new Set(["m1", "p1"]),
    });
    expect(gate.accepted).toBe(false);
    expect(
      gate.failures.some(
        (f) =>
          f.startsWith("operating_program") ||
          f.startsWith("causal_journey_bindings") ||
          f.startsWith("no_superficial_framing"),
      ),
    ).toBe(true);
  });

  it("compileConceptFromOpportunity produces bindings and program fingerprint", () => {
    const entities = [
      {
        id: "m1",
        name: "Harbor Quartet",
        category: "music" as const,
        description: "listening",
        affinity: 0.8,
        tags: ["jazz", "listening"],
      },
      {
        id: "p1",
        name: "Canal Room",
        category: "places" as const,
        description: "listening",
        affinity: 0.7,
        tags: ["jazz", "listening", "intimate"],
      },
    ];
    const opp = {
      id: "opp-test",
      kind: "complementarity" as const,
      title: "music × places complementarity (listening)",
      supportingEntityIds: ["m1", "p1"],
      supportingSignalIds: ["sig-m1-tag-listening", "sig-p1-tag-listening"],
      whyCreativelyUseful:
        "Hypothesis: listening may combine creatively across music and places.",
      designImplication:
        "Design implication: shape the experience via sonic_set so listening gates appear in the journey.",
      uncertainty: "Not verified affinity.",
      unsupportedAssumptions: ["No demand."],
      evidenceIds: ["ev"],
      suggestedMechanismId: "sonic_set" as const,
      status: "accepted" as const,
      relationshipIds: [],
    };
    const spec = compileConceptFromOpportunity({
      opportunity: opp,
      mechanismId: "sonic_set",
      interpreted,
      influences: entities,
    });
    expect(spec).toBeTruthy();
    expect(spec!.operatingProgramId).toBe("acoustic_spatial");
    expect(spec!.causalBindings!.length).toBeGreaterThanOrEqual(2);
    expect(spec!.operatingRules!.length).toBeGreaterThanOrEqual(2);
    expect(spec!.pilotExperiment).toContain(spec!.causalBindings![0]!.pilotMetricId);
  });
});
