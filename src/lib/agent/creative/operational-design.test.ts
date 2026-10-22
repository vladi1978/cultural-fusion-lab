import { describe, expect, it } from "vitest";
import {
  generateOperationalDesign,
  OperationalDesignError,
} from "./operational-design";
import type { CreativeModel } from "./model";
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

describe("operational design quality gate", () => {
  it("rejects missing cultural transfers without proceeding", async () => {
    let calls = 0;

    const model: CreativeModel = {
      id: "offline-invalid-operational-design",
      async complete() {
        calls += 1;
        return JSON.stringify({
          transfers: [],
          crossCulturalDependency: "",
          removalConsequences: [],
          feasibilityUnknowns: [],
          pilotTest: "",
        });
      },
    };

    await expect(
      generateOperationalDesign({
        frame,
        objective: "Design a cross-cultural worker mobility experience",
        outputCategory: "experience",
        location: "Louisville",
        model,
      }),
    ).rejects.toThrow(OperationalDesignError);

    // Design generation now makes ONE corrective retry (with the allowed mechanisms listed) before failing,
    // mirroring the single repair attempt of composition. The invariant under test is unchanged:
    // an invalid design never reaches composition.
    expect(calls).toBe(2);
  });

  it("rejects invalid source mechanisms", async () => {
    const model: CreativeModel = {
      id: "offline-invented-mechanisms",
      async complete() {
        return JSON.stringify({
          transfers: [
            {
              sourceDomain: "Culture A",
              sourceMechanism: "Invented mechanism",
              operatingDecision: "The operator checks requirements before service.",
              participantAction: "Participants confirm their needs before assignment.",
              dependency: "The decision depends on anticipating participant needs.",
            },
            {
              sourceDomain: "Culture B",
              sourceMechanism: "Coordinate safety",
              operatingDecision: "The operator confirms a safety handoff.",
              participantAction: "Participants acknowledge the safety handoff.",
              dependency: "The decision depends on coordinated safety.",
            },
          ],
          crossCulturalDependency:
            "Anticipatory coordination and collective safety jointly determine whether service can proceed.",
          removalConsequences: [
            "Removing Culture A eliminates anticipatory coordination.",
            "Removing Culture B eliminates the safety handoff.",
          ],
          feasibilityUnknowns: ["Operator availability is unverified."],
          pilotTest:
            "Run a controlled pilot and record completed checks and handoffs.",
        });
      },
    };

    await expect(
      generateOperationalDesign({
        frame,
        objective: "Design a cross-cultural worker mobility experience",
        outputCategory: "experience",
        location: "Louisville",
        model,
      }),
    ).rejects.toThrow(OperationalDesignError);
  });
});
