import { describe, expect, it } from "vitest";
import tagFixture from "../../qloo/fixtures/live-probe-tags-2026-10-21.json";
import fixture from "../../qloo/fixtures/live-probe-2026-10-21.json";
import filterFixture from "../../qloo/fixtures/live-probe-filter-tags-2026-10-22.json";
import tagTypes from "../../qloo/fixtures/live-probe-tagtypes-2026-10-22.json";
import tagTypesList from "../../qloo/fixtures/live-probe-tagtypes-list-2026-10-22.json";
import { createQlooPlanSource } from "./qloo-plan-source";
import { assessEvidenceEligibility } from "../evidence/eligibility";
import { AgentError } from "../types";
import type { CulturalSourceContext } from "../types";

// Replays REAL Qloo responses recorded on 2026-10-21 and 2026-10-22 (see fixture notes). No network.
// Recorded: /v2/tags for "cycling" (plain, and place-type list), "jazz" (genre:place) and "community"; hard-filter Insights for
// jazz_club (one real jazz club in Louisville) and cycling_park (nothing in Louisville). Anything not recorded replays as EMPTY,
// never as invented data.
function replayFetch(calls: string[], opts: { failInsights?: boolean; empty?: boolean } = {}) {
  return async (input: string | URL) => {
    const url = new URL(String(input));
    calls.push(`${url.pathname}?${url.searchParams.toString()}`);
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
    if (opts.empty) return json({ results: { entities: [], tags: [] } });
    if (url.pathname === "/v2/tags") {
      const q = (url.searchParams.get("filter.query") ?? "").toLowerCase();
      const types = url.searchParams.get("filter.tag.types");
      if (types) {
        if (q === "jazz" && types.includes("urn:tag:genre:place")) return json({ results: { tags: tagTypes.results[0]!.tags } });
        if (q === "cycling" && types.includes("urn:tag:category:place")) return json({ results: { tags: tagTypesList.results[0]!.tags } });
        return json({ results: { tags: [] } });
      }
      if (q === "cycling") return json(tagFixture.tagsCycling);
      if (q === "community") return json(tagFixture.tagsCommunity);
      return json({ results: { tags: [] } });
    }
    if (url.pathname === "/v2/insights") {
      if (opts.failInsights) return json({}, 500);
      const filterTag = url.searchParams.get("filter.tags");
      if (filterTag) {
        const rec = (filterFixture.results as Record<string, { entities: unknown[] }>)[filterTag];
        return json({ results: { entities: rec?.entities ?? [] } });
      }
      return url.searchParams.get("filter.type") === "urn:entity:brand" ? json(tagFixture.insightsBrandByMediaTag) : json({ results: { entities: [] } });
    }
    if (url.pathname === "/search") {
      const body = (fixture.searchByType as Record<string, unknown>)[url.searchParams.get("type") ?? ""];
      return body ? json(body) : json({ results: [] });
    }
    return json({}, 404);
  };
}
const config = { apiKey: "test-key", baseUrl: "https://example.test", timeoutMs: 5000 };
const ctx = (interest = "cycling and jazz", output: "experience" | "product" = "experience"): CulturalSourceContext => ({
  request: { creativeObjective: `Design a ${interest} night ride service in Louisville`, culturalInterest: interest, location: "Louisville, Kentucky", outputCategory: output, mode: "live" },
  plan: {
    searches: [
      { id: "p0", query: "Village Vanguard", entityType: "urn:entity:place", category: "places", rationale: "recalled venue" },
      { id: "p1", query: "Slow Roll Detroit", entityType: "urn:entity:brand", category: "brands", rationale: "recalled group" },
      { id: "p2", query: "bicycle", entityType: "urn:entity:brand", category: "brands", rationale: "generic topic" },
    ],
    notes: [],
  } as unknown as CulturalSourceContext["plan"],
});
const decoded = (c: string) => new URL(`https://x.test${c}`).searchParams;
const collect = (calls: string[] = [], c = ctx(), extra = {}) => createQlooPlanSource({ fetchImpl: replayFetch(calls), config, bypassLiveGate: true, ...extra }).collect(c);

describe("createQlooPlanSource (documented filters; replay of real Qloo responses)", () => {
  it("never exceeds the request budget and never sends a speculative named query", async () => {
    const calls: string[] = [];
    await collect(calls);
    expect(calls.length).toBeLessThanOrEqual(5);
    expect(calls.some(c => /Village|Vanguard|Slow\+Roll|Detroit/.test(c))).toBe(false);
    expect(calls.some(c => c.startsWith("/search") && c.includes("query=bicycle"))).toBe(true);
  });

  it("looks up place-type tags per topic phrase with the documented tag-type filter", async () => {
    const calls: string[] = [];
    await collect(calls);
    const lookups = calls.filter(c => c.startsWith("/v2/tags")).map(decoded);
    expect(lookups.map(p => p.get("filter.query"))).toEqual(["cycling", "jazz"]);
    expect(lookups.every(p => p.get("filter.tag.types") === "urn:tag:genre:place,urn:tag:category:place")).toBe(true);
  });

  it("restricts places with the HARD filter (filter.tags, one tag per call) and the brief's location, not a soft signal", async () => {
    const calls: string[] = [];
    await collect(calls);
    const insights = calls.filter(c => c.startsWith("/v2/insights")).map(decoded);
    expect(insights.length).toBeGreaterThanOrEqual(1);
    for (const p of insights) {
      expect(p.get("filter.type")).toBe("urn:entity:place");
      expect(p.get("filter.location.query")).toBe("Louisville, Kentucky");
      expect(p.get("signal.interests.tags")).toBeNull();
      expect(p.get("signal.interests.entities")).toBeNull();
      const tag = p.get("filter.tags")!;
      expect(tag.includes(",")).toBe(false);
      expect(tag.includes(":place:")).toBe(true);
    }
  });

  it("asks about every topic phrase before spending a second attempt on one (no phrase starves another)", async () => {
    const calls: string[] = [];
    await collect(calls);
    const tags = calls.filter(c => c.startsWith("/v2/insights")).map(decoded).map(p => p.get("filter.tags")!);
    expect(tags.some(t => t.includes("jazz_club"))).toBe(true);
    expect(tags.some(t => t.includes("cycling"))).toBe(true);
  });

  it("collects the real jazz club Qloo returned, with id, retrieval path, tag use, filter tag and place facts", async () => {
    const bundle = await collect();
    const jazz = bundle.entities.find(e => e.name === "Jimmy Can't Dance")!;
    expect(jazz).toBeDefined();
    expect(jazz.qloo!.entityId).toBe(jazz.id);
    expect(jazz.qloo!.retrievedVia).toBe("insights");
    expect(jazz.qloo!.tagUse).toBe("filter");
    expect(jazz.qloo!.signalTagIds).toEqual(["urn:tag:genre:place:jazz_club"]);
    expect(jazz.qloo!.place?.city).toBe("Louisville");
    expect(jazz.qloo!.place?.region).toBe("Kentucky");
    expect(bundle.entities.every(e => e.qloo?.provider === "qloo")).toBe(true);
    expect(Object.values(bundle.provenanceByEntityId).every(v => v === "verified_api")).toBe(true);
    expect(bundle.evidence.every(e => e.source === "verified_api")).toBe(true);
  });

  it("does not request or return the unrelated places a soft signal returned (pet shop, fast food, salon)", async () => {
    const bundle = await collect();
    const names = bundle.entities.map(e => e.name).join("|");
    expect(names).not.toMatch(/Pet Shop|Zaxbys|Salon|Pizza|Steakhouse/);
  });

  it("feeds eligibility: the validated Louisville jazz club is eligible and nothing is added for cycling", async () => {
    const bundle = await collect();
    const report = assessEvidenceEligibility({ entities: bundle.entities, request: ctx().request });
    const eligiblePlaces = report.eligible.filter(e => e.category === "places").map(e => e.name);
    expect(eligiblePlaces).toEqual(["Jimmy Can't Dance"]);
    expect(report.sufficiency.status).toBe("sufficient");
  });

  it("records the trace, including skipped speculative probes", async () => {
    const bundle = await collect();
    const notes = bundle.collectionNotes.join("\n");
    expect(notes).toMatch(/GET \/v2\/tags "jazz" types=\[/);
    expect(notes).toMatch(/GET \/v2\/insights urn:entity:place filter\.tags=\[Jazz club\]/);
    expect(notes).toMatch(/not sent \(speculative named query\)/);
    expect(notes).toMatch(/Qloo requests used: \d of 5/);
  });

  it("sends nothing about a topic with no place tag, and invents nothing", async () => {
    const calls: string[] = [];
    const bundle = await collect(calls, ctx("ceramics"));
    expect(calls.filter(c => c.startsWith("/v2/insights"))).toHaveLength(0);
    expect(bundle.collectionNotes.join(" ")).toMatch(/no place tag matched this topic/);
    expect(bundle.entities.every(e => e.qloo?.retrievedVia === "search")).toBe(true);
  });

  it("asks for brands with a taste signal and no location when the brief is a product", async () => {
    const calls: string[] = [];
    await collect(calls, ctx("cycling", "product"));
    const ins = calls.filter(c => c.startsWith("/v2/insights")).map(decoded);
    const brand = ins.find(p => p.get("filter.type") === "urn:entity:brand")!;
    expect(brand).toBeDefined();
    expect(brand.get("filter.location.query")).toBeNull();
    expect(brand.get("signal.interests.tags")).toBeTruthy();
    expect(calls.length).toBeLessThanOrEqual(5);
  });

  it("honors a smaller maxRequests", async () => {
    const calls: string[] = [];
    await collect(calls, ctx(), { maxRequests: 2 });
    expect(calls.length).toBeLessThanOrEqual(2);
  });

  it("keeps the other evidence when Insights fails with a non-auth error", async () => {
    const bundle = await createQlooPlanSource({ fetchImpl: replayFetch([], { failInsights: true }), config, bypassLiveGate: true }).collect(ctx());
    expect(bundle.entities.length).toBeGreaterThanOrEqual(2);
    expect(bundle.collectionNotes.join(" ")).toMatch(/unavailable \(non-auth error\)/);
  });

  it("fails closed when the live gate is not open", async () => {
    await expect(createQlooPlanSource({ fetchImpl: replayFetch([]), config }).collect(ctx())).rejects.toThrow();
  });

  it("throws SOURCE_FAILURE when too few entities come back, without inventing any", async () => {
    await expect(createQlooPlanSource({ fetchImpl: replayFetch([], { empty: true }), config, bypassLiveGate: true }).collect(ctx())).rejects.toBeInstanceOf(AgentError);
  });
});
