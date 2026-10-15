import { describe, expect, it } from "vitest";

import { generateConceptCandidates } from "./concepts";
import { runQualityGates } from "./quality-gates";
import { synthesizeConceptCandidates } from "./synthesis";
import type { ConceptSpec } from "../types";
import { AgentError } from "./types";
import type { InterpretedObjective } from "./types";

const interpreted: InterpretedObjective = {
  rawObjective: "Prototype a hospitality experience for jazz culture",
  culturalInterest: "jazz",
  location: "Lisbon",
  outputCategory: "experience",
  intentTokens: ["hospitality", "jazz", "experience"],
  themes: ["hospitality", "sonic"],
  summary: "test",
};

const richEntities = [
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
    affinity: 0.7,
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
  {
    id: "f1",
    name: "Blue Hour",
    category: "film" as const,
    description: "night cinema",
    affinity: 0.6,
    tags: ["jazz", "night"],
  },
];

function baseEvidence(ids: string[]) {
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

function attrIndex(
  entities: typeof richEntities,
): Map<string, Set<string>> {
  return new Map(
    entities.map((e) => [
      e.id,
      new Set([e.category, ...e.tags.map((t) => t.toLowerCase())]),
    ]),
  );
}

describe("Engine V2 quality gates", () => {
  it("accepts one strong concept without padding", () => {
    const musicPair = richEntities.filter((e) => e.category === "music");
    const duo = [
      musicPair[0]!,
      {
        ...musicPair[0]!,
        id: "m2",
        name: "Second Quartet",
        tags: ["jazz", "listening"],
      },
    ];
    const { concepts } = generateConceptCandidates({
      interpreted,
      entities: duo,
      evidence: baseEvidence(duo.map((e) => e.id)),
      affinities: [],
      seedKey: "strong-one",
    });
    expect(concepts).toHaveLength(1);
    expect(concepts[0]!.spec?.rationales.length).toBeGreaterThanOrEqual(3);
  });

  it("rejects generic fluff via specificity gate", () => {
    const synthesized = synthesizeConceptCandidates({
      interpreted,
      entities: richEntities,
      seedKey: "gen",
    });
    const base = synthesized[0]!.spec;
    const generic: ConceptSpec = {
      ...base,
      proposition: "An innovative seamless cutting-edge jazz synergy experience",
      mechanics: "Elevate and unlock holistic synergy for guests.",
    };
    const gate = runQualityGates({
      spec: generic,
      interpreted,
      acceptedFingerprints: [],
      evidenceEntityIds: new Set(richEntities.map((e) => e.id)),
      entityAttributeIndex: attrIndex(richEntities),
    });
    expect(gate.accepted).toBe(false);
    expect(gate.failures.some((f) => f.startsWith("specificity"))).toBe(true);
  });

  it("rejects missing causal rationale coverage", () => {
    const synthesized = synthesizeConceptCandidates({
      interpreted,
      entities: richEntities,
      seedKey: "rat",
    });
    const base = synthesized[0]!.spec;
    const thin: ConceptSpec = {
      ...base,
      rationales: base.rationales.slice(0, 1),
    };
    const gate = runQualityGates({
      spec: thin,
      interpreted,
      acceptedFingerprints: [],
      evidenceEntityIds: new Set(richEntities.map((e) => e.id)),
      entityAttributeIndex: attrIndex(richEntities),
    });
    expect(gate.accepted).toBe(false);
    expect(gate.failures.some((f) => f.startsWith("rationale_coverage"))).toBe(
      true,
    );
  });

  it("rejects unsupported evidence entities and signals", () => {
    const synthesized = synthesizeConceptCandidates({
      interpreted,
      entities: richEntities,
      seedKey: "ev",
    });
    const base = synthesized[0]!.spec;
    const badEntity: ConceptSpec = {
      ...base,
      influenceMap: [
        ...base.influenceMap,
        {
          entityId: "invented-entity",
          entityName: "Invented",
          category: "other",
          role: "texture",
          signalsUsed: ["made-up"],
        },
      ],
    };
    const gateEntity = runQualityGates({
      spec: badEntity,
      interpreted,
      acceptedFingerprints: [],
      evidenceEntityIds: new Set(richEntities.map((e) => e.id)),
    });
    expect(gateEntity.accepted).toBe(false);
    expect(
      gateEntity.failures.some((f) => f.startsWith("evidence_entities")),
    ).toBe(true);

    const badSignal: ConceptSpec = {
      ...base,
      rationales: base.rationales.map((r, i) =>
        i === 0
          ? { ...r, attributeOrSignal: "totally-fabricated-affinity-score" }
          : r,
      ),
    };
    const gateSignal = runQualityGates({
      spec: badSignal,
      interpreted,
      acceptedFingerprints: [],
      evidenceEntityIds: new Set(richEntities.map((e) => e.id)),
      entityAttributeIndex: attrIndex(richEntities),
    });
    expect(gateSignal.accepted).toBe(false);
    expect(
      gateSignal.failures.some((f) => f.startsWith("evidence_signals")),
    ).toBe(true);
  });

  it("rejects duplicate mechanic fingerprints", () => {
    const synthesized = synthesizeConceptCandidates({
      interpreted,
      entities: richEntities,
      seedKey: "dup",
    });
    const first = synthesized[0]!.spec;
    const gate = runQualityGates({
      spec: first,
      interpreted,
      acceptedFingerprints: [first.mechanicFingerprint],
      evidenceEntityIds: new Set(richEntities.map((e) => e.id)),
      entityAttributeIndex: attrIndex(richEntities),
    });
    expect(gate.accepted).toBe(false);
    expect(
      gate.failures.some((f) => f.startsWith("mechanic_differentiation")),
    ).toBe(true);
  });

  it("preserves frozen objective and output category", () => {
    const { concepts } = generateConceptCandidates({
      interpreted,
      entities: richEntities,
      evidence: baseEvidence(richEntities.map((e) => e.id)),
      affinities: [],
      seedKey: "freeze",
    });
    for (const c of concepts) {
      expect(c.spec?.frozenObjective).toBe(interpreted.rawObjective);
      expect(c.spec?.frozenOutputCategory).toBe("experience");
      expect(c.outputCategory).toBe("experience");
    }
  });

  it("returns INSUFFICIENT_QUALITY when no candidates can form", () => {
    expect(() =>
      generateConceptCandidates({
        interpreted,
        entities: [richEntities[0]!],
        evidence: baseEvidence(["m1"]),
        affinities: [],
        seedKey: "empty",
      }),
    ).toThrow(AgentError);

    try {
      generateConceptCandidates({
        interpreted,
        entities: [richEntities[0]!],
        evidence: baseEvidence(["m1"]),
        affinities: [],
        seedKey: "empty",
      });
    } catch (err) {
      expect(err).toMatchObject({
        name: "AgentError",
        code: "EMPTY_EVIDENCE",
      });
    }
  });
});
