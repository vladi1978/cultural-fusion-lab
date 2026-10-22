#!/usr/bin/env node
/**
 * One-off Qloo probe: AT MOST 1 HTTP request, no Anthropic calls. Tests whether filter.tag.types accepts a comma-separated list of
 * two place tag types in ONE call (cycling's place tags are category:place, jazz's are genre:place):
 *   1. GET /v2/tags filter.query=cycling  filter.tag.types=urn:tag:genre:place,urn:tag:category:place
 * Reads the key from .env.local, never prints it, refuses to run twice.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const MAX_REQUESTS = 1;
const MARKER = ".cfl-qloo-tagtype-list-probe-used";
const OUT = "src/lib/qloo/fixtures/live-probe-tagtypes-list-2026-10-22.json";
const CALLS = [
  { query: "cycling", types: "urn:tag:genre:place,urn:tag:category:place" },
];
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
const out = { notes: "Real Qloo responses recorded 2026-10-22 by scripts/qloo-tagtype-probe.mjs (1-request cap).", results: [] };
for (const c of CALLS) {
  if (used >= MAX_REQUESTS) break;
  used++;
  const url = new URL("/v2/tags", base + "/");
  url.searchParams.set("filter.query", c.query);
  url.searchParams.set("filter.tag.types", c.types);
  url.searchParams.set("take", "10");
  const res = await fetch(url, { headers: { Accept: "application/json", "X-Api-Key": apiKey }, signal: AbortSignal.timeout(15000) });
  const text = await res.text();
  console.log(`${used}/${MAX_REQUESTS} GET /v2/tags query=${c.query} filter.tag.types=${c.types} -> HTTP ${res.status}`);
  let body = null; try { body = JSON.parse(text); } catch { /* ignore */ }
  const tags = res.ok ? (body?.results?.tags ?? []).map(t => ({ id: t.id, name: t.name, type: t.type })) : [];
  out.results.push({ ...c, status: res.status, tags, errorBody: res.ok ? undefined : text.slice(0, 200) });
}
out.requestsUsed = used;
writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`\nRequests used: ${used} of ${MAX_REQUESTS}. Saved ${OUT}\n`);
for (const r of out.results) {
  console.log(`query=${r.query} types=${r.types} (HTTP ${r.status})`);
  for (const t of r.tags) console.log(` - ${t.name} [${t.id}]`);
  if (!r.tags.length) console.log(" (no tags)" + (r.errorBody ? ` ${r.errorBody}` : ""));
}
