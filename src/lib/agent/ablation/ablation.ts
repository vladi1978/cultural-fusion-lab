/**
 * Controlled Qloo evidence comparison.
 *
 * Question: when the collected Qloo evidence is supplied, does it change an identifiable design decision?
 *
 * Method:
 *  - Four generations with the SAME system prompt, the SAME user template, the SAME validated operating design,
 *    the SAME stage and token budget. The only difference is the `culturalEvidence` field of the user message:
 *    empty (CONTROL x2) or the cited Qloo entities already collected (EVIDENCE x2). Runs alternate C,E,C,E.
 *  - The Qloo responses are reused from the earlier exploration. This module never calls Qloo.
 *  - A SIGNAL is a specific term taken from a cited entity's NAME or TAGS (generic words and the objective /
 *    operating design vocabulary are excluded) that appears in an operating-decision field (mechanics, journey,
 *    pilot) of the evidence runs and in NO control output.
 *  - "Qloo influence detectable" requires at least one signal REPLICATED in every evidence run, with the decision
 *    excerpt it appears in. Anything else is "not demonstrated". Text similarity is reported for context only and
 *    can never produce a positive verdict.
 *
 * It measures observable evidence influence. It does not measure originality, quality, demand or cultural validity,
 * and naming a venue or attribute does not verify it.
 */
import type { CulturalEntity, ExplorationRequest } from "../../types";
import type { CreativeModel } from "../creative/model";

export class AblationError extends Error {
  constructor(message: string, readonly code: "NO_OPERATIONAL_DESIGN" | "BAD_MODEL_OUTPUT" | "NO_SPEC" | "NO_EVIDENCE") {
    super(message);
    this.name = "AblationError";
  }
}

export interface AblationText {
  name: string;
  proposition: string;
  audience: string;
  context: string;
  mechanics: string;
  journey: string[];
  differentiationHypothesis: string;
  pilotExperiment: string;
}

export type DecisionField = "mechanics" | "journey" | "pilotExperiment";

export interface EvidenceSignal {
  entityId: string;
  entityName: string;
  term: string;
  kind: "name" | "tag";
  /** How many evidence runs contain the term in a decision field. */
  evidenceRuns: number;
  /** The decision (sentence or journey step) in which the term appears. */
  field: DecisionField;
  excerpt: string;
}

export type AblationVerdict = "detectable" | "not_demonstrated";

export interface AblationResult {
  control: AblationText[];
  evidence: AblationText[];
  /** Descriptive only. Never used for the verdict. */
  textSimilarity: { controlVsControl: number | null; evidenceVsEvidence: number | null; controlVsEvidence: number };
  signals: EvidenceSignal[];
  verdict: AblationVerdict;
  explanation: string;
  caveat: string;
  /** Exactly what was held constant. */
  protocol: { modelCalls: number; stage: string; maxTokens: number; order: string; qlooCalls: 0 };
  modelId: string;
  generatedAt: string;
}

export const ABLATION_CAVEAT =
  "This measures observable evidence influence only: whether specific terms from the cited Qloo entities appear in the operating decisions when, and only when, the evidence is supplied. Text similarity, originality, commercial quality, demand and cultural validity are not measured. Naming a venue or attribute does not verify it.";

export const SIMILARITY_NOTE = "Text similarity is descriptive only. It is not evidence of Qloo influence, originality or quality.";

const STOP = new Set(["participants", "participant", "guests", "guest", "host", "hosts", "their", "there", "which", "would", "could", "should", "every", "each", "other", "about", "while", "using", "between", "within", "without", "when", "then", "they", "them", "that", "this", "with", "from", "into", "what", "where", "also", "than", "more", "most", "such", "only", "both", "inc", "llc"]);

/** Words that describe a kind of place, genre or crowd rather than a specific signal. Never credited as Qloo influence. */
export const GENERIC_TERMS = new Set([
  "local", "locals", "community", "communities", "people", "public", "popular", "city", "town", "urban", "downtown", "neighborhood", "neighbourhood",
  "music", "musical", "live", "jazz", "dance", "dancing", "night", "nights", "evening", "events", "event", "festival", "festivals", "show", "shows",
  "theatre", "theater", "museum", "hall", "club", "center", "centre", "house", "park", "gallery", "lounge", "venue", "venues", "stage", "series",
  "cafe", "coffee", "restaurant", "restaurants", "place", "places", "bar", "bars", "pub", "shop", "store", "company", "brand", "brands", "group",
  "american", "national", "international", "world", "great", "best", "social", "cultural", "culture", "entertainment", "outdoor", "indoor", "famous",
  "kentucky", "louisville", "ride", "rides", "bike", "bikes", "bicycle", "bicycles", "cycling",
]);

const normalize = (s: string): string[] =>
  (s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").match(/[a-z0-9]+/g) ?? []).filter(w => w.length >= 4 && !STOP.has(w));
const stemOf = (w: string): string => { const b = w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w; return b.length >= 5 ? b.slice(0, 5) : b; };
const stemSet = (s: string): Set<string> => new Set(normalize(s).map(stemOf));
const isGeneric = (w: string): boolean => GENERIC_TERMS.has(w) || GENERIC_TERMS.has(w.endsWith("s") ? w.slice(0, -1) : w);

export const bodyOf = (t: AblationText): string =>
  [t.name, t.proposition, t.audience, t.context, t.mechanics, ...t.journey, t.differentiationHypothesis, t.pilotExperiment].join(" ");

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

const round = (x: number) => Math.round(x * 1000) / 1000;

/** The pieces of a concept that state what is done, in what order, and what is measured. */
function decisionUnits(t: AblationText): Array<{ field: DecisionField; text: string }> {
  const sentences = (s: string) => s.split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(Boolean);
  return [
    ...sentences(t.mechanics).map(text => ({ field: "mechanics" as const, text })),
    ...t.journey.map(text => ({ field: "journey" as const, text })),
    ...sentences(t.pilotExperiment).map(text => ({ field: "pilotExperiment" as const, text })),
  ];
}

interface Candidate { entity: CulturalEntity; term: string; stem: string; kind: "name" | "tag" }

export function candidateTerms(entities: CulturalEntity[], sharedContext: string): Candidate[] {
  const shared = stemSet(sharedContext);
  const out: Candidate[] = [];
  for (const entity of entities) {
    const seen = new Set<string>();
    const add = (raw: string, kind: "name" | "tag") => {
      for (const w of normalize(raw)) {
        if (w.length < 5 || isGeneric(w)) continue;
        const stem = stemOf(w);
        if (shared.has(stem) || seen.has(stem)) continue;
        seen.add(stem);
        out.push({ entity, term: w, stem, kind });
      }
    };
    add(entity.name, "name");
    for (const tag of entity.tags) add(tag, "tag");
  }
  return out;
}

export function findSignals(
  control: AblationText[],
  evidence: AblationText[],
  entities: CulturalEntity[],
  sharedContext: string,
): EvidenceSignal[] {
  const controlStems = new Set(control.flatMap(c => [...stemSet(bodyOf(c))]));
  const signals: EvidenceSignal[] = [];
  for (const c of candidateTerms(entities, sharedContext)) {
    if (controlStems.has(c.stem)) continue;
    let runs = 0;
    let first: { field: DecisionField; text: string } | null = null;
    for (const run of evidence) {
      const hit = decisionUnits(run).find(u => stemSet(u.text).has(c.stem));
      if (hit) { runs++; first ??= hit; }
    }
    if (runs > 0 && first) {
      signals.push({ entityId: c.entity.id, entityName: c.entity.name, term: c.term, kind: c.kind, evidenceRuns: runs, field: first.field, excerpt: first.text.slice(0, 280) });
    }
  }
  return signals.sort((a, b) => b.evidenceRuns - a.evidenceRuns || a.entityName.localeCompare(b.entityName) || a.term.localeCompare(b.term));
}

export function similarityOf(control: AblationText[], evidence: AblationText[]): AblationResult["textSimilarity"] {
  const c = control.map(t => stemSet(bodyOf(t)));
  const e = evidence.map(t => stemSet(bodyOf(t)));
  let sum = 0, n = 0;
  for (const x of c) for (const y of e) { sum += jaccard(x, y); n++; }
  return {
    controlVsControl: c.length >= 2 ? round(jaccard(c[0]!, c[1]!)) : null,
    evidenceVsEvidence: e.length >= 2 ? round(jaccard(e[0]!, e[1]!)) : null,
    controlVsEvidence: n ? round(sum / n) : 1,
  };
}

export function judge(signals: EvidenceSignal[], evidenceRunCount: number): Pick<AblationResult, "verdict" | "explanation"> {
  const replicated = evidenceRunCount >= 2 ? signals.filter(s => s.evidenceRuns === evidenceRunCount) : [];
  if (replicated.length > 0) {
    const names = [...new Set(replicated.map(s => s.entityName))];
    return {
      verdict: "detectable",
      explanation: `${replicated.length} specific signal(s) from ${names.join(", ")} appear in the operating decisions of every evidence run and in no control run. See the decisions listed below.`,
    };
  }
  const partial = signals.length;
  const why = evidenceRunCount < 2
    ? "Fewer than two evidence runs, so a signal cannot be shown to repeat."
    : partial > 0
      ? `${partial} signal(s) appeared in only some evidence runs, so they are not replicated.`
      : "No specific term from a cited Qloo entity appears in the operating decisions of the evidence runs without also appearing in the control runs.";
  return { verdict: "not_demonstrated", explanation: `Qloo influence on the design is not demonstrated. ${why}` };
}

export const ABLATION_SYSTEM = `You are designing ONE original, commercially testable concept.
You receive a JSON object with: objective, outputCategory, location, validatedOperatingDesign, and culturalEvidence.
culturalEvidence is a possibly empty list of real cultural-intelligence entities. If it is empty, use only the objective and the validated operating design. If it is not empty, you may use an entity's attributes only where they concretely change a design decision; do not force them in.
Never invent facts about an entity, a venue, demand, partnerships or performance. Keep every field concrete, operational and concise.
Return ONLY a JSON object with exactly these keys:
{"name":"2-5 words","proposition":"one concrete sentence","audience":"who and where","context":"setting and constraints","mechanics":"ordered operating steps","journey":["step 1","step 2","step 3"],"differentiationHypothesis":"a hypothesis, not a claim","pilotExperiment":"what is measured over how long"}`;

export const ABLATION_STAGE = "compose" as const;
export const ABLATION_MAX_TOKENS = 4000; // the hosted adapter raises this to its compose stage floor for every call alike

export function parseGenerated(raw: string): AblationText {
  const start = raw.indexOf("{"), end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new AblationError("No JSON object in model output.", "BAD_MODEL_OUTPUT");
  let data: Record<string, unknown>;
  try { data = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>; }
  catch { throw new AblationError("Model output was not valid JSON.", "BAD_MODEL_OUTPUT"); }
  const str = (k: string): string => {
    const v = data[k];
    if (typeof v !== "string" || !v.trim()) throw new AblationError(`Output field missing: ${k}`, "BAD_MODEL_OUTPUT");
    return v.trim();
  };
  const journeyRaw = data.journey;
  const journey = Array.isArray(journeyRaw)
    ? journeyRaw.map(j => typeof j === "string" ? j : (j && typeof j === "object" && typeof (j as Record<string, unknown>).action === "string" ? (j as Record<string, string>).action : "")).filter(Boolean)
    : [];
  if (journey.length < 2) throw new AblationError("Output journey missing.", "BAD_MODEL_OUTPUT");
  return {
    name: str("name"), proposition: str("proposition"), audience: str("audience"), context: str("context"),
    mechanics: str("mechanics"), journey, differentiationHypothesis: str("differentiationHypothesis"), pilotExperiment: str("pilotExperiment"),
  };
}

/** Evidence as sent to the model: attributes only; ids and scores are not sent. */
export function evidencePayload(entities: CulturalEntity[]) {
  return entities.slice(0, 8).map(e => ({
    name: e.name,
    category: e.category,
    type: e.qloo?.entityType,
    place: e.qloo?.place ? { address: e.qloo.place.address, city: e.qloo.place.city, region: e.qloo.place.region } : undefined,
    tags: e.tags.slice(0, 8),
    description: e.description.slice(0, 240),
  }));
}

export function buildUser(
  request: Pick<ExplorationRequest, "creativeObjective" | "outputCategory" | "location">,
  operationalTransfer: unknown,
  culturalEvidence: ReturnType<typeof evidencePayload>,
): string {
  return JSON.stringify({
    objective: request.creativeObjective,
    outputCategory: request.outputCategory,
    location: request.location ?? null,
    validatedOperatingDesign: operationalTransfer,
    culturalEvidence,
  });
}

export const ABLATION_MODEL_CALLS = 4;

export async function runAblation(input: {
  /** The concept's validated operating design (held constant in every arm). */
  operationalTransfer: unknown;
  /** The Qloo entities already collected and cited by the concept. Reused; Qloo is never called here. */
  influences: CulturalEntity[];
  request: Pick<ExplorationRequest, "creativeObjective" | "outputCategory" | "location">;
  model: CreativeModel;
}): Promise<AblationResult> {
  const { operationalTransfer, influences, request, model } = input;
  if (!operationalTransfer) throw new AblationError("The concept has no validated operating design to hold constant.", "NO_OPERATIONAL_DESIGN");
  if (!influences.length) throw new AblationError("The concept cites no collected Qloo entities to test.", "NO_EVIDENCE");

  const withEvidence = buildUser(request, operationalTransfer, evidencePayload(influences));
  const withoutEvidence = buildUser(request, operationalTransfer, []);
  const control: AblationText[] = [];
  const evidence: AblationText[] = [];
  // Alternate C, E, C, E so slow drift in the provider affects both arms alike.
  for (let i = 0; i < ABLATION_MODEL_CALLS / 2; i++) {
    control.push(parseGenerated(await model.complete({ stage: ABLATION_STAGE, system: ABLATION_SYSTEM, user: withoutEvidence, maxTokens: ABLATION_MAX_TOKENS })));
    evidence.push(parseGenerated(await model.complete({ stage: ABLATION_STAGE, system: ABLATION_SYSTEM, user: withEvidence, maxTokens: ABLATION_MAX_TOKENS })));
  }
  const shared = `${request.creativeObjective} ${request.location ?? ""} ${JSON.stringify(operationalTransfer)}`;
  const signals = findSignals(control, evidence, influences, shared);
  return {
    control,
    evidence,
    textSimilarity: similarityOf(control, evidence),
    signals,
    ...judge(signals, evidence.length),
    caveat: ABLATION_CAVEAT,
    protocol: { modelCalls: ABLATION_MODEL_CALLS, stage: ABLATION_STAGE, maxTokens: ABLATION_MAX_TOKENS, order: "control, evidence, control, evidence", qlooCalls: 0 },
    modelId: model.id,
    generatedAt: new Date().toISOString(),
  };
}
