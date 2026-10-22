import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getLiveAvailability, parseLiveAvailability, resolveLiveUi } from "./live-availability";
import { HARD_LIMITS } from "./validation-session";
import { POST as explorePost } from "./../app/api/explore/route";
import { POST as mutatePost } from "./../app/api/mutate/route";
import { POST as ablationPost } from "./../app/api/ablation/route";
import { GET as statusGet } from "./../app/api/live/status/route";

// Fully offline: any outbound fetch fails the test. No key, no network, no paid call.
const KEYS = ["QLOO_LIVE_ENABLED", "QLOO_API_KEY", "CFL_ABLATION_ENABLED", "CFL_CREATIVE_LLM_ENABLED", "ANTHROPIC_API_KEY", "CFL_VALIDATION_SESSION"];
const SAVED: Record<string, string | undefined> = {};
const realFetch = globalThis.fetch;
let fetched = 0;
beforeEach(() => {
  for (const k of KEYS) { SAVED[k] = process.env[k]; delete process.env[k]; }
  fetched = 0;
  globalThis.fetch = (async () => { fetched++; throw new Error("network is forbidden in this test"); }) as typeof fetch;
});
afterEach(() => {
  for (const k of KEYS) { if (SAVED[k] === undefined) delete process.env[k]; else process.env[k] = SAVED[k]; }
  globalThis.fetch = realFetch;
});

const exploreBody = { creativeObjective: "Design a bicycle ride and live jazz evening", culturalInterest: "cycling and jazz", location: "Louisville, Kentucky", outputCategory: "experience", mode: "live" };
const post = (url: string, body: unknown) => new Request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

describe("live availability comes from the server environment only", () => {
  it("is unavailable with nothing configured", () => {
    const a = getLiveAvailability({});
    expect(a.exploration.available).toBe(false);
    expect(a.comparison.available).toBe(false);
  });
  it("needs the flag to be explicitly true: absent, false, 1, yes and empty all fail", () => {
    for (const v of [undefined, "false", "1", "yes", "", "enabled"]) {
      expect(getLiveAvailability({ QLOO_LIVE_ENABLED: v, QLOO_API_KEY: "k" }).exploration.available).toBe(false);
    }
  });
  it("needs the credential even when the flag is true (missing, empty and blank all fail)", () => {
    for (const v of [undefined, "", "   "]) {
      const a = getLiveAvailability({ QLOO_LIVE_ENABLED: "true", QLOO_API_KEY: v }).exploration;
      expect(a.available).toBe(false);
      expect(a.reason).toMatch(/credentials/);
    }
  });
  it("is available only with flag AND credential", () => {
    expect(getLiveAvailability({ QLOO_LIVE_ENABLED: "true", QLOO_API_KEY: "k" }).exploration).toEqual({ available: true, reason: null });
  });
  it("comparison needs its flag, the model flag exactly true, and the model key", () => {
    const ok = { CFL_ABLATION_ENABLED: "true", CFL_CREATIVE_LLM_ENABLED: "true", ANTHROPIC_API_KEY: "k" };
    expect(getLiveAvailability(ok).comparison.available).toBe(true);
    expect(getLiveAvailability({ ...ok, CFL_ABLATION_ENABLED: "false" }).comparison.available).toBe(false);
    expect(getLiveAvailability({ ...ok, CFL_CREATIVE_LLM_ENABLED: "TRUE" }).comparison.available).toBe(false);
    expect(getLiveAvailability({ ...ok, ANTHROPIC_API_KEY: "" }).comparison.available).toBe(false);
  });
  it("never puts a credential in its output", () => {
    const out = JSON.stringify(getLiveAvailability({ QLOO_LIVE_ENABLED: "true", QLOO_API_KEY: "SECRET-KEY-123", ANTHROPIC_API_KEY: "SECRET-ANTHROPIC-456", CFL_ABLATION_ENABLED: "true", CFL_CREATIVE_LLM_ENABLED: "true" }));
    expect(out).not.toMatch(/SECRET/);
  });
});

describe("a URL parameter never overrides the server", () => {
  const off = getLiveAvailability({});
  const on = getLiveAvailability({ QLOO_LIVE_ENABLED: "true", QLOO_API_KEY: "k" });
  it("?live=1 with an unavailable server is unavailable, not live", () => {
    const ui = resolveLiveUi("1", off);
    expect(ui.state).toBe("unavailable");
    expect(ui.liveActive).toBe(false);
    expect(ui.reason).toMatch(/not enabled/);
  });
  it("is not active while the status is pending, and not active if the status could not be read", () => {
    expect(resolveLiveUi("1", "pending")).toMatchObject({ state: "checking", liveActive: false });
    expect(resolveLiveUi("1", "error")).toMatchObject({ state: "unavailable", liveActive: false });
  });
  it("only an explicit server yes makes ?live=1 live; other values and no parameter stay demo", () => {
    expect(resolveLiveUi("1", on)).toMatchObject({ state: "live", liveActive: true });
    for (const p of [null, "0", "true", "", "2", "yes"]) expect(resolveLiveUi(p, on)).toMatchObject({ state: "demo", liveActive: false });
  });
  it("treats a malformed or forged status payload as unavailable", () => {
    for (const raw of [null, "x", 1, {}, { exploration: { available: "true" }, comparison: { available: true } }, { exploration: { available: true } }]) {
      expect(parseLiveAvailability(raw)).toBe("error");
    }
    expect(resolveLiveUi("1", parseLiveAvailability({ exploration: { available: "yes" }, comparison: { available: true } }))).toMatchObject({ liveActive: false });
  });
});

describe("direct API requests are rejected without the server's explicit yes", () => {
  it("explore: live mode is refused with no configuration, and nothing is fetched", async () => {
    const res = await explorePost(post("http://localhost/api/explore?live=1", exploreBody));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("QLOO_LIVE_DISABLED");
    expect(fetched).toBe(0);
  });
  it("explore: flag false with a key is refused; flag true without a key is refused", async () => {
    process.env.QLOO_API_KEY = "k"; process.env.QLOO_LIVE_ENABLED = "false";
    expect((await explorePost(post("http://localhost/api/explore", exploreBody))).status).toBe(503);
    delete process.env.QLOO_API_KEY; process.env.QLOO_LIVE_ENABLED = "true";
    expect((await explorePost(post("http://localhost/api/explore", exploreBody))).status).toBe(503);
    expect(fetched).toBe(0);
  });
  it("explore: the URL, headers and extra body fields cannot grant Live", async () => {
    const req = new Request("http://localhost/api/explore?live=1&QLOO_LIVE_ENABLED=true&liveAllowed=1", {
      method: "POST", headers: { "Content-Type": "application/json", "x-live": "1", "x-qloo-live-enabled": "true" },
      body: JSON.stringify({ ...exploreBody, liveAllowed: true, QLOO_LIVE_ENABLED: "true", QLOO_API_KEY: "forged" }),
    });
    const res = await explorePost(req);
    expect(res.status).toBe(503);
    expect(fetched).toBe(0);
  });
  it("explore: a refused live request does not consume the validation-session budget", async () => {
    process.env.CFL_VALIDATION_SESSION = "true";
    const res = await explorePost(post("http://localhost/api/explore", exploreBody));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("QLOO_LIVE_DISABLED");
  });
  it("mutate: live mode is refused with no configuration", async () => {
    const res = await mutatePost(post("http://localhost/api/mutate?live=1", {
      mode: "live", conceptId: "c", replaceEntityId: "a", newEntityId: "b",
      exploration: { creativeObjective: "x", culturalInterest: "y", outputCategory: "product", mode: "live" }, concepts: [], entities: [], evidence: [],
    }));
    expect([400, 503]).toContain(res.status);
    expect(fetched).toBe(0);
  });
  it("comparison: refused when disabled, and when enabled without the model key", async () => {
    const body = { mode: "live", concept: { spec: { operationalTransfer: {} }, culturalInfluences: [{ id: "a", name: "A" }] }, request: { creativeObjective: "x" } };
    let res = await ablationPost(post("http://localhost/api/ablation?live=1", body));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("ABLATION_DISABLED");
    process.env.CFL_ABLATION_ENABLED = "true";
    res = await ablationPost(post("http://localhost/api/ablation", body));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("CREATIVE_MODEL_DISABLED");
    process.env.CFL_CREATIVE_LLM_ENABLED = "true";
    res = await ablationPost(post("http://localhost/api/ablation", body));
    expect(res.status).toBe(503);
    expect(fetched).toBe(0);
  });
});

describe("the public status endpoint", () => {
  it("reports unavailable with no configuration and exposes no secret", async () => {
    const res = await statusGet(new Request("http://localhost/api/live/status"));
    const json = await res.json();
    expect(json.exploration.available).toBe(false);
    expect(json.comparison.available).toBe(false);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
  it("reports available only when the server is configured, without echoing the key", async () => {
    process.env.QLOO_LIVE_ENABLED = "true"; process.env.QLOO_API_KEY = "SECRET-KEY-123";
    const text = JSON.stringify(await (await statusGet(new Request("http://localhost/api/live/status"))).json());
    expect(JSON.parse(text).exploration.available).toBe(true);
    expect(text).not.toMatch(/SECRET/);
  });
});

describe("spend limits are unchanged", () => {
  it("keeps the validation-session hard limits at 6 Qloo / 10 logical / 20 HTTP", () => {
    expect(HARD_LIMITS).toMatchObject({ qlooHttp: 6, anthropicLogical: 10, anthropicHttp: 20 });
  });
});
