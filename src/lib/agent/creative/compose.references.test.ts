import { describe, expect, it } from "vitest";
import { composeCreativeConcepts, CreativeCompositionError } from "./compose";
import type { ConceptSpec, CulturalEntity, EvidenceItem } from "../../types";
import type { CreativeModel, CreativeModelRequest } from "./model";
import type { InterpretedObjective } from "../types";
import type { CreativeFrame } from "./types";

const request = {
  creativeObjective: "Design a participatory Shinrin-yoku and Nordic sauna experience with sequence, intensity and social choices",
  culturalInterest: "Shinrin-yoku and Nordic sauna",
  location: "Seattle",
  outputCategory: "experience" as const,
  mode: "demo" as const,
};
const frame: CreativeFrame = {
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



const interpreted: InterpretedObjective = {
  rawObjective: request.creativeObjective, culturalInterest: request.culturalInterest, location: request.location,
  outputCategory: "experience", intentTokens: [], themes: [], summary: "test",
};
const design = {
  transfers: [
    { sourceDomain: "Shinrin-yoku", sourceMechanism: "slow sensory attention",
      operatingDecision: "The host offers a slower observation stage before the participant proceeds to thermal recovery.",
      participantAction: "The participant chooses whether sensory observation happens before or after the sauna orientation.",
      dependency: "Requires a suitable observation setting and a facilitator able to adjust the session sequence." },
    { sourceDomain: "Nordic sauna", sourceMechanism: "heat cooling cycles",
      operatingDecision: "The host schedules supervised thermal stages with rest periods and adjustable intensity.",
      participantAction: "The participant chooses an intensity option and confirms readiness before the next supervised stage.",
      dependency: "Requires qualified supervision, appropriate facilities and an individual safety assessment." },
  ],
  crossCulturalDependency: "The sensory observation stage informs the participant's preferred pace, while the supervised thermal sequence determines which adjustments are feasible and safe; together they determine the actual session itinerary.",
  removalConsequences: [
    "Without sensory observation, the participant loses the reflective pacing mechanism that informs the session sequence.",
    "Without supervised thermal recovery, the itinerary loses its structured recovery stages and intensity decisions.",
  ],
  feasibilityUnknowns: ["Whether participants value the combined sequence enough to justify its operational complexity."],
  pilotTest: "Conduct a supervised pilot with consenting adults, record sequence choices and adjustments, and assess participant feedback without claiming proven health benefits.",
};
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
function run(drafts: Array<(c: Record<string, unknown>) => void>) {
  const calls: CreativeModelRequest[] = [];
  let composeN = 0;
  const model: CreativeModel = {
    id: "refs-test-no-network",
    async complete(call) {
      calls.push(call);
      if (call.stage === "operational_design") return JSON.stringify(design);
      const c = clone(concept) as unknown as Record<string, unknown>;
      c.declaredOutputCategory = "experience"; c.operationalTransfer = clone(design);
      drafts[Math.min(composeN++, drafts.length - 1)](c);
      return JSON.stringify({ concepts: [c] });
    },
  };
  return { calls, result: composeCreativeConcepts({ frame, interpreted, entities, evidence, model, fidelityPolicy: "triage" }) };
}
const stages = (calls: CreativeModelRequest[]) => calls.map(c => c.stage).join(",");

describe("evidence-reference reliability (offline, mocked model)", () => {
  it("baseline: a correctly referenced concept is accepted", async () => {
    const { calls, result } = run([() => {}]);
    const out = await result;
    expect(out.concepts).toHaveLength(1);
    expect(stages(calls)).toBe("operational_design,compose");
  });
  it("tells the model exactly which ids, signals and shape are allowed", async () => {
    const { calls, result } = run([() => {}]); await result;
    const user = JSON.parse(calls.find(c => c.stage === "compose")!.user);
    expect(user.evidenceReferenceContract.allowedEntities.map((e: { id: string }) => e.id)).toEqual(["mock-forest", "mock-sauna", "mock-recovery"]);
    expect(user.evidenceReferenceContract.allowedEntities[0].signals.length).toBeGreaterThan(0);
    expect(calls.find(c => c.stage === "compose")!.system).toMatch(/copied from allowedEntities|copied from evidenceReferenceContract|<id copied from allowedEntities>/);
  });
  it("an invented id is repaired once with explicit diagnostics + allowed ids, and strict provenance is preserved", async () => {
    const { calls, result } = run([
      c => { (c.influenceMap as Array<Record<string, unknown>>)[0].entityId = "forest-center-001"; },
      () => {},
    ]);
    const out = await result;
    expect(stages(calls)).toBe("operational_design,compose,compose");
    const repair = JSON.parse(calls[2].user);
    expect(repair.repairFeedback).toMatch(/removed influenceMap\[0\]\.entityId="forest-center-001"/);
    expect(repair.repairFeedback).toMatch(/allowed entity ids: \[mock-forest, mock-sauna, mock-recovery\]/);
    expect(out.concepts[0].spec!.influenceMap.every(m => ["mock-forest", "mock-sauna", "mock-recovery"].includes(m.entityId))).toBe(true);
  });
  it("never substitutes: if the model keeps inventing ids the run fails and names every bad reference", async () => {
    const bad = (c: Record<string, unknown>) => {
      (c.influenceMap as Array<Record<string, unknown>>)[0].entityId = "totally-made-up";
      (c.journey as Array<Record<string, unknown>>)[0].influenceEntityIds = ["also-made-up"];
      (c.rationales as Array<Record<string, unknown>>)[0].influenceEntityId = undefined;
    };
    const { calls, result } = run([bad, bad]);
    await expect(result).rejects.toThrow(CreativeCompositionError);
    const msg = await run([bad, bad]).result.then(() => "", (e: Error) => e.message);
    expect(msg).toContain('removed influenceMap[0].entityId="totally-made-up"');
    expect(msg).toContain('removed rationales[0] with influenceEntityId=undefined');
    expect(msg).toContain('removed journey[0].influenceEntityIds value "also-made-up"');
    expect(calls.filter(c => c.stage === "compose")).toHaveLength(2);
  });
  it("does not accept an existing entity that is cited with a signal it does not have (relationship must be genuine)", async () => {
    const { calls, result } = run([
      c => { (c.rationales as Array<Record<string, unknown>>)[1].attributeOrSignal = "synthwave"; },
      () => {},
    ]);
    await result;
    const repair = JSON.parse(calls[2].user);
    expect(repair.repairFeedback).toMatch(/attributeOrSignal "synthwave" is not a signal of "mock-sauna"/);
  });
  it("normalizes only exact case/whitespace/name variants of a real entity, and discloses it", async () => {
    const { result } = run([c => {
      (c.influenceMap as Array<Record<string, unknown>>)[0].entityId = "  MOCK-FOREST ";
      (c.influenceMap as Array<Record<string, unknown>>)[1].entityId = "Mock Nordic Sauna Studio";
    }]);
    const out = await result;
    const spec = out.concepts[0].spec!;
    expect(spec.influenceMap.map(m => m.entityId)).toEqual(["mock-forest", "mock-sauna"]);
    expect(spec.evidenceBoundary).toMatch(/Reference normalization \(exact matches only\)/);
  });
  it("does not fuzzy-match a near-miss id to a different entity", async () => {
    const { result } = run([c => { (c.influenceMap as Array<Record<string, unknown>>)[0].entityId = "mock-forests"; }, c => { (c.influenceMap as Array<Record<string, unknown>>)[0].entityId = "mock-forests"; }]);
    await expect(result).rejects.toThrow(/mock-forests/);
  });
  it("an entity with an ambiguous name is not resolved by name", async () => {
    const dup: CulturalEntity[] = [...entities, { ...entities[0], id: "mock-forest-2" }];
    const calls: CreativeModelRequest[] = [];
    const model: CreativeModel = { id: "m", async complete(call) {
      calls.push(call);
      if (call.stage === "operational_design") return JSON.stringify(design);
      const c = clone(concept) as unknown as Record<string, unknown>;
      c.declaredOutputCategory = "experience"; c.operationalTransfer = clone(design);
      (c.influenceMap as Array<Record<string, unknown>>)[0].entityId = entities[0].name;
      return JSON.stringify({ concepts: [c] });
    } };
    await expect(composeCreativeConcepts({ frame, interpreted, entities: dup, evidence, model, fidelityPolicy: "triage" })).rejects.toThrow(/removed influenceMap\[0\]\.entityId="Mock Shinrin-yoku Forest Center"/);
  });

  it("REAL-RUN REGRESSION: an extra invented third influence is discarded and disclosed, valid ones keep provenance", async () => {
    const { result } = run([c => {
      (c.influenceMap as Array<Record<string, unknown>>).push({ entityId: "mock-uses-0-983", entityName: "Invented", category: "other", role: "texture", signalsUsed: ["x"] });
    }]);
    const out = await result;
    const spec = out.concepts[0].spec!;
    expect(spec.influenceMap.map(m => m.entityId)).toEqual(["mock-forest", "mock-sauna"]);
    expect(spec.evidenceBoundary).toMatch(/discarded, not replaced.*mock-uses-0-983/);
    expect(out.concepts[0].culturalInfluences.map(e => e.id).sort()).toEqual(["mock-forest", "mock-sauna"]);
  });
  it("discarding never rescues a concept that depended on the invented references (all influences invented)", async () => {
    const bad = (c: Record<string, unknown>) => { (c.influenceMap as Array<Record<string, unknown>>).forEach((m, i) => { m.entityId = `fake-${i}`; }); };
    await expect(run([bad, bad]).result).rejects.toThrow(/fewer than two justified cultural influences[\s\S]*removed influenceMap\[0\]/);
  });
  it("discarding rationales cannot leave fewer than the required three", async () => {
    const bad = (c: Record<string, unknown>) => { const r = c.rationales as Array<Record<string, unknown>>; r[0].influenceEntityId = "ghost-1"; r[1].influenceEntityId = "ghost-2"; };
    await expect(run([bad, bad]).result).rejects.toThrow(/Rationales=2/);
  });
  it("a journey step whose only citation was invented fails the journey-binding gate", async () => {
    const bad = (c: Record<string, unknown>) => { (c.journey as Array<Record<string, unknown>>)[1].influenceEntityIds = ["ghost"]; };
    await expect(run([bad, bad]).result).rejects.toThrow(/lack influence bindings/);
  });
});

describe("quality contract is stated to the model", () => {
  it("lists every machine-checked rule that previously caused silent rejections", async () => {
    const { calls, result } = run([() => {}]); await result;
    const system = calls.find(c => c.stage === "compose")!.system;
    for (const rule of [/2 to 5 separate words/, /CamelCase/, /24 to 280 characters/, /at least 60 characters/, /innovative, seamless/, /word "hypothesis"/, /3 or 4 steps/]) expect(system).toMatch(rule);
  });
});
