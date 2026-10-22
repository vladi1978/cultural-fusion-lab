import { describe, expect, it } from "vitest";
import { composeCreativeConcepts, CreativeCompositionError } from "./compose";
import type { CreativeModel, CreativeModelRequest } from "./model";
import type { CreativeFrame } from "./types";

const frame: CreativeFrame = {
  sourceDomains: [
    {
      name: "Culture A",
      origin: "Region A",
      essence: "Anticipatory coordination",
      coreMechanics: ["Anticipate needs"],
    },
    {
      name: "Culture B",
      origin: "Region B",
      essence: "Collective reliability",
      coreMechanics: ["Coordinate safety"],
    },
  ],
  experientialGoals: ["Improve reliability"],
  requirements: ["Serve workers"],
  offBrief: [],
  evidenceProbes: [],
};

describe("corrective creative composition", () => {
  it("makes at most one repair attempt and preserves rejection", async () => {
    const calls: CreativeModelRequest[] = [];

    const model: CreativeModel = {
      id: "offline-repair-test",
      async complete(call) {
        calls.push(call);
        if (call.stage === "operational_design") {
          return JSON.stringify({
            transfers: [
              {
                sourceDomain: "Culture A",
                sourceMechanism: "Anticipate needs",
                operatingDecision: "The operator checks participant needs before assigning service.",
                participantAction: "Participants confirm requirements before receiving an assignment.",
                dependency: "The assignment depends on anticipating needs before service delivery.",
              },
              {
                sourceDomain: "Culture B",
                sourceMechanism: "Coordinate safety",
                operatingDecision: "The operator confirms a coordinated safety handoff before departure.",
                participantAction: "Participants acknowledge the safety handoff before departure.",
                dependency: "Departure depends on coordinated safety decisions among participants.",
              },
            ],
            crossCulturalDependency: "Anticipated needs determine the assignment while coordinated safety determines whether that assignment can proceed.",
            removalConsequences: [
              "Without anticipating needs, assignments would not reflect participant requirements.",
              "Without coordinated safety, assignments would lack the departure handoff.",
            ],
            feasibilityUnknowns: ["Whether operators can complete both checks."],
            pilotTest: "Run a supervised pilot and measure completed checks, failed handoffs and participant feedback.",
          });
        }
        return JSON.stringify({
          concepts: [{
            name: "Incomplete concept",
            proposition: "An unsupported concept",
          }],
        });
      },
    };

    await expect(
      composeCreativeConcepts({
        frame,
        interpreted: {
          rawObjective: "Design a culturally informed experience",
          culturalInterest: "Culture A and Culture B",
          location: "Test location",
          outputCategory: "experience",
        } as Parameters<typeof composeCreativeConcepts>[0]["interpreted"],
        entities: [],
        evidence: [],
        model,
        fidelityPolicy: "triage",
      }),
    ).rejects.toThrow(CreativeCompositionError);

    expect(calls).toHaveLength(3);
    expect(calls.filter(c =>
      c.stage === "operational_design"
    )).toHaveLength(1);
    expect(calls.map(call => call.stage).join(",") ===
      "operational_design,compose,compose").toBe(true);

    const secondRequest = JSON.parse(calls[2].user);
    expect(secondRequest.repairFeedback).toContain("incomplete ConceptSpec");
    expect(secondRequest.repairInstruction).toContain("Revise the supplied rejectedDraft");
    expect(typeof secondRequest.rejectedDraft).toBe("string");
    expect(secondRequest.rejectedDraft.length).toBeGreaterThan(0);
    expect(secondRequest.rejectedDraft).toContain("concepts");
  });
});
