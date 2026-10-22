import { describe, expect, it } from "vitest";
import { runExplorationAgent } from "../orchestrator";
import { createMockFixtureSource } from "../fixtures/agent-mock-fixtures";
import { CreativeCompositionError } from "./compose";
import type { CreativeModel, CreativeModelRequest } from "./model";
import type { CulturalEvidenceSource } from "../types";

const request = {
  creativeObjective: "Design a participatory jazz listening and late-night hospitality experience with participant choices",
  culturalInterest: "jazz",
  location: "Lisbon",
  outputCategory: "experience" as const,
  mode: "demo" as const,
};

const frame = {
  sourceDomains: [
    { name: "Jazz listening", origin: "Jazz tradition", essence: "attentive listening", coreMechanics: ["guided listening", "call response"] },
    { name: "Night hospitality", origin: "Lisbon night venues", essence: "hosted social encounter", coreMechanics: ["hosted welcome", "shared table"] },
  ],
  experientialGoals: ["participate in a hosted listening experience"],
  requirements: ["Participant choices affect sequence and social dynamics"],
  offBrief: ["Generic music festival", "Clothing customization"],
  evidenceProbes: [
    { query: "jazz listening", entityType: "urn:entity:artist", why: "ground listening" },
    { query: "Lisbon hospitality", entityType: "urn:entity:place", why: "ground hosted experience" },
  ],
};

function badConcept(mechanics: string) {
  return {
    name: "Rejected replay candidate", proposition: "A proposed experience", audience: "travelers", context: "Lisbon",
    mechanics, journey: [{ id: "step1", actor: "visitor", action: "Visit a listening booth", influenceEntityIds: [] }],
    influenceMap: [], rationales: [], differentiationHypothesis: "unverified", feasibilityAssumptions: [],
    risksAndUnknowns: [], pilotExperiment: "small pilot", evidenceBoundary: "unverified hypothesis",
    mechanicFingerprint: "e2e-replay", mechanismId: "replay",
  };
}

function modelFor(compose: unknown, calls: CreativeModelRequest[]): CreativeModel {
  return {
    id: "e2e-replay-no-network",
    async complete(call) {
      calls.push(call);
      if (call.stage === "frame") return JSON.stringify(frame);
      if (call.stage === "compose") return JSON.stringify({ concepts: [compose] });
      throw new Error(`Unexpected model stage: ${call.stage}`);
    },
  };
}

describe("objective-first orchestration adversarial E2E (offline)", () => {
  it("runs frame → frame-derived search → demo collection → composition and rejects an off-brief candidate", async () => {
    const calls: CreativeModelRequest[] = [];
    const fixture = createMockFixtureSource();
    let observedQueries: string[] = [];
    let collected = false;
    const source: CulturalEvidenceSource = {
      ...fixture,
      async collect(ctx) {
        collected = true;
        observedQueries = ctx.plan.searches.map(s => s.query);
        return fixture.collect(ctx);
      },
    };
    await expect(runExplorationAgent(request, {
      source,
      creativeModel: modelFor(badConcept("Generic music festival featuring jazz playlists and apparel sales"), calls),
      now: () => "2026-10-20T00:00:00.000Z",
    })).rejects.toThrow(CreativeCompositionError);
    expect(collected).toBe(true);
    expect(observedQueries).toEqual(["jazz listening", "Lisbon hospitality"]);
    expect(calls.map(c => c.stage)).toEqual(["frame", "compose"]);
    expect(calls[1].user).toContain('"sourceDomains"');
    expect(calls[1].user).toContain('"collectedEvidence"');
  });

  it("stops before collection when the creative frame is invalid even after its repair retry", async () => {
    let collectionCalls = 0;
    const fixture = createMockFixtureSource();
    const source: CulturalEvidenceSource = {
      ...fixture,
      async collect(ctx) { collectionCalls++; return fixture.collect(ctx); },
    };
    const calls: CreativeModelRequest[] = [];
    const model: CreativeModel = {
      id: "invalid-frame-replay",
      async complete(call) { calls.push(call); return JSON.stringify({ sourceDomains: [] }); },
    };
    await expect(runExplorationAgent(request, { source, creativeModel: model })).rejects.toThrow();
    expect(calls.map(c => c.stage)).toEqual(["frame", "frame"]);
    expect(collectionCalls).toBe(0);
  });
});
