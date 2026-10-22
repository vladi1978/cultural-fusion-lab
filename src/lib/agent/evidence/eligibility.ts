/**
 * Evidence eligibility: which collected entities may ground a concrete design decision?
 *
 * An entity is decision-eligible only if
 *  - GEOGRAPHY: when it is a place and the brief names a location, Qloo's own place facts (city / region) match that
 *    location. Facts that are missing make the geography "unverifiable", which is NOT eligible.
 *  - TOPIC: its name, tags or description share a specific term with the brief's topic (interest + objective +
 *    the tag that retrieved that entity). Qloo returning an entity for a signal is not enough on its own.
 *
 * Everything else is rejected with a reason. If nothing is eligible the report says so; no decision is forced and no
 * entity or location is invented. Domain-agnostic: the same rules serve places, brands, artists, products and others.
 */
import type { CulturalEntity, EvidenceRejection, EvidenceSufficiency, ExplorationRequest } from "../../types";
import { normalizePhrase, stemsOf } from "./terms";

export type GeographyStatus = "verified" | "mismatch" | "unverifiable" | "not_required";

export interface EntityEligibility {
  entityId: string;
  name: string;
  eligible: boolean;
  geography: { status: GeographyStatus; detail: string };
  topic: { matchedTerms: string[] };
  reasons: string[];
}

export interface EligibilityReport {
  topicTerms: string[];
  entities: EntityEligibility[];
  eligible: CulturalEntity[];
  rejected: EntityEligibility[];
  sufficiency: EvidenceSufficiency;
}

const PLACE_TYPES = new Set(["urn:entity:place", "urn:entity:locality"]);

export function isPlaceEntity(e: CulturalEntity): boolean {
  return e.qloo?.entityType ? PLACE_TYPES.has(e.qloo.entityType) : e.category === "places";
}

/** "Louisville, Kentucky" -> ["louisville", "kentucky"]. */
export const locationSegments = (location: string): string[] => location.split(",").map(normalizePhrase).filter(Boolean);

export function validateGeography(e: CulturalEntity, location: string | undefined): { status: GeographyStatus; detail: string } {
  if (!isPlaceEntity(e)) return { status: "not_required", detail: "Not a place; geography does not apply." };
  const segments = location ? locationSegments(location) : [];
  if (!segments.length) return { status: "not_required", detail: "The brief names no location." };
  const place = e.qloo?.place;
  const city = place?.city ? normalizePhrase(place.city) : "";
  if (!place || !city) return { status: "unverifiable", detail: "Qloo returned no city for this place, so it cannot be tied to the requested location." };
  const [wantCity, ...rest] = segments;
  if (city !== wantCity) return { status: "mismatch", detail: `Qloo places it in ${place.city}, not ${wantCity}.` };
  if (rest.length) {
    const regionFacts = [place.region, place.subregion, place.country].filter((x): x is string => !!x).map(normalizePhrase);
    if (regionFacts.length && !regionFacts.some(r => rest.some(want => r === want || r.includes(want) || want.includes(r)))) {
      return { status: "mismatch", detail: `City matches but Qloo's region (${place.region ?? place.country}) differs from ${rest.join(", ")}.` };
    }
  }
  return { status: "verified", detail: `Qloo places it in ${place.city}${place.region ? `, ${place.region}` : ""}${place.address ? ` (${place.address})` : ""}.` };
}

export interface TopicTerms {
  /** The cultural interest and the Insights signal tag names: the brief's declared subject. */
  primary: Map<string, string>;
  /** Other objective vocabulary: weaker, so two distinct hits are required. */
  secondary: Map<string, string>;
}

export function topicTermsOf(request: Pick<ExplorationRequest, "creativeObjective" | "culturalInterest">, signalTagNames: string[] = []): TopicTerms {
  const primary = new Map<string, string>();
  for (const text of [request.culturalInterest, ...signalTagNames]) for (const [stem, word] of stemsOf(text)) if (!primary.has(stem)) primary.set(stem, word);
  const secondary = new Map<string, string>();
  for (const [stem, word] of stemsOf(request.creativeObjective)) if (!primary.has(stem) && !secondary.has(stem)) secondary.set(stem, word);
  return { primary, secondary };
}

/**
 * Eligible when one primary term matches the entity's NAME or TAGS (its own classification), or when two distinct
 * terms match once description-only hits are counted at secondary weight. A passing mention in free-text prose
 * ("influenced the jazz scene") is not classification, so on its own it does not make an entity on-topic.
 */
export function matchTopic(e: CulturalEntity, topic: TopicTerms): { matched: string[]; passed: boolean } {
  const classified = stemsOf(`${e.name} ${e.tags.join(" ")}`);
  const described = stemsOf(e.description.slice(0, 500));
  const classifiedPrimary = [...topic.primary].filter(([stem]) => classified.has(stem)).map(([, w]) => w);
  const describedPrimary = [...topic.primary].filter(([stem]) => !classified.has(stem) && described.has(stem)).map(([, w]) => w);
  const secondaryHits = [...topic.secondary].filter(([stem]) => classified.has(stem) || described.has(stem)).map(([, w]) => w);
  const weak = new Set([...describedPrimary, ...secondaryHits]);
  return { matched: [...classifiedPrimary, ...weak], passed: classifiedPrimary.length >= 1 || weak.size >= 2 };
}

export function assessEvidenceEligibility(input: {
  entities: CulturalEntity[];
  request: Pick<ExplorationRequest, "creativeObjective" | "culturalInterest" | "location">;
  /** Insights signal tag names actually used during discovery. */
  signalTagNames?: string[];
}): EligibilityReport {
  const topic = topicTermsOf(input.request, input.signalTagNames ?? []);
  const entities: EntityEligibility[] = input.entities.map(e => {
    const geography = validateGeography(e, input.request.location);
    // The tag(s) that retrieved THIS entity count as its own primary terms, never as terms for other entities: a generic
    // word in one tag name ("club", "park") must not make every other entity on-topic.
    const own = topicTermsOf(input.request, [...(input.signalTagNames ?? []), ...(e.qloo?.signalTagNames ?? [])]);
    const topicMatch = matchTopic(e, own);
    const matchedTerms = topicMatch.matched;
    const reasons: string[] = [];
    if (geography.status === "mismatch" || geography.status === "unverifiable") reasons.push(`geography ${geography.status}: ${geography.detail}`);
    if (!topicMatch.passed) reasons.push("no term from the brief's subject appears in its name or tags (a lone mention in its description, or one word from the objective, is not enough)");
    return { entityId: e.id, name: e.name, eligible: reasons.length === 0, geography, topic: { matchedTerms }, reasons };
  });
  const eligible = input.entities.filter(e => entities.find(x => x.entityId === e.id)?.eligible);
  const rejected = entities.filter(x => !x.eligible);
  const rejections: EvidenceRejection[] = rejected.map(x => ({ entityId: x.entityId, name: x.name, reason: x.reasons.join("; ") }));
  const sufficiency: EvidenceSufficiency = eligible.length
    ? { status: "sufficient", eligibleEntityIds: eligible.map(e => e.id), rejections, reason: `${eligible.length} of ${input.entities.length} collected entities passed geographic and topical validation and may ground design decisions.` }
    : { status: "insufficient", eligibleEntityIds: [], rejections, reason: `None of the ${input.entities.length} collected entities passed geographic and topical validation. No design decision is grounded in Qloo evidence, and no location or entity has been added.` };
  return { topicTerms: [...topic.primary.values(), ...topic.secondary.values()], entities, eligible, rejected, sufficiency };
}

export const notApplicableSufficiency = (reason: string): EvidenceSufficiency => ({ status: "not_applicable", eligibleEntityIds: [], reason, rejections: [] });
