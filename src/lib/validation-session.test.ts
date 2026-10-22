import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createFileValidationBudget, createMemoryValidationBudget, getValidationBudget, HARD_LIMITS,
  resetValidationBudgetCacheForTests, ValidationBudgetError,
} from "./validation-session";
import { createAnthropicCreativeModel, createMemorySpendLedger } from "./agent/creative/model";
import { qlooRequest } from "./qloo/client";
import { createQlooPlanSource } from "./agent/sources/qloo-plan-source";
import { POST as ablationPost } from "./../app/api/ablation/route";
import type { CulturalSourceContext } from "./agent/types";

// Everything here is offline: injected fetch functions, temp files, no network, no paid call.
let dir = "";
const SAVED: Record<string, string | undefined> = {};
const ENV_KEYS = ["CFL_VALIDATION_SESSION", "CFL_VALIDATION_SESSION_FILE", "CFL_SESSION_MAX_QLOO_HTTP", "CFL_SESSION_MAX_ANTHROPIC_LOGICAL",
  "CFL_SESSION_MAX_ANTHROPIC_HTTP", "CFL_ABLATION_ENABLED", "CFL_CREATIVE_LLM_ENABLED", "ANTHROPIC_API_KEY", "CFL_CREATIVE_PRICE_IN_USD_PER_MTOK",
  "CFL_CREATIVE_PRICE_OUT_USD_PER_MTOK", "CFL_CREATIVE_MAX_CALLS", "CFL_CREATIVE_SPEND_LEDGER", "CFL_CREATIVE_TOTAL_CAP_USD"];
const realFetch = globalThis.fetch;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "cfl-vs-"));
  for (const k of ENV_KEYS) { SAVED[k] = process.env[k]; delete process.env[k]; }
  resetValidationBudgetCacheForTests();
});
afterEach(() => {
  for (const k of ENV_KEYS) { if (SAVED[k] === undefined) delete process.env[k]; else process.env[k] = SAVED[k]; }
  globalThis.fetch = realFetch;
  resetValidationBudgetCacheForTests();
  rmSync(dir, { recursive: true, force: true });
});
const sessionEnv = (file = join(dir, "session.json")) => { process.env.CFL_VALIDATION_SESSION = "true"; process.env.CFL_VALIDATION_SESSION_FILE = file; return file; };

const modelEnv = { CFL_CREATIVE_LLM_ENABLED: "true", ANTHROPIC_API_KEY: "test-key-not-real", CFL_CREATIVE_PRICE_IN_USD_PER_MTOK: "2",
  CFL_CREATIVE_PRICE_OUT_USD_PER_MTOK: "10", CFL_CREATIVE_MAX_CALLS: "100", CFL_CREATIVE_TOTAL_CAP_USD: "5" };
function anthropicFetch(stops: string[], counter: { n: number }) {
  return (async () => {
    const stop = stops[counter.n % stops.length];
    counter.n++;
    return new Response(JSON.stringify({ content: [{ type: "text", text: "{}" }], usage: { input_tokens: 10, output_tokens: 10 }, stop_reason: stop }), { status: 200 });
  }) as unknown as typeof fetch;
}
const req = { stage: "compose" as const, system: "s", user: "u", maxTokens: 100 };

describe("budget counters", () => {
  it("never allows more than the hard limits, whatever limits are requested", () => {
    expect(HARD_LIMITS).toEqual({ qlooHttp: 6, anthropicLogical: 10, anthropicHttp: 20 });
    const file = join(dir, "s.json");
    writeFileSync(file, JSON.stringify({ version: 1, createdAt: "x", limits: { qlooHttp: 99, anthropicLogical: 10, anthropicHttp: 20 }, used: { qlooHttp: 0, anthropicLogical: 0, anthropicHttp: 0 }, runs: {} }));
    expect(() => createFileValidationBudget(file).reserve("qlooHttp")).toThrow(ValidationBudgetError); // tampered limit rejected
  });

  it("allows exactly 6 Qloo requests, then refuses the 7th", () => {
    const b = createMemoryValidationBudget();
    for (let i = 0; i < 6; i++) b.reserve("qlooHttp");
    expect(() => b.reserve("qlooHttp")).toThrow(/exhausted/);
    expect(b.snapshot().used.qlooHttp).toBe(6);
  });

  it("environment variables can lower limits but never raise them, and bad values fail closed", () => {
    sessionEnv();
    process.env.CFL_SESSION_MAX_QLOO_HTTP = "99";
    expect(getValidationBudget()!.snapshot().limits.qlooHttp).toBe(6);
    resetValidationBudgetCacheForTests();
    process.env.CFL_VALIDATION_SESSION_FILE = join(dir, "other.json");
    process.env.CFL_SESSION_MAX_QLOO_HTTP = "2";
    const b = getValidationBudget()!; b.reserve("qlooHttp"); b.reserve("qlooHttp");
    expect(() => b.reserve("qlooHttp")).toThrow(ValidationBudgetError);
    resetValidationBudgetCacheForTests();
    process.env.CFL_VALIDATION_SESSION_FILE = join(dir, "bad.json");
    process.env.CFL_SESSION_MAX_QLOO_HTTP = "abc";
    expect(() => getValidationBudget()!.reserve("qlooHttp")).toThrow(ValidationBudgetError);
  });

  it("is inactive (null) unless CFL_VALIDATION_SESSION=true", () => {
    expect(getValidationBudget()).toBeNull();
    process.env.CFL_VALIDATION_SESSION = "false";
    expect(getValidationBudget()).toBeNull();
  });

  it("persists counters across a restart (a new instance on the same file)", () => {
    const file = join(dir, "s.json");
    const a = createFileValidationBudget(file);
    for (let i = 0; i < 4; i++) a.reserve("qlooHttp");
    const b = createFileValidationBudget(file); // simulated dev-server restart
    expect(b.snapshot().used.qlooHttp).toBe(4);
    b.reserve("qlooHttp"); b.reserve("qlooHttp");
    expect(() => b.reserve("qlooHttp")).toThrow(/exhausted/);
  });
});

describe("fail closed when state cannot be trusted", () => {
  it("refuses on a corrupted file", () => {
    const file = join(dir, "s.json"); writeFileSync(file, "{not json");
    expect(() => createFileValidationBudget(file).reserve("anthropicHttp")).toThrow(/refusing/);
    expect(readFileSync(file, "utf8")).toBe("{not json"); // never overwritten
  });
  it("refuses on malformed counters", () => {
    const file = join(dir, "s.json");
    writeFileSync(file, JSON.stringify({ version: 1, createdAt: "x", limits: { qlooHttp: 6, anthropicLogical: 10, anthropicHttp: 20 }, used: { qlooHttp: -1, anthropicLogical: 0, anthropicHttp: 0 }, runs: {} }));
    expect(() => createFileValidationBudget(file).reserve("qlooHttp")).toThrow(ValidationBudgetError);
  });
  it("refuses while another process holds the lock, and does not delete that lock", () => {
    const file = join(dir, "s.json"); writeFileSync(`${file}.lock`, "");
    expect(() => createFileValidationBudget(file).reserve("qlooHttp")).toThrow(/lock/);
    expect(existsSync(`${file}.lock`)).toBe(true);
  });
  it("refuses when the state file cannot be written", () => {
    const blocker = join(dir, "blocker"); writeFileSync(blocker, "x"); // a file where a directory is needed
    expect(() => createFileValidationBudget(join(blocker, "s.json")).reserve("qlooHttp")).toThrow(ValidationBudgetError);
  });
  it("releases the lock after every operation, including refused ones", () => {
    const file = join(dir, "s.json"); const b = createFileValidationBudget(file, { qlooHttp: 1, anthropicLogical: 1, anthropicHttp: 1 });
    b.reserve("qlooHttp"); expect(() => b.reserve("qlooHttp")).toThrow();
    expect(existsSync(`${file}.lock`)).toBe(false);
  });
});

describe("duplicate submissions", () => {
  it("rejects a second start of the same run kind, in flight or after it finished", () => {
    const b = createMemoryValidationBudget();
    b.startRun("explore");
    expect(() => b.startRun("explore")).toThrow(/in progress/);
    b.finishRun("explore");
    expect(() => b.startRun("explore")).toThrow(/already started/); // a finished or failed run is never repeated automatically
    b.startRun("ablation"); // other kinds are independent
  });
  it("remembers a started run across a restart", () => {
    const file = join(dir, "s.json");
    createFileValidationBudget(file).startRun("explore");
    expect(() => createFileValidationBudget(file).startRun("explore")).toThrow(/already started/);
  });
});

describe("Anthropic: logical calls and HTTP attempts", () => {
  it("counts a truncation retry as one logical call and two HTTP attempts", async () => {
    const budget = createMemoryValidationBudget(); const c = { n: 0 };
    const model = createAnthropicCreativeModel(modelEnv, anthropicFetch(["max_tokens", "end_turn"], c), createMemorySpendLedger(), budget);
    await model.complete(req);
    expect(c.n).toBe(2);
    expect(budget.snapshot().used).toMatchObject({ anthropicLogical: 1, anthropicHttp: 2 });
  });

  it("stops at the HTTP ceiling mid-retry without sending another request", async () => {
    const budget = createMemoryValidationBudget({ qlooHttp: 6, anthropicLogical: 10, anthropicHttp: 3 }); const c = { n: 0 };
    const model = createAnthropicCreativeModel(modelEnv, anthropicFetch(["max_tokens"], c), createMemorySpendLedger(), budget);
    await expect(model.complete(req)).rejects.toThrow(); // truncated twice (2 HTTP)
    await expect(model.complete(req)).rejects.toThrow(/exhausted/); // 3rd HTTP ok, retry would be the 4th
    expect(c.n).toBe(3);
    await expect(model.complete(req)).rejects.toBeInstanceOf(ValidationBudgetError);
    expect(c.n).toBe(3);
  });

  it("shares ONE 10-call logical budget across exploration and comparison instances", async () => {
    const budget = createMemoryValidationBudget(); const c = { n: 0 };
    const exploration = createAnthropicCreativeModel(modelEnv, anthropicFetch(["end_turn"], c), createMemorySpendLedger(), budget);
    const comparison = createAnthropicCreativeModel(modelEnv, anthropicFetch(["end_turn"], c), createMemorySpendLedger(), budget);
    for (let i = 0; i < 6; i++) await exploration.complete(req);
    for (let i = 0; i < 4; i++) await comparison.complete(req);
    await expect(comparison.complete(req)).rejects.toBeInstanceOf(ValidationBudgetError);
    await expect(exploration.complete(req)).rejects.toBeInstanceOf(ValidationBudgetError);
    expect(c.n).toBe(10);
    expect(budget.snapshot().used.anthropicLogical).toBe(10);
  });

  it("caps total HTTP attempts at 20 even when every call is truncated once", async () => {
    const budget = createMemoryValidationBudget(); const c = { n: 0 };
    const model = createAnthropicCreativeModel(modelEnv, anthropicFetch(["max_tokens", "end_turn"], c), createMemorySpendLedger(), budget);
    // Alternating truncated / complete responses: every logical call costs 2 HTTP attempts.
    for (let i = 0; i < 10; i++) await model.complete(req);
    expect(c.n).toBe(20);
    expect(budget.snapshot().used).toMatchObject({ anthropicLogical: 10, anthropicHttp: 20 });
    await expect(model.complete(req)).rejects.toBeInstanceOf(ValidationBudgetError);
    expect(c.n).toBe(20);
  });

  it("keeps the $5 monetary guard in force alongside the call budget", async () => {
    const budget = createMemoryValidationBudget(); const c = { n: 0 };
    const model = createAnthropicCreativeModel(modelEnv, anthropicFetch(["end_turn"], c), createMemorySpendLedger(4.999999), budget);
    await expect(model.complete(req)).rejects.toThrow(/Spend guard/);
    expect(c.n).toBe(0);
  });

  it("fails closed when the shared state is unreadable: nothing is sent", async () => {
    const file = join(dir, "s.json"); writeFileSync(file, "garbage"); const c = { n: 0 };
    const model = createAnthropicCreativeModel(modelEnv, anthropicFetch(["end_turn"], c), createMemorySpendLedger(), createFileValidationBudget(file));
    await expect(model.complete(req)).rejects.toBeInstanceOf(ValidationBudgetError);
    expect(c.n).toBe(0);
  });
});

describe("Qloo: every HTTP request is reserved, including failures", () => {
  const config = { apiKey: "test-key", baseUrl: "https://example.test", timeoutMs: 5000 };
  it("allows 6 requests (probe + 5), then refuses the 7th without sending it", async () => {
    sessionEnv(); let sent = 0;
    const fetchImpl = async () => { sent++; return new Response(JSON.stringify({ results: [] }), { status: 200 }); };
    for (let i = 0; i < 6; i++) await qlooRequest({ path: "/search", fetchImpl, config });
    await expect(qlooRequest({ path: "/search", fetchImpl, config })).rejects.toBeInstanceOf(ValidationBudgetError);
    expect(sent).toBe(6);
  });
  it("counts a request that fails with HTTP 500", async () => {
    sessionEnv(); let sent = 0;
    const fetchImpl = async () => { sent++; return new Response("{}", { status: 500 }); };
    await expect(qlooRequest({ path: "/search", fetchImpl, config })).rejects.toThrow();
    expect(getValidationBudget()!.snapshot().used.qlooHttp).toBe(1);
    expect(sent).toBe(1);
  });
  it("does not swallow budget exhaustion inside discovery: it stops and surfaces the error", async () => {
    sessionEnv(); process.env.CFL_SESSION_MAX_QLOO_HTTP = "1"; let sent = 0;
    const fetchImpl = async () => { sent++; return new Response(JSON.stringify({ results: { tags: [] } }), { status: 200 }); };
    const ctx = {
      request: { creativeObjective: "Design a cycling night ride service in Louisville", culturalInterest: "cycling", location: "Louisville, Kentucky", outputCategory: "experience", mode: "live" },
      plan: { searches: [], notes: [] },
    } as unknown as CulturalSourceContext;
    await expect(createQlooPlanSource({ fetchImpl, config, bypassLiveGate: true }).collect(ctx)).rejects.toBeInstanceOf(ValidationBudgetError);
    expect(sent).toBe(1);
  });
  it("is not applied (no counting) outside a validation session", async () => {
    let sent = 0;
    const fetchImpl = async () => { sent++; return new Response("{}", { status: 200 }); };
    for (let i = 0; i < 8; i++) await qlooRequest({ path: "/search", fetchImpl, config });
    expect(sent).toBe(8);
  });
});

describe("comparison route: duplicate clicks", () => {
  const concept = {
    spec: { operationalTransfer: { transfers: [{ sourceDomain: "Slow Roll", operatingDecision: "pace to the slowest rider" }] }, evidenceSufficiency: { status: "sufficient" } },
    culturalInfluences: [{ id: "e1", name: "Zanzabar Listening Room", category: "places", description: "Listening room", affinity: 0.5, tags: ["bebop"] }],
  };
  const output = JSON.stringify({ name: "Paced Ride", proposition: "A paced ride.", audience: "Riders", context: "Evening", mechanics: "Riders gather and ride at the slowest pace.", journey: ["Gather", "Ride", "Listen"], differentiationHypothesis: "h", pilotExperiment: "Over six weeks, measure repeat attendance." });
  const post = () => ablationPost(new Request("http://localhost/api/ablation", {
    method: "POST", body: JSON.stringify({ mode: "live", concept, request: { creativeObjective: "a bicycle and jazz listening evening", outputCategory: "experience", location: "Louisville, Kentucky" } }),
  }));
  function arm() {
    sessionEnv();
    Object.assign(process.env, { CFL_ABLATION_ENABLED: "true", CFL_CREATIVE_LLM_ENABLED: "true", ANTHROPIC_API_KEY: "test-key-not-real",
      CFL_CREATIVE_PRICE_IN_USD_PER_MTOK: "2", CFL_CREATIVE_PRICE_OUT_USD_PER_MTOK: "10", CFL_CREATIVE_MAX_CALLS: "100",
      CFL_CREATIVE_SPEND_LEDGER: join(dir, "spend.json"), CFL_CREATIVE_TOTAL_CAP_USD: "5" });
    const c = { n: 0 };
    globalThis.fetch = (async () => { c.n++; return new Response(JSON.stringify({ content: [{ type: "text", text: output }], usage: { input_tokens: 10, output_tokens: 10 }, stop_reason: "end_turn" }), { status: 200 }); }) as unknown as typeof fetch;
    return c;
  }
  it("runs once; a second click afterwards is rejected with 409 and sends nothing", async () => {
    const c = arm();
    const first = await post();
    expect(first.status).toBe(200);
    expect(c.n).toBe(4);
    const second = await post();
    expect(second.status).toBe(409);
    expect(c.n).toBe(4);
  });
  it("two simultaneous clicks start only one comparison", async () => {
    const c = arm();
    const [a, b] = await Promise.all([post(), post()]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(c.n).toBe(4);
  });
  it("refuses with 503 and sends nothing when the session state is unsafe", async () => {
    const c = arm();
    writeFileSync(process.env.CFL_VALIDATION_SESSION_FILE!, "corrupt");
    const res = await post();
    expect(res.status).toBe(503);
    expect(c.n).toBe(0);
  });
});
