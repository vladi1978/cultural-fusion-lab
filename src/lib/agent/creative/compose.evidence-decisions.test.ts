import { describe, expect, it } from "vitest";
import { composeCreativeConcepts, CreativeCompositionError } from "./compose";
import { assessEvidenceEligibility } from "../evidence/eligibility";
import { clone, concept, design, frame, interpreted, request } from "./compose.fixtures";
import type { CulturalEntity, EvidenceItem } from "../../types";
import type { CreativeModel, CreativeModelRequest } from "./model";

// Offline, mocked model. Entities carry the provenance shape of real Qloo results; the data is synthetic.
type PlaceFacts = NonNullable<CulturalEntity["qloo"]>["place"];
const live = (id: string, name: string, type: string, tags: string[], description: string, place?: PlaceFacts, via: "search" | "insights" = "insights"): CulturalEntity => ({
  id, name, category: type === "urn:entity:place" ? "places" : "brands", description, affinity: 0.5, tags,
  qloo: { provider: "qloo", entityId: id, entityType: type, retrievedVia: via, signalTagIds: ["urn:tag:category:place:sauna"], signalTagNames: ["Sauna"], ...(place ? { place } : {}) },
});
const seattle: PlaceFacts = { city: "Seattle", region: "Washington", country: "United States", address: "1 Pine St Seattle, WA", lat: 47.6, lon: -122.3 };
const tacoma: PlaceFacts = { city: "Tacoma", region: "Washington", country: "United States", address: "9 Pacific Ave Tacoma, WA" };
const FOREST = "Mock Shinrin-yoku Forest Center", SAUNA = "Mock Nordic Sauna Studio", RECOVERY = "Mock Shinrin-yoku Nordic Recovery Program";
const forestTags = ["Shinrin-yoku", "forest", "sensory", "guided"], saunaTags = ["Nordic", "sauna", "heat", "cooling"], recTags = ["Shinrin-yoku", "Nordic", "sauna", "forest", "recovery"];
const forestDesc = "Forest venue for guided sensory attention", saunaDesc = "Sauna studio for heat cooling cycles", recDesc = "Shinrin-yoku and Nordic sauna program for guided observation and recovery";

function build(over: { forest?: PlaceFacts; recovery?: PlaceFacts; saunaType?: string; saunaPlace?: PlaceFacts } = {}) {
  const entities: CulturalEntity[] = [
    live("mock-forest", FOREST, "urn:entity:place", forestTags, forestDesc, "forest" in over ? over.forest : seattle),
    live("mock-sauna", SAUNA, over.saunaType ?? "urn:entity:brand", saunaTags, saunaDesc, over.saunaPlace),
    live("mock-recovery", RECOVERY, "urn:entity:place", recTags, recDesc, "recovery" in over ? over.recovery : seattle),
  ];
  const evidence: EvidenceItem[] = entities.map(e => ({ id: `ev-${e.id}`, source: "verified_api", label: `Qloo entity ${e.name}`, detail: "Returned by Qloo.", relatedEntityIds: [e.id], createdAt: "2026-10-22T00:00:00.000Z" }));
  const eligibility = assessEvidenceEligibility({ entities, request, signalTagNames: ["Sauna"] });
  return { entities, evidence, eligibility };
}

type Mode = "reference-only" | "location-nonplace" | "faithful" | "cite-rejected" | "invented-id" | "not-realized" | "names-rejected-place";
function run(setup: ReturnType<typeof build>, mode: Mode = "faithful", withEligibility = true) {
  const calls: CreativeModelRequest[] = [];
  const model: CreativeModel = {
    id: "decisions-test-no-network",
    async complete(call) {
      calls.push(call);
      if (call.stage === "operational_design") return JSON.stringify(design);
      const user = JSON.parse(call.user);
      const eligible: Array<{ id: string; name: string; type: string }> = user.evidenceDecisionContract?.eligibleEvidence ?? [];
      const c = clone(concept) as unknown as Record<string, unknown> & { mechanics: string; journey: Array<{ id: string; actor: string; action: string; influenceEntityIds: string[] }> };
      c.declaredOutputCategory = "experience"; c.operationalTransfer = clone(design);
      const decisions: unknown[] = [];
      if (mode === "faithful") {
        for (const e of eligible) {
          c.mechanics += ` Participants also use ${e.name} as part of the session.`;
          decisions.push({ kind: e.type === "urn:entity:place" ? "location" : "component", decision: `Participants spend the first 20 minutes of each session at ${e.name}`, entityIds: [e.id], basis: "name" });
        }
      } else if (mode === "reference-only") {
        for (const e of eligible) {
          c.mechanics += ` Participants also use ${e.name} as part of the session.`;
          decisions.push({ kind: "other", decision: `Use ${e.name} as the reference for the concept`, entityIds: [e.id], basis: "name" });
        }
      } else if (mode === "location-nonplace") {
        for (const e of eligible.filter(x => x.type !== "urn:entity:place")) {
          c.mechanics += ` Participants also use ${e.name} as part of the session.`;
          decisions.push({ kind: "location", decision: `Hold the first stop with ${e.name} for 20 minutes`, entityIds: [e.id], basis: "name" });
        }
      } else if (mode === "cite-rejected") {
        decisions.push({ kind: "location", decision: "Hold the closing stage at the recovery program", entityIds: ["mock-recovery"], basis: "name" });
      } else if (mode === "invented-id") {
        decisions.push({ kind: "location", decision: "Hold the closing stage at an invented site", entityIds: ["Q-INVENTED-123"], basis: "name" });
      } else if (mode === "not-realized") {
        for (const e of eligible.filter(x => x.type === "urn:entity:place")) decisions.push({ kind: "location", decision: `Run the first stop at ${e.name} for 20 minutes`, entityIds: [e.id], basis: "name" });
      } else if (mode === "names-rejected-place") {
        c.mechanics += ` Participants meet at ${RECOVERY} before the session.`;
      }
      if (withEligibility) c.evidenceDecisions = decisions;
      return JSON.stringify({ concepts: [c] });
    },
  };
  const result = composeCreativeConcepts({ frame, interpreted, entities: setup.entities, evidence: setup.evidence, model, fidelityPolicy: "triage", eligibility: withEligibility ? setup.eligibility : undefined });
  return { calls, result };
}
const idsOf = (d: Array<{ entities: Array<{ id: string }> }> | undefined) => (d ?? []).flatMap(x => x.entities.map(e => e.id)).sort();

describe("evidence-to-decision mechanism (offline, mocked model)", () => {
  it("grounds decisions only in validated evidence and preserves Qloo ids and provenance", async () => {
    const setup = build();
    expect(setup.eligibility.sufficiency.status).toBe("sufficient");
    const { concepts } = await run(setup).result;
    const spec = concepts[0]!.spec!;
    expect(spec.evidenceSufficiency?.status).toBe("sufficient");
    expect(idsOf(spec.evidenceDecisions)).toEqual(["mock-forest", "mock-recovery", "mock-sauna"]);
    const forest = spec.evidenceDecisions!.find(d => d.entities[0]!.id === "mock-forest")!;
    expect(forest.entities[0]).toMatchObject({ qlooEntityId: "mock-forest", retrievedVia: "insights", address: "1 Pine St Seattle, WA" });
    expect(spec.evidenceBoundary).toMatch(/grounded in validated Qloo evidence/);
    expect(concepts[0]!.culturalInfluences.every(e => e.qloo?.entityId === e.id)).toBe(true);
  });

  it("changing the evidence changes the operating decisions (a place moves out of the location)", async () => {
    const a = (await run(build()).result).concepts[0]!.spec!;
    const b = (await run(build({ recovery: tacoma })).result).concepts[0]!.spec!;
    expect(idsOf(a.evidenceDecisions)).toContain("mock-recovery");
    expect(idsOf(b.evidenceDecisions)).not.toContain("mock-recovery");
    expect(b.mechanics.includes(RECOVERY)).toBe(false);
    expect(a.mechanics.includes(RECOVERY)).toBe(true);
    expect(b.evidenceSufficiency?.rejections.find(r => r.entityId === "mock-recovery")?.reason).toMatch(/Tacoma/);
  });

  it("removing evidence changes decisions: places without Qloo place facts are unverifiable and unusable", async () => {
    const setup = build({ forest: undefined, recovery: undefined });
    const spec = (await run(setup).result).concepts[0]!.spec!;
    expect(idsOf(spec.evidenceDecisions)).toEqual(["mock-sauna"]);
    expect(spec.evidenceSufficiency?.rejections.map(r => r.entityId).sort()).toEqual(["mock-forest", "mock-recovery"]);
    expect(spec.evidenceSufficiency?.rejections[0]!.reason).toMatch(/unverifiable/);
  });

  it("reports insufficient evidence explicitly and forces no decision, location or entity", async () => {
    const setup = build({ forest: tacoma, recovery: tacoma, saunaType: "urn:entity:place", saunaPlace: tacoma });
    expect(setup.eligibility.sufficiency.status).toBe("insufficient");
    const { calls, result } = run(setup);
    const spec = (await result).concepts[0]!.spec!;
    expect(spec.evidenceDecisions).toEqual([]);
    expect(spec.evidenceSufficiency?.status).toBe("insufficient");
    expect(spec.evidenceBoundary).toMatch(/insufficient to ground any design decision/);
    const compose = calls.find(c => c.stage === "compose")!;
    expect(JSON.parse(compose.user).evidenceDecisionContract.eligibleEvidence).toEqual([]);
    expect(compose.system).toMatch(/status is "insufficient"/);
  });

  it("discards a decision that cites rejected evidence", async () => {
    const setup = build({ recovery: tacoma });
    const spec = (await run(setup, "cite-rejected").result).concepts[0]!.spec!;
    expect(spec.evidenceDecisions).toEqual([]);
    expect(spec.evidenceBoundary).toMatch(/Discarded unvalidated entity reference/);
  });

  it("discards invented entity ids and never resolves them to anything", async () => {
    const spec = (await run(build(), "invented-id").result).concepts[0]!.spec!;
    expect(spec.evidenceDecisions).toEqual([]);
    expect(spec.evidenceBoundary).toMatch(/Q-INVENTED-123/);
  });

  it("discards a decision whose evidence is not visible in the mechanics or journey", async () => {
    const spec = (await run(build(), "not-realized").result).concepts[0]!.spec!;
    expect(spec.evidenceDecisions).toEqual([]);
    expect(spec.evidenceBoundary).toMatch(/not visible in the mechanics or journey/);
  });

  it("rejects a concept that names a place which failed validation", async () => {
    const setup = build({ recovery: tacoma });
    await expect(run(setup, "names-rejected-place").result).rejects.toThrow(/failed geographic or topical validation/);
    await expect(run(setup, "names-rejected-place").result).rejects.toBeInstanceOf(CreativeCompositionError);
  });

  it("is domain-agnostic: a non-place entity needs no geography and can ground a component decision", async () => {
    const spec = (await run(build({ forest: tacoma, recovery: tacoma })).result).concepts[0]!.spec!;
    const sauna = spec.evidenceDecisions!.find(d => d.entities[0]!.id === "mock-sauna")!;
    expect(sauna.kind).toBe("component");
    expect(idsOf(spec.evidenceDecisions)).toEqual(["mock-sauna"]);
  });

  it("leaves demo and legacy runs unchanged: no contract in the prompt, no decision fields on the spec", async () => {
    const { calls, result } = run(build(), "faithful", false);
    const spec = (await result).concepts[0]!.spec!;
    expect(spec.evidenceDecisions).toBeUndefined();
    expect(spec.evidenceSufficiency).toBeUndefined();
    const compose = calls.find(c => c.stage === "compose")!;
    expect(compose.system.includes("EVIDENCE-TO-DECISION CONTRACT")).toBe(false);
    expect("evidenceDecisionContract" in JSON.parse(compose.user)).toBe(false);
  });

  it("discards a decision that only cites a reference or theme and changes nothing operational", async () => {
    const r = await run(build(), "reference-only").result;
    expect(r.concepts[0]!.spec!.evidenceDecisions).toEqual([]);
  });
  it("does not let an entity without a place ground a location decision", async () => {
    const r = await run(build(), "location-nonplace").result;
    expect(r.concepts[0]!.spec!.evidenceDecisions).toEqual([]);
  });
});

describe("operational decision test", () => {
  it("accepts concrete stops, orders, durations and counts and rejects flavour", async () => {
    const { isOperationalDecision } = await import("./evidence-decisions");
    expect(isOperationalDecision("Open with a 15 minute warm-up at the second stop")).toBe(true);
    expect(isOperationalDecision("Cap each cohort at 8 participants")).toBe(true);
    expect(isOperationalDecision("Use Alpha Davis as the reference")).toBe(false);
    expect(isOperationalDecision("Inspired by the jazz scene")).toBe(false);
  });
});
