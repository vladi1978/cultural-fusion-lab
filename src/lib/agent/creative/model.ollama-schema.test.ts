import { describe, expect, it } from "vitest";
import { createOllamaCreativeModel } from "./model";

function capture() {
  const bodies: Array<Record<string, any>> = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  const fetchImpl = (async (_url: unknown, init: { body: string }) => {
    bodies.push(JSON.parse(init.body));
    return { ok: true, json: async () => ({ message: { content: "{}" } }), text: async () => "" } as unknown as Response;
  }) as unknown as typeof fetch;
  return { bodies, fetchImpl };
}
const env = { CFL_CREATIVE_LLM_ENABLED: "true" };

describe("Ollama compose schema (offline; no network)", () => {
  it("restricts every entity-id field to the collected ids (constrained decoding) and bounds list sizes", async () => {
    const { bodies, fetchImpl } = capture();
    await createOllamaCreativeModel(env, fetchImpl).complete({ stage: "compose", system: "s", user: "u", maxTokens: 100, allowedEntityIds: ["a-1", "b-2"] });
    const c = bodies[0].format.properties.concepts.items.properties;
    expect(c.influenceMap.items.properties.entityId.enum).toEqual(["a-1", "b-2"]);
    expect(c.rationales.items.properties.influenceEntityId.enum).toEqual(["a-1", "b-2"]);
    expect(c.journey.items.properties.influenceEntityIds.items.enum).toEqual(["a-1", "b-2"]);
    expect(c.journey.minItems).toBe(3); expect(c.journey.maxItems).toBe(4);
    expect(c.influenceMap.minItems).toBe(2); expect(c.influenceMap.maxItems).toBe(3);
    expect(c.rationales.minItems).toBe(3);
    expect(c.influenceMap.items.properties.role.enum).toContain("hinge");
  });
  it("falls back to a plain string id when no ids are supplied", async () => {
    const { bodies, fetchImpl } = capture();
    await createOllamaCreativeModel(env, fetchImpl).complete({ stage: "compose", system: "s", user: "u", maxTokens: 100 });
    expect(bodies[0].format.properties.concepts.items.properties.influenceMap.items.properties.entityId).toEqual({ type: "string" });
  });
  it("does not constrain other stages", async () => {
    const { bodies, fetchImpl } = capture();
    await createOllamaCreativeModel(env, fetchImpl).complete({ stage: "frame", system: "s", user: "u", maxTokens: 100, allowedEntityIds: ["x"] });
    expect(JSON.stringify(bodies[0].format)).not.toContain('"enum":["x"]');
  });
});

describe("Ollama operational_design schema", () => {
  it("allows only each domain's own name and mechanisms, exactly one transfer per domain", async () => {
    const { bodies, fetchImpl } = capture();
    await createOllamaCreativeModel(env, fetchImpl).complete({ stage: "operational_design", system: "s", user: "u", maxTokens: 100,
      designConstraints: [{ domain: "A", mechanisms: ["a1", "a2"] }, { domain: "B", mechanisms: ["b1"] }] });
    const t = bodies[0].format.properties.transfers;
    expect(t.minItems).toBe(2); expect(t.maxItems).toBe(2);
    expect(t.items.anyOf[0].properties.sourceDomain.enum).toEqual(["A"]);
    expect(t.items.anyOf[0].properties.sourceMechanism.enum).toEqual(["a1", "a2"]);
    expect(t.items.anyOf[1].properties.sourceMechanism.enum).toEqual(["b1"]);
  });
});
