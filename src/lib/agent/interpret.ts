import type { ExplorationRequest } from "../types";
import type { InterpretedObjective } from "./types";
import { AgentError } from "./types";

const THEME_RULES: { match: RegExp; theme: string }[] = [
  { match: /\b(night|late[\s-]?night|after[\s-]?hours|midnight)\b/i, theme: "nocturnal" },
  { match: /\b(hospitality|hotel|lounge|bar|cafe|restaurant)\b/i, theme: "hospitality" },
  { match: /\b(travel|traveler|tourist|destination|city)\b/i, theme: "mobility" },
  { match: /\b(ritual|ceremony|slow|mindful)\b/i, theme: "ritual" },
  { match: /\b(sound|music|listening|audio|jazz|dj)\b/i, theme: "sonic" },
  { match: /\b(fashion|apparel|wear|textile)\b/i, theme: "apparel" },
  { match: /\b(food|culinary|kitchen|dining|taste)\b/i, theme: "culinary" },
  { match: /\b(tech|digital|app|platform)\b/i, theme: "digital" },
  { match: /\b(community|gather|social|collective)\b/i, theme: "communal" },
  { match: /\b(luxury|premium|craft|atelier)\b/i, theme: "craft" },
];

const STOP = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "for",
  "to",
  "of",
  "in",
  "on",
  "with",
  "by",
  "from",
  "that",
  "this",
  "into",
  "our",
  "their",
  "design",
  "create",
  "build",
  "make",
  "product",
  "brand",
  "experience",
]);

/** Deterministic objective interpretation — keyword/theme rules only (no LLM). */
export function interpretObjective(
  request: ExplorationRequest,
): InterpretedObjective {
  const objective = request.creativeObjective.trim();
  const interest = request.culturalInterest.trim();
  if (!objective || !interest) {
    throw new AgentError(
      "VALIDATION",
      "Creative objective and cultural interest are required for agent interpretation.",
    );
  }

  const corpus = `${objective} ${interest} ${request.location ?? ""}`;
  const intentTokens = tokenize(corpus);
  const themes = THEME_RULES.filter((rule) => rule.match.test(corpus)).map(
    (r) => r.theme,
  );
  const uniqueThemes = [...new Set(themes)];
  if (uniqueThemes.length === 0) {
    uniqueThemes.push("cultural-fusion");
  }

  const locationBit = request.location?.trim()
    ? ` located around ${request.location.trim()}`
    : "";

  return {
    rawObjective: objective,
    culturalInterest: interest,
    location: request.location?.trim() || undefined,
    outputCategory: request.outputCategory,
    intentTokens,
    themes: uniqueThemes,
    summary: `Interpret “${objective}” through interest “${interest}”${locationBit} toward a ${request.outputCategory} outcome. Themes: ${uniqueThemes.join(", ")}.`,
  };
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !STOP.has(t))
    .slice(0, 16);
}
