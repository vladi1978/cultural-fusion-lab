/**
 * Resolve meaningful observed signals for opportunity compilation.
 * Prefers non-interest attributes; does not treat interest alone as a relationship.
 */

import type { CulturalEntity } from "../types";
import type { OpportunityHypothesis } from "./opportunity-types";

const INTEREST_STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "culture",
  "cultural",
  "a",
  "an",
]);

export interface ResolvedOpportunitySignals {
  sharedNonInterest: string[];
  leftDistinct: string[];
  rightDistinct: string[];
  /** Best non-interest shared signal, else best distinct, else category — never interest-only if avoidable. */
  primary: string;
  secondary: string;
  signalIds: string[];
  /** True when only the interest keyword links the pair. */
  interestOnly: boolean;
  opposition?: [string, string];
}

export function tokenizeInterest(interest: string): Set<string> {
  return new Set(
    interest
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2 && !INTEREST_STOP.has(t)),
  );
}

/** Parse `sig-{entityId}-{kind}-{signal}` where entityId may contain hyphens. */
export function parseSignalId(
  id: string,
): { entityId: string; kind: string; signal: string } | null {
  const m = id.match(/^sig-(.+)-(tag|attr|norm|category)-(.+)$/);
  if (!m) return null;
  return { entityId: m[1]!, kind: m[2]!, signal: m[3]! };
}

export function resolveOpportunitySignals(options: {
  opportunity: OpportunityHypothesis;
  entities: CulturalEntity[];
  culturalInterest: string;
}): ResolvedOpportunitySignals {
  const { opportunity, entities, culturalInterest } = options;
  const interestTokens = tokenizeInterest(culturalInterest);

  const supporters = opportunity.supportingEntityIds
    .map((id) => entities.find((e) => e.id === id))
    .filter((e): e is CulturalEntity => Boolean(e));

  const left = supporters[0];
  const right = supporters[1] ?? supporters[0];

  const leftTags = new Set(tagsOf(left));
  const rightTags = new Set(tagsOf(right));

  const shared = [...leftTags].filter((t) => rightTags.has(t));
  const sharedNonInterest = shared.filter((t) => !interestTokens.has(t));
  const leftDistinct = [...leftTags].filter(
    (t) => !rightTags.has(t) && !interestTokens.has(t),
  );
  const rightDistinct = [...rightTags].filter(
    (t) => !leftTags.has(t) && !interestTokens.has(t),
  );

  const fromIds = opportunity.supportingSignalIds
    .map(parseSignalId)
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => p.signal.toLowerCase())
    .filter((s) => s.length > 1 && !interestTokens.has(s));

  // Explicitly supported, observed tags take precedence over incidental tag order.
  // Never promote an unverified signal ID into an observed cultural fact.
  const supportedObserved = [...new Set(fromIds)].filter((signal) =>
    supporters.some((entity) => tagsOf(entity).includes(signal)),
  );

  const rankedShared = [...sharedNonInterest].sort();
  const rankedLeft = [...leftDistinct].sort();
  const rankedRight = [...rightDistinct].sort();

  const primary =
    supportedObserved[0] ??
    rankedShared[0] ??
    rankedLeft[0] ??
    rankedRight[0] ??
    (left ? left.category : "signal");

  const secondary =
    supportedObserved.find((signal) => signal !== primary) ??
    rankedShared.find((signal) => signal !== primary) ??
    rankedRight.find((signal) => signal !== primary) ??
    rankedLeft.find((signal) => signal !== primary) ??
    (right && right.id !== left?.id ? right.category : primary);

  const opposition = extractOpposition(opportunity);

  return {
    sharedNonInterest,
    leftDistinct,
    rightDistinct,
    primary,
    secondary,
    signalIds: [...opportunity.supportingSignalIds],
    interestOnly:
      sharedNonInterest.length === 0 &&
      fromIds.length === 0 &&
      shared.some((t) => interestTokens.has(t)),
    opposition,
  };
}

function tagsOf(entity?: CulturalEntity): string[] {
  if (!entity) return [];
  return entity.tags.map((t) => t.toLowerCase().trim()).filter((t) => t.length > 1);
}

function extractOpposition(
  opportunity: OpportunityHypothesis,
): [string, string] | undefined {
  const m = opportunity.title.match(/(\w+)\s+vs\s+(\w+)/i);
  if (m) return [m[1]!.toLowerCase(), m[2]!.toLowerCase()];
  const fromWhy = opportunity.whyCreativelyUseful.match(
    /\b([a-z]+)\s+vs\s+([a-z]+)\b/i,
  );
  if (fromWhy) return [fromWhy[1]!.toLowerCase(), fromWhy[2]!.toLowerCase()];
  if (opportunity.kind === "tension" || opportunity.kind === "contrast") {
    return ["quiet", "loud"];
  }
  return undefined;
}

export function isAcousticSignal(s: string): boolean {
  return /\b(listening|sonic|audio|sound|ambient|audiophile|quiet|silence)\b/i.test(
    s,
  );
}

export function isCraftSignal(s: string): boolean {
  return /\b(craft|atelier|handmade|ceramic|make|studio)\b/i.test(s);
}

export function isMaterialSignal(s: string): boolean {
  return /\b(utility|archive|layer|apparel|garment|streetwear|textile)\b/i.test(
    s,
  );
}

export function isRetailSignal(s: string): boolean {
  return /\b(retail|membership|drop|invite|commons)\b/i.test(s);
}
