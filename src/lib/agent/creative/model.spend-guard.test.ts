import { describe, expect, it } from "vitest";
import { createAnthropicCreativeModel, createMemorySpendLedger, CreativeModelDisabledError, CreativeModelTruncatedError } from "./model";

const baseEnv = {
  CFL_CREATIVE_LLM_ENABLED: "true",
  ANTHROPIC_API_KEY: "test-key-not-real",
  CFL_CREATIVE_PRICE_IN_USD_PER_MTOK: "3",
  CFL_CREATIVE_PRICE_OUT_USD_PER_MTOK: "15",
};
const req = { stage: "compose" as const, system: "s".repeat(300), user: "u".repeat(300), maxTokens: 1000 };
const okFetch = (usage?: { input_tokens: number; output_tokens: number }, stops: string[] = []) => {
  const f = (async (_u: unknown, init?: { body?: string }) => {
    f.calls += 1;
    const sent = JSON.parse(String(init?.body ?? "{}"));
    f.sentMax.push(sent.max_tokens);
    f.sentSystem.push(String(sent.system ?? ""));
    return new Response(JSON.stringify({ content: [{ type: "text", text: "{}" }], usage, stop_reason: stops.shift() ?? "end_turn" }), { status: 200 });
  }) as unknown as typeof fetch & { calls: number; sentMax: number[]; sentSystem: string[] };
  f.calls = 0; f.sentMax = []; f.sentSystem = [];
  return f;
};

describe("hosted model spend guard", () => {
  it("refuses to run without explicit prices (fail closed, no network call)", async () => {
    const f = okFetch();
    const m = createAnthropicCreativeModel({ ...baseEnv, CFL_CREATIVE_PRICE_IN_USD_PER_MTOK: undefined }, f, createMemorySpendLedger());
    await expect(m.complete(req)).rejects.toThrow(/set CFL_CREATIVE_PRICE_IN_USD_PER_MTOK/);
    expect(f.calls).toBe(0);
  });

  it("refuses non-positive or malformed prices", async () => {
    for (const bad of ["0", "-1", "abc", ""]) {
      const f = okFetch();
      const m = createAnthropicCreativeModel({ ...baseEnv, CFL_CREATIVE_PRICE_OUT_USD_PER_MTOK: bad }, f, createMemorySpendLedger());
      await expect(m.complete(req)).rejects.toBeInstanceOf(CreativeModelDisabledError);
      expect(f.calls).toBe(0);
    }
  });

  it("records actual usage and accumulates it in the ledger", async () => {
    const ledger = createMemorySpendLedger();
    const m = createAnthropicCreativeModel(baseEnv, okFetch({ input_tokens: 1000, output_tokens: 2000 }), ledger);
    await m.complete(req);
    // 1000*3/1e6 + 2000*15/1e6 = 0.033
    expect(Math.abs(ledger.read() - 0.033)).toBeLessThan(1e-6);
    await m.complete(req);
    expect(Math.abs(ledger.read() - 0.066)).toBeLessThan(1e-6);
  });

  it("blocks a call whose worst case would pass the cap, before any network call", async () => {
    const f = okFetch({ input_tokens: 1, output_tokens: 1 });
    // Worst case here is ~ (200*3 + 1000*15)/1e6 = $0.0156; spent 0.99 of a $1 cap leaves $0.01.
    const m = createAnthropicCreativeModel({ ...baseEnv, CFL_CREATIVE_TOTAL_CAP_USD: "1" }, f, createMemorySpendLedger(0.99));
    await expect(m.complete(req)).rejects.toThrow(/Spend guard: refusing compose/);
    expect(f.calls).toBe(0);
  });

  it("never allows a cap above the $25 ceiling", async () => {
    const f = okFetch({ input_tokens: 1, output_tokens: 1 });
    const m = createAnthropicCreativeModel({ ...baseEnv, CFL_CREATIVE_TOTAL_CAP_USD: "1000" }, f, createMemorySpendLedger(24.999));
    await expect(m.complete(req)).rejects.toThrow(/\$25\.00 cap/);
  });

  it("charges the worst case when the provider omits usage, so the cap stays honest", async () => {
    const ledger = createMemorySpendLedger();
    const m = createAnthropicCreativeModel(baseEnv, okFetch(undefined), ledger);
    await m.complete(req);
    expect(ledger.read()).toBeGreaterThan(0.015);
  });

  it("stays inert unless explicitly enabled", async () => {
    const f = okFetch();
    const m = createAnthropicCreativeModel({ ...baseEnv, CFL_CREATIVE_LLM_ENABLED: "false" }, f, createMemorySpendLedger());
    await expect(m.complete(req)).rejects.toThrow(/disabled/);
    expect(f.calls).toBe(0);
  });

  it("still enforces the per-process call ceiling", async () => {
    const m = createAnthropicCreativeModel({ ...baseEnv, CFL_CREATIVE_MAX_CALLS: "1" }, okFetch({ input_tokens: 1, output_tokens: 1 }), createMemorySpendLedger());
    await m.complete(req);
    await expect(m.complete(req)).rejects.toThrow(/call ceiling/);
  });

  it("never sends a hosted request below the stage floor", async () => {
    const f = okFetch({ input_tokens: 10, output_tokens: 10 });
    const m = createAnthropicCreativeModel(baseEnv, f, createMemorySpendLedger());
    await m.complete({ ...req, stage: "frame", maxTokens: 1500 });
    expect(f.sentMax[0]).toBe(4000);
  });

  it("retries once with a doubled budget when output is truncated, and records both calls", async () => {
    const ledger = createMemorySpendLedger();
    const f = okFetch({ input_tokens: 100, output_tokens: 100 }, ["max_tokens", "end_turn"]);
    const m = createAnthropicCreativeModel(baseEnv, f, ledger);
    await m.complete({ ...req, stage: "frame", maxTokens: 1500 });
    expect(f.sentMax.join(",")).toBe("4000,8000");
    expect(ledger.read() > 0.0029).toBe(true);
  });

  it("raises a clear truncation error when the retry is also cut off", async () => {
    const m = createAnthropicCreativeModel(baseEnv, okFetch({ input_tokens: 1, output_tokens: 1 }, ["max_tokens", "max_tokens"]), createMemorySpendLedger());
    await expect(m.complete({ ...req, stage: "frame", maxTokens: 1500 })).rejects.toBeInstanceOf(CreativeModelTruncatedError);
  });

  it("charges the doubled-budget worst case against the cap before retrying", async () => {
    const f = okFetch({ input_tokens: 1, output_tokens: 1 }, ["max_tokens", "end_turn"]);
    // With the $15/MTok output price: first call worst case ~ $0.061, retry ~ $0.121. A $0.07 cap allows the first and blocks the retry.
    const m = createAnthropicCreativeModel({ ...baseEnv, CFL_CREATIVE_TOTAL_CAP_USD: "0.07" }, f, createMemorySpendLedger());
    await expect(m.complete({ ...req, stage: "frame", maxTokens: 1500 })).rejects.toThrow(/Spend guard/);
    expect(f.calls).toBe(1);
  });

  it("tells a hosted model to keep each stage short, without changing the caller's prompt", async () => {
    const f = okFetch({ input_tokens: 10, output_tokens: 10 });
    const m = createAnthropicCreativeModel(baseEnv, f, createMemorySpendLedger());
    await m.complete({ ...req, stage: "frame", system: "ORIGINAL" });
    expect(f.sentSystem[0].startsWith("ORIGINAL")).toBe(true);
    expect(f.sentSystem[0].includes("OUTPUT LENGTH")).toBe(true);
    expect(f.sentSystem[0].includes("1,200 tokens")).toBe(true);
  });
});
