/**
 * Influence-sensitive mutation transform engine.
 * Deterministic: category + tags + output category + direction drive the rewrite.
 * Does not invent Qloo scores or market demand. Creative interpretation is labeled.
 */

import type {
  ConceptNarrative,
  CulturalEntity,
  EntityCategory,
  MutationFieldDiff,
  OutputCategory,
} from "../types";
import type { CreativeDirectionId, InterpretedObjective } from "./types";
import { AgentError } from "./types";

export type CulturalLens =
  | "spatial"
  | "narrative"
  | "sonic"
  | "branded"
  | "material"
  | "culinary"
  | "generic";

export interface MutationTransformResult {
  title: string;
  narrative: ConceptNarrative;
  diffs: MutationFieldDiff[];
  mutationNote: string;
  incomingLens: CulturalLens;
  outgoingLens: CulturalLens;
}

/**
 * Observed-attribute → normalized signal.
 * Ambiguous tags stay themselves; do not collapse archive→documentary.
 */
const TAG_SIGNALS: { match: RegExp; signal: string }[] = [
  { match: /\b(speculative|myth|mythic|fantasy|sci[\s-]?fi)\b/i, signal: "speculative" },
  { match: /\b(documentary|oral[\s-]?history)\b/i, signal: "documentary" },
  { match: /\b(archive|archival)\b/i, signal: "archive" },
  { match: /\b(intimate|quiet|soft|ritual|slow)\b/i, signal: "intimate" },
  { match: /\b(loud|club|crowd|aggressive|metal)\b/i, signal: "intense" },
  { match: /\b(industrial|foundry|raw|warehouse)\b/i, signal: "industrial" },
  { match: /\b(retail|arcade|streetwear|apparel)\b/i, signal: "street" },
  { match: /\b(listening|audiophile|ambient|sonic)\b/i, signal: "sonic" },
  { match: /\b(craft|atelier|handmade|ceramic)\b/i, signal: "craft" },
  { match: /\b(coffee|culinary|food|kitchen|cafe)\b/i, signal: "taste" },
  { match: /\b(night|nocturnal|after[\s-]?hours)\b/i, signal: "nocturnal" },
  { match: /\b(gallery|museum|exhibition)\b/i, signal: "gallery" },
  { match: /\b(utility|modular|layer)\b/i, signal: "utility" },
];

export function lensForEntity(entity: CulturalEntity): CulturalLens {
  switch (entity.category) {
    case "places":
      return "spatial";
    case "film":
      return "narrative";
    case "music":
      return "sonic";
    case "brands":
      return "branded";
    case "fashion":
      return "material";
    case "food":
      return "culinary";
    default:
      return "generic";
  }
}

export function extractSignals(entity: CulturalEntity): string[] {
  const corpus = `${entity.name} ${entity.description} ${entity.tags.join(" ")}`;
  const hits: string[] = [];
  for (const rule of TAG_SIGNALS) {
    if (rule.match.test(corpus) && !hits.includes(rule.signal)) {
      hits.push(rule.signal);
    }
  }
  // Always include normalized tags as weak signals (deterministic, capped).
  for (const tag of entity.tags.map((t) => t.toLowerCase()).sort()) {
    if (tag.length > 2 && !hits.includes(tag)) hits.push(tag);
    if (hits.length >= 6) break;
  }
  return hits;
}

/**
 * Assess whether outgoing→incoming provides enough metadata for a material rewrite.
 */
export function assessMutationDifferentiation(
  outgoing: CulturalEntity,
  incoming: CulturalEntity,
): { sufficient: boolean; reason?: string } {
  if (outgoing.id === incoming.id) {
    return {
      sufficient: false,
      reason: "Incoming influence is identical to the outgoing influence.",
    };
  }

  const categoryShift = outgoing.category !== incoming.category;
  const outSignals = new Set(extractSignals(outgoing));
  const inSignals = new Set(extractSignals(incoming));
  let shared = 0;
  for (const s of inSignals) if (outSignals.has(s)) shared += 1;
  const union = outSignals.size + inSignals.size - shared;
  const overlap = union === 0 ? 1 : shared / union;
  const novelSignals = [...inSignals].filter((s) => !outSignals.has(s));

  if (categoryShift) {
    return { sufficient: true };
  }

  if (novelSignals.length >= 1 && incoming.tags.length > 0) {
    return { sufficient: true };
  }

  if (incoming.tags.length === 0 && outgoing.tags.length === 0 && !categoryShift) {
    return {
      sufficient: false,
      reason:
        "Incoming entity lacks category shift and usable tags/metadata for a meaningful creative transformation.",
    };
  }

  if (overlap >= 0.85 && novelSignals.length === 0) {
    return {
      sufficient: false,
      reason:
        "Outgoing and incoming influences are too similar (same category, near-identical signals) to justify a material concept rewrite.",
    };
  }

  return { sufficient: true };
}

/**
 * Transform a concept around an incoming influence. Throws if differentiation is insufficient.
 */
export function transformConceptForMutation(options: {
  interpreted: InterpretedObjective;
  directionId: CreativeDirectionId;
  originalTitle: string;
  originalNarrative: ConceptNarrative;
  outgoing: CulturalEntity;
  incoming: CulturalEntity;
  retainedInfluences: CulturalEntity[];
  modeLabel?: "demo" | "live";
}): MutationTransformResult {
  const {
    interpreted,
    directionId,
    originalTitle,
    originalNarrative,
    outgoing,
    incoming,
    retainedInfluences,
    modeLabel = "demo",
  } = options;

  const assessment = assessMutationDifferentiation(outgoing, incoming);
  if (!assessment.sufficient) {
    throw new AgentError(
      "INSUFFICIENT_DIFFERENTIATION",
      "This influence swap does not provide enough cultural metadata for a meaningful concept transformation.",
      assessment.reason,
    );
  }

  const outgoingLens = lensForEntity(outgoing);
  const incomingLens = lensForEntity(incoming);
  const signals = extractSignals(incoming);
  const interest = interpreted.culturalInterest.trim();
  const location = interpreted.location?.trim();
  const where = location ? ` in ${location}` : "";
  const output = interpreted.outputCategory;
  const retainedNames = retainedInfluences.map((e) => e.name).join(", ");

  const blueprint = buildLensBlueprint({
    lens: incomingLens,
    signals,
    interest,
    where,
    output,
    directionId,
    incoming,
    outgoing,
    retainedNames,
  });

  const title = buildMutatedTitle({
    interest,
    output,
    directionId,
    incoming,
    lens: incomingLens,
    signals,
  });

  const inspiredBy = `Influences after mutation: ${[incoming, ...retainedInfluences]
    .map((e) => `${e.name} (${e.category})`)
    .join(" · ")}. Incoming hinge “${incoming.name}” contributes ${incomingLens} cues via tags [${incoming.tags.join(", ") || "none"}].`;

  const evidenceBoundary =
    modeLabel === "live"
      ? `Entity anchors cite collected/verified evidence; each format/audience/mechanic rewrite below is creative interpretation driven by “${incoming.name}” metadata — not a Qloo forecast or market validation.`
      : `In Demo Mode, entity anchors are mock demo evidence. Rewrites of mechanics, audience participation, and distinctive value are agent creative interpretations of “${incoming.name}” (${incoming.category}) tags/metadata — not Taste Graph scores or consumer demand proof.`;

  const narrative: ConceptNarrative = {
    whatItIs: blueprint.format,
    whoItServes: blueprint.audience,
    howItWorks: blueprint.mechanics,
    distinctive: blueprint.distinctive,
    inspiredBy,
    evidenceBoundary,
  };

  const diffs: MutationFieldDiff[] = [
    {
      field: "format",
      before: originalNarrative.whatItIs,
      after: narrative.whatItIs,
      changed: normalize(originalNarrative.whatItIs) !== normalize(narrative.whatItIs),
      why: blueprint.whyFormat,
      basis: "creative_interpretation",
    },
    {
      field: "mechanics",
      before: originalNarrative.howItWorks,
      after: narrative.howItWorks,
      changed: normalize(originalNarrative.howItWorks) !== normalize(narrative.howItWorks),
      why: blueprint.whyMechanics,
      basis: "creative_interpretation",
    },
    {
      field: "audience",
      before: originalNarrative.whoItServes,
      after: narrative.whoItServes,
      changed: normalize(originalNarrative.whoItServes) !== normalize(narrative.whoItServes),
      why: blueprint.whyAudience,
      basis: "creative_interpretation",
    },
    {
      field: "inspiration",
      before: originalNarrative.inspiredBy,
      after: narrative.inspiredBy,
      changed: true,
      why: `Outgoing “${outgoing.name}” (${outgoing.category}/${outgoingLens}) exits; incoming “${incoming.name}” (${incoming.category}/${incomingLens}) becomes the cultural hinge. Entity category/tags are evidence metadata; the role assigned to them is creative interpretation.`,
      basis: "entity_metadata",
    },
    {
      field: "distinctive",
      before: originalNarrative.distinctive,
      after: narrative.distinctive,
      changed:
        normalize(originalNarrative.distinctive) !== normalize(narrative.distinctive),
      why: blueprint.whyDistinctive,
      basis: "creative_interpretation",
    },
  ];

  const materialFields = diffs.filter(
    (d) =>
      (d.field === "mechanics" ||
        d.field === "audience" ||
        d.field === "distinctive" ||
        d.field === "format") &&
      d.changed,
  );

  if (materialFields.length < 3) {
    throw new AgentError(
      "INSUFFICIENT_DIFFERENTIATION",
      "This influence swap could not produce a sufficiently different concept narrative.",
      `Only ${materialFields.length} material fields changed between “${originalTitle}” and the attempted variant.`,
    );
  }

  const mutationNote = [
    `Swapped ${outgoing.name} (${outgoing.category}) → ${incoming.name} (${incoming.category}).`,
    `Lens shift: ${outgoingLens} → ${incomingLens}.`,
    `Material changes: ${materialFields.map((d) => d.field).join(", ")}.`,
    `Objective (“${interpreted.rawObjective}”) and output category (${output}) preserved.`,
    `Rationales are creative interpretations of entity metadata, not verified market effects.`,
  ].join(" ");

  return {
    title,
    narrative,
    diffs,
    mutationNote,
    incomingLens,
    outgoingLens,
  };
}

interface LensBlueprint {
  format: string;
  audience: string;
  mechanics: string;
  distinctive: string;
  whyFormat: string;
  whyMechanics: string;
  whyAudience: string;
  whyDistinctive: string;
}

function buildLensBlueprint(options: {
  lens: CulturalLens;
  signals: string[];
  interest: string;
  where: string;
  output: OutputCategory;
  directionId: CreativeDirectionId;
  incoming: CulturalEntity;
  outgoing: CulturalEntity;
  retainedNames: string;
}): LensBlueprint {
  const {
    lens,
    signals,
    interest,
    where,
    output,
    directionId,
    incoming,
    outgoing,
    retainedNames,
  } = options;

  const signalPhrase = signals.length
    ? signals.slice(0, 3).join("/")
    : incoming.category;
  const retainedBit = retainedNames
    ? ` Retained anchors (${retainedNames}) stay as supporting texture, not the primary format driver.`
    : "";

  // Category-driven format + mechanics — not a rename of the prior salon/object.
  if (lens === "narrative") {
    const speculative = signals.includes("speculative");
    const documentary = signals.includes("documentary");
    const archival = signals.includes("archive");
    const arcWord = speculative
      ? "speculative myth chapters"
      : documentary
        ? "documentary chapters"
        : archival
          ? "archival chapters"
          : "cinematic chapters";
    const format =
      output === "product"
        ? `A ${interest} narrative object kit that unfolds as ${arcWord} rather than a static ritual prop.`
        : output === "brand"
          ? `A ${interest} story-house brand organized around episodic film cues from “${incoming.name}”.`
          : `A ${interest} screening-salon experience${where} paced as ${arcWord} instead of a pure listening room.`;
    const mechanics =
      output === "experience"
        ? `Guests move through timed scenes inspired by “${incoming.name}”: each chapter pairs a short visual/narrative beat with ${interest} response prompts; seating reshuffles between scenes rather than staying fixed in a private listening layout.${retainedBit}`
        : output === "product"
          ? `Users open sequenced cards/objects keyed to beats from “${incoming.name}”; each beat asks for a ${interest}-linked action (listen, map, or reply) before the next chapter unlocks.${retainedBit}`
          : `Brand touchpoints ship as episodic drops mirroring “${incoming.name}” arcs; members complete chapter tasks before the next drop unlocks.${retainedBit}`;
    const audience =
      directionId === "communal"
        ? `Groups who want to interpret ${interest} together through shared story chapters${where}.`
        : directionId === "systems"
          ? `Programmers and hosts who assemble ${interest} nights from reusable narrative modules${where}.`
          : `Small cohorts who prefer guided story immersion over open social mixing${where}.`;
    const distinctive = speculative
      ? `Distinctive value: speculative film logic rewrites the format into mythic chapters — not another reserved-seat listening salon.`
      : `Distinctive value: film narrative structure becomes the operating system; ${outgoing.category} spatial habits from “${outgoing.name}” no longer define the experience.`;
    return {
      format,
      audience,
      mechanics,
      distinctive,
      whyFormat: `Incoming film entity “${incoming.name}” (${signalPhrase}) reframes the offering as chaptered narrative rather than the prior ${outgoing.category}-led format. Creative interpretation of category=film.`,
      whyMechanics: `Mechanics adopt scene/chapter progression because film metadata implies sequential storytelling; this is creative interpretation, not a verified affinity edge.`,
      whyAudience: `Audience shifts toward participants who engage story beats, matching a narrative lens while preserving the user's ${interest} objective.`,
      whyDistinctive: `Value proposition contrasts film-driven chaptering against the removed “${outgoing.name}” ${outgoing.category} influence.`,
    };
  }

  if (lens === "spatial") {
    const format =
      output === "product"
        ? `A site-responsive ${interest} kit designed to reconfigure around a place typology inspired by “${incoming.name}”.`
        : output === "brand"
          ? `A place-led ${interest} brand that treats venues like “${incoming.name}” as the primary identity surface.`
          : `A place-choreographed ${interest} experience${where} organized around thresholds and rooms, not media chapters.`;
    const mechanics = `Hosts map the night onto zones derived from “${incoming.name}” (arrival, dwell, release); guests physically relocate between zones while ${interest} cues stay constant.${retainedBit}`;
    const audience = `People who discover ${interest} through embodied movement across a venue${where}.`;
    const distinctive = `Distinctive value: architecture and circulation — not plot — set the pace, replacing the prior ${outgoing.category} hinge.`;
    return withWhys(
      format,
      audience,
      mechanics,
      distinctive,
      incoming,
      outgoing,
      "spatial zones",
      signalPhrase,
      interest,
    );
  }

  if (lens === "sonic") {
    const format =
      output === "product"
        ? `A tempo-coded ${interest} instrument/object that scores use in timed listening phrases from “${incoming.name}”.`
        : output === "brand"
          ? `A sonic-identity ${interest} brand whose releases follow mix-structure cues from “${incoming.name}”.`
          : `A score-led ${interest} session${where} where arrangement changes — not seating charts — mark each phase.`;
    const mechanics = `Facilitators run phrase → break → reprise cycles modeled on “${incoming.name}”; participation is timed to sonic sections rather than visual chapters or room zones.${retainedBit}`;
    const audience = `Listeners who want ${interest} structured as a set/performance arc${where}.`;
    const distinctive = `Distinctive value: musical structure becomes the mechanic, displacing the removed ${outgoing.category} driver “${outgoing.name}”.`;
    return withWhys(
      format,
      audience,
      mechanics,
      distinctive,
      incoming,
      outgoing,
      "sonic phrasing",
      signalPhrase,
      interest,
    );
  }

  if (lens === "branded") {
    const format =
      output === "brand"
        ? `A ${interest} platform brand that behaves like “${incoming.name}”: limited drops, membership rituals, and public commons.`
        : output === "product"
          ? `A branded ${interest} system of modular goods whose packaging language follows “${incoming.name}”.`
          : `A brand-hosted ${interest} activation${where} run as a drop/event rather than a continuous salon.`;
    const mechanics = `Participation runs through membership checkpoints inspired by “${incoming.name}” (invite → unlock → share); retained influences supply cultural texture only.${retainedBit}`;
    const audience = `Community joiners who engage ${interest} through membership and drops${where}.`;
    const distinctive = `Distinctive value: brand mechanics (drops/membership) replace the prior ${outgoing.category} operating logic.`;
    return withWhys(
      format,
      audience,
      mechanics,
      distinctive,
      incoming,
      outgoing,
      "membership/drop cadence",
      signalPhrase,
      interest,
    );
  }

  if (lens === "material") {
    const format =
      output === "product"
        ? `A wearable/material ${interest} system patterned on “${incoming.name}” layers and utility.`
        : `A material-led ${interest} ${output}${where} where garments/objects are the participation interface.`;
    const mechanics = `Guests/users change or reconfigure layers inspired by “${incoming.name}” at each stage; the act of dressing/assembling is the interaction loop.${retainedBit}`;
    const audience = `Participants who express ${interest} through material assembly and utility layering${where}.`;
    const distinctive = `Distinctive value: tactile fashion/utility mechanics supersede the removed ${outgoing.category} hinge.`;
    return withWhys(
      format,
      audience,
      mechanics,
      distinctive,
      incoming,
      outgoing,
      "material layering",
      signalPhrase,
      interest,
    );
  }

  if (lens === "culinary") {
    const format =
      output === "experience"
        ? `A tasting-paced ${interest} experience${where} sequenced like courses from “${incoming.name}”.`
        : `A ${interest} ${output} organized around hospitality beats inspired by “${incoming.name}”.`;
    const mechanics = `The arc is plated: arrival bite → main ritual → closing share, each timed to hospitality cues from “${incoming.name}” while keeping ${interest} central.${retainedBit}`;
    const audience = `Guests who want ${interest} through shared hospitality pacing${where}.`;
    const distinctive = `Distinctive value: culinary cadence replaces the prior ${outgoing.category} structure.`;
    return withWhys(
      format,
      audience,
      mechanics,
      distinctive,
      incoming,
      outgoing,
      "course pacing",
      signalPhrase,
      interest,
    );
  }

  // generic / weak lens — still rewrite, but assessment should usually block empty cases
  const format = `A ${interest} ${output} re-centered on “${incoming.name}” as the primary cultural hinge${where}.`;
  const mechanics = `Interaction steps are rebuilt so “${incoming.name}” dictates sequence and prompts; “${outgoing.name}” no longer sets the format.${retainedBit}`;
  const audience = `People exploring ${interest} through the lens of ${incoming.category} cues${where}.`;
  const distinctive = `Distinctive value: the concept pivots to ${incoming.category} logic from “${incoming.name}”, abandoning the prior ${outgoing.category} frame.`;
  return withWhys(
    format,
    audience,
    mechanics,
    distinctive,
    incoming,
    outgoing,
    "generic metadata hinge",
    signalPhrase,
    interest,
  );
}

function withWhys(
  format: string,
  audience: string,
  mechanics: string,
  distinctive: string,
  incoming: CulturalEntity,
  outgoing: CulturalEntity,
  mechanicLabel: string,
  signalPhrase: string,
  interest: string,
): LensBlueprint {
  return {
    format,
    audience,
    mechanics,
    distinctive,
    whyFormat: `Incoming “${incoming.name}” (${incoming.category}; ${signalPhrase}) supplies a new format lens via entity metadata. Creative interpretation — not a verified market claim.`,
    whyMechanics: `Mechanics use ${mechanicLabel} because that follows from category=${incoming.category} and available tags; interpretation only.`,
    whyAudience: `Audience participation is rewritten to match the new lens while keeping cultural interest “${interest}” fixed.`,
    whyDistinctive: `Distinctiveness is defined against removed influence “${outgoing.name}” (${outgoing.category}).`,
  };
}

function buildMutatedTitle(options: {
  interest: string;
  output: OutputCategory;
  directionId: CreativeDirectionId;
  incoming: CulturalEntity;
  lens: CulturalLens;
  signals: string[];
}): string {
  const interest = titleCase(options.interest);
  const hinge = shortName(options.incoming.name) ?? interest;
  const speculative = options.signals.includes("speculative");

  if (options.lens === "narrative") {
    if (options.output === "experience") {
      return speculative
        ? `${interest} Mythic Screening`
        : `${hinge} Chapter Salon`;
    }
    if (options.output === "product") {
      return speculative
        ? `${interest} Myth Object Kit`
        : `${hinge} Narrative Kit`;
    }
    return `${hinge} Story House`;
  }

  if (options.lens === "spatial") {
    return options.output === "experience"
      ? `${hinge} Room Circuit`
      : `${hinge} Site Kit`;
  }

  if (options.lens === "sonic") {
    return options.output === "experience"
      ? `${hinge} Phrase Session`
      : `${hinge} Score System`;
  }

  if (options.lens === "branded") {
    return `${hinge} Drop Commons`;
  }

  if (options.lens === "material") {
    return `${hinge} Layer System`;
  }

  if (options.lens === "culinary") {
    return `${hinge} Course Ritual`;
  }

  return `${hinge} ${titleCase(options.directionId)} Reframe`;
}

function shortName(name?: string): string | undefined {
  if (!name) return undefined;
  const parts = name
    .replace(/^Eval\s+/i, "")
    .replace(/^Mock\s+/i, "")
    .split(/\s+/);
  return parts.filter((p) => p.length > 2).slice(0, 2).join(" ");
}

function titleCase(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Test helper — category pair expected to be transformative. */
export function categoryPairIsCrossCutting(
  a: EntityCategory,
  b: EntityCategory,
): boolean {
  return a !== b;
}
