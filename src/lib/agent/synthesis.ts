/**
 * Engine V2 causal concept synthesis.
 * Mechanism families are driven by hinge category + tags — not intimate/communal/systems.
 * Output-category coherence is enforced at generation time; quality gates reject residue.
 * Deterministic. Does not invent Qloo facts.
 */

import type {
  ConceptNarrative,
  ConceptSpec,
  CulturalEntity,
  DesignRationale,
  InfluenceMapEntry,
  JourneyStep,
  OutputCategory,
} from "../types";
import {
  assessMechanismCompatibility,
  formatCausalBridge,
} from "./mechanism-compat";
import { extractSignals } from "./mutation-transform";
import {
  GENERIC_NAME_TOKENS,
  hasRepeatedWords,
  isGenericSuffixChain,
} from "./naming";
import { compileConceptFromOpportunity } from "./opportunity-compiler";
import type { OpportunityHypothesis } from "./opportunity-types";
import type { EvidenceConflict, InterpretedObjective, MechanismId } from "./types";

export { hasRepeatedWords, isGenericSuffixChain } from "./naming";

export interface SynthesisCandidate {
  mechanismId: MechanismId;
  hinge: CulturalEntity;
  influences: CulturalEntity[];
  spec: ConceptSpec;
  opportunityId?: string;
}

interface MechDef {
  id: MechanismId;
  hingeCategory: CulturalEntity["category"] | "tension";
  label: string;
}

const MECHANISMS: MechDef[] = [
  { id: "spatial_circuit", hingeCategory: "places", label: "Spatial circuit" },
  { id: "narrative_chapters", hingeCategory: "film", label: "Narrative chapters" },
  { id: "sonic_set", hingeCategory: "music", label: "Sonic set" },
  { id: "brand_drop", hingeCategory: "brands", label: "Brand drop" },
  { id: "material_layer", hingeCategory: "fashion", label: "Material layer" },
  { id: "hospitality_course", hingeCategory: "food", label: "Hospitality course" },
  { id: "tension_dual", hingeCategory: "tension", label: "Tension dual-path" },
];

/**
 * Build deterministic synthesis candidates.
 * Accepted opportunities compile operating programs first (P1.1).
 * Catalog fallback fills unused slots but must not clone the same operating program.
 */
export function synthesizeConceptCandidates(options: {
  interpreted: InterpretedObjective;
  entities: CulturalEntity[];
  conflicts?: EvidenceConflict[];
  modeLabel?: "demo" | "live";
  seedKey: string;
  opportunities?: OpportunityHypothesis[];
}): SynthesisCandidate[] {
  const {
    interpreted,
    entities,
    conflicts = [],
    modeLabel = "demo",
    seedKey,
    opportunities = [],
  } = options;

  const byCategory = groupByCategory(entities);
  const out: SynthesisCandidate[] = [];
  const usedMechanisms = new Set<MechanismId>();
  const usedProgramFingerprints = new Set<string>();

  // 1) Opportunity-first compilation (causal operating programs)
  for (const opp of opportunities) {
    const mechanismId = opp.suggestedMechanismId;
    if (!mechanismId) continue;

    const influences = pickOpportunityInfluences(opp, entities, byCategory, mechanismId, seedKey);
    if (influences.length < 2) continue;

    const spec = compileConceptFromOpportunity({
      opportunity: opp,
      mechanismId,
      interpreted,
      influences,
      modeLabel,
    });
    if (!spec?.operatingProgramFingerprint) continue;
    if (usedProgramFingerprints.has(spec.operatingProgramFingerprint)) continue;

    // Fingerprint-lock only — do not lock MechanismId. Opportunities that later fail
    // quality gates must not starve catalog fallback for the same base mechanism.
    usedProgramFingerprints.add(spec.operatingProgramFingerprint);
    out.push({
      mechanismId,
      hinge: influences[0]!,
      influences,
      spec,
      opportunityId: opp.id,
    });
  }

  // 2) Structural catalog fallback — skip duplicate operating-program fingerprints
  for (const mech of MECHANISMS) {
    if (usedMechanisms.has(mech.id)) continue;
    const built = buildMechanismCandidate({
      mech,
      interpreted,
      entities,
      byCategory,
      conflicts,
      modeLabel,
      seedKey,
    });
    if (!built) continue;
    const fp =
      built.spec.operatingProgramFingerprint ??
      catalogProgramFingerprint(built.spec);
    if (usedProgramFingerprints.has(fp)) continue;
    const catalogCulturalFingerprint = [
      built.spec.influenceMap[0]?.entityId ?? "unknown",
      built.spec.influenceMap[1]?.entityId ?? "unknown",
      built.spec.influenceMap[0]?.signalsUsed[0] ?? "unknown",
      built.spec.influenceMap[1]?.signalsUsed[0] ?? "unknown",
    ]
      .map((value) => value.trim().toLowerCase().replace(/\\s+/g, "_"))
      .join("|");

    const catalogStructuralFingerprint = [
      `catalog_${mech.id}`,
      built.spec.frozenOutputCategory,
      "catalog_blueprint",
      built.spec.journey
        .map((step) =>
          `${step.actor.trim().toLowerCase()}:${step.influenceEntityIds.length}`
        )
        .join(">"),
    ].join("|");

    built.spec = {
      ...built.spec,
      operatingProgramId: built.spec.operatingProgramId ?? `catalog_${mech.id}`,
      operatingProgramFingerprint: fp,
      culturalFingerprint: catalogCulturalFingerprint,
      structuralFingerprint: catalogStructuralFingerprint,
    };
    usedProgramFingerprints.add(fp);
    usedMechanisms.add(mech.id);
    out.push(built);
  }

  return out.sort((a, b) => {
    const aOpp = a.opportunityId ? 0 : 1;
    const bOpp = b.opportunityId ? 0 : 1;
    if (aOpp !== bOpp) return aOpp - bOpp;
    return a.mechanismId === b.mechanismId
      ? a.hinge.id.localeCompare(b.hinge.id)
      : a.mechanismId.localeCompare(b.mechanismId);
  });
}

function catalogProgramFingerprint(spec: ConceptSpec): string {
  return [
    "catalog",
    spec.mechanismId,
    spec.frozenOutputCategory,
    spec.influenceMap[0]?.category ?? "na",
    spec.mechanicFingerprint.split("|").slice(0, 4).join("|"),
  ]
    .join("|")
    .toLowerCase();
}

function pickOpportunityInfluences(
  opp: OpportunityHypothesis,
  entities: CulturalEntity[],
  byCategory: Map<CulturalEntity["category"], CulturalEntity[]>,
  mechanismId: MechanismId,
  seedKey: string,
): CulturalEntity[] {
  const supporters = opp.supportingEntityIds
    .map((id) => entities.find((e) => e.id === id))
    .filter((e): e is CulturalEntity => Boolean(e));

  const mech = MECHANISMS.find((m) => m.id === mechanismId);
  let hinge = supporters[0];
  if (mech && mech.hingeCategory !== "tension") {
    hinge =
      supporters.find((e) => e.category === mech.hingeCategory) ??
      (byCategory.get(mech.hingeCategory) ?? []).sort((a, b) =>
        a.id.localeCompare(b.id),
      )[0] ??
      hinge;
  }
  if (!hinge) return [];

  const secondary =
    supporters.find((e) => e.id !== hinge!.id) ??
    pickSupport(entities, [hinge.id], 1, `${seedKey}:${mechanismId}:opp`)[0];
  if (!secondary) return [hinge];

  const extra = pickSupport(
    entities,
    [hinge.id, secondary.id],
    1,
    `${seedKey}:${mechanismId}:extra`,
  );
  return uniqueEntities([hinge, secondary, ...extra]).slice(0, 3);
}

function buildMechanismCandidate(options: {
  mech: MechDef;
  interpreted: InterpretedObjective;
  entities: CulturalEntity[];
  byCategory: Map<CulturalEntity["category"], CulturalEntity[]>;
  conflicts: EvidenceConflict[];
  modeLabel: "demo" | "live";
  seedKey: string;
}): SynthesisCandidate | null {
  const {
    mech,
    interpreted,
    entities,
    byCategory,
    conflicts,
    modeLabel,
    seedKey,
  } = options;

  if (mech.hingeCategory === "tension") {
    if (conflicts.length === 0) return null;
    const c = conflicts[0]!;
    const left = entities.find((e) => e.id === c.leftEntityId);
    const right = entities.find((e) => e.id === c.rightEntityId);
    if (!left || !right) return null;

    const compat = assessMechanismCompatibility({
      mechanismId: mech.id,
      output: interpreted.outputCategory,
      hingeCategory: "tension",
      culturalInterest: interpreted.culturalInterest,
      rawObjective: interpreted.rawObjective,
    });
    if (!compat.applicable) return null;

    const support = pickSupport(
      entities,
      [left.id, right.id],
      1,
      `${seedKey}:${mech.id}`,
    );
    const influences = uniqueEntities([left, right, ...support]).slice(0, 3);
    if (influences.length < 2) return null;
    const spec = buildSpec({
      mech,
      hinge: left,
      secondary: right,
      influences,
      interpreted,
      modeLabel,
      seedKey,
      conflict: c,
      needsBridge: compat.needsBridge,
    });
    return {
      mechanismId: mech.id,
      hinge: left,
      influences,
      spec,
    };
  }

  const hinges = byCategory.get(mech.hingeCategory) ?? [];
  const hinge = [...hinges].sort((a, b) => a.id.localeCompare(b.id))[0];
  if (!hinge) return null;

  const compat = assessMechanismCompatibility({
    mechanismId: mech.id,
    output: interpreted.outputCategory,
    hingeCategory: hinge.category,
    culturalInterest: interpreted.culturalInterest,
    rawObjective: interpreted.rawObjective,
  });
  if (!compat.applicable) return null;

  const support = pickSupport(entities, [hinge.id], 2, `${seedKey}:${mech.id}`);
  const secondary = support[0] ?? hinge;
  const influences = uniqueEntities([hinge, secondary, ...support]).slice(0, 3);
  if (influences.length < 2) return null;

  const spec = buildSpec({
    mech,
    hinge,
    secondary,
    influences,
    interpreted,
    modeLabel,
    seedKey,
    needsBridge: compat.needsBridge,
  });
  return {
    mechanismId: mech.id,
    hinge,
    influences,
    spec,
  };
}

export function specToNarrative(spec: ConceptSpec): ConceptNarrative {
  return {
    whatItIs: `${spec.proposition} Operating mode: ${spec.mechanics}`,
    whoItServes: `${spec.audience} Context: ${spec.context}`,
    howItWorks: spec.journey
      .map((s, i) => `${i + 1}. ${s.actor}: ${s.action}`)
      .join(" "),
    distinctive: spec.differentiationHypothesis,
    inspiredBy: spec.influenceMap
      .map((m) => `${m.entityName} (${m.category}/${m.role})`)
      .join(" · "),
    evidenceBoundary: spec.evidenceBoundary,
  };
}

/** Prefer raw observed tags; avoid unsupported semantic jumps. */
export function selectObservedSignal(
  entity: CulturalEntity,
  preferNonInterest?: string,
): string {
  const interestTokens = new Set(
    (preferNonInterest ?? "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2),
  );
  const tags = entity.tags.map((t) => t.toLowerCase().trim()).filter((t) => t.length > 2);
  const nonInterest = tags.find((t) => !interestTokens.has(t));
  if (nonInterest) return nonInterest;
  if (tags[0]) return tags[0];
  const signals = extractSignals(entity);
  const corpus = `${entity.name} ${entity.description} ${entity.tags.join(" ")}`.toLowerCase();
  const grounded = signals.find(
    (s) =>
      !interestTokens.has(s.toLowerCase()) &&
      (corpus.includes(s.toLowerCase()) ||
        entity.tags.some((t) => t.toLowerCase() === s)),
  );
  return grounded ?? entity.category;
}

export function supportedCategoryInterpretation(
  entity: CulturalEntity,
  observed: string,
): string {
  switch (entity.category) {
    case "fashion":
      return `Supported category reading: fashion/apparel utility of “${observed}”. Do not reinterpret as a film-genre cue.`;
    case "music":
      return `Supported category reading: sonic/arrangement cue from “${observed}”.`;
    case "places":
      return `Supported category reading: spatial/venue typology from “${observed}”.`;
    case "film":
      return `Supported category reading: narrative/sequence cue from “${observed}”.`;
    case "brands":
      return `Supported category reading: membership/distribution cue from “${observed}”.`;
    case "food":
      return `Supported category reading: hospitality/course pacing from “${observed}”.`;
    default:
      return `Supported category reading: treat “${observed}” within ${entity.category} only.`;
  }
}

function buildSpec(options: {
  mech: MechDef;
  hinge: CulturalEntity;
  secondary: CulturalEntity;
  influences: CulturalEntity[];
  interpreted: InterpretedObjective;
  modeLabel: "demo" | "live";
  seedKey: string;
  conflict?: EvidenceConflict;
  needsBridge: boolean;
}): ConceptSpec {
  const {
    mech,
    hinge,
    secondary,
    influences,
    interpreted,
    modeLabel,
    conflict,
    needsBridge,
  } = options;

  const interest = interpreted.culturalInterest.trim();
  const location = interpreted.location?.trim();
  const where = location ? ` in ${location}` : "";
  const output = interpreted.outputCategory;
  const primarySignal = selectObservedSignal(hinge);
  const secondarySignal = selectObservedSignal(secondary);
  const productForm = productFormFor(mech.id, interest, output);

  const drafted = mechanismBlueprint({
    mech,
    hinge,
    secondary,
    interest,
    where,
    output,
    primarySignal,
    secondarySignal,
    conflict,
    productForm,
  });

  const influenceMap: InfluenceMapEntry[] = influences.map((e) => {
    const role =
      e.id === hinge.id
        ? "hinge"
        : conflict &&
            (e.id === conflict.leftEntityId || e.id === conflict.rightEntityId)
          ? "tension"
          : e.category === "brands"
            ? "distribution"
            : "texture";
    return {
      entityId: e.id,
      entityName: e.name,
      category: e.category,
      role,
      signalsUsed: [selectObservedSignal(e), ...e.tags.slice(0, 2)].slice(0, 3),
    };
  });

  const bridge = needsBridge
    ? formatCausalBridge({
        mechanismId: mech.id,
        output,
        hingeCategory: hinge.category,
        hingeName: hinge.name,
        observedSignal: primarySignal,
        interest,
        productForm,
      })
    : undefined;

  const differentiationHypothesis = [
    `Differs by operating as a ${mech.label.toLowerCase()} for a ${output} deliverable, hinged on observed “${primarySignal}” from “${hinge.name}” (${hinge.category}).`,
    bridge,
  ]
    .filter(Boolean)
    .join(" ");

  const feasibilityAssumptions = [
    output === "product"
      ? `A small batch of the ${productForm ?? "product"} can be prototyped for ${interest}${where}.`
      : output === "brand"
        ? `Brand touchpoints (identity, membership/drop, and at least one customer channel) can be stubbed for ${interest}${where}.`
        : `Hosts can run the ${mech.label.toLowerCase()} sequence for ${interest}${where}.`,
    modeLabel === "demo"
      ? "Demo entities are fictional stand-ins; live deployment would require verified neighborhood substitutes."
      : "Live entities are drawn from collected API rows; operational logistics remain unvalidated.",
  ];

  const risksAndUnknowns = [
    `Unknown whether observed “${primarySignal}” on “${hinge.name}” transfers to ${output} operations outside ${hinge.category}.`,
    conflict
      ? `Unresolved tension ${conflict.opposition.join(" vs ")} may confuse users if dual-path signaling is unclear.`
      : `Comprehension of the ${mech.id} mechanic for a ${output} is untested.`,
    `No consumer demand or purchase-intent evidence is available for this proposal.`,
  ];

  const pilotExperiment =
    output === "product"
      ? `Put 8–12 target users through one use cycle of the ${productForm ?? "product"}${where}: count completed functions, and score 1–5 clarity of the core mechanic. Success: ≥70% complete the cycle and median clarity ≥3. Not a market forecast.`
      : output === "brand"
        ? `Show 8–12 target customers a brand kit (positioning line, one touchpoint, one drop/membership rule)${where}: count understood touchpoints and score 1–5 identity clarity. Success: ≥70% name the offering correctly and median clarity ≥3. Not a market forecast.`
        : `Run a 90-minute pilot${where} with 8–12 guests: execute the three journey steps once, count completed steps, and record a 1–5 clarity score for the ${mech.label.toLowerCase()} mechanic. Success threshold: ≥70% complete all steps and median clarity ≥3. Not a market forecast.`;

  const evidenceBoundary =
    modeLabel === "demo"
      ? `Observed attributes are mock_demo entity tags/categories. Category interpretations and design hypotheses are labeled separately in rationales — not Qloo Taste Graph edges, demand proof, or verified cultural laws.`
      : `Observed attributes cite collected/verified_api entity metadata where available. Category interpretations and design hypotheses remain creative — not Taste Graph forecasts or market validation.`;

  const mechanicFingerprint = [
    mech.id,
    output,
    hinge.category,
    primarySignal,
    drafted.journey.map((j) => j.action.split(" ").slice(0, 4).join(" ")).join(">"),
  ]
    .join("|")
    .toLowerCase();

  return {
    name: drafted.name,
    proposition: drafted.proposition,
    audience: drafted.audience,
    context: drafted.context,
    journey: drafted.journey,
    mechanics: drafted.mechanics,
    influenceMap,
    differentiationHypothesis,
    feasibilityAssumptions,
    risksAndUnknowns: risksAndUnknowns.slice(0, 3),
    pilotExperiment,
    evidenceBoundary,
    rationales: drafted.rationales,
    frozenObjective: interpreted.rawObjective,
    frozenOutputCategory: output,
    mechanicFingerprint,
    mechanismId: mech.id,
  };
}

function productFormFor(
  mech: MechanismId,
  interest: string,
  output: OutputCategory,
): string | undefined {
  if (output !== "product" && output !== "brand") return undefined;
  const topic = interest.trim() || "culture";
  switch (mech) {
    case "material_layer":
      return `reconfigurable ${topic} layer garment kit`;
    case "brand_drop":
      return output === "product"
        ? `limited ${topic} drop SKU with checkpoint card`
        : `membership drop system for ${topic}`;
    case "hospitality_course":
      return `${topic} course-ritual hosting kit (timer cards + service props)`;
    case "spatial_circuit":
      return `portable ${topic} zone kit (threshold / dwell / release markers)`;
    case "sonic_set":
      return `timed ${topic} phrase kit (cue timer + phrase cards)`;
    case "narrative_chapters":
      return `${topic} chapter prompt deck`;
    case "tension_dual":
      return `${topic} dual-path choice object`;
    default:
      return `${topic} prototype kit`;
  }
}

function mechanismBlueprint(options: {
  mech: MechDef;
  hinge: CulturalEntity;
  secondary: CulturalEntity;
  interest: string;
  where: string;
  output: OutputCategory;
  primarySignal: string;
  secondarySignal: string;
  conflict?: EvidenceConflict;
  productForm?: string;
}): {
  name: string;
  proposition: string;
  audience: string;
  context: string;
  mechanics: string;
  journey: JourneyStep[];
  rationales: DesignRationale[];
} {
  const {
    mech,
    hinge,
    secondary,
    interest,
    where,
    output,
    primarySignal,
    secondarySignal,
    conflict,
    productForm,
  } = options;

  const name = professionalName(interest, hinge, mech.id);
  const a = article(output);
  const hingeInterp = supportedCategoryInterpretation(hinge, primarySignal);
  const secInterp = supportedCategoryInterpretation(secondary, secondarySignal);

  if (mech.id === "spatial_circuit") {
    return draftSpatial({
      name,
      a,
      output,
      interest,
      where,
      hinge,
      secondary,
      primarySignal,
      secondarySignal,
      productForm,
      hingeInterp,
      secInterp,
      mech,
    });
  }
  if (mech.id === "narrative_chapters") {
    return draftNarrative({
      name,
      a,
      output,
      interest,
      where,
      hinge,
      secondary,
      primarySignal,
      secondarySignal,
      productForm,
      hingeInterp,
      secInterp,
      mech,
    });
  }
  if (mech.id === "sonic_set") {
    return draftSonic({
      name,
      a,
      output,
      interest,
      where,
      hinge,
      secondary,
      primarySignal,
      secondarySignal,
      productForm,
      hingeInterp,
      secInterp,
      mech,
    });
  }
  if (mech.id === "brand_drop") {
    return draftBrandDrop({
      name,
      a,
      output,
      interest,
      where,
      hinge,
      secondary,
      primarySignal,
      secondarySignal,
      productForm,
      hingeInterp,
      secInterp,
      mech,
    });
  }
  if (mech.id === "material_layer") {
    return draftMaterial({
      name,
      a,
      output,
      interest,
      where,
      hinge,
      secondary,
      primarySignal,
      secondarySignal,
      productForm,
      hingeInterp,
      secInterp,
      mech,
    });
  }
  if (mech.id === "hospitality_course") {
    return draftHospitality({
      name,
      a,
      output,
      interest,
      where,
      hinge,
      secondary,
      primarySignal,
      secondarySignal,
      productForm,
      hingeInterp,
      secInterp,
      mech,
    });
  }

  const opp = conflict?.opposition ?? ["quiet", "loud"];
  const journey = steps([
    [
      "Host",
      `Declare dual paths: ${opp[0]} track vs ${opp[1]} track using “${hinge.name}” / “${secondary.name}”.`,
      [hinge.id, secondary.id],
    ],
    [
      "Guest",
      `Choose a path for the mid segment; paths do not silently merge.`,
      [hinge.id, secondary.id],
    ],
    [
      "Host",
      `Hold a shared close that names the unresolved tension (no fake resolution).`,
      [hinge.id, secondary.id],
    ],
  ]);
  return pack({
    name,
    proposition: `${a} ${output} that keeps ${opp.join(" vs ")} as parallel participant paths instead of inventing a false harmony.`,
    audience: `Participants willing to choose a pole rather than average them${where}.`,
    context: `Explicit tag opposition from collected metadata (${opp.join("/")}).`,
    mechanics: `Fork mid-sequence. No narrative that “resolves” the opposition. Closing acknowledges unresolved tension.`,
    journey,
    hinge,
    secondary,
    primarySignal,
    secondarySignal,
    hingeInterp,
    secInterp,
    mech,
  });
}

type DraftArgs = {
  name: string;
  a: "A" | "An";
  output: OutputCategory;
  interest: string;
  where: string;
  hinge: CulturalEntity;
  secondary: CulturalEntity;
  primarySignal: string;
  secondarySignal: string;
  productForm?: string;
  hingeInterp: string;
  secInterp: string;
  mech: MechDef;
};

function draftSpatial(o: DraftArgs) {
  const { name, a, output, interest, where, hinge, secondary, primarySignal, secondarySignal, productForm, hingeInterp, secInterp, mech } = o;
  if (output === "product") {
    const form = productForm ?? `portable ${interest} zone kit`;
    return pack({
      name,
      proposition: `${a} product: ${form} that lets users stage threshold → dwell → release zones for ${interest}${where}.`,
      audience: `Operators who need a portable ${interest} layout tool${where}.`,
      context: `Product use context: temporary rooms or pop-ups; inspired by place typology of “${hinge.name}” (observed: ${primarySignal}).`,
      mechanics: `Physical kit components mark three zones. User function: set up, move between zones on a timed cue, pack down. Distinguishing feature: circuit rules derived from “${hinge.name}”; closing texture from “${secondary.name}” (${secondarySignal}). Cultural influence does not replace the kit.`,
      journey: steps([
        ["User", `Unpack and place threshold / dwell / release markers patterned on “${hinge.name}”.`, [hinge.id]],
        ["User", `Run one timed ${interest} circuit using the markers (no reserved-seat dependency).`, [hinge.id]],
        ["User", `Close with a release beat card textured by “${secondary.name}”; pack the kit.`, [secondary.id]],
      ]),
      hinge,
      secondary,
      primarySignal,
      secondarySignal,
      hingeInterp,
      secInterp,
      mech,
    });
  }
  if (output === "brand") {
    return pack({
      name,
      proposition: `${a} brand platform for ${interest} whose identity is a three-zone circuit (threshold → dwell → release)${where}.`,
      audience: `Customers who join ${interest} through place-like brand touchpoints${where}.`,
      context: `Brand positioning from place cues on “${hinge.name}” (observed: ${primarySignal}).`,
      mechanics: `Offering: circuit-led brand system. Touchpoints: arrival threshold ritual, dwell program, release moment. Identity inherits spatial grammar from “${hinge.name}”; “${secondary.name}” textures the release touchpoint. Not a venue substitute.`,
      journey: steps([
        ["Brand", `Publish threshold touchpoint rules inspired by “${hinge.name}”.`, [hinge.id]],
        ["Customer", `Complete a dwell action tied to ${interest} membership.`, [hinge.id]],
        ["Brand", `Close the cycle with a release drop textured by “${secondary.name}”.`, [secondary.id, hinge.id]],
      ]),
      hinge,
      secondary,
      primarySignal,
      secondarySignal,
      hingeInterp,
      secInterp,
      mech,
    });
  }
  return pack({
    name,
    proposition: `${a} experience that runs ${interest} as a three-zone spatial circuit derived from place typology${where}.`,
    audience: `Guests who navigate culture by moving through rooms${where}.`,
    context: `${interest} + place-led circulation${where || " (location flexible)"}.`,
    mechanics: `Participants relocate across threshold → dwell → release. Host controls timing. “${hinge.name}” supplies layout logic via observed “${primarySignal}”; “${secondary.name}” supplies closing texture via “${secondarySignal}”.`,
    journey: steps([
      ["Host", `Map three zones from “${hinge.name}” typology (threshold → dwell → release).`, [hinge.id]],
      ["Guest", `Move zone-to-zone on a timed ${interest} cue; no fixed reserved-seat lock.`, [hinge.id]],
      ["Host", `Close with a release beat textured by “${secondary.name}”.`, [secondary.id]],
    ]),
    hinge,
    secondary,
    primarySignal,
    secondarySignal,
    hingeInterp,
    secInterp,
    mech,
  });
}

function draftNarrative(o: DraftArgs) {
  const { name, a, output, interest, where, hinge, secondary, primarySignal, secondarySignal, productForm, hingeInterp, secInterp, mech } = o;
  if (output === "product") {
    const form = productForm ?? `${interest} chapter prompt deck`;
    return pack({
      name,
      proposition: `${a} product: ${form} that sequences ${interest} into gated chapters${where}.`,
      audience: `Facilitators and users who need a portable chaptered ${interest} tool.`,
      context: `Product form is a deck/kit; film cues from “${hinge.name}” (observed: ${primarySignal}) inspire sequence only.`,
      mechanics: `User function: draw chapter cards, complete prompts, advance. Distinguishing feature: chapter gates from “${hinge.name}”; texture cards from “${secondary.name}”.`,
      journey: steps([
        ["User", `Open chapter 1 card derived from “${hinge.name}”.`, [hinge.id]],
        ["User", `Complete a ${interest} prompt before chapter 2 opens.`, [hinge.id]],
        ["User", `Close with a texture card referencing “${secondary.name}”.`, [secondary.id]],
      ]),
      hinge,
      secondary,
      primarySignal,
      secondarySignal,
      hingeInterp,
      secInterp,
      mech,
    });
  }
  if (output === "brand") {
    return pack({
      name,
      proposition: `${a} brand whose ${interest} offering unfolds as narrative chapters rather than a flat catalog${where}.`,
      audience: `Customers who progress through story-led brand chapters${where}.`,
      context: `Positioning and touchpoints sequenced like “${hinge.name}” (observed: ${primarySignal}).`,
      mechanics: `Offering: chaptered brand narrative. Touchpoints: chapter 1 invite, chapter 2 unlock task, public close. Identity is story-gated; “${secondary.name}” textures the close.`,
      journey: steps([
        ["Brand", `Launch chapter 1 identity beat from “${hinge.name}”.`, [hinge.id]],
        ["Customer", `Complete a ${interest} response before chapter 2 opens.`, [hinge.id]],
        ["Brand", `Publish closing chapter textured by “${secondary.name}”.`, [secondary.id, hinge.id]],
      ]),
      hinge,
      secondary,
      primarySignal,
      secondarySignal,
      hingeInterp,
      secInterp,
      mech,
    });
  }
  return pack({
    name,
    proposition: `${a} experience that sequences ${interest} as narrative chapters hinged on film cues${where}.`,
    audience: `Small cohorts who progress through story beats rather than open milling${where}.`,
    context: `${interest} framed by “${hinge.name}” (observed: ${primarySignal})${where}.`,
    mechanics: `Chapter gates control progression. Seating may reshuffle between chapters. Film attribute “${primarySignal}” drives sequence; “${secondary.name}” is texture only.`,
    journey: steps([
      ["Facilitator", `Open chapter 1 with a visual/narrative beat from “${hinge.name}”.`, [hinge.id]],
      ["Guest", `Complete a ${interest} response prompt before chapter 2 opens.`, [hinge.id]],
      ["Facilitator", `Reseat or regroup between chapters; close with “${secondary.name}” texture.`, [secondary.id, hinge.id]],
    ]),
    hinge,
    secondary,
    primarySignal,
    secondarySignal,
    hingeInterp,
    secInterp,
    mech,
  });
}

function draftSonic(o: DraftArgs) {
  const { name, a, output, interest, where, hinge, secondary, primarySignal, secondarySignal, productForm, hingeInterp, secInterp, mech } = o;
  if (output === "product") {
    const form = productForm ?? `timed ${interest} phrase kit`;
    return pack({
      name,
      proposition: `${a} product: ${form} — a physical/digital cue system that runs phrase → break → reprise for ${interest}${where}.`,
      audience: `Users who need a portable timed-set tool for ${interest}, not a concert ticket.`,
      context: `Product use: tabletop or app timer. Music entity “${hinge.name}” (observed: ${primarySignal}) inspires pacing only.`,
      mechanics: `User function: start phrase timer, hold break, run reprise. Distinguishing features: pacing rules from “${hinge.name}”; handoff texture from “${secondary.name}”. The product is the kit, not a live set.`,
      journey: steps([
        ["User", `Start phrase A on the kit timer modeled on “${hinge.name}” pacing.`, [hinge.id]],
        ["User", `Hold the break cue; no venue relocation required.`, [hinge.id]],
        ["User", `Run reprise + handoff card textured by “${secondary.name}”.`, [hinge.id, secondary.id]],
      ]),
      hinge,
      secondary,
      primarySignal,
      secondarySignal,
      hingeInterp,
      secInterp,
      mech,
    });
  }
  if (output === "brand") {
    return pack({
      name,
      proposition: `${a} brand for ${interest} whose customer cadence is phrase → break → reprise rather than always-on posts${where}.`,
      audience: `Members who accept timed brand “sets” for ${interest}${where}.`,
      context: `Brand touchpoints paced like “${hinge.name}” (observed: ${primarySignal}).`,
      mechanics: `Offering: set-structured brand communications. Touchpoints: phrase drop, mandated break, reprise. Identity is time-boxed; “${secondary.name}” textures the reprise.`,
      journey: steps([
        ["Brand", `Publish phrase A content modeled on “${hinge.name}”.`, [hinge.id]],
        ["Member", `Observe the break window (no new drop).`, [hinge.id]],
        ["Brand", `Release reprise touchpoint textured by “${secondary.name}”.`, [hinge.id, secondary.id]],
      ]),
      hinge,
      secondary,
      primarySignal,
      secondarySignal,
      hingeInterp,
      secInterp,
      mech,
    });
  }
  return pack({
    name,
    proposition: `${a} experience where ${interest} is scored as phrase → break → reprise, not as a static salon.`,
    audience: `Listeners who accept timed set structure${where}.`,
    context: `Sonic arrangement from “${hinge.name}” (observed: ${primarySignal})${where}.`,
    mechanics: `Time-boxed phrases. Participation is listen/respond within the set. Layout is secondary to arrangement.`,
    journey: steps([
      ["Facilitator", `Start phrase A modeled on “${hinge.name}” pacing.`, [hinge.id]],
      ["Guest", `Hold silence/break on cue; no zone relocation required.`, [hinge.id]],
      ["Facilitator", `Run reprise + handoff textured by “${secondary.name}”.`, [hinge.id, secondary.id]],
    ]),
    hinge,
    secondary,
    primarySignal,
    secondarySignal,
    hingeInterp,
    secInterp,
    mech,
  });
}

function draftBrandDrop(o: DraftArgs) {
  const { name, a, output, interest, where, hinge, secondary, primarySignal, secondarySignal, productForm, hingeInterp, secInterp, mech } = o;
  if (output === "product") {
    const form = productForm ?? `limited ${interest} drop SKU`;
    return pack({
      name,
      proposition: `${a} product: ${form} released through invite → checkpoint → public commons${where}.`,
      audience: `Buyers who engage ${interest} through limited releases${where}.`,
      context: `Product SKU + checkpoint card; ops cadence from “${hinge.name}” (observed: ${primarySignal}).`,
      mechanics: `User function: redeem invite, complete checkpoint, receive SKU. Distinguishing feature: membership rules from “${hinge.name}”; commons moment textured by “${secondary.name}”.`,
      journey: steps([
        ["Buyer", `Redeem invite/drop #1 under “${hinge.name}”-like rules.`, [hinge.id]],
        ["Buyer", `Complete a ${interest} checkpoint before drop #2.`, [hinge.id]],
        ["Operator", `Release public commons edition textured by “${secondary.name}”.`, [secondary.id, hinge.id]],
      ]),
      hinge,
      secondary,
      primarySignal,
      secondarySignal,
      hingeInterp,
      secInterp,
      mech,
    });
  }
  // brand (default) + experience-with-bridge treated as brand system
  return pack({
    name,
    proposition: `${a} brand organized as membership drops and checkpoint releases for ${interest} rather than a continuous open venue${where}.`,
    audience: `Members who engage ${interest} through checkpoints and limited releases${where}.`,
    context: `Brand positioning and touchpoints inspired by “${hinge.name}” (observed: ${primarySignal}).`,
    mechanics: `Offering: drop-based brand. Identity: scarcity as procedure. Touchpoints: invite, checkpoint task, public commons. “${secondary.name}” textures the commons beat.`,
    journey: steps([
      ["Operator", `Issue invite/drop #1 under “${hinge.name}”-like membership rules.`, [hinge.id]],
      ["Member", `Complete a ${interest} checkpoint task before drop #2.`, [hinge.id]],
      ["Operator", `Publish public commons moment textured by “${secondary.name}”.`, [secondary.id, hinge.id]],
    ]),
    hinge,
    secondary,
    primarySignal,
    secondarySignal,
    hingeInterp,
    secInterp,
    mech,
  });
}

function draftMaterial(o: DraftArgs) {
  const { name, a, output, interest, where, hinge, secondary, primarySignal, secondarySignal, productForm, hingeInterp, secInterp, mech } = o;
  if (output === "product" || output === "brand") {
    const form = productForm ?? `reconfigurable ${interest} layer garment kit`;
    const isProduct = output === "product";
    return pack({
      name,
      proposition: isProduct
        ? `${a} product: ${form} — physical layers users reconfigure to express ${interest}${where}.`
        : `${a} brand line of reconfigurable ${interest} layers whose identity is assembly/utility${where}.`,
      audience: isProduct
        ? `Wearers who express ${interest} through assembly/utility${where}.`
        : `Customers of a utility-led ${interest} apparel brand${where}.`,
      context: isProduct
        ? `Physical apparel/kit form. Fashion signals from “${hinge.name}” (observed: ${primarySignal}) — not a film or music substitute.`
        : `Brand offering/touchpoints: layer drops, fit sessions, archive of configurations. Hinge: “${hinge.name}” (${primarySignal}).`,
      mechanics: isProduct
        ? `Product form: layered garment/kit. User function: receive layers, reconfigure mid-use, log configuration. Distinguishing features: utility patterning from “${hinge.name}”; closing reference from “${secondary.name}” (${secondarySignal}).`
        : `Offering: modular layer apparel system. Positioning: utility over logo theater. Touchpoints: kit receive, mid-session reconfigure, archive. “${secondary.name}” is texture, not the product line.`,
      journey: steps([
        [
          isProduct ? "User" : "Customer",
          `Receive layer kit patterned on “${hinge.name}” utility (observed: ${primarySignal}).`,
          [hinge.id],
        ],
        [
          isProduct ? "User" : "Customer",
          `Reconfigure layers at mid-session on a ${interest} cue.`,
          [hinge.id],
        ],
        [
          "Host",
          `Archive configurations; close with “${secondary.name}” reference.`,
          [secondary.id],
        ],
      ]),
      hinge,
      secondary,
      primarySignal,
      secondarySignal,
      hingeInterp,
      secInterp,
      mech,
    });
  }
  // experience: material as participatory costume system
  return pack({
    name,
    proposition: `${a} experience where participation is material reconfiguration for ${interest}, not seating ritual.`,
    audience: `Participants who express ${interest} through assembly/utility${where}.`,
    context: `Fashion/utility signals from “${hinge.name}” (observed: ${primarySignal}).`,
    mechanics: `Physical layers change state. Each state is a logged interaction. Narrative media is optional texture via “${secondary.name}”.`,
    journey: steps([
      ["Guest", `Receive layer kit patterned on “${hinge.name}” utility.`, [hinge.id]],
      ["Guest", `Reconfigure layers at mid-session on a ${interest} cue.`, [hinge.id]],
      ["Host", `Archive configurations; close with “${secondary.name}” reference.`, [secondary.id]],
    ]),
    hinge,
    secondary,
    primarySignal,
    secondarySignal,
    hingeInterp,
    secInterp,
    mech,
  });
}

function draftHospitality(o: DraftArgs) {
  const { name, a, output, interest, where, hinge, secondary, primarySignal, secondarySignal, productForm, hingeInterp, secInterp, mech } = o;
  if (output === "product") {
    const form = productForm ?? `${interest} course-ritual hosting kit`;
    return pack({
      name,
      proposition: `${a} product: ${form} that paces ${interest} as arrival → main → close${where}.`,
      audience: `Hosts who need a portable course-ritual kit for ${interest}${where}.`,
      context: `Physical/digital hosting kit. Food entity “${hinge.name}” (observed: ${primarySignal}) supplies pacing, not a restaurant concept by default.`,
      mechanics: `Product form: timer cards + service props. User function: plate arrival beat, run main ritual, serve close. Distinguishing feature: hospitality cues from “${hinge.name}”; close textured by “${secondary.name}”.`,
      journey: steps([
        ["Host", `Use kit card 1 to plate arrival beat from “${hinge.name}”.`, [hinge.id]],
        ["Guest", `Move through main ${interest} ritual as course two using kit cues.`, [hinge.id]],
        ["Host", `Serve closing share using kit card 3 textured by “${secondary.name}”.`, [secondary.id, hinge.id]],
      ]),
      hinge,
      secondary,
      primarySignal,
      secondarySignal,
      hingeInterp,
      secInterp,
      mech,
    });
  }
  if (output === "brand") {
    return pack({
      name,
      proposition: `${a} brand for ${interest} paced like hospitality courses — arrival, main, close — across customer touchpoints${where}.`,
      audience: `Customers who accept course-like brand pacing for ${interest}${where}.`,
      context: `Brand identity/touchpoints from “${hinge.name}” (observed: ${primarySignal}).`,
      mechanics: `Offering: course-paced brand journey. Touchpoints: arrival welcome, main ritual, closing share. “${secondary.name}” textures the close.`,
      journey: steps([
        ["Brand", `Open arrival touchpoint using hospitality cues from “${hinge.name}”.`, [hinge.id]],
        ["Customer", `Complete main ${interest} ritual as course two.`, [hinge.id]],
        ["Brand", `Deliver closing share textured by “${secondary.name}”.`, [secondary.id, hinge.id]],
      ]),
      hinge,
      secondary,
      primarySignal,
      secondarySignal,
      hingeInterp,
      secInterp,
      mech,
    });
  }
  return pack({
    name,
    proposition: `${a} experience paced like courses — arrival, main, close — for ${interest} instead of freeform hanging out${where}.`,
    audience: `Guests who accept hospitality pacing for ${interest}${where}.`,
    context: `Food/hospitality attributes from “${hinge.name}” (observed: ${primarySignal}).`,
    mechanics: `Course clock. Each course has a host action and guest action. Not a restaurant concept unless food service is explicit.`,
    journey: steps([
      ["Host", `Plate arrival beat using hospitality cues from “${hinge.name}”.`, [hinge.id]],
      ["Guest", `Move through main ${interest} ritual as “course two”.`, [hinge.id]],
      ["Host", `Serve closing share textured by “${secondary.name}”.`, [secondary.id, hinge.id]],
    ]),
    hinge,
    secondary,
    primarySignal,
    secondarySignal,
    hingeInterp,
    secInterp,
    mech,
  });
}

function pack(options: {
  name: string;
  proposition: string;
  audience: string;
  context: string;
  mechanics: string;
  journey: JourneyStep[];
  hinge: CulturalEntity;
  secondary: CulturalEntity;
  primarySignal: string;
  secondarySignal: string;
  hingeInterp: string;
  secInterp: string;
  mech: MechDef;
}): {
  name: string;
  proposition: string;
  audience: string;
  context: string;
  mechanics: string;
  journey: JourneyStep[];
  rationales: DesignRationale[];
} {
  const {
    name,
    proposition,
    audience,
    context,
    mechanics,
    journey,
    hinge,
    secondary,
    primarySignal,
    secondarySignal,
    hingeInterp,
    secInterp,
    mech,
  } = options;

  const rationales: DesignRationale[] = [
    {
      id: `rat-mech-${mech.id}`,
      featureId: "operating_mechanics",
      featureDescription: mechanics,
      influenceEntityId: hinge.id,
      attributeOrSignal: primarySignal,
      creativeInterpretation: `${hingeInterp} Creative design hypothesis: treat “${hinge.name}” as an operating-system metaphor (${mech.label}), not as decoration or as a substitute for the requested deliverable.`,
      whyItProducesMechanic: `Observed attribute “${primarySignal}” on a ${hinge.category} entity implies ${mech.label.toLowerCase()} progression rules when interpreted for this deliverable — still a hypothesis, not a verified cultural law.`,
    },
    {
      id: `rat-${journey[0]!.id}`,
      featureId: journey[0]!.id,
      featureDescription: journey[0]!.action,
      influenceEntityId: hinge.id,
      attributeOrSignal: primarySignal,
      creativeInterpretation: `Creative design hypothesis: opening step inherits hinge attributes from “${hinge.name}” (observed: ${primarySignal}).`,
      whyItProducesMechanic: `Binding step 1 to the hinge keeps the journey non-interchangeable across unrelated interests.`,
    },
    {
      id: `rat-${journey[1]!.id}`,
      featureId: journey[1]!.id,
      featureDescription: journey[1]!.action,
      influenceEntityId: hinge.id,
      attributeOrSignal: primarySignal,
      creativeInterpretation: `Creative design hypothesis: mid step keeps the same mechanism family so users learn one rule.`,
      whyItProducesMechanic: `Repeating the hinge rule mid-journey is what makes the mechanic teachable in a pilot.`,
    },
    {
      id: `rat-${journey[2]!.id}`,
      featureId: journey[2]!.id,
      featureDescription: journey[2]!.action,
      influenceEntityId: secondary.id,
      attributeOrSignal: secondarySignal,
      creativeInterpretation: `${secInterp} Creative design hypothesis: closing uses “${secondary.name}” as texture/constraint, not a second competing OS.`,
      whyItProducesMechanic: `Secondary observed signal “${secondarySignal}” differentiates the close without replacing the hinge mechanic.`,
    },
  ];

  return { name, proposition, audience, context, mechanics, journey, rationales };
}

function steps(rows: [string, string, string[]][]): JourneyStep[] {
  return rows.map((row, i) => ({
    id: `step-${i + 1}`,
    actor: row[0],
    action: row[1],
    influenceEntityIds: row[2],
  }));
}

/** Pronounceable, non-repetitive names — interest-led, not entity-fragment chains. */
export function professionalName(
  interest: string,
  hinge: CulturalEntity,
  mechanismId: MechanismId,
): string {
  const suffix = MECHANISM_NAME_SUFFIX[mechanismId];
  const interestLead = titleCase(interest)
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .slice(0, 2)
    .join(" ");
  const hingeToken = distinctiveHingeToken(hinge.name, suffix);

  const candidates = [
    `${interestLead} ${suffix}`,
    hingeToken ? `${hingeToken} ${suffix}` : "",
    hingeToken ? `${interestLead} ${hingeToken}` : "",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (!hasRepeatedWords(candidate) && !isGenericSuffixChain(candidate)) {
      return candidate;
    }
  }
  return `${interestLead || "Fusion"} ${suffix}`;
}

const MECHANISM_NAME_SUFFIX: Record<MechanismId, string> = {
  spatial_circuit: "Circuit",
  narrative_chapters: "Chapters",
  sonic_set: "Session",
  brand_drop: "Drops",
  material_layer: "Layers",
  hospitality_course: "Courses",
  tension_dual: "Fork",
};

function distinctiveHingeToken(entityName: string, suffix: string): string {
  const skip = new Set([
    ...GENERIC_NAME_TOKENS,
    suffix.toLowerCase(),
    "mock",
    "eval",
    "the",
    "and",
    "co",
    "studio",
    "label",
  ]);
  const parts = entityName
    .replace(/^Eval\s+/i, "")
    .replace(/^Mock\s+/i, "")
    .split(/\s+/)
    .map((p) => p.replace(/[^a-zA-Z0-9-]/g, ""))
    .filter((p) => p.length > 2 && !skip.has(p.toLowerCase()));
  return parts.slice(0, 1).join(" ");
}

function groupByCategory(
  entities: CulturalEntity[],
): Map<CulturalEntity["category"], CulturalEntity[]> {
  const map = new Map<CulturalEntity["category"], CulturalEntity[]>();
  for (const e of entities) {
    const list = map.get(e.category) ?? [];
    list.push(e);
    map.set(e.category, list);
  }
  return map;
}

function pickSupport(
  entities: CulturalEntity[],
  excludeIds: string[],
  count: number,
  salt: string,
): CulturalEntity[] {
  const exclude = new Set(excludeIds);
  const sorted = [...entities]
    .filter((e) => !exclude.has(e.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  const offset = sorted.length === 0 ? 0 : hashSalt(salt) % sorted.length;
  const rotated = [...sorted.slice(offset), ...sorted.slice(0, offset)];
  const picked: CulturalEntity[] = [];
  for (const e of rotated) {
    if (picked.length >= count) break;
    if (picked.some((p) => p.category === e.category)) continue;
    picked.push(e);
  }
  for (const e of rotated) {
    if (picked.length >= count) break;
    if (!picked.some((p) => p.id === e.id)) picked.push(e);
  }
  return picked;
}

function uniqueEntities(list: CulturalEntity[]): CulturalEntity[] {
  const seen = new Set<string>();
  const out: CulturalEntity[] = [];
  for (const e of list) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
  }
  return out;
}

function hashSalt(salt: string): number {
  let h = 2166136261;
  for (let i = 0; i < salt.length; i++) {
    h ^= salt.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function article(output: OutputCategory): "A" | "An" {
  return output === "experience" ? "An" : "A";
}
