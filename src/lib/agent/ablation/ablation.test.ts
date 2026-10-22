import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ABLATION_MODEL_CALLS, ABLATION_SYSTEM, AblationError, candidateTerms, evidencePayload, findSignals, judge, jaccard,
  parseGenerated, runAblation, similarityOf, type AblationText, type EvidenceSignal,
} from "./ablation";
import type { CulturalEntity } from "../../types";
import type { CreativeModel } from "../creative/model";

const t = (over: Partial<AblationText> = {}): AblationText => ({
  name: "Slow Ride", proposition: "A Wednesday evening group ride through three short venue stops.",
  audience: "Adults who ride", context: "Evening, flat streets", mechanics: "Riders gather at the first stop. The leader sets the pace to the slowest rider. The group rests at each stop.",
  journey: ["Riders meet at the first stop", "The group rides to the second stop", "Everyone sits for the closing set"], differentiationHypothesis: "Hypothesis: a paced ride feels calmer than a free ride.",
  pilotExperiment: "Over six weeks, measure repeat attendance.", ...over,
});
const entity = (id: string, name: string, tags: string[] = [], description = ""): CulturalEntity =>
  ({ id, name, category: "places", description, affinity: 0.5, tags });
const SHARED = "a bicycle and jazz listening evening in Louisville Kentucky";

describe("generic terms never count as Qloo influence", () => {
  it("excludes 'locals' and other generic words (the regression from the first live run)", () => {
    const jimmy = entity("j", "Jimmy Can't Dance", ["locals", "live music", "community"], "Popular with locals for live music nights");
    const forecastle = entity("f", "Forecastle Festival", ["locals", "festival", "music"]);
    const terms = candidateTerms([jimmy, forecastle], SHARED).map(c => c.term);
    expect(terms).not.toContain("locals");
    expect(terms).not.toContain("festival");
    expect(terms).not.toContain("music");
    expect(terms).not.toContain("community");
    expect(terms).toContain("jimmy");
    expect(terms).toContain("forecastle");
  });

  it("does not turn the first live run into a positive result", () => {
    const entities = [entity("v", "Village Vanguard"), entity("a", "Actors Theatre of Louisville"), entity("j", "Jimmy Can't Dance", ["locals"]), entity("f", "Forecastle Festival", ["locals"])];
    const control = [t({ name: "Head Card Jazz Ride" }), t({ name: "Head Card Jazz Ride" })];
    const evidence = [
      t({ name: "Slow Head Jazz Ride", mechanics: "The leader serves locals at every stop. The group paces to the slowest rider.", journey: ["Riders meet locals", "Ride to the second stop", "Silent walking cool-down"] }),
      t({ name: "Slow Head Jazz Ride", mechanics: "Locals welcome riders at each stop. A silent walking cool-down follows.", journey: ["Meet locals at stop one", "Ride to stop two", "Cool-down walk"] }),
    ];
    const signals = findSignals(control, evidence, entities, SHARED);
    expect(signals.find(s => s.term === "locals")).toBeUndefined();
    expect(judge(signals, 2).verdict).toBe("not_demonstrated");
  });
});

describe("signals must be specific, traceable and in a decision", () => {
  const vanguard = entity("v", "Village Vanguard", ["bebop"]);
  it("counts a specific entity term that appears in every evidence run and in no control run", () => {
    const control = [t(), t()];
    const evidence = [
      t({ mechanics: "Riders gather at the first stop. The closing set follows a Vanguard-style bebop trio format." }),
      t({ journey: ["Riders meet", "Ride on", "Closing bebop set with a short trio"] }),
    ];
    const signals = findSignals(control, evidence, [vanguard], SHARED);
    const bebop = signals.find(s => s.term === "bebop");
    expect(bebop).toBeDefined();
    expect(bebop!.evidenceRuns).toBe(2);
    expect(bebop!.entityName).toBe("Village Vanguard");
    expect(bebop!.excerpt.length).toBeGreaterThan(0);
    expect(judge(signals, 2).verdict).toBe("detectable");
  });

  it("is not demonstrated when the signal appears in only one evidence run", () => {
    const evidence = [t({ mechanics: "The set is a bebop trio." }), t()];
    const signals = findSignals([t(), t()], evidence, [vanguard], SHARED);
    expect(signals.find(s => s.term === "bebop")!.evidenceRuns).toBe(1);
    expect(judge(signals, 2).verdict).toBe("not_demonstrated");
  });

  it("ignores a term that the control runs also produce without evidence", () => {
    const withBebop = t({ mechanics: "A bebop trio plays the closing set." });
    const signals = findSignals([withBebop, t()], [withBebop, withBebop], [vanguard], SHARED);
    expect(signals.find(s => s.term === "bebop")).toBeUndefined();
    expect(judge(signals, 2).verdict).toBe("not_demonstrated");
  });

  it("ignores vocabulary already in the objective or operating design", () => {
    const shared = `${SHARED} bebop`;
    const evidence = [t({ mechanics: "A bebop trio plays." }), t({ mechanics: "A bebop trio plays." })];
    expect(findSignals([t(), t()], evidence, [vanguard], shared).find(s => s.term === "bebop")).toBeUndefined();
  });

  it("does not count a term that only appears in the name or proposition, not in an operating decision", () => {
    const evidence = [t({ name: "Bebop Ride", proposition: "A bebop evening." }), t({ name: "Bebop Ride", proposition: "A bebop evening." })];
    expect(findSignals([t(), t()], evidence, [vanguard], SHARED)).toEqual([]);
  });

  it("cannot be shown to replicate with a single evidence run", () => {
    const signal: EvidenceSignal = { entityId: "v", entityName: "Village Vanguard", term: "bebop", kind: "tag", evidenceRuns: 1, field: "mechanics", excerpt: "x" };
    expect(judge([signal], 1).verdict).toBe("not_demonstrated");
  });
});

describe("text similarity can never produce a positive verdict", () => {
  it("a very different evidence concept with no specific signal is not demonstrated (the 0.384 vs 0.61 case)", () => {
    const control = [t({ name: "Head Card Ride" }), t({ name: "Head Card Ride" })];
    const evidence = [
      t({ mechanics: "Entirely different operating text about pottery glazing workshops and ceramic vessels.", journey: ["Visitors choose vessels", "Staff glazes vessels", "Visitors compare results"] }),
      t({ mechanics: "Entirely different text about bakery tasting flights and sourdough starters.", journey: ["Guests choose loaves", "Baker slices loaves", "Guests compare tastes"] }),
    ];
    const sim = similarityOf(control, evidence);
    expect(sim.controlVsEvidence).toBeLessThan(sim.controlVsControl!);
    expect(judge(findSignals(control, evidence, [entity("x", "Anything")], SHARED), 2).verdict).toBe("not_demonstrated");
  });

  it("jaccard is 1 for identical sets and 0 for disjoint sets", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(1);
    expect(jaccard(new Set(["a"]), new Set(["b"]))).toBe(0);
  });
});

describe("generation output parsing", () => {
  const good = JSON.stringify({ name: "A B", proposition: "p", audience: "a", context: "c", mechanics: "m", journey: ["one", { action: "two" }], differentiationHypothesis: "h", pilotExperiment: "x" });
  it("parses valid output, tolerating prose around the JSON", () => {
    expect(parseGenerated(`Here: ${good} thanks`).journey).toEqual(["one", "two"]);
  });
  it("rejects missing fields and non-JSON", () => {
    expect(() => parseGenerated("no json")).toThrow(AblationError);
    expect(() => parseGenerated(JSON.stringify({ name: "x" }))).toThrow(AblationError);
  });
});

describe("runAblation protocol", () => {
  afterEach(() => vi.unstubAllGlobals());
  const design = { transfers: [{ sourceDomain: "Slow Roll", operatingDecision: "pace to the slowest rider" }] };
  const request = { creativeObjective: "a bicycle and jazz listening evening", outputCategory: "experience" as const, location: "Louisville, Kentucky" };
  const entities = [entity("e1", "Village Vanguard", ["bebop"], "Jazz club"), entity("e2", "Jimmy Can't Dance", ["locals"])];
  const out = JSON.stringify({ name: "Paced Ride", proposition: "A paced ride.", audience: "Riders", context: "Evening", mechanics: "Riders gather. A bebop trio plays at the close.", journey: ["Gather", "Ride", "Listen to the bebop trio"], differentiationHypothesis: "h", pilotExperiment: "Over six weeks, measure repeat attendance." });

  type Call = { stage: string; system: string; user: string; maxTokens: number };
  const recorder = () => {
    const calls: Call[] = [];
    const model: CreativeModel = { id: "fake", async complete(req) { calls.push({ stage: req.stage, system: req.system, user: req.user, maxTokens: req.maxTokens }); return out; } };
    return { calls, model };
  };

  it("makes exactly four model calls, alternating control and evidence", async () => {
    const { calls, model } = recorder();
    const r = await runAblation({ operationalTransfer: design, influences: entities, request, model });
    expect(calls).toHaveLength(ABLATION_MODEL_CALLS);
    expect(ABLATION_MODEL_CALLS).toBe(4);
    expect(calls.map(c => JSON.parse(c.user).culturalEvidence.length > 0)).toEqual([false, true, false, true]);
    expect(r.protocol.modelCalls).toBe(4);
    expect(r.protocol.qlooCalls).toBe(0);
  });

  it("uses identical system prompt, stage and token budget in every arm; only culturalEvidence differs", async () => {
    const { calls, model } = recorder();
    await runAblation({ operationalTransfer: design, influences: entities, request, model });
    expect(new Set(calls.map(c => c.system))).toEqual(new Set([ABLATION_SYSTEM]));
    expect(new Set(calls.map(c => c.stage)).size).toBe(1);
    expect(new Set(calls.map(c => c.maxTokens)).size).toBe(1);
    const strip = (u: string) => { const o = JSON.parse(u); delete o.culturalEvidence; return JSON.stringify(o); };
    expect(new Set(calls.map(c => strip(c.user))).size).toBe(1);
    expect(JSON.parse(calls[0]!.user).culturalEvidence).toEqual([]);
    expect(JSON.parse(calls[1]!.user).culturalEvidence).toEqual(evidencePayload(entities));
  });

  it("sends entity attributes to the evidence arm only, and never ids or scores", async () => {
    const { calls, model } = recorder();
    await runAblation({ operationalTransfer: design, influences: entities, request, model });
    expect(calls[0]!.user.includes("Village Vanguard")).toBe(false);
    expect(calls[1]!.user).toContain("Village Vanguard");
    expect(calls[1]!.user.includes("e1")).toBe(false);
    expect(calls[1]!.user.includes("affinity")).toBe(false);
  });

  it("makes no network call: the collected Qloo evidence is reused", async () => {
    const fetchSpy = vi.fn(() => { throw new Error("network is not allowed"); });
    vi.stubGlobal("fetch", fetchSpy);
    const { model } = recorder();
    await runAblation({ operationalTransfer: design, influences: entities, request, model });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reports a replicated signal when only the evidence runs use a specific term", async () => {
    const plain = JSON.stringify({ name: "Paced Ride", proposition: "A paced ride.", audience: "Riders", context: "Evening", mechanics: "Riders gather and ride at a set pace.", journey: ["Gather", "Ride", "Listen to a set"], differentiationHypothesis: "h", pilotExperiment: "Over six weeks, measure repeat attendance." });
    let n = 0;
    const model: CreativeModel = { id: "fake", async complete() { n++; return n % 2 === 1 ? plain : out; } };
    const r = await runAblation({ operationalTransfer: design, influences: entities, request, model });
    expect(r.verdict).toBe("detectable");
    expect(r.signals.some(s => s.term === "bebop" && s.entityName === "Village Vanguard" && s.evidenceRuns === 2)).toBe(true);
    expect(r.signals.some(s => s.term === "locals")).toBe(false);
  });

  it("reports not demonstrated when evidence changes nothing", async () => {
    const { model } = recorder();
    const noEvidenceEffect: CreativeModel = { id: "fake", async complete(req) { return JSON.parse(req.user).culturalEvidence.length ? out : out; } };
    void model;
    const r = await runAblation({ operationalTransfer: design, influences: entities, request, model: noEvidenceEffect });
    expect(r.verdict).toBe("not_demonstrated");
  });

  it("always states what is and is not measured", async () => {
    const { model } = recorder();
    const r = await runAblation({ operationalTransfer: design, influences: entities, request, model });
    expect(r.caveat).toMatch(/originality/);
    expect(r.caveat).toMatch(/does not verify/);
  });

  it("refuses to run without an operating design or without collected evidence", async () => {
    const { model } = recorder();
    await expect(runAblation({ operationalTransfer: undefined, influences: entities, request, model })).rejects.toThrow(AblationError);
    await expect(runAblation({ operationalTransfer: design, influences: [], request, model })).rejects.toMatchObject({ code: "NO_EVIDENCE" });
  });
});

describe("ablation with provenance-bearing evidence", () => {
  afterEach(() => vi.unstubAllGlobals());
  const design = { transfers: [{ sourceDomain: "Slow Roll", operatingDecision: "pace to the slowest rider" }] };
  const request = { creativeObjective: "a bicycle and jazz listening evening", outputCategory: "experience" as const, location: "Louisville, Kentucky" };
  const placeEntity: CulturalEntity = {
    id: "q-place", name: "Zanzabar Listening Room", category: "places", description: "Listening room", affinity: 0.5, tags: ["bebop"],
    qloo: { provider: "qloo", entityId: "q-place", entityType: "urn:entity:place", retrievedVia: "insights", place: { city: "Louisville", region: "Kentucky", address: "1 Main St" } },
  };
  const outFor = (stop: string | null) => JSON.stringify({
    name: "Paced Ride", proposition: "A paced ride.", audience: "Riders", context: "Evening",
    mechanics: stop ? `Riders gather. The final stop is ${stop}.` : "Riders gather. The final stop is a park shelter.",
    journey: ["Gather", "Ride", stop ? `Listen at ${stop}` : "Rest at the shelter"], differentiationHypothesis: "h", pilotExperiment: "Over six weeks, measure repeat attendance.",
  });

  it("sends type and place facts to the evidence arm only", async () => {
    const users: string[] = [];
    const model: CreativeModel = { id: "f", async complete(req) { users.push(req.user); return outFor(null); } };
    await runAblation({ operationalTransfer: design, influences: [placeEntity], request, model });
    expect(JSON.parse(users[0]!).culturalEvidence).toEqual([]);
    const ev = JSON.parse(users[1]!).culturalEvidence[0];
    expect(ev.type).toBe("urn:entity:place");
    expect(ev.place.city).toBe("Louisville");
    expect(users[1]).not.toContain("q-place");
  });

  it("is detectable when a validated place appears in the decisions of both evidence runs and no control run", async () => {
    let n = 0;
    const model: CreativeModel = { id: "f", async complete() { n++; return outFor(n % 2 === 0 ? "Zanzabar Listening Room" : null); } };
    const r = await runAblation({ operationalTransfer: design, influences: [placeEntity], request, model });
    expect(r.verdict).toBe("detectable");
  });

  it("stays not demonstrated when only one evidence run uses the place", async () => {
    let n = 0;
    const model: CreativeModel = { id: "f", async complete() { n++; return outFor(n === 2 ? "Zanzabar Listening Room" : null); } };
    const r = await runAblation({ operationalTransfer: design, influences: [placeEntity], request, model });
    expect(r.verdict).toBe("not_demonstrated");
  });
});
