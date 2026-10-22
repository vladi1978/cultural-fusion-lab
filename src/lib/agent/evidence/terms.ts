/**
 * Shared, domain-agnostic text helpers for evidence validation.
 * Nothing here knows about bicycles, jazz, venues or any other domain.
 */

/** Words that frame any brief but name no topic. Never used as evidence of topical relevance. */
const FRAMING = new Set([
  "about", "also", "audience", "build", "create", "design", "designed", "experience", "from", "have", "into", "make", "more", "must", "need", "only",
  "product", "brand", "service", "system", "should", "that", "their", "them", "then", "there", "these", "this", "through", "using", "when", "where",
  "which", "while", "with", "without", "would", "people", "everyone", "something", "idea", "ideas", "concept", "original", "viable", "commercially",
  "evening", "morning", "afternoon", "night", "week", "weekday", "weekend", "wednesday", "thursday", "friday", "saturday", "sunday", "monday", "tuesday",
  "short", "small", "large", "stops", "stop", "venue", "venues", "place", "places", "local", "locals", "city", "town", "group", "groups", "that's",
]);

export const normalizeWords = (s: string): string[] =>
  (s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").match(/[a-z0-9]+/g) ?? []).filter(w => w.length >= 4 && !FRAMING.has(w));

/** 5-character stems with a trailing plural 's' removed: cycling/cyclist/cycle share a stem family only partly, by design (conservative). */
export const stemOf = (w: string): string => {
  const b = w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w;
  return b.length >= 5 ? b.slice(0, 5) : b;
};

export const stemsOf = (s: string): Map<string, string> => {
  const m = new Map<string, string>();
  for (const w of normalizeWords(s)) if (!m.has(stemOf(w))) m.set(stemOf(w), w);
  return m;
};

export const normalizePhrase = (s: string): string =>
  s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
