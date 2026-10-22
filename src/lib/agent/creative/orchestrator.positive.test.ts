import { describe, expect, it } from "vitest";
import { runExplorationAgent } from "../orchestrator";
import { createMockFixtureSource } from "../fixtures/agent-mock-fixtures";
import type { ConceptSpec, CulturalEntity, EvidenceItem } from "../../types";
import type { CreativeModel, CreativeModelRequest } from "./model";

const request = {
  creativeObjective: "Design a participatory Shinrin-yoku and Nordic sauna experience with sequence, intensity and social choices",
  culturalInterest: "Shinrin-yoku and Nordic sauna",
  location: "Seattle",
  outputCategory: "experience" as const,
  mode: "demo" as const,
};
const frame = {
  sourceDomains: [
    { name: "Shinrin-yoku", origin: "Japan", essence: "sensory nature attention", coreMechanics: ["slow sensory attention", "guided forest observation"] },
    { name: "Nordic sauna", origin: "Nordic countries", essence: "thermal recovery", coreMechanics: ["heat cooling cycles", "rest between sauna rounds"] },
  ],
  experientialGoals: ["reduce stress through participatory recovery"],
  requirements: ["Choices change sequence, intensity, and social dynamics"],
  offBrief: ["Generic music festival", "Clothing customization"],
  evidenceProbes: [
    { query: "Shinrin-yoku forest", entityType: "urn:entity:place", why: "explore forest setting" },
    { query: "Nordic sauna", entityType: "urn:entity:brand", why: "explore sauna context" },
  ],
};
const entities: CulturalEntity[] = [
  { id: "mock-forest", name: "Mock Shinrin-yoku Forest Center", category: "places", description: "Fictional forest venue used for testing guided sensory attention", affinity: 0.5, tags: ["Shinrin-yoku", "forest", "sensory", "guided"] },
  { id: "mock-sauna", name: "Mock Nordic Sauna Studio", category: "brands", description: "Fictional sauna fixture used for testing heat cooling cycles", affinity: 0.5, tags: ["Nordic", "sauna", "heat", "cooling"] },
  { id: "mock-recovery", name: "Mock Shinrin-yoku Nordic Recovery Program", category: "places", description: "Fictional Shinrin-yoku and Nordic sauna program for testing guided observation and recovery", affinity: 0.5, tags: ["Shinrin-yoku", "Nordic", "sauna", "forest", "recovery"] },
];
const evidence: EvidenceItem[] = [
  { id: "ev-forest", source: "mock_demo", label: "Fictional forest entity", detail: "Mock fixture, not verified Qloo evidence", relatedEntityIds: ["mock-forest"], createdAt: "2026-10-20T00:00:00.000Z" },
  { id: "ev-sauna", source: "mock_demo", label: "Fictional sauna entity", detail: "Mock fixture, not verified Qloo evidence", relatedEntityIds: ["mock-sauna"], createdAt: "2026-10-20T00:00:00.000Z" },
  { id: "ev-recovery", source: "mock_demo", label: "Fictional recovery program", detail: "Mock fixture, not verified Qloo evidence", relatedEntityIds: ["mock-recovery"], createdAt: "2026-10-20T00:00:00.000Z" },
];
const concept: Omit<ConceptSpec, "frozenObjective" | "frozenOutputCategory"> = {
  name: "Forest Thermal Choices",
  proposition: "A hosted experience combining guided forest observation with sauna recovery, where each participant chooses a personal route and social setting.",
  audience: "Adults seeking a participatory wellness experience",
  context: "A fictional Seattle forest and sauna pilot venue",
  mechanics: "The host offers two sequence options: begin with slow sensory attention and guided forest observation or begin with a supervised sauna orientation. Participants choose intensity for heat cooling cycles and select a social setting (quiet solo or facilitated small group). After each heat round, rest between sauna rounds is mandatory. Each option changes the timed itinerary and group assignment; the host records participant decisions and adjusts the session accordingly.",
  journey: [
    { id: "arrival", actor: "host", action: "At arrival, choose sequence: guided forest observation with slow sensory attention first, or sauna orientation first; record the participant's chosen route.", influenceEntityIds: ["mock-forest", "mock-sauna"] },
    { id: "thermal", actor: "participant", action: "Choose intensity of supervised heat cooling cycles and rest between sauna rounds; a facilitator adjusts the duration and offers a non-heat alternative.", influenceEntityIds: ["mock-sauna"] },
    { id: "social", actor: "participant", action: "Select social setting: quiet solo sensory observation or guided small-group reflection; the host changes the group assignment and closing session.", influenceEntityIds: ["mock-forest", "mock-sauna"] },
  ],
  influenceMap: [
    { entityId: "mock-forest", entityName: "Mock Shinrin-yoku Forest Center", category: "places", role: "hinge", signalsUsed: ["forest", "sensory"] },
    { entityId: "mock-sauna", entityName: "Mock Nordic Sauna Studio", category: "brands", role: "constraint", signalsUsed: ["sauna", "heat"] },
  ],
  rationales: [
    { id: "r-arrival", featureId: "arrival", featureDescription: "Choice of first stage", influenceEntityId: "mock-forest", attributeOrSignal: "forest", creativeInterpretation: "The observed mock forest tag motivates a creative design hypothesis for a forest-first route.", whyItProducesMechanic: "The observed fixture suggests a setting; choosing route order is a creative design hypothesis, not a verified cultural claim." },
    { id: "r-thermal", featureId: "thermal", featureDescription: "Choice of thermal intensity", influenceEntityId: "mock-sauna", attributeOrSignal: "heat", creativeInterpretation: "The observed mock heat tag motivates a creative design hypothesis for adjustable thermal stages.", whyItProducesMechanic: "The observed mock tag anchors the proposed heat stage but does not establish safety or cultural prevalence." },
    { id: "r-social", featureId: "social", featureDescription: "Choice of social participation", influenceEntityId: "mock-forest", attributeOrSignal: "sensory", creativeInterpretation: "The observed mock sensory tag inspires a creative design hypothesis for optional group reflection.", whyItProducesMechanic: "The observed mock attribute supports only a design exploration, not evidence of participant preferences." },
    { id: "r-mechanic", featureId: "operating_mechanic", featureDescription: "Timed recovery rule", influenceEntityId: "mock-sauna", attributeOrSignal: "sauna", creativeInterpretation: "The observed mock sauna tag motivates a creative design hypothesis for timed recovery.", whyItProducesMechanic: "The observed mock fixture informs the pilot context, not verified sauna safety protocols." },
  ],
  differentiationHypothesis: "Changing route order, thermal intensity and social participation may produce a more adaptable hosted experience; not validated.",
  feasibilityAssumptions: ["A qualified operator and appropriate site permissions are available for a controlled pilot."],
  risksAndUnknowns: ["Heat exposure and participant safety require qualified professional oversight.", "Cultural interpretation must be reviewed with practitioners; mock entities cannot establish authenticity."],
  pilotExperiment: "Run a supervised pilot session with consenting adults; observe chosen sequence, count intensity adjustments and survey perceived agency after each session.",
  evidenceBoundary: "Creative hypothesis using fictional mock demo entities; no Qloo evidence, demand or safety validation.",
  mechanicFingerprint: "forest-thermal-choice-routing-v1",
  mechanismId: "participatory_thermal_routing",
};

describe("positive objective-first orchestrator replay (offline)", () => {
  it("accepts a culturally operational concept with distinct participant choices and mock-evidence provenance", async () => {
    const calls: CreativeModelRequest[] = [];
    const source = createMockFixtureSource({ entities, evidence });
    const model: CreativeModel = {
      id: "positive-replay-no-network",
      async complete(call) {
        calls.push(call);
        if (call.stage === "frame") return JSON.stringify(frame);
        if (call.stage === "compose") return JSON.stringify({ concepts: [concept] });
        throw new Error(`Unexpected model stage: ${call.stage}`);
      },
    };
    const result = await runExplorationAgent(request, { source, creativeModel: model, now: () => "2026-10-20T00:00:00.000Z" });
    expect(calls.map(c => c.stage)).toEqual(["frame", "compose"]);
    expect(result.agentTrace.plan!.searches.map(s => s.query)).toEqual(["Shinrin-yoku forest", "Nordic sauna"]);
    expect(result.concepts).toHaveLength(1);
    const accepted = result.concepts[0];
    expect(accepted.title).toBe("Forest Thermal Choices");
    expect(accepted.qualityGate!.accepted).toBe(true);
    expect(accepted.spec?.journey).toHaveLength(3);
    expect(accepted.culturalInfluences.map(e => e.id).sort()).toEqual(["mock-forest", "mock-sauna"]);
    expect(accepted.evidenceIds).toContain("ev-forest");
    expect(accepted.evidenceIds).toContain("ev-sauna");
    expect(result.agentTrace.engine).toBe("creative-llm-v1");
    expect(result.disclaimer).toMatch(/demo|mock|fictional/i);
    expect(result.agentTrace.quality!.candidatesAccepted).toBe(1);
  });
});
