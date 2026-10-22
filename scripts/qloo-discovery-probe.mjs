#!/usr/bin/env node
/**
 * One-off Qloo discovery probe: AT MOST 3 HTTP requests, no Anthropic calls.
 *   1. GET /v2/tags   filter.query="jazz club"
 *   2. GET /v2/tags   filter.query="live music"
 *   3. GET /v2/insights  filter.type=urn:entity:place, signal.interests.tags=<first place-namespaced tag from 1 or 2>,
 *                        filter.location.query="Louisville, Kentucky"   (skipped if neither lookup returns a place tag)
 * Reads QLOO_API_KEY / QLOO_BASE_URL from .env.local, never prints the key, writes a trimmed JSON fixture.
 * Refuses to run twice (a marker file records that the probe was used).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const MAX_REQUESTS = 3;
const MARKER = ".cfl-qloo-probe-used";
const OUT = "src/lib/qloo/fixtures/live-probe-jazz-2026-10-22.json";
const LOCATION = "Louisville, Kentucky";

if (existsSync(MARKER)) { console.error(`Refusing to run: ${MARKER} exists (the probe was already used). Delete it on purpose to run again.`); process.exit(2); }

const env = {};
try {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { console.error("Cannot read .env.local"); process.exit(2); }
const apiKey = (env.QLOO_API_KEY || process.env.QLOO_API_KEY || "").trim();
if (!apiKey) { console.error("QLOO_API_KEY is not set."); process.exit(2); }
const base = (env.QLOO_BASE_URL || process.env.QLOO_BASE_URL || "https://hackathon.api.qloo.com").replace(/\/+$/, "");

writeFileSync(MARKER, new Date().toISOString()); // marked BEFORE the first request: a crash cannot lead to a silent repeat
let used = 0;
async function get(path, query) {
  if (used >= MAX_REQUESTS) throw new Error("Request cap reached");
  used++;
  const url = new URL(path, base + "/");
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Accept: "application/json", "X-Api-Key": apiKey }, signal: AbortSignal.timeout(15000) });
  const text = await res.text();
  console.log(`${used}/${MAX_REQUESTS} GET ${path} ${JSON.stringify(query)} -> HTTP ${res.status}`);
  if (!res.ok) return { status: res.status, body: null };
  try { return { status: res.status, body: JSON.parse(text) }; } catch { return { status: res.status, body: null }; }
}
const tagsOf = (b) => (b?.results?.tags ?? []).map(t => ({ id: t.id, name: t.name, type: t.type }));
const entsOf = (b) => (b?.results?.entities ?? []).map(e => ({
  entity_id: e.entity_id, name: e.name, subtype: e.subtype, type: e.type,
  tags: (e.tags ?? []).map(t => ({ name: t.name, id: t.id })).slice(0, 24),
  properties: { description: e.properties?.description, address: e.properties?.address, geocode: e.properties?.geocode },
  location: e.location,
}));

const out = { notes: "Real Qloo responses recorded 2026-10-22 by scripts/qloo-discovery-probe.mjs (3-request cap).", location: LOCATION };
const jazz = await get("/v2/tags", { "filter.query": "jazz club", take: "10" });
out.tagsJazzClub = tagsOf(jazz.body);
const live = await get("/v2/tags", { "filter.query": "live music", take: "10" });
out.tagsLiveMusic = tagsOf(live.body);
const placeTag = [...out.tagsJazzClub, ...out.tagsLiveMusic].find(t => typeof t.id === "string" && t.id.includes(":place"));
out.chosenPlaceTag = placeTag ?? null;
if (placeTag) {
  const ins = await get("/v2/insights", { "filter.type": "urn:entity:place", "signal.interests.tags": placeTag.id, "filter.location.query": LOCATION, take: "8" });
  out.insightsPlaceByChosenTag = entsOf(ins.body);
} else {
  console.log("No place-namespaced tag found; Insights call skipped.");
  out.insightsPlaceByChosenTag = [];
}
out.requestsUsed = used;
writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`\nRequests used: ${used} of ${MAX_REQUESTS}. Saved ${OUT}\n`);
console.log("Tags 'jazz club':", out.tagsJazzClub.map(t => `${t.name} [${t.id}]`).join(" | ") || "none");
console.log("Tags 'live music':", out.tagsLiveMusic.map(t => `${t.name} [${t.id}]`).join(" | ") || "none");
console.log("Chosen place tag:", placeTag ? `${placeTag.name} [${placeTag.id}]` : "none");
for (const e of out.insightsPlaceByChosenTag) console.log(` - ${e.name} | ${e.tags.slice(0, 6).map(t => t.name).join(", ")} | ${e.properties.geocode?.city ?? "?"}, ${e.properties.geocode?.admin1_region ?? "?"}`);
