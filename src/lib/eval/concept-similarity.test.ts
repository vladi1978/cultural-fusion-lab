import { describe, expect, it } from "vitest";
import type { FusionConcept } from "../types";
import {
  auditConceptSimilarity,
  compareConcepts,
} from "./concept-similarity";

function concept(
  id: string,
  title: string,
  proposition: string,
  mechanics: string,
  journey: string[],
): FusionConcept {
  return {
    id,
    title,
    positioning: mechanics,
    outputCategory: "experience",
    culturalInfluences: [],
    evidenceIds: [],
    summary: proposition,
    spec: {
      name: title,
      proposition,
      audience: "Urban culture enthusiasts",
      context: "City",
      journey: journey.map((action, index) => ({
        id: `step-${index}`,
        actor: "participant",
        action,
        influenceEntityIds: [],
      })),
      mechanics,
      influenceMap: [],
      differentiationHypothesis: proposition,
      feasibilityAssumptions: [],
      risksAndUnknowns: [],
      pilotExperiment: "",
      evidenceBoundary: "",
      rationales: [],
      frozenObjective: "",
      frozenOutputCategory: "experience",
      mechanicFingerprint: `fingerprint-${id}`,
      mechanismId: `mechanism-${id}`,
    },
  };
}

describe("P1.16-B independent concept similarity audit", () => {
  it("flags identical operating ideas despite different names and IDs", () => {
    const a = concept(
      "jazz-1",
      "Jazz Night Circuit",
      "Participants discover hidden cultural spaces through a guided city route",
      "Guests receive a location card and unlock the next cultural stop after completing each activity",
      ["Receive route card", "Visit cultural stop", "Unlock next stop"],
    );

    const b = concept(
      "coffee-2",
      "Coffee City Discovery",
      "Participants discover hidden cultural spaces through a guided city route",
      "Guests receive a location card and unlock the next cultural stop after completing each activity",
      ["Receive route card", "Visit cultural stop", "Unlock next stop"],
    );

    const result = compareConcepts(a, b, ["jazz", "coffee"]);

    expect(result.flagged).toBe(true);
    expect(result.overall).toBeGreaterThan(0.9);
  });

  it("does not flag clearly different operating ideas", () => {
    const a = concept(
      "a",
      "Night Route",
      "Visitors navigate a neighborhood discovery trail",
      "Participants unlock venue locations after completing walking challenges",
      ["Explore district", "Find venue", "Complete challenge"],
    );

    const b = concept(
      "b",
      "Material Exchange",
      "Designers exchange modular garment components",
      "Members trade fabric panels and assemble personalized clothing",
      ["Select garment", "Trade textile panels", "Assemble clothing"],
    );

    expect(compareConcepts(a, b).flagged).toBe(false);
  });

  it("audits every unique pair", () => {
    const a = concept("1", "One", "Alpha", "Alpha", ["Alpha"]);
    const b = concept("2", "Two", "Beta", "Beta", ["Beta"]);
    const c = concept("3", "Three", "Gamma", "Gamma", ["Gamma"]);

    expect(auditConceptSimilarity([a, b, c])).toHaveLength(3);
  });
});
