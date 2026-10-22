#!/usr/bin/env node
/**
 * One-off Qloo probe: AT MOST 2 HTTP requests, no Anthropic calls. Tests whether the documented HARD filter
 * `filter.tags` (instead of the soft taste signal `signal.interests.tags`) restricts place results to the topic.
 *   1. GET /v2/insights filter.type=urn:entity:place, filter.tags=urn:tag:genre:place:jazz_club,        location Louisville
 *   2. GET /v2/insights filter.type=urn:entity:place, filter.tags=urn:tag:category:place:cycling_park,   location Louisville
 * Reads the key from .env.local, never prints it, refuses to run twice.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const MAX_REQUESTS = 2;
const MARKER = ".cfl-qloo-filter-probe-used";
const OUT = "src/lib/qloo/fixtures/live-probe-filter-tags-2026-10-22.json";
const LOCATION = "Louisville, Kentucky";
const TAGS = ["urn:tag:genre:place:jazz_club", "urn:tag:category:place:cycling_park"];

if (existsSync(MARKER)) { console.error(`Refusing to run: ${MARKER} exists. Delete it on purpose to run again.`); process.exit(2); }
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

writeFileSync(MARKER, new Date().toISOString());
let used = 0;
const entsOf = (b) => (b?.results?.entities ?? []).map(e => ({
  entity_id: e.entity_id, name: e.name, subtype: e.subtype, type: e.type,
  tags: (e.tags ?? []).map(t => ({ name: t.name, id: t.id })).slice(0, 24),
  properties: { description: e.properties?.description, address: e.properties?.address, geocode: e.properties?.geocode },
  location: e.location,
}));
const out = { notes: "Real Qloo responses recorded 2026-10-22 by scripts/qloo-filter-probe.mjs (2-request cap). Hard filter.tags.", location: LOCATION, results: {} };
for (const tag of TAGS) {
  if (used >= MAX_REQUESTS) break;
  used++;
  const url = new URL("/v2/insights", base + "/");
  url.searchParams.set("filter.type", "urn:entity:place");
  url.searchParams.set("filter.tags", tag);
  url.searchParams.set("filter.location.query", LOCATION);
  url.searchParams.set("take", "8");
  const res = await fetch(url, { headers: { Accept: "application/json", "X-Api-Key": apiKey }, signal: AbortSignal.timeout(15000) });
  const text = await res.text();
  console.log(`${used}/${MAX_REQUESTS} GET /v2/insights filter.tags=${tag} -> HTTP ${res.status}`);
  let body = null; try { body = JSON.parse(text); } catch { /* ignore */ }
  out.results[tag] = { status: res.status, entities: res.ok ? entsOf(body) : [] };
}
out.requestsUsed = used;
writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`\nRequests used: ${used} of ${MAX_REQUESTS}. Saved ${OUT}\n`);
for (const tag of TAGS) {
  console.log(`filter.tags=${tag}`);
  for (const e of out.results[tag]?.entities ?? []) console.log(` - ${e.name} | ${e.tags.slice(0, 6).map(t => t.name).join(", ")} | ${e.properties.geocode?.city ?? "?"}, ${e.properties.geocode?.admin1_region ?? "?"}`);
  if (!(out.results[tag]?.entities ?? []).length) console.log(" (no entities)");
}
