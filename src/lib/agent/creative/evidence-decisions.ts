/**
 * Evidence-to-decision mechanism (domain-agnostic).
 *
 * A concept may ground concrete operating decisions (a stop, a sequence, an activity, a component, a material, a
 * partner, an audience, a channel) in evidence that passed geographic and topical validation. The model proposes
 * decisions; this module decides which survive:
 *  - only entities in the eligible set can be cited (ids are matched exactly, unknown ids are dropped),
 *  - the decision must be visible in the concept's mechanics or journey through the entity's own name or a word of its
 *    own attributes (vocabulary already in the brief or the shared operating design does not count),
 *  - entity ids, Qloo ids, retrieval path and address are resolved by code from collected data, never by the model,
 *  - zero decisions is a valid outcome. When no evidence is eligible, none is allowed and the concept says so.
 * Nothing here knows about bicycles, venues or any other domain.
 */
import type { CulturalEntity, EvidenceDecision, EvidenceSufficiency } from "../../types";
import type { EligibilityReport } from "../evidence/eligibility";
import { isPlaceEntity } from "../evidence/eligibility";
import { normalizePhrase, stemsOf } from "../evidence/terms";

const KINDS: ReadonlySet<EvidenceDecision["kind"]> = new Set(["location", "sequence", "activity", "component", "material", "partner", "audience", "channel", "other"]);

export const EVIDENCE_DECISION_SHAPE_EXAMPLE =
  '"evidenceDecisions":[{"kind":"location|sequence|activity|component|material|partner|audience|channel|other","decision":"what is decided","entityIds":["id copied from eligibleEvidence"],"basis":"which attribute it relies on: name, a tag, place or description"}]';

export function buildEvidenceDecisionContract(report: EligibilityReport) {
  return {
    status: report.sufficiency.status,
    reason: report.sufficiency.reason,
    eligibleEvidence: report.eligible.map(e => ({
      id: e.id,
      name: e.name,
      type: e.qloo?.entityType ?? e.category,
      place: e.qloo?.place ? { address: e.qloo.place.address, city: e.qloo.place.city, region: e.qloo.place.region } : undefined,
      tags: e.tags.slice(0, 8),
      description: e.description.slice(0, 200),
    })),
    rules: [
      "evidenceDecisions lists concrete operating decisions that genuinely rely on an eligibleEvidence entity. Use none, one or several; never add one only to look grounded.",
      "Cite an entity only by copying its id from eligibleEvidence. Do not name, recommend or imply any other venue, brand, product, place, person or organization as part of the operating design.",
      "A decision must change something operational (a stop, an order, a duration, a count, an activity or a rule). 'Use X as the reference', a theme or a mood is not a decision and is discarded.",
      "A location decision must cite a validated place (one with a place address in eligibleEvidence). Entities without a place can ground an activity, component, material, partner, audience or channel decision, never a location.",
      "Each decision must be visible in mechanics or journey by the entity's name or one of its own attributes.",
      "If status is insufficient, evidenceDecisions must be [] and evidenceBoundary must say that Qloo evidence was insufficient to ground any decision.",
    ],
  };
}


/**
 * Is this entity visible in the text? A named place must be visible by its name (a stop is a named place);
 * other entities by their name or by a word of their own attributes. Brief and shared-design vocabulary never counts.
 */
export function entityRealizedIn(e: CulturalEntity, operatingText: string, sharedContext: string): boolean {
  const text = normalizePhrase(operatingText);
  const name = normalizePhrase(e.name);
  if (name.length >= 4 && text.includes(name)) return true;
  const shared = new Set(stemsOf(sharedContext).keys());
  const textStems = new Set(stemsOf(operatingText).keys());
  if (isPlaceEntity(e)) {
    const nameStems = [...stemsOf(e.name).keys()].filter(stem => !shared.has(stem));
    return nameStems.length >= 2 && nameStems.filter(stem => textStems.has(stem)).length / nameStems.length >= 0.67;
  }
  const own = stemsOf(`${e.name} ${e.tags.slice(0, 8).join(" ")}`);
  for (const stem of own.keys()) if (!shared.has(stem) && textStems.has(stem)) return true;
  return false;
}

/** Short, readable excerpt for notes: cut at a word boundary and mark the cut. */
export function excerpt(text: string, max = 80): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 20)).trimEnd()}…`;
}

const OPERATIONAL_MARKERS = new Set(["stop", "stops", "order", "sequence", "first", "last", "then", "before", "after", "during", "minute", "minutes", "hour", "hours", "duration", "per", "each", "every", "number", "limit", "cap", "route", "step", "phase", "round", "slot", "schedule", "start", "starts", "end", "ends", "begin", "begins", "swap", "assign", "require", "requires", "choose", "chooses", "select", "pair", "pairs", "split", "rotate", "rotates", "cap", "price", "fee", "capacity", "quota", "checkpoint", "handoff", "meeting", "meet", "repeat", "repeats"]);
const REFERENCE_FRAMING = /\b(as the reference|as a reference|inspired by|inspiration|as inspiration|nod to|vibe|mood|theme|tribute|reminiscent|evoke|evokes)\b/i;

/**
 * A decision must change something operational: a stop, an order, a duration, an activity, a count or a rule.
 * "Use X as the reference" or a theme is flavour, not a decision. Domain-agnostic: no topic words appear here.
 */
export function isOperationalDecision(text: string): boolean {
  const words = text.toLowerCase().match(/[a-z]+|\d+/g) ?? [];
  const concrete = words.some(w => /^\d+$/.test(w) || OPERATIONAL_MARKERS.has(w));
  if (!concrete) return false;
  return !(REFERENCE_FRAMING.test(text) && !words.some(w => /^\d+$/.test(w)));
}

export function resolveEvidenceDecisions(
  raw: unknown,
  report: EligibilityReport | null | undefined,
  operatingText: string,
  sharedContext: string,
): { decisions: EvidenceDecision[]; notes: string[] } {
  if (!report || report.sufficiency.status === "not_applicable") return { decisions: [], notes: [] };
  const list = Array.isArray(raw) ? raw : [];
  const notes: string[] = [];
  if (report.sufficiency.status === "insufficient") {
    if (list.length) notes.push(`${list.length} proposed decision(s) discarded: no evidence passed validation.`);
    return { decisions: [], notes };
  }
  const eligible = new Map(report.eligible.map(e => [e.id, e] as const));
  const decisions: EvidenceDecision[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    if (!item || typeof item !== "object") { notes.push("A malformed decision was discarded."); continue; }
    const o = item as Record<string, unknown>;
    const decision = typeof o.decision === "string" ? o.decision.trim() : "";
    const basis = typeof o.basis === "string" ? o.basis.trim() : "";
    if (!decision || !basis) { notes.push("A decision without text or basis was discarded."); continue; }
    const ids = Array.isArray(o.entityIds) ? o.entityIds.filter((x): x is string => typeof x === "string").map(x => x.trim()) : [];
    const kept = [...new Set(ids.filter(id => eligible.has(id)))];
    const dropped = ids.filter(id => !eligible.has(id));
    if (dropped.length) notes.push(`Discarded unvalidated entity reference(s): ${dropped.join(", ")}.`);
    if (!kept.length) { notes.push(`Decision "${excerpt(decision)}" discarded: it cites no validated evidence.`); continue; }
    if (!isOperationalDecision(decision)) { notes.push(`Decision "${excerpt(decision)}" discarded: it names a reference or theme but changes no stop, order, duration, activity or rule.`); continue; }
    const realized = kept.filter(id => entityRealizedIn(eligible.get(id)!, operatingText, sharedContext));
    if (!realized.length) { notes.push(`Decision "${excerpt(decision)}" discarded: its evidence is not visible in the mechanics or journey.`); continue; }
    const kind = KINDS.has(o.kind as EvidenceDecision["kind"]) ? (o.kind as EvidenceDecision["kind"]) : "other";
    if (kind === "location" && !realized.some(id => isPlaceEntity(eligible.get(id)!))) { notes.push(`Decision "${excerpt(decision)}" discarded: a location decision needs a validated place, and none of its evidence is one.`); continue; }
    const key = normalizePhrase(decision);
    if (seen.has(key)) continue;
    seen.add(key);
    decisions.push({
      id: `ed-${decisions.length + 1}`,
      kind,
      decision,
      basis,
      entities: realized.map(id => {
        const e = eligible.get(id)!;
        return { id: e.id, name: e.name, qlooEntityId: e.qloo?.entityId, retrievedVia: e.qloo?.retrievedVia, address: e.qloo?.place?.address };
      }),
    });
  }
  return { decisions, notes };
}

/**
 * Names of rejected PLACES that the operating text uses. A named place in the mechanics or journey is a de facto
 * location decision, so an unvalidated one is not allowed to appear.
 */
export function rejectedPlacesInUse(operatingText: string, report: EligibilityReport | null | undefined, all: CulturalEntity[]): string[] {
  if (!report || report.sufficiency.status === "not_applicable") return [];
  const text = ` ${normalizePhrase(operatingText)} `;
  const rejectedIds = new Set(report.rejected.map(r => r.entityId));
  return all
    .filter(e => rejectedIds.has(e.id) && isPlaceEntity(e))
    .filter(e => { const n = normalizePhrase(e.name); return n.length >= 5 && text.includes(` ${n} `); })
    .map(e => e.name);
}

export function evidenceBoundarySentence(s: EvidenceSufficiency, decisions: EvidenceDecision[]): string {
  if (s.status === "not_applicable") return "";
  if (s.status === "insufficient") return "Qloo evidence was insufficient to ground any design decision (no entity passed geographic and topical validation); no location or entity was added.";
  if (!decisions.length) return `Validated Qloo evidence existed (${s.eligibleEntityIds.length} entities) but this concept grounds no operating decision in it.`;
  return `Operating decisions grounded in validated Qloo evidence: ${decisions.map(d => `${d.decision} (${d.entities.map(e => e.name).join(", ")})`).join("; ")}.`;
}
