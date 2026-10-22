/**
 * Offline fixtures for compose-level tests: a brief, its frame, a valid concept and a validated operating design.
 * Shared by the evidence-to-decision tests. Contains no network access and no real entity data.
 */
import type { ConceptSpec } from "../../types";
import type { InterpretedObjective } from "../types";
import type { CreativeFrame } from "./types";

export const request = {
  creativeObjective: "Design a participatory Shinrin-yoku and Nordic sauna experience with sequence, intensity and social choices",
  culturalInterest: "Shinrin-yoku and Nordic sauna",
  location: "Seattle",
  outputCategory: "experience" as const,
  mode: "demo" as const,
};
export const frame: CreativeFrame = {
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
export const concept: Omit<ConceptSpec, "frozenObjective" | "frozenOutputCategory"> = {
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



export const interpreted: InterpretedObjective = {
  rawObjective: request.creativeObjective, culturalInterest: request.culturalInterest, location: request.location,
  outputCategory: "experience", intentTokens: [], themes: [], summary: "test",
};
export const design = {
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

export const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
