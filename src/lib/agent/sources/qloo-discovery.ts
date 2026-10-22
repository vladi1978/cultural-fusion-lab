/**
 * Pure planning helpers for Qloo discovery built on DOCUMENTED filters only:
 *   GET /v2/tags              filter.query            -> taste-graph tag ids
 *   GET /v2/insights          filter.type             -> entity type to return
 *                             signal.interests.tags   -> topic signal (tag ids)
 *                             filter.location.query   -> geography (places)
 *   GET /search               query + type            -> only for GENERIC topic words
 *
 * It never asks Qloo about a venue, brand or person the model "remembered". Those speculative named queries
 * returned unrelated entities (a museum for "The Jazz Factory Louisville", sports teams for "Slow Roll Detroit").
 * Domain-agnostic: nothing here knows about any particular topic.
 */
import type { QlooEntityType, QlooTag } from "../../qloo/schemas";
import type { ExplorationRequest } from "../../types";
import { stemsOf } from "../evidence/terms";

type Req = Pick<ExplorationRequest, "creativeObjective" | "culturalInterest" | "location" | "outputCategory">;

/**
 * A query is speculative when it names something specific the brief never named: two or more capitalised words that
 * are not in the brief, or a capitalised word after the first position that is not in the brief.
 */
export function isSpeculativeNamedQuery(query: string, request: Pick<ExplorationRequest, "creativeObjective" | "culturalInterest" | "location">): boolean {
  const brief = `${request.creativeObjective} ${request.culturalInterest} ${request.location ?? ""}`.toLowerCase();
  const words = query.trim().split(/\s+/).filter(Boolean);
  const named = words
    .map((w, i) => ({ w: w.replace(/[^\p{L}\p{N}'’-]/gu, ""), i }))
    .filter(({ w }) => /^\p{Lu}/u.test(w) && !brief.includes(w.toLowerCase()));
  return named.length >= 2 || named.some(({ i }) => i > 0);
}

/** One or two topic phrases for tag lookup: the declared interest segments, then the most specific objective word. */
export function topicPhrasesOf(request: Req): string[] {
  const phrases = request.culturalInterest
    .split(/\s*(?:[+,;/&]|\band\b)\s*/i)
    .map(p => p.trim().toLowerCase())
    .filter(p => p.length >= 3 && p.split(/\s+/).length <= 3);
  const unique = [...new Set(phrases)].slice(0, 2);
  if (unique.length < 2) {
    const covered = new Set([...unique, request.location ?? ""].flatMap(p => [...stemsOf(p).keys()]));
    const candidates = [...stemsOf(request.creativeObjective)].filter(([stem]) => !covered.has(stem)).map(([, word]) => word);
    const longest = candidates.sort((a, b) => b.length - a.length)[0];
    if (longest) unique.push(longest);
  }
  return unique.slice(0, 2);
}

/** Entity types worth asking Insights for, from the brief's output and whether it names a location. */
export function targetTypesFor(request: Req): QlooEntityType[] {
  const out: QlooEntityType[] = [];
  if (request.outputCategory === "product" || request.outputCategory === "brand") out.push("urn:entity:brand");
  if (request.outputCategory === "experience" || request.location?.trim()) out.push("urn:entity:place");
  return [...new Set(out)].slice(0, 2);
}

const TAG_NAMESPACE_FOR: Partial<Record<QlooEntityType, string>> = {
  // Probe 2026-10-21: a media tag used as the signal for places returned unrelated shops and restaurants,
  // so places require place-namespaced tags. Other types accept any tag whose name matches the topic.
  "urn:entity:place": ":place",
};

export function tagCompatible(tag: QlooTag, target: QlooEntityType): boolean {
  const ns = TAG_NAMESPACE_FOR[target];
  return !ns || (tag.type ?? tag.id).includes(ns);
}

/**
 * Hard-filter candidates for places, one list per topic phrase. Probes on 2026-10-22 showed that for places the soft
 * signal (signal.interests.tags) is ignored in practice (a pet shop and fast food came back for a jazz tag), while the
 * documented hard filter (filter.tags) returned only a real jazz club. Candidates are place-namespaced, overlap the
 * phrase, and are ordered: exact name, then the least nested id (a plain genre/category tag before a restaurant or
 * hotel sub-variant), then popularity. Filter tags are never combined in one call, because Qloo requires all of them.
 */
export function chooseFilterTags(tags: QlooTag[], target: QlooEntityType, phrases: string[], perPhrase = 2): Array<{ phrase: string; candidates: QlooTag[] }> {
  const seenAcross = new Set<string>();
  return phrases.map(phrase => {
    const stems = new Set(stemsOf(phrase).keys());
    const scored = tags
      .filter(t => tagCompatible(t, target) && [...stemsOf(t.name).keys()].some(s => stems.has(s)))
      .map(t => ({ t, exact: phrase.toLowerCase() === t.name.toLowerCase(), depth: t.id.split(":").length }));
    scored.sort((a, b) => Number(b.exact) - Number(a.exact) || a.depth - b.depth || (b.t.popularity ?? 0) - (a.t.popularity ?? 0));
    const candidates: QlooTag[] = [];
    for (const { t } of scored) {
      if (seenAcross.has(t.id) || candidates.some(c => c.id === t.id)) continue;
      candidates.push(t);
      if (candidates.length >= perPhrase) break;
    }
    for (const c of candidates) seenAcross.add(c.id);
    return { phrase, candidates };
  });
}

/** Signal tags for one target type: compatible namespace, name overlapping a topic phrase, exact names first. */
export function chooseSignalTags(tags: QlooTag[], target: QlooEntityType, phrases: string[], limit = 3): QlooTag[] {
  const phraseStems = phrases.map(p => new Set(stemsOf(p).keys()));
  const scored = tags
    .filter(t => tagCompatible(t, target))
    .map(t => {
      const stems = [...stemsOf(t.name).keys()];
      const overlap = phraseStems.some(ps => stems.some(s => ps.has(s)));
      const exact = phrases.some(p => p.toLowerCase() === t.name.toLowerCase());
      return { t, overlap, exact };
    })
    .filter(x => x.overlap);
  scored.sort((a, b) => Number(b.exact) - Number(a.exact) || (b.t.popularity ?? 0) - (a.t.popularity ?? 0));
  const seen = new Set<string>();
  const out: QlooTag[] = [];
  for (const { t } of scored) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
    if (out.length >= limit) break;
  }
  return out;
}
