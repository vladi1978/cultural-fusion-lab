/**
 * Professional naming helpers for ConceptSpec titles.
 */

const GENERIC_NAME_TOKENS = new Set(
  [
    "session",
    "system",
    "ritual",
    "circuit",
    "commons",
    "layers",
    "courses",
    "chapters",
    "drops",
    "fork",
    "kit",
    "platform",
  ].map((s) => s.toLowerCase()),
);

export function hasRepeatedWords(name: string): boolean {
  const tokens = name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i] === tokens[i - 1]) return true;
  }
  const seen = new Set<string>();
  for (const t of tokens) {
    if (t.length <= 3) continue;
    if (seen.has(t)) return true;
    seen.add(t);
  }
  return false;
}

export function isGenericSuffixChain(name: string): boolean {
  const tokens = name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (tokens.length < 2) return true;
  const genericCount = tokens.filter((t) => GENERIC_NAME_TOKENS.has(t)).length;
  return genericCount >= tokens.length;
}

export { GENERIC_NAME_TOKENS };
