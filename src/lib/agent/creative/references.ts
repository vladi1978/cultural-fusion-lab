/**
 * Evidence-reference contract for model-composed concepts.
 *
 * The composer's quality gates enforce strict provenance: every cited entity must be one of the
 * collected entities, and every rationale signal must come from that entity's own metadata.
 * This module (1) states that contract explicitly to the model, (2) diagnoses violations precisely
 * so a repair attempt can act on them, and (3) canonicalizes ONLY exact, unambiguous spelling
 * variants of a real id or a real name. It never substitutes a different entity, never fuzzy-matches,
 * and never invents references; anything it cannot resolve stays invalid and is rejected.
 */
import type { CulturalEntity } from "../../types";

export interface AllowedEntity { id: string; name: string; category: string; signals: string[] }

export const INFLUENCE_ROLES = ["hinge", "texture", "tension", "constraint", "distribution"] as const;

export function allowedEntities(entities: CulturalEntity[]): AllowedEntity[] {
  return entities.map(e => ({ id: e.id, name: e.name, category: e.category, signals: [...new Set(e.tags.map(t => t.trim()).filter(Boolean))] }));
}

export function buildReferenceContract(entities: CulturalEntity[]) {
  return {
    allowedEntities: allowedEntities(entities),
    rules: [
      "Every entity reference must be copied character-for-character from allowedEntities[].id. Names, labels, paraphrases and ids you make up are invalid and the concept is rejected.",
      "influenceMap: at least 2 entries. Each: {entityId, entityName, category, role, signalsUsed}. entityName and category are copied from the SAME allowed entity; role is one of hinge|texture|tension|constraint|distribution; signalsUsed come only from that entity's signals.",
      "journey: 3 or 4 steps. Every step's influenceEntityIds has at least one allowed id, and only entities that genuinely motivate THAT step. Do not attach an entity just to fill the field.",
      "rationales: at least 3. One has featureId \"operating_mechanic\"; at least 2 others have featureId equal to a journey step id. Each: {id, featureId, featureDescription, influenceEntityId, attributeOrSignal, creativeInterpretation, whyItProducesMechanic}.",
      "attributeOrSignal must be copied verbatim from the signals of the entity named in influenceEntityId.",
      "In creativeInterpretation or whyItProducesMechanic, separate what is observed in the entity metadata from your leap, and label the leap with the words \"creative design hypothesis\". Demo entities are fictional: say so, never present them as verified.",
      "If no allowed entity genuinely relates to part of the design, do NOT fabricate a link; state the gap in evidenceBoundary.",
    ],
  };
}

export const REFERENCE_SHAPE_EXAMPLE = `"journey":[{"id":"step-1","actor":"...","action":"...","influenceEntityIds":["<id copied from allowedEntities>"]}],
"influenceMap":[{"entityId":"<id from allowedEntities>","entityName":"<its name>","category":"<its category>","role":"hinge","signalsUsed":["<one of its signals>"]}],
"rationales":[{"id":"r1","featureId":"operating_mechanic","featureDescription":"...","influenceEntityId":"<id from allowedEntities>","attributeOrSignal":"<one of that entity's signals>","creativeInterpretation":"Observed: <metadata>. Creative design hypothesis: <your leap>.","whyItProducesMechanic":"..."}]`;

const norm = (s: string) => s.trim().replace(/^[`"'“”]+|[`"'“”]+$/g, "").replace(/\s+/g, " ").toLowerCase();
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Exact id, or exact (case/whitespace/quote-insensitive) id, or unique exact name. Otherwise null. */
export function resolveEntityId(ref: unknown, entities: CulturalEntity[]): string | null {
  if (typeof ref !== "string" || !ref.trim()) return null;
  if (entities.some(e => e.id === ref)) return ref;
  const n = norm(ref);
  const byId = entities.filter(e => norm(e.id) === n);
  if (byId.length === 1) return byId[0].id;
  const byName = entities.filter(e => norm(e.name) === n);
  if (byName.length === 1 && byId.length === 0) return byName[0].id;
  return null;
}

interface RefSlot { where: string; get(): unknown; set(v: string): void }
function slots(draft: Record<string, unknown>): RefSlot[] {
  const out: RefSlot[] = [];
  const each = (key: string, f: (item: Record<string, unknown>, i: number) => void) => {
    const arr = draft[key];
    if (Array.isArray(arr)) arr.forEach((it, i) => { if (isObj(it)) f(it, i); });
  };
  each("influenceMap", (it, i) => out.push({ where: `influenceMap[${i}].entityId`, get: () => it.entityId, set: v => { it.entityId = v; } }));
  each("rationales", (it, i) => out.push({ where: `rationales[${i}].influenceEntityId`, get: () => it.influenceEntityId, set: v => { it.influenceEntityId = v; } }));
  each("journey", (it, i) => {
    const ids = it.influenceEntityIds;
    if (Array.isArray(ids)) ids.forEach((_, k) => out.push({ where: `journey[${i}].influenceEntityIds[${k}]`, get: () => ids[k], set: v => { ids[k] = v; } }));
  });
  return out;
}

/** Mutates the draft only for exact spelling/name variants of a real entity; returns disclosure notes. */
export function canonicalizeReferences(draft: Record<string, unknown>, entities: CulturalEntity[]): string[] {
  const notes: string[] = [];
  for (const slot of slots(draft)) {
    const v = slot.get();
    if (typeof v !== "string" || entities.some(e => e.id === v)) continue;
    const id = resolveEntityId(v, entities);
    if (id) { notes.push(`${slot.where} "${v}" normalized to collected id "${id}" (exact match)`); slot.set(id); }
  }
  // entityName/category on influenceMap must describe the referenced entity; correct from the real record.
  if (Array.isArray(draft.influenceMap)) draft.influenceMap.forEach((it, i) => {
    if (!isObj(it) || typeof it.entityId !== "string") return;
    const e = entities.find(x => x.id === it.entityId);
    if (!e) return;
    if (it.entityName !== e.name || it.category !== e.category) {
      notes.push(`influenceMap[${i}] name/category replaced with the collected record of "${e.id}"`);
      it.entityName = e.name; it.category = e.category;
    }
  });
  return notes;
}

/** Precise diagnostics. Never mutates. */
export function diagnoseReferences(draft: Record<string, unknown>, entities: CulturalEntity[]): { invalidIds: string[]; signalProblems: string[] } {
  const ids = new Set(entities.map(e => e.id));
  const invalidIds: string[] = [];
  for (const slot of slots(draft)) {
    const v = slot.get();
    if (typeof v !== "string" || !ids.has(v)) invalidIds.push(`${slot.where}=${typeof v === "string" ? JSON.stringify(v) : String(v)}`);
  }
  const signalProblems: string[] = [];
  if (Array.isArray(draft.rationales)) draft.rationales.forEach((r, i) => {
    if (!isObj(r) || typeof r.influenceEntityId !== "string") return;
    const e = entities.find(x => x.id === r.influenceEntityId);
    if (!e) return;
    const sig = typeof r.attributeOrSignal === "string" ? r.attributeOrSignal.toLowerCase().trim() : "";
    const attrs = new Set([e.category, e.name.toLowerCase(), ...e.tags.map(t => t.toLowerCase()), ...e.description.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2)]);
    const ok = !!sig && (attrs.has(sig) || sig.split(/[\s/_-]+/).some(t => t.length > 2 && attrs.has(t)));
    if (!ok) signalProblems.push(`rationales[${i}].attributeOrSignal ${JSON.stringify(r.attributeOrSignal)} is not a signal of "${e.id}"; its signals are ${JSON.stringify(e.tags)}`);
  });
  return { invalidIds, signalProblems };
}

/**
 * Removes references that cannot be resolved to a collected entity (after exact canonicalization).
 * This DISCARDS unsupported claims; it never substitutes another entity or invents one. What remains
 * is judged by the unchanged quality gates (>=2 influences, every journey step bound, >=3 rationales...),
 * so a concept that depended on the removed references fails honestly. Returns disclosure notes.
 */
export function pruneUnresolvableReferences(draft: Record<string, unknown>, entities: CulturalEntity[]): string[] {
  const ids = new Set(entities.map(e => e.id));
  const notes: string[] = [];
  const ok = (v: unknown) => typeof v === "string" && ids.has(v);
  if (Array.isArray(draft.influenceMap)) {
    draft.influenceMap = draft.influenceMap.filter((it, i) => {
      if (isObj(it) && ok(it.entityId)) return true;
      notes.push(`removed influenceMap[${i}].entityId=${isObj(it) && typeof it.entityId === "string" ? JSON.stringify(it.entityId) : "undefined"} (not a collected entity)`);
      return false;
    });
  }
  if (Array.isArray(draft.rationales)) {
    draft.rationales = draft.rationales.filter((it, i) => {
      if (isObj(it) && ok(it.influenceEntityId)) return true;
      notes.push(`removed rationales[${i}] with influenceEntityId=${isObj(it) && typeof it.influenceEntityId === "string" ? JSON.stringify(it.influenceEntityId) : "undefined"} (not a collected entity)`);
      return false;
    });
  }
  if (Array.isArray(draft.journey)) {
    draft.journey.forEach((step, i) => {
      if (!isObj(step) || !Array.isArray(step.influenceEntityIds)) return;
      const kept = step.influenceEntityIds.filter(v => ok(v));
      step.influenceEntityIds.filter(v => !ok(v)).forEach(v => notes.push(`removed journey[${i}].influenceEntityIds value ${JSON.stringify(v)} (not a collected entity)`));
      step.influenceEntityIds = kept;
    });
  }
  return notes;
}
