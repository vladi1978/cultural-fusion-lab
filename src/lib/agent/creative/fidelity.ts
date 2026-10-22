/** Conservative, deterministic checks for the opt-in creative pipeline.
 * These are rejection heuristics, NOT proof of semantic or cultural correctness.
 */
import type { ConceptSpec } from "../../types";
import type { CreativeFrame } from "./types";

export interface CreativeFidelityResult { accepted: boolean; failures: string[]; /** Non-blocking notes that still require semantic review. */ warnings?: string[] }
const tokens = (s: string): string[] => (s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").match(/[a-z0-9]+/g) ?? [])
  .filter(w => w.length >= 4 && !["culture","cultural","japanese","nordic","experience","participants","participant","practice","ritual","through","their","with","from","that","this","into","about","generic","concept","design"].includes(w));
const contains = (haystack: string, needle: string) => haystack.toLowerCase().includes(needle.toLowerCase());
const meaningfulMatch = (haystack: string, source: string): boolean => {
  const terms = tokens(source);
  const hay = new Set(tokens(haystack));
  // A single overlapping keyword is not evidence that a practice is implemented.
  // This is a lexical screen, not a semantic equivalence judgment.
  return terms.length > 0 && terms.every(t => hay.has(t));
};


// ---- Realization-based check (used when the concept carries a validated operational design) ----
// Domain-agnostic: no cultures, no paraphrase dictionaries. It asks whether the concept's
// operating text carries out the design's own operating decisions, using novelty stems that
// are NOT merely a restatement of the source mechanism. Still a heuristic, not semantic proof.
const GENERIC = new Set(["participant","participants","host","hosts","service","whether","before","after","their","there","which","would","could","should","every","each","other","about","while","using","between","within","without","when","then","they","them","that","this","with","from","into","what","where","also","than","more","most","such","only","both"]);
const stem = (w: string): string => { const b = w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w; return b.length >= 5 ? b.slice(0, 5) : b; };
const stems = (s: string): Set<string> => new Set((s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").match(/[a-z0-9]+/g) ?? [])
  .filter(w => w.length >= 4 && !GENERIC.has(w)).map(stem));
const minus = (a: Set<string>, ...others: Set<string>[]): string[] => [...a].filter(x => others.every(o => !o.has(x)));
const overlap = (needles: string[], hay: Set<string>): number => needles.filter(n => hay.has(n)).length;

interface DesignTransfer { sourceDomain: string; sourceMechanism: string; operatingDecision: string; participantAction: string }
function readDesign(spec: ConceptSpec): { transfers: DesignTransfer[]; cross: string; removal: string[] } | null {
  const ot = (spec as unknown as { operationalTransfer?: Record<string, unknown> }).operationalTransfer;
  if (!ot || typeof ot !== "object" || !Array.isArray(ot.transfers) || ot.transfers.length < 2) return null;
  const ok = (ot.transfers as unknown[]).every(t => !!t && typeof t === "object" &&
    ["sourceDomain", "sourceMechanism", "operatingDecision", "participantAction"].every(k => typeof (t as Record<string, unknown>)[k] === "string"));
  if (!ok) return null;
  return {
    transfers: ot.transfers as DesignTransfer[],
    cross: typeof ot.crossCulturalDependency === "string" ? ot.crossCulturalDependency : "",
    removal: Array.isArray(ot.removalConsequences) ? ot.removalConsequences.filter((x): x is string => typeof x === "string") : [],
  };
}

function assessRealization(frame: CreativeFrame, spec: ConceptSpec, design: NonNullable<ReturnType<typeof readDesign>>): string[] {
  const failures: string[] = [];
  const steps = [spec.mechanics, ...spec.journey.map(s => s.action)];
  const opsStems = stems(steps.join(" "));
  const own: Array<{ name: string; novel: string[] }> = [];
  for (const domain of frame.sourceDomains) {
    const t = design.transfers.find(x => x.sourceDomain === domain.name);
    if (!t) { failures.push(`Missing operational mechanism for cultural domain: ${domain.name} (no transfer in the operational design)`); continue; }
    const novel = minus(stems(`${t.operatingDecision} ${t.participantAction}`), stems(t.sourceMechanism), stems(domain.name));
    own.push({ name: domain.name, novel });
    if (novel.length < 2) { failures.push(`Operational design for ${domain.name} adds no concrete detail beyond restating its source mechanism`); continue; }
    const hit = overlap(novel, opsStems);
    if (hit < 2 || hit / novel.length < 0.35) {
      const missing = novel.filter(n => !opsStems.has(n)).slice(0, 8);
      failures.push(`Concept does not carry out the designed operating decision for ${domain.name}: "${t.operatingDecision.slice(0, 140)}" (mechanics and journey steps must describe this decision in their own words; operating terms not yet used: [${missing.join(", ")}])`);
    }
  }
  if (own.length >= 2 && failures.length === 0) {
    // Exclusive stems: appear in one domain's design but not the other's.
    const excl = own.map((d, i) => new Set(minus(new Set(d.novel), ...own.filter((_, j) => j !== i).map(o => new Set(o.novel)))));
    // A domain is "referenced" by a design sentence if it shares the domain's operating-decision stems,
    // its source-mechanism stems, or its name. Naming the practice is a legitimate way to refer to it;
    // the realization check above is what enforces concrete operating content.
    const anchors = frame.sourceDomains.map((d, i) => {
      const t = design.transfers.find(x => x.sourceDomain === d.name);
      return new Set([...excl[i], ...stems(t?.sourceMechanism ?? ""), ...stems(d.name)]);
    });
    const crossStems = stems(design.cross);
    frame.sourceDomains.forEach((d, i) => {
      if (overlap([...anchors[i]], crossStems) === 0) failures.push(`Cross-cultural dependency does not reference ${d.name}'s operating decision`);
    });
    // Each domain must be the subject of at least one removal consequence (order is not assumed).
    if (design.removal.length) {
      frame.sourceDomains.forEach((d, i) => {
        if (!design.removal.some(r => overlap([...anchors[i]], stems(r)) > 0)) failures.push(`No removal consequence refers to ${d.name}'s operating decision`);
      });
    }
    // Binding: at least one step/mechanics sentence must use both domains' exclusive stems.
    const bound = steps.some(text => { const st = stems(text); return excl.every(e => overlap([...e], st) > 0); });
    if (!bound) failures.push("No step combines the operating decisions of the source domains; they are realized only in isolation");
  }
  return failures;
}

// Off-brief near-match: an exclusion is probably present when, inside ONE unit of operating text
// (proposition, a mechanics sentence, or a journey action), at least half of the exclusion's
// distinctive stems appear. "Distinctive" = not part of the source domains' own vocabulary, so a
// practice the brief asked for (e.g. "cooking") can never count as evidence of an excluded format.
// Needs >=2 distinctive stems, so a single shared word never triggers it. Still lexical: a true
// synonym with zero shared stems is NOT detected (see semantic-verification warning in triage).
// A step that only DISCLAIMS an excluded format ("does not assume ...", "without relying on ...")
// is compliant with the exclusion, but a lexical check cannot tell. A negation cue shortly before
// most of the matching terms marks the unit as a probable disclaimer. This is deliberately narrow:
// it never fires without such a cue, it is reported as a warning (never as approval), and the
// triage layer keeps semantic verification required.
const NEGATION_CUES = new Set(["not", "no", "never", "without", "avoid", "avoids", "avoiding", "neither", "nor", "cannot", "dont", "doesnt", "isnt", "wont", "nothing", "none", "lacks", "lacking"]);
const wordsOf = (s: string): string[] => s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/['\u2019]/g, "").match(/[a-z0-9]+/g) ?? [];

function isDisclaimer(unit: string, hit: string[]): boolean {
  const words = wordsOf(unit);
  // First occurrence of each matched stem; a stem is "negated" when a cue sits within 6 words before it.
  const positions = hit.map(h => words.findIndex(w => stem(w) === h)).filter(i => i >= 0);
  if (!positions.length) return false;
  const negated = positions.filter(i => words.slice(Math.max(0, i - 6), i).some(w => NEGATION_CUES.has(w))).length;
  return negated * 2 >= positions.length;
}

interface NearOffBrief { hit: string[]; unit: string; disclaimer: boolean }
function nearOffBrief(prohibited: string, frame: CreativeFrame, spec: ConceptSpec): NearOffBrief | null {
  const domainVocab = stems(frame.sourceDomains.flatMap(d => [d.name, ...d.coreMechanics]).join(" "));
  const distinct = minus(stems(prohibited), domainVocab);
  if (distinct.length < 2) return null;
  const need = Math.ceil(distinct.length / 2);
  const units = [spec.proposition, ...spec.mechanics.split(/[.;!?]+/), ...spec.journey.map(s => s.action)];
  for (const unit of units) {
    const st = stems(unit);
    const hit = distinct.filter(d => st.has(d));
    if (hit.length >= need) return { hit, unit: unit.trim(), disclaimer: isDisclaimer(unit, hit) };
  }
  return null;
}

export function assessCreativeFidelity(frame: CreativeFrame, spec: ConceptSpec): CreativeFidelityResult {
  const failures: string[] = [];
  const warnings: string[] = [];
  // Only operational text is checked: a title or a frozen brief cannot satisfy this gate.
  const operations = [spec.mechanics, ...spec.journey.map(s => s.action)].join(" ");
  const description = [spec.proposition, spec.mechanics, ...spec.journey.map(s => s.action)].join(" ");
  const design = readDesign(spec);
  if (design) {
    failures.push(...assessRealization(frame, spec, design));
  } else {
    for (const domain of frame.sourceDomains) {
      const mechanics = domain.coreMechanics.filter(m => meaningfulMatch(operations, m));
      if (mechanics.length === 0) failures.push(`Missing operational mechanism for cultural domain: ${domain.name}`);
    }
  }
  for (const prohibited of frame.offBrief) {
    // Exact off-brief descriptions are rejected; loose thematic overlap is not enough.
    if (prohibited.trim().length >= 8 && contains(description, prohibited.trim())) {
      failures.push(`Matches off-brief exclusion: ${prohibited}`);
      continue;
    }
    const near = nearOffBrief(prohibited, frame, spec);
    if (near && near.disclaimer) {
      warnings.push(`Off-brief terms [${near.hit.join(", ")}] appear only after a negation in one step ("${near.unit.slice(0, 120)}"); treated as a disclaimer, semantic review required: ${prohibited}`);
    } else if (near) {
      failures.push(`Probable off-brief exclusion (shares distinctive terms [${near.hit.join(", ")}] within one operating step: "${near.unit.slice(0, 120)}"): ${prohibited}`);
    }
  }
  // Explicitly requested choice dimensions must affect operations, not just the pitch.
  const brief = frame.requirements.join(" ").toLowerCase();
  const choiceRequested = /\b(choice|choices|choose|decision|decisions|interactive)\b/.test(brief);
  if (choiceRequested && !/\b(choose|choice|select|decide|option|branch|alternate|either)\b/i.test(operations)) {
    failures.push("Requested participant choice absent from operating mechanics and journey");
  }
  for (const dimension of ["sequence", "intensity", "social"]) {
    if (new RegExp(`\\b${dimension}\\b`, "i").test(brief) && !new RegExp(`\\b${dimension}\\b`, "i").test(operations)) {
      failures.push(`Requested choice dimension not operationalized: ${dimension}`);
    }
  }
  return { accepted: failures.length === 0, failures, ...(warnings.length ? { warnings } : {}) };
}
