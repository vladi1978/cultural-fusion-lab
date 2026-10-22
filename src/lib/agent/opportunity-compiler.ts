import { buildProgramIdentity } from "./program-identity";
/**
 * P1.1 Opportunity-first concept compiler.
 * Opportunities determine operating programs — not post-hoc description.
 * Deterministic. Does not invent Qloo facts, demand, or audience preferences.
 */

import type {
  CausalBinding,
  ConceptSpec,
  CulturalEntity,
  DesignRationale,
  InfluenceMapEntry,
  JourneyStep,
  OperatingRule,
  OutputCategory,
} from "../types";
import { assessMechanismCompatibility } from "./mechanism-compat";
import { interpretProductIntent } from "./product-intent";
import { hasRepeatedWords, isGenericSuffixChain } from "./naming";
import type { OpportunityHypothesis } from "./opportunity-types";
import {
  isAcousticSignal,
  isCraftSignal,
  isMaterialSignal,
  isRetailSignal,
  resolveOpportunitySignals,
  type ResolvedOpportunitySignals,
} from "./opportunity-signals";
import type { InterpretedObjective, MechanismId } from "./types";

export interface CompileConceptFromOpportunityInput {
  opportunity: OpportunityHypothesis;
  mechanismId: MechanismId;
  interpreted: InterpretedObjective;
  influences: CulturalEntity[];
  modeLabel?: "demo" | "live";
}

export interface OperatingProgramDraft {
  id: string;
  label: string;
  fingerprint: string;
  baseMechanismId: MechanismId;
  rules: OperatingRule[];
  proposition: string;
  audience: string;
  context: string;
  mechanics: string;
  journey: JourneyStep[];
  differentiation: string;
  pilotExperiment: string;
  pilotMetricId: string;
  designDecisionId: string;
  bindings: Omit<CausalBinding, "id" | "opportunityId" | "evidenceIds">[];
}

/**
 * Compile a ConceptSpec where the opportunity causally drives the operating program.
 */
export function compileConceptFromOpportunity(
  input: CompileConceptFromOpportunityInput,
): ConceptSpec | null {
  const {
    opportunity,
    mechanismId,
    interpreted,
    influences,
    modeLabel = "demo",
  } = input;

  if (influences.length < 2) return null;

  // P9.211: preserve explicit physical-product intent
  // Opportunity operating programs currently synthesize cultural kits.
  // Defer recognized physical objects to the catalog product blueprint.
  if (
    interpreted.outputCategory === "product" &&
    interpretProductIntent(interpreted.rawObjective).kind === "explicit"
  ) {
    return null;
  }


  const hinge =
    influences.find((e) =>
      opportunity.supportingEntityIds.includes(e.id),
    ) ?? influences[0]!;
  const secondary =
    influences.find(
      (e) =>
        e.id !== hinge.id && opportunity.supportingEntityIds.includes(e.id),
    ) ??
    influences.find((e) => e.id !== hinge.id) ??
    influences[1]!;

  const compat = assessMechanismCompatibility({
    mechanismId,
    output: interpreted.outputCategory,
    hingeCategory:
      mechanismId === "tension_dual" ? "tension" : hinge.category,
    culturalInterest: interpreted.culturalInterest,
    rawObjective: interpreted.rawObjective,
  });
  if (!compat.applicable) return null;

  const signals = resolveOpportunitySignals({
    opportunity,
    entities: influences,
    culturalInterest: interpreted.culturalInterest,
  });
  if (signals.interestOnly && opportunity.kind !== "tension") {
    return null;
  }

  const program = buildOperatingProgram({
    mechanismId,
    opportunity,
    interpreted,
    hinge,
    secondary,
    signals,
  });

  const name = composeProgramName(
    interpreted.culturalInterest,
    program,
    hinge,
    mechanismId,
  );

  const bindings: CausalBinding[] = program.bindings.map((b, i) => ({
    id: `bind-${opportunity.id}-${i + 1}`,
    opportunityId: opportunity.id,
    evidenceIds: [...opportunity.evidenceIds],
    ...b,
  }));

  const rationales = buildRationales({
    opportunity,
    hinge,
    secondary,
    influences,
    program,
    bindings,
    signals,
  });

  const influenceMap: InfluenceMapEntry[] = influences.slice(0, 3).map((e) => ({
    entityId: e.id,
    entityName: e.name,
    category: e.category,
    role:
      e.id === hinge.id
        ? "hinge"
        : opportunity.kind === "tension" &&
            opportunity.supportingEntityIds.includes(e.id)
          ? "tension"
          : e.category === "brands"
            ? "distribution"
            : "texture",
    signalsUsed: e.tags.slice(0, 3),
  }));

  const where = interpreted.location ? ` in ${interpreted.location}` : "";
  const feasibilityAssumptions = [
    interpreted.outputCategory === "product"
      ? `A small batch of the ${program.label} deliverable can be prototyped for ${interpreted.culturalInterest}${where}.`
      : `Hosts can run the ${program.label} operating program for ${interpreted.culturalInterest}${where}.`,
    modeLabel === "demo"
      ? "Demo entities are fictional stand-ins; live deployment would require verified neighborhood substitutes."
      : "Live entities are drawn from collected API rows; operational logistics remain unvalidated.",
  ];

  const risksAndUnknowns = [
    opportunity.uncertainty,
    ...opportunity.unsupportedAssumptions.slice(0, 1),
    `Unknown whether observed “${signals.primary}” transfers to ${interpreted.outputCategory} operations outside collected categories.`,
  ].slice(0, 3);

  const evidenceBoundary =
    modeLabel === "demo"
      ? `Observed attributes are mock_demo tags/categories. Operating program and rationales are creative hypotheses compiled from an opportunity — not Qloo Taste Graph edges or demand proof.`
      : `Observed attributes cite collected/verified_api metadata where available. Operating program remains a creative hypothesis — not Taste Graph forecasts or market validation.`;

  const opportunityTrace = {
    opportunityId: opportunity.id,
    opportunityKind: opportunity.kind,
    steps: [
      {
        stage: "observed_signal" as const,
        label: "Observed signals",
        detail: `Primary “${signals.primary}”, secondary “${signals.secondary}”; shared non-interest=[${signals.sharedNonInterest.join(", ")}].`,
        hypothesis: false,
        evidenceIds: [...opportunity.evidenceIds].slice(0, 6),
      },
      {
        stage: "opportunity_hypothesis" as const,
        label: `${opportunity.kind} opportunity (hypothesis)`,
        detail: opportunity.whyCreativelyUseful,
        hypothesis: true,
        evidenceIds: [...opportunity.evidenceIds].slice(0, 6),
      },
      {
        stage: "design_decision" as const,
        label: "Design decision (hypothesis)",
        detail: `${program.designDecisionId}: ${opportunity.designImplication}`,
        hypothesis: true,
        evidenceIds: [...opportunity.evidenceIds].slice(0, 4),
      },
      {
        stage: "concept_mechanism" as const,
        label: `Operating program: ${program.id}`,
        detail: program.mechanics,
        hypothesis: true,
        evidenceIds: [...opportunity.evidenceIds].slice(0, 4),
      },
      {
        stage: "proposed_pilot" as const,
        label: "Proposed pilot",
        detail: program.pilotExperiment,
        hypothesis: true,
        evidenceIds: [...opportunity.evidenceIds].slice(0, 2),
      },
    ],
  };

  return {
    name,
    proposition: program.proposition,
    audience: program.audience,
    context: program.context,
    journey: program.journey,
    mechanics: program.mechanics,
    influenceMap,
    differentiationHypothesis: program.differentiation,
    feasibilityAssumptions,
    risksAndUnknowns,
    pilotExperiment: program.pilotExperiment,
    evidenceBoundary,
    rationales,
    frozenObjective: interpreted.rawObjective,
    frozenOutputCategory: interpreted.outputCategory,
    mechanicFingerprint: program.fingerprint,
    mechanismId,
    opportunityId: opportunity.id,
    opportunityKind: opportunity.kind,
    opportunityTrace,
    operatingProgramId: program.id,
    operatingProgramFingerprint: program.fingerprint,
    ...buildProgramIdentity({
      programId: program.id,
      outputCategory: interpreted.outputCategory,
      opportunityKind: opportunity.kind,
      hingeId: hinge.id,
      secondaryId: secondary.id,
      primarySignal: signals.primary,
      secondarySignal: signals.secondary,
      ruleIds: program.rules.map((rule) => rule.id),
      journey: program.journey,
    }),
    operatingRules: program.rules,
    causalBindings: bindings,
  };
}

function buildOperatingProgram(options: {
  mechanismId: MechanismId;
  opportunity: OpportunityHypothesis;
  interpreted: InterpretedObjective;
  hinge: CulturalEntity;
  secondary: CulturalEntity;
  signals: ResolvedOpportunitySignals;
}): OperatingProgramDraft {
  const { mechanismId, opportunity, interpreted, hinge, secondary, signals } =
    options;
  const output = interpreted.outputCategory;
  const interest = interpreted.culturalInterest;
  const where = interpreted.location ? ` in ${interpreted.location}` : "";
  const a = output === "experience" ? "An" : "A";

  // Retail evidence alone does not authorize a membership/drop experience.
  // The requested outcome must explicitly call for commercial access mechanics.
  const retailProgramRelevant =
    /\b(membership|memberships|member access|members-only|exclusive access|exclusive brand|limited drops?|product drops?|retail drops?|subscription|subscriptions)\b/i.test(
      interpreted.rawObjective
    );


  // Tension / contrast → dual-mode program
  if (
    opportunity.kind === "tension" ||
    opportunity.kind === "contrast" ||
    signals.opposition
  ) {
    return dualModeProgram({
      mechanismId,
      opportunity,
      output,
      interest,
      where,
      a,
      hinge,
      secondary,
      signals,
    });
  }

  // A recognized primary signal determines the operating family.
  // Secondary shared signals enrich the program but cannot override it.
  // Tension/contrast remains higher priority, handled above.
  if (isAcousticSignal(signals.primary)) {
    return acousticSpatialProgram({
      mechanismId, opportunity, output, interest, where, a,
      hinge, secondary, signals,
    });
  }

  if (isCraftSignal(signals.primary)) {
    return craftCocreateProgram({
      mechanismId, opportunity, output, interest, where, a,
      hinge, secondary, signals,
    });
  }

  if (isMaterialSignal(signals.primary)) {
    return materialReconfigProgram({
      mechanismId, opportunity, output, interest, where, a,
      hinge, secondary, signals,
    });
  }

  if (retailProgramRelevant && isRetailSignal(signals.primary)) {
    return retailCheckpointProgram({
      mechanismId, opportunity, output, interest, where, a,
      hinge, secondary, signals,
    });
  }

  // Acoustic / listening + place → spatial-acoustic participation
  if (
    isAcousticSignal(signals.primary) ||
    (signals.sharedNonInterest.some(isAcousticSignal) &&
      (hinge.category === "places" || secondary.category === "places"))
  ) {
    return acousticSpatialProgram({
      mechanismId,
      opportunity,
      output,
      interest,
      where,
      a,
      hinge,
      secondary,
      signals,
    });
  }

  // Craft / atelier → co-creation program
  if (
    isCraftSignal(signals.primary) ||
    signals.sharedNonInterest.some(isCraftSignal) ||
    isCraftSignal(signals.secondary)
  ) {
    return craftCocreateProgram({
      mechanismId,
      opportunity,
      output,
      interest,
      where,
      a,
      hinge,
      secondary,
      signals,
    });
  }

  // Material / utility fashion
  if (
    isMaterialSignal(signals.primary) ||
    signals.sharedNonInterest.some(isMaterialSignal)
  ) {
    return materialReconfigProgram({
      mechanismId,
      opportunity,
      output,
      interest,
      where,
      a,
      hinge,
      secondary,
      signals,
    });
  }

  // Retail / membership
  if (
    retailProgramRelevant &&
    (isRetailSignal(signals.primary) ||
      signals.sharedNonInterest.some(isRetailSignal))
  ) {
    return retailCheckpointProgram({
      mechanismId,
      opportunity,
      output,
      interest,
      where,
      a,
      hinge,
      secondary,
      signals,
    });
  }

  // Generic complementarity/convergence specialized by primary signal
  return signalSpecializedProgram({
    mechanismId,
    opportunity,
    output,
    interest,
    where,
    a,
    hinge,
    secondary,
    signals,
  });
}

type ProgArgs = {
  mechanismId: MechanismId;
  opportunity: OpportunityHypothesis;
  output: OutputCategory;
  interest: string;
  where: string;
  a: string;
  hinge: CulturalEntity;
  secondary: CulturalEntity;
  signals: ResolvedOpportunitySignals;
};

function acousticSpatialProgram(o: ProgArgs): OperatingProgramDraft {
  const { opportunity, output, interest, where, a, hinge, secondary, signals, mechanismId } = o;
  const cue = signals.sharedNonInterest.find(isAcousticSignal) ?? signals.primary;
  const place =
    hinge.category === "places" ? hinge : secondary.category === "places" ? secondary : hinge;
  const music =
    hinge.category === "music" ? hinge : secondary.category === "music" ? secondary : secondary;

  const designDecisionId = "dd-acoustic-spatial";
  const rules: OperatingRule[] = [
    {
      id: "rule-listen-gate",
      rule: `Progression between zones requires a completed ${cue} listen gate (timed silence or phrase).`,
      boundSignalIds: signalIdsFor(signals, cue),
    },
    {
      id: "rule-zone-map",
      rule: `Physical/layout zones follow “${place.name}” typology; acoustic pacing follows “${music.name}”.`,
      boundSignalIds: signalIdsFor(signals, cue),
    },
    {
      id: "rule-no-average",
      rule: "Do not collapse listening into ambient wallpaper — listen gates are mandatory operating rules.",
      boundSignalIds: signalIdsFor(signals, cue),
    },
  ];

  const journey: JourneyStep[] =
    output === "product"
      ? [
          {
            id: "step-1",
            actor: "User",
            action: `Unpack the portable listen-gate zone kit; configure threshold / dwell / release markers using “${place.name}”, then arm a ${cue} timer from “${music.name}”.`,
            influenceEntityIds: [place.id, music.id],
          },
          {
            id: "step-2",
            actor: "User",
            action: `Use the ${cue} listen gate before relocating the kit; moving without the gate is invalid.`,
            influenceEntityIds: [music.id, place.id],
          },
          {
            id: "step-3",
            actor: "User",
            action: `Pack the kit only after gate success; log whether ${cue} pacing matched the configured zone map.`,
            influenceEntityIds: [place.id, music.id],
          },
        ]
      : [
          {
            id: "step-1",
            actor: "Host",
            action: `Map threshold / dwell / release markers using “${place.name}”, then arm a ${cue} listen gate from “${music.name}”.`,
            influenceEntityIds: [place.id, music.id],
          },
          {
            id: "step-2",
            actor: "Guest",
            action: `Complete the ${cue} gate before leaving dwell; relocation without the gate is invalid.`,
            influenceEntityIds: [music.id, place.id],
          },
          {
            id: "step-3",
            actor: "Host",
            action: `Release only after gate success; log whether ${cue} pacing matched the zone map.`,
            influenceEntityIds: [place.id, music.id],
          },
        ];

  const pilotMetricId = "pilot-listen-gate-completion";
  const fingerprint = [
    "acoustic_spatial",
    output,
    cue,
    place.category,
    music.category,
    opportunity.kind,
  ]
    .join("|")
    .toLowerCase();

  const deliverable =
    output === "product"
      ? `portable ${interest} listen-gate zone kit`
      : output === "brand"
        ? `${interest} brand system paced by listen gates across place-like touchpoints`
        : `${interest} experience that couples spatial zones to ${cue} listen gates`;

  return {
    id: "acoustic_spatial",
    label: "Acoustic–spatial participation",
    fingerprint,
    baseMechanismId: mechanismId,
    rules,
    proposition: `${a} ${output}: ${deliverable}${where}, driven by observed “${cue}” across ${place.category} and ${music.category}.`,
    audience:
      output === "product"
        ? `Users who configure and use a portable ${cue} zone kit for ${interest}${where}.`
        : `${output === "brand" ? "Customers" : "Guests"} who accept mandatory ${cue} gates before zone changes${where}.`,
    context: `Operating program compiled from ${opportunity.kind} on “${cue}” (not interest-only). Place hinge “${place.name}”; acoustic hinge “${music.name}”.`,
    mechanics: rules.map((r) => r.rule).join(" "),
    journey,
    differentiation: withCausalBridge(
      output,
      hinge.category,
      `Distinctive operating program=acoustic_spatial: zone progress is gated by ${cue}, not by a generic timed salon. Opportunity=${opportunity.id}.`,
      cue,
    ),
    pilotExperiment: `Pilot metric (${pilotMetricId}): run one circuit with 8–12 participants${where}; count % who complete the ${cue} listen gate before zone exit; score 1–5 whether zones felt acoustically paced. Success: ≥70% gate-complete and median score ≥3. Tests the opportunity hypothesis — not audience validation.`,
    pilotMetricId,
    designDecisionId,
    bindings: [
      {
        observedSignalIds: signalIdsFor(signals, cue),
        observedSignals: [cue],
        designDecisionId,
        operatingRuleId: "rule-listen-gate",
        journeyStepIds: ["step-1", "step-2"],
        pilotMetricId,
        creativeInterpretation: `Creative design hypothesis: treat observed “${cue}” as a hard participation gate between spatial zones — not verified cultural law.`,
      },
      {
        observedSignalIds: signalIdsFor(signals, cue),
        observedSignals: [cue],
        designDecisionId,
        operatingRuleId: "rule-zone-map",
        journeyStepIds: ["step-1", "step-3"],
        pilotMetricId,
        creativeInterpretation: `Creative design hypothesis from observed place typology: “${place.name}” supplies layout; “${music.name}” supplies gate timing.`,
      },
    ],
  };
}

function craftCocreateProgram(o: ProgArgs): OperatingProgramDraft {
  const { opportunity, output, interest, where, a, hinge, secondary, signals, mechanismId } = o;
  const cue =
    signals.sharedNonInterest.find(isCraftSignal) ??
    (isCraftSignal(signals.primary) ? signals.primary : signals.secondary);
  const brand =
    hinge.category === "brands" ? hinge : secondary.category === "brands" ? secondary : secondary;
  const maker =
    hinge.category === "brands" ? secondary : hinge;

  const designDecisionId = "dd-craft-cocreate";
  const rules: OperatingRule[] = [
    {
      id: "rule-make-beat",
      rule: `Core participation is a ${cue} make/assemble beat — not listen-only phrase timing.`,
      boundSignalIds: signalIdsFor(signals, cue),
    },
    {
      id: "rule-brand-checkpoint",
      rule: `A brand checkpoint from “${brand.name}” validates the made artifact before the next release.`,
      boundSignalIds: signalIdsFor(signals, cue),
    },
    {
      id: "rule-cocreate-log",
      rule: "Each participant logs one co-created configuration; passive attendance does not complete the program.",
      boundSignalIds: signalIdsFor(signals, cue),
    },
  ];

  const journey: JourneyStep[] = [
    {
      id: "step-1",
      actor: output === "brand" ? "Brand" : "Host",
      action: `Issue a ${cue} make kit patterned on “${maker.name}” under “${brand.name}” membership rules.`,
      influenceEntityIds: [maker.id, brand.id],
    },
    {
      id: "step-2",
      actor: output === "product" ? "User" : "Member",
      action: `Assemble/reconfigure the ${cue} artifact; submit to the brand checkpoint before continuing.`,
      influenceEntityIds: [maker.id, brand.id],
    },
    {
      id: "step-3",
      actor: output === "brand" ? "Brand" : "Host",
      action: `Release the commons/share moment only for checkpoint-passed artifacts; archive configurations.`,
      influenceEntityIds: [brand.id, maker.id],
    },
  ];

  const pilotMetricId = "pilot-cocreate-checkpoint";
  const fingerprint = [
    "craft_cocreate",
    output,
    cue,
    brand.category,
    maker.category,
    opportunity.kind,
  ]
    .join("|")
    .toLowerCase();

  const deliverable =
    output === "product"
      ? `${interest} co-creation kit with brand checkpoint card`
      : output === "brand"
        ? `${interest} co-creation membership line paced by ${cue} make beats`
        : `${interest} co-creation session where ${cue} making is the main action`;

  return {
    id: "craft_cocreate",
    label: "Craft co-creation",
    fingerprint,
    baseMechanismId: mechanismId,
    rules,
    proposition: `${a} ${output}: ${deliverable}${where}, driven by observed “${cue}” across ${maker.category} and ${brand.category}.`,
    audience: `Participants who will make/assemble under a brand checkpoint for ${interest}${where}.`,
    context: `Operating program compiled from ${opportunity.kind} on “${cue}”. Maker “${maker.name}”; brand ops “${brand.name}”.`,
    mechanics: rules.map((r) => r.rule).join(" "),
    journey,
    differentiation: withCausalBridge(
      output,
      hinge.category,
      `Distinctive operating program=craft_cocreate: participation is ${cue} making + brand checkpoint — not a phrase→break→reprise listening salon. Opportunity=${opportunity.id}.`,
      cue,
    ),
    pilotExperiment: `Pilot metric (${pilotMetricId}): 8–12 participants run one make→checkpoint→release cycle${where}; count % who pass the checkpoint with a logged artifact; score 1–5 clarity of the ${cue} co-create rule. Success: ≥70% checkpoint-pass and median ≥3. Tests the craft complementarity hypothesis — not demand.`,
    pilotMetricId,
    designDecisionId,
    bindings: [
      {
        observedSignalIds: signalIdsFor(signals, cue),
        observedSignals: [cue],
        designDecisionId,
        operatingRuleId: "rule-make-beat",
        journeyStepIds: ["step-1", "step-2"],
        pilotMetricId,
        creativeInterpretation: `Creative interpretation: observed “${cue}” becomes the primary participation verb (make/assemble), replacing listen-only pacing.`,
      },
      {
        observedSignalIds: signalIdsFor(signals, cue),
        observedSignals: [cue],
        designDecisionId,
        operatingRuleId: "rule-brand-checkpoint",
        journeyStepIds: ["step-2", "step-3"],
        pilotMetricId,
        creativeInterpretation: `Creative design hypothesis: observed brand ops from “${brand.name}” supply checkpoint/release for co-created artifacts.`,
      },
    ],
  };
}

function dualModeProgram(o: ProgArgs): OperatingProgramDraft {
  const { opportunity, output, interest, where, a, hinge, secondary, signals, mechanismId } = o;
  const opp = signals.opposition ?? ["quiet", "loud"];
  const designDecisionId = "dd-dual-mode";
  const rules: OperatingRule[] = [
    {
      id: "rule-declare-poles",
      rule: `Declare dual modes (${opp[0]} vs ${opp[1]}) using “${hinge.name}” / “${secondary.name}”; no silent merge.`,
      boundSignalIds: signalIdsFor(signals, opp[0]),
    },
    {
      id: "rule-fork",
      rule: "Mid segment requires an explicit path choice; averaging poles is an invalid operating move.",
      boundSignalIds: signalIdsFor(signals, opp[1]),
    },
    {
      id: "rule-unresolved-close",
      rule: "Close names the unresolved tension; do not invent a harmonic resolution.",
      boundSignalIds: signalIdsFor(signals, opp[0]),
    },
  ];

  const journey: JourneyStep[] = [
    {
      id: "step-1",
      actor: "Host",
      action: `Open by declaring ${opp[0]} track vs ${opp[1]} track with anchors “${hinge.name}” and “${secondary.name}”.`,
      influenceEntityIds: [hinge.id, secondary.id],
    },
    {
      id: "step-2",
      actor: "Guest",
      action: `Choose one pole for the mid segment; switching requires a visible transition, not a blend.`,
      influenceEntityIds: [hinge.id, secondary.id],
    },
    {
      id: "step-3",
      actor: "Host",
      action: `Hold a shared close that states the tension remains unresolved (${opp[0]} / ${opp[1]}).`,
      influenceEntityIds: [hinge.id, secondary.id],
    },
  ];

  const pilotMetricId = "pilot-path-choice";
  const fingerprint = [
    "dual_mode_tension",
    output,
    opp[0],
    opp[1],
    opportunity.kind,
  ]
    .join("|")
    .toLowerCase();

  return {
    id: "dual_mode_tension",
    label: "Dual-mode tension",
    fingerprint,
    baseMechanismId: mechanismId,
    rules,
    proposition: `${a} ${output} that runs ${interest} as explicit ${opp[0]} vs ${opp[1]} dual modes${where}, instead of averaging opposing cues.`,
    audience: `Participants willing to choose a pole rather than average ${opp[0]}/${opp[1]}${where}.`,
    context: `Operating program from ${opportunity.kind}; opposition=${opp.join("/")}.`,
    mechanics: rules.map((r) => r.rule).join(" "),
    journey,
    differentiation: withCausalBridge(
      output,
      hinge.category,
      `Distinctive operating program=dual_mode_tension: fork + unresolved close on ${opp.join(" vs ")}. Opportunity=${opportunity.id}.`,
      signals.primary,
    ),
    pilotExperiment: `Pilot metric (${pilotMetricId}): 8–12 participants; count % who make an explicit mid-path choice; score 1–5 whether the close felt unresolved (not falsely harmonized). Success: ≥70% choose a path and median unresolved-clarity ≥3. Tests the tension hypothesis — not demand.`,
    pilotMetricId,
    designDecisionId,
    bindings: [
      {
        observedSignalIds: signalIdsFor(signals, opp[0]),
        observedSignals: [...opp],
        designDecisionId,
        operatingRuleId: "rule-declare-poles",
        journeyStepIds: ["step-1", "step-2"],
        pilotMetricId,
        creativeInterpretation: `Creative interpretation: keep ${opp.join(" vs ")} as parallel operating modes.`,
      },
      {
        observedSignalIds: signalIdsFor(signals, opp[1]),
        observedSignals: [...opp],
        designDecisionId,
        operatingRuleId: "rule-fork",
        journeyStepIds: ["step-2", "step-3"],
        pilotMetricId,
        creativeInterpretation: `Creative interpretation: mid fork is mandatory; blending is invalid.`,
      },
    ],
  };
}

function materialReconfigProgram(o: ProgArgs): OperatingProgramDraft {
  const { opportunity, output, interest, where, a, hinge, secondary, signals, mechanismId } = o;
  const cue =
    signals.sharedNonInterest.find(isMaterialSignal) ?? signals.primary;
  const designDecisionId = "dd-material-reconfig";
  const rules: OperatingRule[] = [
    {
      id: "rule-layer-state",
      rule: `Participation changes a physical/digital layer state keyed to observed “${cue}”.`,
      boundSignalIds: signalIdsFor(signals, cue),
    },
    {
      id: "rule-mid-reconfig",
      rule: "A mid-cycle reconfiguration is required; static display does not complete the program.",
      boundSignalIds: signalIdsFor(signals, cue),
    },
    {
      id: "rule-archive",
      rule: `Archive each configuration; closing references “${secondary.name}” as texture only.`,
      boundSignalIds: signalIdsFor(signals, signals.secondary),
    },
  ];
  const formNoun =
    output === "product"
      ? "modular apparel kit"
      : output === "brand"
        ? "wearable module line"
        : "layer kit";
  const journey: JourneyStep[] = [
    {
      id: "step-1",
      actor: output === "product" ? "User" : "Guest",
      action:
        output === "product"
          ? `Unpack the ${formNoun} patterned on “${hinge.name}” ${cue} utility; wear the base layer.`
          : `Receive ${formNoun} patterned on “${hinge.name}” ${cue} utility.`,
      influenceEntityIds: [hinge.id],
    },
    {
      id: "step-2",
      actor: output === "product" ? "User" : "Guest",
      action:
        output === "product"
          ? `Configure / reassemble layers mid-cycle on a ${interest} cue tied to observed “${cue}”.`
          : `Reconfigure layers mid-cycle on a ${interest} cue tied to “${cue}”.`,
      influenceEntityIds: [hinge.id],
    },
    {
      id: "step-3",
      actor: output === "product" ? "User" : "Host",
      action: `Archive each module configuration; close with “${secondary.name}” reference (texture only).`,
      influenceEntityIds: [secondary.id, hinge.id],
    },
  ];
  const pilotMetricId = "pilot-reconfig-count";
  const fingerprint = ["material_reconfig", output, cue, opportunity.kind]
    .join("|")
    .toLowerCase();
  return {
    id: "material_reconfig",
    label: "Material reconfiguration",
    fingerprint,
    baseMechanismId: mechanismId,
    rules,
    proposition:
      output === "product"
        ? `${a} ${output}: ${formNoun} that users configure and wear for ${interest} ${cue} layering${where}.`
        : `${a} ${output} where ${interest} participation is ${cue} layer reconfiguration${where}, not seating ritual.`,
    audience:
      output === "product"
        ? `Users who wear and configure ${interest} utility modules${where}.`
        : `Participants who express ${interest} through assembly/utility${where}.`,
    context: `Operating program from ${opportunity.kind} on “${cue}”; hinge “${hinge.name}”.`,
    mechanics: rules.map((r) => r.rule).join(" "),
    journey,
    differentiation: withCausalBridge(
      output,
      hinge.category,
      `Distinctive operating program=material_reconfig on “${cue}”. Opportunity=${opportunity.id}.`,
      cue,
    ),
    pilotExperiment: `Pilot metric (${pilotMetricId}): count completed mid-cycle reconfigurations among 8–12 users${where}; score 1–5 clarity of the ${cue} rule. Success: ≥70% reconfigure once and median ≥3. Tests the opportunity hypothesis.`,
    pilotMetricId,
    designDecisionId,
    bindings: [
      {
        observedSignalIds: signalIdsFor(signals, cue),
        observedSignals: [cue],
        designDecisionId,
        operatingRuleId: "rule-layer-state",
        journeyStepIds: ["step-1", "step-2"],
        pilotMetricId,
        creativeInterpretation: `Creative design hypothesis: observed “${cue}” drives mandatory garment/module layer state changes.`,
      },
      {
        observedSignalIds: signalIdsFor(signals, cue),
        observedSignals: [cue],
        designDecisionId,
        operatingRuleId: "rule-mid-reconfig",
        journeyStepIds: ["step-2", "step-3"],
        pilotMetricId,
        creativeInterpretation: `Creative design hypothesis: mid-cycle configure/assemble is the success-critical product function.`,
      },
    ],
  };
}

function retailCheckpointProgram(o: ProgArgs): OperatingProgramDraft {
  const { opportunity, output, interest, where, a, hinge, secondary, signals, mechanismId } = o;
  const cue =
    signals.sharedNonInterest.find(isRetailSignal) ?? signals.primary;
  const designDecisionId = "dd-retail-checkpoint";
  const rules: OperatingRule[] = [
    {
      id: "rule-invite",
      rule: `Entry is invite/drop #1 under “${hinge.name}”-like rules keyed to “${cue}”.`,
      boundSignalIds: signalIdsFor(signals, cue),
    },
    {
      id: "rule-task",
      rule: `A ${interest} checkpoint task must complete before drop #2.`,
      boundSignalIds: signalIdsFor(signals, cue),
    },
    {
      id: "rule-commons",
      rule: `Public commons release is textured by “${secondary.name}”, not a continuous open venue.`,
      boundSignalIds: signalIdsFor(signals, signals.secondary),
    },
  ];
  const journey: JourneyStep[] = [
    {
      id: "step-1",
      actor: "Operator",
      action: `Issue invite/drop #1 under “${hinge.name}” ${cue} rules.`,
      influenceEntityIds: [hinge.id],
    },
    {
      id: "step-2",
      actor: "Member",
      action: `Complete the ${interest} checkpoint tied to “${cue}” before drop #2.`,
      influenceEntityIds: [hinge.id],
    },
    {
      id: "step-3",
      actor: "Operator",
      action: `Publish commons moment textured by “${secondary.name}”.`,
      influenceEntityIds: [secondary.id, hinge.id],
    },
  ];
  const pilotMetricId = "pilot-checkpoint-completion";
  const fingerprint = ["retail_checkpoint", output, cue, opportunity.kind]
    .join("|")
    .toLowerCase();
  return {
    id: "retail_checkpoint",
    label: "Retail checkpoint drops",
    fingerprint,
    baseMechanismId: mechanismId,
    rules,
    proposition: `${a} ${output} organized as ${cue} membership checkpoints for ${interest}${where}.`,
    audience: `Joiners who engage ${interest} through checkpoints and limited releases${where}.`,
    context: `Operating program from ${opportunity.kind} on “${cue}”.`,
    mechanics: rules.map((r) => r.rule).join(" "),
    journey,
    differentiation: withCausalBridge(
      output,
      hinge.category,
      `Distinctive operating program=retail_checkpoint on “${cue}”. Opportunity=${opportunity.id}.`,
      cue,
    ),
    pilotExperiment: `Pilot metric (${pilotMetricId}): measure checkpoint completion rate for 8–12 joiners${where}; score 1–5 clarity of the ${cue} drop rule. Success: ≥70% complete checkpoint and median ≥3.`,
    pilotMetricId,
    designDecisionId,
    bindings: [
      {
        observedSignalIds: signalIdsFor(signals, cue),
        observedSignals: [cue],
        designDecisionId,
        operatingRuleId: "rule-invite",
        journeyStepIds: ["step-1", "step-2"],
        pilotMetricId,
        creativeInterpretation: `Creative interpretation: “${cue}” structures invite→task→release.`,
      },
      {
        observedSignalIds: signalIdsFor(signals, cue),
        observedSignals: [cue],
        designDecisionId,
        operatingRuleId: "rule-task",
        journeyStepIds: ["step-2", "step-3"],
        pilotMetricId,
        creativeInterpretation: `Creative interpretation: checkpoint task is mandatory before release.`,
      },
    ],
  };
}

function signalSpecializedProgram(o: ProgArgs): OperatingProgramDraft {
  const { opportunity, output, interest, where, a, hinge, secondary, signals, mechanismId } = o;
  const cue = signals.primary;
  const designDecisionId = "dd-signal-specialized";
  const rules: OperatingRule[] = [
    {
      id: "rule-signal-os",
      rule: `Operating system uses observed “${cue}” as the primary progression rule for this ${output}.`,
      boundSignalIds: signalIdsFor(signals, cue),
    },
    {
      id: "rule-secondary-texture",
      rule: `“${secondary.name}” supplies “${signals.secondary}” texture only — not a second OS.`,
      boundSignalIds: signalIdsFor(signals, signals.secondary),
    },
    {
      id: "rule-hypothesis-bound",
      rule: `Every beat must cite the ${opportunity.kind} hypothesis on “${cue}”; generic interest mood is invalid.`,
      boundSignalIds: signalIdsFor(signals, cue),
    },
  ];
  const journey: JourneyStep[] =
    output === "product"
      ? [
          {
            id: "step-1",
            actor: "User",
            action: `Open the ${interest} module/kit; configure the “${cue}” rule demonstration anchored on “${hinge.name}”.`,
            influenceEntityIds: [hinge.id],
          },
          {
            id: "step-2",
            actor: "User",
            action: `Use the mid “${cue}” function; skipping the signal rule fails the beat.`,
            influenceEntityIds: [hinge.id, secondary.id],
          },
          {
            id: "step-3",
            actor: "User",
            action: `Close with “${signals.secondary}” texture from “${secondary.name}”; pack only after restating the “${cue}” rule.`,
            influenceEntityIds: [secondary.id, hinge.id],
          },
        ]
      : [
          {
            id: "step-1",
            actor: "Host",
            action: `Open with a “${cue}” rule demonstration anchored on “${hinge.name}”.`,
            influenceEntityIds: [hinge.id],
          },
          {
            id: "step-2",
            actor: "Guest",
            action: `Execute the mid “${cue}” action; skipping the signal rule fails the beat.`,
            influenceEntityIds: [hinge.id, secondary.id],
          },
          {
            id: "step-3",
            actor: "Host",
            action: `Close with “${signals.secondary}” texture from “${secondary.name}”; restate the “${cue}” rule.`,
            influenceEntityIds: [secondary.id, hinge.id],
          },
        ];
  const pilotMetricId = "pilot-signal-rule-clarity";
  const fingerprint = [
    "signal_specialized",
    output,
    cue,
    signals.secondary,
    opportunity.kind,
    mechanismId,
  ]
    .join("|")
    .toLowerCase();
  return {
    id: "signal_specialized",
    label: `Signal-specialized (${cue})`,
    fingerprint,
    baseMechanismId: mechanismId,
    rules,
    proposition:
      output === "product"
        ? `${a} ${output}: ${interest} kit whose operating rule is observed “${cue}” (${opportunity.kind})${where}, not a generic template.`
        : `${a} ${output} for ${interest}${where} whose operating rule is observed “${cue}” (${opportunity.kind}), not a generic template.`,
    audience:
      output === "product"
        ? `Users who configure and use a “${cue}”-ruled ${interest} kit${where}.`
        : `Participants who will follow a “${cue}”-specific rule for ${interest}${where}.`,
    context: `Compiled from opportunity ${opportunity.id}; primary=${cue}; secondary=${signals.secondary}.`,
    mechanics: rules.map((r) => r.rule).join(" "),
    journey,
    differentiation: withCausalBridge(
      output,
      hinge.category,
      `Distinctive operating program=signal_specialized(${cue}). Opportunity=${opportunity.id}.`,
      cue,
    ),
    pilotExperiment: `Pilot metric (${pilotMetricId}): after one cycle with 8–12 participants${where}, score 1–5 whether the “${cue}” rule was understood as the operating system; count rule-compliant mid beats. Success: median ≥3 and ≥70% compliant mid beats.`,
    pilotMetricId,
    designDecisionId,
    bindings: [
      {
        observedSignalIds: signalIdsFor(signals, cue),
        observedSignals: [cue],
        designDecisionId,
        operatingRuleId: "rule-signal-os",
        journeyStepIds: ["step-1", "step-2"],
        pilotMetricId,
        creativeInterpretation: `Creative design hypothesis: observed “${cue}” is the OS rule for this deliverable.`,
      },
      {
        observedSignalIds: signalIdsFor(signals, signals.secondary),
        observedSignals: [signals.secondary],
        designDecisionId,
        operatingRuleId: "rule-secondary-texture",
        journeyStepIds: ["step-2", "step-3"],
        pilotMetricId,
        creativeInterpretation: `Creative design hypothesis: observed secondary “${signals.secondary}” textures the close only.`,
      },
    ],
  };
}

function buildRationales(options: {
  opportunity: OpportunityHypothesis;
  hinge: CulturalEntity;
  secondary: CulturalEntity;
  influences: CulturalEntity[];
  program: OperatingProgramDraft;
  bindings: CausalBinding[];
  signals: ResolvedOpportunitySignals;
}): DesignRationale[] {
  const { opportunity, hinge, secondary, influences, program, bindings, signals } =
    options;
  const pool = [
    hinge,
    secondary,
    ...influences.filter((e) => e.id !== hinge.id && e.id !== secondary.id),
  ];
  const primaryEntity = entityWithSignal(pool, signals.primary) ?? hinge;
  const rationales: DesignRationale[] = [
    {
      id: `rat-prog-${program.id}`,
      featureId: "operating_mechanics",
      featureDescription: program.mechanics,
      influenceEntityId: primaryEntity.id,
      attributeOrSignal: signals.primary,
      creativeInterpretation: `Supported category reading retained. Creative design hypothesis: compile operating program “${program.id}” from ${opportunity.kind} on “${signals.primary}”.`,
      whyItProducesMechanic: `Hypothesis: observed “${signals.primary}” selects program rules [${program.rules.map((r) => r.id).join(", ")}] rather than a catalog default for ${program.baseMechanismId}.`,
    },
  ];

  // One rationale per journey step so rationale_coverage sees ≥2 bound steps.
  const coveredSteps = new Set<string>();
  for (const b of bindings) {
    for (const stepId of b.journeyStepIds) {
      if (coveredSteps.has(stepId)) continue;
      const step = program.journey.find((j) => j.id === stepId);
      if (!step) continue;
      coveredSteps.add(stepId);
      const cue = b.observedSignals[0] ?? signals.primary;
      const stepEntities = step.influenceEntityIds
        .map((id) => pool.find((e) => e.id === id))
        .filter((e): e is CulturalEntity => Boolean(e));
      const entity =
        entityWithSignal([...stepEntities, ...pool], cue) ?? hinge;
      // Prefer an attribute the linked entity actually carries.
      const attribute = entityHasSignal(entity, cue)
        ? cue
        : entity.tags.find((t) => t.toLowerCase() !== entity.category) ??
          entity.category;
      rationales.push({
        id: `rat-${b.id}-${stepId}`,
        featureId: stepId,
        featureDescription: step.action,
        influenceEntityId: entity.id,
        attributeOrSignal: attribute,
        creativeInterpretation: ensureSignalDisciplineLabel(
          b.creativeInterpretation,
          cue,
        ),
        whyItProducesMechanic: `Observed “${cue}” → causal binding ${b.id}: designDecision=${b.designDecisionId} → rule=${b.operatingRuleId} → journey=${stepId} → pilot=${b.pilotMetricId}. Creative design hypothesis; secondary texture may cite “${secondary.name}”.`,
      });
    }
  }
  return rationales;
}

/** Quality gate signal_discipline requires labeled observed / category / hypothesis phrasing. */
function ensureSignalDisciplineLabel(text: string, cue: string): string {
  if (/observed|supported category|creative design hypothesis/i.test(text)) {
    return text;
  }
  return `Creative design hypothesis from observed “${cue}”: ${text}`;
}

function entityHasSignal(entity: CulturalEntity, token: string): boolean {
  const t = token.toLowerCase().trim();
  if (!t) return false;
  if (entity.category.toLowerCase() === t) return true;
  if (entity.tags.some((tag) => tag.toLowerCase() === t)) return true;
  return t
    .split(/[\s/_-]+/)
    .some(
      (part) =>
        part.length > 2 &&
        (entity.category.toLowerCase() === part ||
          entity.tags.some((tag) => tag.toLowerCase() === part)),
    );
}

function entityWithSignal(
  entities: CulturalEntity[],
  token: string,
): CulturalEntity | undefined {
  return entities.find((e) => entityHasSignal(e, token));
}

/** Product/brand + cross-domain hinge needs an explicit causal bridge phrase. */
function withCausalBridge(
  output: OutputCategory,
  hingeCategory: string,
  base: string,
  cue: string,
): string {
  const needs =
    (output === "product" || output === "brand") &&
    (hingeCategory === "music" ||
      hingeCategory === "film" ||
      hingeCategory === "places");
  if (!needs) return base;
  return `${base} Cross-domain causal bridge: observed “${cue}” on ${hingeCategory} becomes operating rules for the ${output} deliverable.`;
}

function composeProgramName(
  interest: string,
  program: OperatingProgramDraft,
  hinge: CulturalEntity,
  mechanismId: MechanismId,
): string {
  const interestLead = interest
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  const suffix: Record<string, string> = {
    acoustic_spatial: "Listen Circuit",
    craft_cocreate: "Co-Make",
    dual_mode_tension: "Fork",
    material_reconfig: "Layers",
    retail_checkpoint: "Checkpoints",
    signal_specialized: "Signal Run",
  };
  const candidate = `${interestLead} ${suffix[program.id] ?? "Program"}`;
  if (!hasRepeatedWords(candidate) && !isGenericSuffixChain(candidate)) {
    return candidate;
  }
  void hinge;
  void mechanismId;
  return `${interestLead || "Fusion"} Program`;
}

function signalIdsFor(
  signals: ResolvedOpportunitySignals,
  token: string,
): string[] {
  const t = token.toLowerCase();
  const hits = signals.signalIds.filter((id) => {
    const parsed = id.match(/^sig-(.+)-(tag|attr|norm|category)-(.+)$/);
    return parsed ? parsed[3]!.toLowerCase().includes(t) || t.includes(parsed[3]!.toLowerCase()) : id.includes(t);
  });
  return hits.length > 0 ? hits.slice(0, 4) : signals.signalIds.slice(0, 2);
}
