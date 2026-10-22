import { describe, expect, it } from "vitest";
import { assessCreativeFidelity } from "./fidelity";
import type { CreativeFrame } from "./types";
import type { ConceptSpec } from "../../types";

// Offline calibration fixtures. Hand-written; NOT real model output.
const frame: CreativeFrame = {
  sourceDomains: [
    { name: "Japanese omotenashi", origin: "Japan", essence: "anticipatory hospitality", coreMechanics: ["anticipating needs before they are requested", "coordinated service handoffs between staff"] },
    { name: "Dutch cycling culture", origin: "Netherlands", essence: "everyday cycling infrastructure", coreMechanics: ["separated predictable routes with clear priority rules", "steady everyday trip chaining"] },
  ],
  experientialGoals: ["safer late-shift commutes"], requirements: ["Serve shift workers"], offBrief: [], evidenceProbes: [],
};
const design = {
  transfers: [
    { sourceDomain: "Japanese omotenashi", sourceMechanism: "anticipating needs before they are requested",
      operatingDecision: "Dispatcher reviews each worker's shift end time and fatigue signal, then pre-assigns a lit bike lane escort and a warm waiting shelter before the worker clocks out.",
      participantAction: "Worker confirms shift end and fatigue level; escort and shelter are ready at the exit.", dependency: "Escort pre-assignment needs the shift end confirmation." },
    { sourceDomain: "Dutch cycling culture", sourceMechanism: "separated predictable routes with clear priority rules",
      operatingDecision: "Riders follow fixed protected corridors with priority crossings, chaining the grocery stop and transit transfer onto the same corridor.",
      participantAction: "Worker picks a protected corridor and chains one errand stop on it.", dependency: "Corridor choice determines the chained stops." },
  ],
  crossCulturalDependency: "The pre-assigned escort and shelter follow the protected corridor the worker picks, so corridor priority crossings decide where the shelter waits and how errands chain.",
  removalConsequences: [
    "Without pre-assigned escorts and shelters at shift end, the corridor ride starts with no preparation for fatigue.",
    "Without protected corridors with priority crossings, the escort would have no predictable chained route to follow.",
  ],
  feasibilityUnknowns: ["u"], pilotTest: "p",
};
const mk = (mechanics: string, steps: string[], d: unknown = design): ConceptSpec => ({
  name: "ShiftSync", proposition: "Safer commutes", audience: "shift workers", context: "Louisville", mechanics,
  journey: steps.map((action, i) => ({ id: `s${i}`, actor: "worker", action, influenceEntityIds: [] })),
  influenceMap: [], rationales: [], differentiationHypothesis: "x", feasibilityAssumptions: [], risksAndUnknowns: [], pilotExperiment: "p",
  evidenceBoundary: "u", mechanicFingerprint: "f", mechanismId: "m", frozenObjective: "o", frozenOutputCategory: "experience",
  operationalTransfer: d,
} as unknown as ConceptSpec);

describe("realization-based fidelity (offline calibration)", () => {
  it("accepts a concept that realizes both designed operating decisions and binds them (paraphrase, no verbatim mechanics)", () => {
    const r = assessCreativeFidelity(frame, mk(
      "Before the worker clocks out, the dispatcher reviews shift end and fatigue, pre-assigns an escort and a warm shelter, and the worker picks a protected corridor.",
      ["Worker confirms shift end and fatigue level; the dispatcher readies the escort and shelter at the exit.",
       "Worker picks a protected corridor with priority crossings; the escort follows it and the shelter waits along that corridor, chaining one grocery stop."]));
    expect(r.failures).toEqual([]);
    expect(r.accepted).toBe(true);
  });
  it("rejects a name-drop that ignores the design", () => {
    const r = assessCreativeFidelity(frame, mk("A loyalty app with points and badges for commuters.", ["Open the app.", "Collect badges and share them online."]));
    expect(r.accepted).toBe(false);
    expect(r.failures.join(" ")).toMatch(/does not carry out/);
  });
  it("rejects realization of only one domain", () => {
    const r = assessCreativeFidelity(frame, mk(
      "Dispatcher reviews shift end and fatigue, pre-assigns an escort and a warm shelter before clock out.",
      ["Worker confirms shift end and fatigue level; escort and shelter readied at the exit."]));
    expect(r.accepted).toBe(false);
    expect(r.failures.join(" ")).toMatch(/Dutch cycling culture/);
  });
  it("rejects domains realized only in isolation (no step binds them)", () => {
    const r = assessCreativeFidelity(frame, mk(
      "Two separate programs run side by side.",
      ["Dispatcher reviews shift end and fatigue, pre-assigns an escort and a warm shelter before clock out.",
       "Riders follow protected corridors with priority crossings, chaining a grocery stop and transit transfer."]));
    expect(r.accepted).toBe(false);
    expect(r.failures.join(" ")).toMatch(/combines the operating decisions|isolation/);
  });
  it("rejects a design that merely restates the source mechanism", () => {
    const thin = { ...design, transfers: design.transfers.map(t => ({ ...t, operatingDecision: t.sourceMechanism, participantAction: t.sourceMechanism })) };
    const r = assessCreativeFidelity(frame, mk("Anticipating needs before they are requested on separated predictable routes.", ["Anticipating needs before they are requested."], thin));
    expect(r.accepted).toBe(false);
    expect(r.failures.join(" ")).toMatch(/restating/);
  });
  it("keeps the legacy lexical path when no design is attached", () => {
    const r = assessCreativeFidelity(frame, mk("Anything.", ["Nothing."], null));
    expect(r.failures.join(" ")).toMatch(/Missing operational mechanism/);
  });
  it("accepts removal consequences that name the practice or list domains in a different order", () => {
    const d = { ...design, removalConsequences: [
      "If the dutch cycling corridors were removed, the shelter would have no route to wait along.",
      "Without omotenashi style anticipation at the exit, workers would leave tired and unprepared.",
    ] };
    const r = assessCreativeFidelity(frame, mk(
      "Before the worker clocks out, the dispatcher reviews shift end and fatigue, pre-assigns an escort and a warm shelter, and the worker picks a protected corridor.",
      ["Worker confirms shift end and fatigue level; the dispatcher readies the escort and shelter at the exit.",
       "Worker picks a protected corridor with priority crossings; the escort follows it and the shelter waits along that corridor, chaining one grocery stop."], d));
    expect(r.failures).toEqual([]);
  });
  it("rejects when no removal consequence concerns one of the domains", () => {
    const d = { ...design, removalConsequences: ["Things would be worse overall without this program.", "The pilot would be less useful in general terms."] };
    const r = assessCreativeFidelity(frame, mk(
      "Before the worker clocks out, the dispatcher reviews shift end and fatigue, pre-assigns an escort and a warm shelter, and the worker picks a protected corridor.",
      ["Worker confirms shift end and fatigue level; the dispatcher readies the escort and shelter at the exit.",
       "Worker picks a protected corridor with priority crossings; the escort follows it and the shelter waits along that corridor, chaining one grocery stop."], d));
    expect(r.accepted).toBe(false);
    expect(r.failures.join(" ")).toMatch(/No removal consequence/);
  });
});
