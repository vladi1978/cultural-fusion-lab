import { describe, expect, it } from "vitest";
import { runExplorationAgent } from "../orchestrator";
import { clone, concept, frame, request } from "./compose.fixtures";
import type { CulturalEntity, EvidenceItem } from "../../types";
import type { CulturalEvidenceSource } from "../types";
import type { CreativeModel } from "./model";

// Offline replay: a live-shaped source (id "qloo"), a replay model, no network.
type Place = NonNullable<CulturalEntity["qloo"]>["place"];
const live = (id: string, name: string, type: string, tags: string[], description: string, place?: Place): CulturalEntity => ({
  id, name, category: type === "urn:entity:place" ? "places" : "brands", description, affinity: 0.5, tags,
  qloo: { provider: "qloo", entityId: id, entityType: type, retrievedVia: "insights", ...(place ? { place } : {}) },
});
const seattle: Place = { city: "Seattle", region: "Washington", address: "1 Pine St Seattle, WA" };
const tacoma: Place = { city: "Tacoma", region: "Washington", address: "9 Pacific Ave Tacoma, WA" };
function sourceOf(forest: Place, recovery: Place): CulturalEvidenceSource {
  const entities = [
    live("mock-forest", "Mock Shinrin-yoku Forest Center", "urn:entity:place", ["Shinrin-yoku", "forest", "sensory", "guided"], "Forest venue for guided sensory attention", forest),
    live("mock-sauna", "Mock Nordic Sauna Studio", "urn:entity:brand", ["Nordic", "sauna", "heat", "cooling"], "Sauna studio for heat cooling cycles"),
    live("mock-recovery", "Mock Shinrin-yoku Nordic Recovery Program", "urn:entity:place", ["Shinrin-yoku", "Nordic", "sauna", "forest", "recovery"], "Shinrin-yoku and Nordic sauna program for guided observation and recovery", recovery),
  ];
  const evidence: EvidenceItem[] = entities.map(e => ({ id: `ev-${e.id}`, source: "verified_api", label: `Qloo entity ${e.name}`, detail: "Returned by Qloo.", relatedEntityIds: [e.id], createdAt: "2026-10-22T00:00:00.000Z" }));
  return {
    id: "qloo",
    async collect() {
      return { entities, evidence, provenanceByEntityId: Object.fromEntries(entities.map(e => [e.id, "verified_api" as const])), collectionNotes: ["replay"] };
    },
  };
}
const model: CreativeModel = {
  id: "eligibility-replay-no-network",
  async complete(call) {
    if (call.stage === "frame") return JSON.stringify(frame);
    if (call.stage === "compose") {
      const eligible: Array<{ id: string; name: string }> = JSON.parse(call.user).evidenceDecisionContract?.eligibleEvidence ?? [];
      const c = clone(concept) as unknown as Record<string, unknown> & { mechanics: string };
      const places = eligible.filter(e => /Forest|Recovery/.test(e.name));
      for (const e of places) c.mechanics += ` Participants use ${e.name} as a stop.`;
      c.evidenceDecisions = places.map(e => ({ kind: "location", decision: `Use ${e.name} as a stop`, entityIds: [e.id], basis: "name" }));
      return JSON.stringify({ concepts: [c] });
    }
    throw new Error(`Unexpected stage ${call.stage}`);
  },
};
const live1 = { ...request, mode: "live" as const };

describe("orchestrator: evidence eligibility (offline)", () => {
  it("reports eligible evidence in the trace and grounds decisions in it", async () => {
    const result = await runExplorationAgent(live1, { source: sourceOf(seattle, seattle), creativeModel: model, now: () => "2026-10-22T00:00:00.000Z" });
    const step = result.agentTrace.steps.find(s => s.id === "eligibility")!;
    expect(step.status).toBe("ok");
    const spec = result.concepts[0]!.spec!;
    expect(spec.evidenceSufficiency?.status).toBe("sufficient");
    expect(spec.evidenceDecisions!.map(d => d.entities[0]!.id).sort()).toEqual(["mock-forest", "mock-recovery"]);
  });

  it("changing the evidence changes the decisions: the same brief with places elsewhere grounds none", async () => {
    const result = await runExplorationAgent(live1, { source: sourceOf(tacoma, tacoma), creativeModel: model, now: () => "2026-10-22T00:00:00.000Z" });
    const spec = result.concepts[0]!.spec!;
    expect(spec.evidenceDecisions!.map(d => d.entities[0]!.id)).toEqual([]);
    expect(spec.evidenceSufficiency?.status).toBe("sufficient"); // the brand is still eligible: sufficiency is about any eligible evidence
    expect(spec.mechanics).not.toMatch(/Forest Center as a stop/);
    expect(spec.evidenceSufficiency?.rejections.map(r => r.entityId).sort()).toEqual(["mock-forest", "mock-recovery"]);
  });

  it("states insufficiency in the trace and the warnings when nothing is eligible, and still invents nothing", async () => {
    const entitiesAllPlaces: CulturalEvidenceSource = {
      id: "qloo",
      async collect(ctx) {
        const b = await sourceOf(tacoma, tacoma).collect(ctx);
        const entities = b.entities.map(e => e.id === "mock-sauna" ? live(e.id, e.name, "urn:entity:place", e.tags, e.description, tacoma) : e);
        return { ...b, entities };
      },
    };
    const result = await runExplorationAgent(live1, { source: entitiesAllPlaces, creativeModel: model, now: () => "2026-10-22T00:00:00.000Z" });
    expect(result.agentTrace.steps.find(s => s.id === "eligibility")!.status).toBe("empty");
    expect(result.agentTrace.warnings.join(" ")).toMatch(/None of the 3 collected entities passed geographic and topical validation/);
    const spec = result.concepts[0]!.spec!;
    expect(spec.evidenceSufficiency?.status).toBe("insufficient");
    expect(spec.evidenceDecisions).toEqual([]);
    expect(spec.evidenceBoundary).toMatch(/insufficient to ground any design decision/);
  });

  it("does not run for demo evidence (no Qloo provenance): no step, no spec fields", async () => {
    const demo: CulturalEvidenceSource = {
      id: "demo",
      async collect(ctx) {
        const b = await sourceOf(seattle, seattle).collect(ctx);
        return { ...b, entities: b.entities.map(e => ({ ...e, qloo: undefined })) };
      },
    };
    const result = await runExplorationAgent({ ...request, mode: "demo" }, { source: demo, creativeModel: model, now: () => "2026-10-22T00:00:00.000Z" });
    expect(result.agentTrace.steps.some(s => s.id === "eligibility")).toBe(false);
    expect(result.concepts[0]!.spec!.evidenceSufficiency).toBeUndefined();
  });
});
