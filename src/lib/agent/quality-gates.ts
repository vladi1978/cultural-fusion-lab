/**
 * Professional quality gates for ConceptSpec acceptance.
 * Structural validity + commercial coherence checks.
 * Heuristic scores elsewhere are still not proof of real-world creativity or market viability.
 */

import type {
  ConceptSpec,
  OutputCategory,
  QualityGateCheck,
  QualityGateReport,
} from "../types";
import { hasRepeatedWords, isGenericSuffixChain } from "./naming";
import { assessBriefFidelity } from "./brief-fidelity";
import type { InterpretedObjective } from "./types";

const FLUFF =
  /\b(innovative|seamless|cutting[\s-]?edge|next[\s-]?level|elevate|unlock|synergy|holistic)\b/i;

const GENERIC_BANNED =
  /\b(tactile\s+\w+\s+ritual object that stages|portable\s+\w+\s+gathering kit that turns any table|modular\s+\w+\s+recombine system — interchangeable parts)\b/i;

const UNSUPPORTED_SIGNAL_JUMPS =
  /\barchive\b[^.]{0,40}\bdocumentary\b|\bdocumentary\b[^.]{0,40}\bas\s+fashion\b/i;

export function runQualityGates(options: {
  spec: ConceptSpec;
  interpreted: InterpretedObjective;
  acceptedFingerprints: string[];
  evidenceEntityIds: Set<string>;
  /** Optional: entity id → lowercase attribute tokens available for integrity checks. */
  entityAttributeIndex?: Map<string, Set<string>>;
}): QualityGateReport {
  const {
    spec,
    interpreted,
    acceptedFingerprints,
    evidenceEntityIds,
    entityAttributeIndex,
  } = options;
  const checks: QualityGateCheck[] = [];

  const push = (id: string, passed: boolean, detail: string) => {
    checks.push({ id, passed, detail });
  };

  // Objective alignment
  push(
    "objective_frozen",
    spec.frozenObjective === interpreted.rawObjective &&
      spec.frozenOutputCategory === interpreted.outputCategory,
    spec.frozenObjective === interpreted.rawObjective
      ? "Objective and output category frozen."
      : "Objective or output category drifted from user request.",
  );

  // P10.20: explicit brief requirements must appear in generated operations,
  // not merely in the frozen original request or cultural-interest label.
  const fidelity = assessBriefFidelity(interpreted.rawObjective, spec);
  push("brief_operational_fidelity", fidelity.ok, fidelity.detail);

  // Journey
  push(
    "journey_length",
    spec.journey.length >= 3,
    `Journey steps=${spec.journey.length} (need ≥3).`,
  );
  const journeyBound = spec.journey.every((s) => s.influenceEntityIds.length > 0);
  push(
    "journey_influence_binding",
    journeyBound,
    journeyBound
      ? "Every journey step cites at least one influence."
      : "One or more journey steps lack influence bindings.",
  );

  // Causal rationales
  const rationaleFeatures = new Set(spec.rationales.map((r) => r.featureId));
  const hasMechanicRationale = [...rationaleFeatures].some((f) =>
    /mechanic|operating/i.test(f),
  );
  const journeyRationales = spec.journey.filter((s) =>
    rationaleFeatures.has(s.id),
  ).length;
  push(
    "rationale_coverage",
    spec.rationales.length >= 3 &&
      hasMechanicRationale &&
      journeyRationales >= 2,
    `Rationales=${spec.rationales.length}, mechanic covered=${hasMechanicRationale}, journey steps covered=${journeyRationales}.`,
  );

  const rationalesComplete = spec.rationales.every(
    (r) =>
      r.influenceEntityId &&
      r.attributeOrSignal.trim().length > 0 &&
      r.creativeInterpretation.trim().length > 10 &&
      r.whyItProducesMechanic.trim().length > 10,
  );
  push(
    "rationale_fields",
    rationalesComplete,
    rationalesComplete
      ? "Each rationale names influence, attribute/signal, interpretation, and mechanic link."
      : "One or more rationales are incomplete.",
  );

  // Evidence integrity — influence map entities must be from collected set
  const mapIds = spec.influenceMap.map((m) => m.entityId);
  const allKnown = mapIds.every((id) => evidenceEntityIds.has(id));
  push(
    "evidence_entities",
    allKnown && mapIds.length >= 2,
    allKnown
      ? "Influence map entities are from the collected neighborhood."
      : "Influence map references unknown entities.",
  );

  // Unsupported attribute/signal rejection (when index provided)
  if (entityAttributeIndex && entityAttributeIndex.size > 0) {
    const signalsOk = spec.rationales.every((r) => {
      const attrs = entityAttributeIndex.get(r.influenceEntityId);
      if (!attrs) return false;
      const token = r.attributeOrSignal.toLowerCase().trim();
      if (!token) return false;
      if (attrs.has(token)) return true;
      return token.split(/[\s/_-]+/).some((t) => t.length > 2 && attrs.has(t));
    });
    push(
      "evidence_signals",
      signalsOk,
      signalsOk
        ? "Rationale attributes/signals resolve to collected entity metadata."
        : "One or more rationales cite attributes not present on the linked entity.",
    );
  }

  // Semantic signal discipline — reject known unsupported jumps in rationale text
  const rationaleBlob = spec.rationales
    .map(
      (r) =>
        `${r.attributeOrSignal} ${r.creativeInterpretation} ${r.whyItProducesMechanic}`,
    )
    .join(" ");
  const jump = UNSUPPORTED_SIGNAL_JUMPS.test(rationaleBlob);
  push(
    "signal_discipline",
    !jump &&
      spec.rationales.every((r) =>
        /observed|supported category|creative design hypothesis/i.test(
          r.creativeInterpretation + " " + r.whyItProducesMechanic,
        ),
      ),
    jump
      ? "Unsupported semantic jump detected (e.g. archive→documentary)."
      : "Rationales separate observed attributes, category reading, and creative hypothesis.",
  );

  // Specificity
  const concrete =
    spec.mechanics.length >= 60 &&
    spec.proposition.length >= 24 &&
    spec.proposition.length <= 280 &&
    !FLUFF.test(spec.proposition) &&
    !FLUFF.test(spec.mechanics) &&
    !GENERIC_BANNED.test(spec.proposition + " " + spec.mechanics);
  push(
    "specificity",
    concrete,
    concrete
      ? "Proposition/mechanics pass length and anti-fluff / anti-generic checks."
      : "Proposition/mechanics too vague, fluffy, or match banned generic templates.",
  );

  // Professional naming
  const nameOk =
    spec.name.trim().split(/\s+/).length >= 2 &&
    spec.name.trim().split(/\s+/).length <= 5 &&
    !hasRepeatedWords(spec.name) &&
    !isGenericSuffixChain(spec.name) &&
    !/^(session|system|ritual|circuit|commons)$/i.test(spec.name.trim());
  push(
    "professional_naming",
    nameOk,
    nameOk
      ? "Name is pronounceable and free of repeated-word / generic-suffix chains."
      : "Name has repeated words, generic suffix chains, or weak structure.",
  );

  // Output-category coherence (commercial completeness of the requested deliverable)
  const coherence = checkOutputCategoryCoherence(spec, interpreted.outputCategory);
  push("output_category_coherence", coherence.ok, coherence.detail);

  // Causal bridge when cross-domain (music/place/film hinge for product/brand fashion, etc.)
  const hingeCats = new Set(spec.influenceMap.filter((m) => m.role === "hinge").map((m) => m.category));
  const needsBridge =
    (interpreted.outputCategory === "product" ||
      interpreted.outputCategory === "brand") &&
    [...hingeCats].some((c) => c === "music" || c === "film" || c === "places");
  const bridgeOk =
    !needsBridge ||
    /cross-domain bridge|causal bridge|causal link/i.test(
      spec.differentiationHypothesis,
    );
  push(
    "causal_bridge",
    bridgeOk,
    bridgeOk
      ? needsBridge
        ? "Cross-domain hinge includes a documented causal bridge to the deliverable."
        : "No cross-domain bridge required for this hinge/output pair."
      : "Cross-domain hinge lacks a documented causal bridge to the requested deliverable.",
  );

  // P1.1 causal opportunity compilation — reject superficial framing
  if (spec.opportunityId) {
    const trace = spec.opportunityTrace;
    const stages = new Set(trace?.steps.map((s) => s.stage) ?? []);
    const traceOk =
      Boolean(trace) &&
      stages.has("observed_signal") &&
      stages.has("opportunity_hypothesis") &&
      stages.has("design_decision") &&
      stages.has("concept_mechanism") &&
      stages.has("proposed_pilot");
    push(
      "opportunity_trace",
      traceOk,
      traceOk
        ? "Opportunity trace links observed signals → hypothesis → design → mechanism → pilot."
        : "Opportunity-linked concept missing complete judge-facing hypothesis trace.",
    );

    const bindings = spec.causalBindings ?? [];
    const hasProgram =
      Boolean(spec.operatingProgramId) &&
      Boolean(spec.operatingProgramFingerprint) &&
      !(spec.operatingProgramId ?? "").startsWith("catalog_");
    push(
      "operating_program",
      hasProgram,
      hasProgram
        ? `Specialized operating program=${spec.operatingProgramId}.`
        : "Opportunity-linked concept lacks a specialized operating program (catalog/framing only).",
    );

    // P1.1: validate every causal reference, not only aggregate counts.
    const validRuleIds = new Set(
      (spec.operatingRules ?? []).map((rule) => rule.id),
    );
    const validJourneyIds = new Set(spec.journey.map((step) => step.id));

    const causalReferencesOk =
      bindings.length >= 2 &&
      bindings.every(
        (binding) =>
          binding.opportunityId === spec.opportunityId &&
          validRuleIds.has(binding.operatingRuleId) &&
          binding.journeyStepIds.length > 0 &&
          binding.journeyStepIds.every((id) => validJourneyIds.has(id)) &&
          binding.pilotMetricId.trim().length > 0 &&
          spec.pilotExperiment.includes(binding.pilotMetricId) &&
          binding.evidenceIds.length > 0 &&
          binding.evidenceIds.every((id) => id.trim().length > 0),
      );

    push(
      "causal_reference_integrity",
      causalReferencesOk,
      causalReferencesOk
        ? "All causal bindings resolve to operating rules, journey steps, pilot metrics and nonempty evidence references."
        : "One or more causal bindings contain invalid rules, journey steps, pilot metrics or evidence references.",
    );

    const boundSteps = new Set(bindings.flatMap((b) => b.journeyStepIds));
    const journeyBoundCount = spec.journey.filter((j) => boundSteps.has(j.id)).length;
    push(
      "causal_journey_bindings",
      bindings.length >= 2 && journeyBoundCount >= 2,
      `Causal bindings=${bindings.length}, journey steps bound=${journeyBoundCount} (need ≥2 each).`,
    );

    const pilotBound =
      Boolean(spec.pilotExperiment) &&
      bindings.some((b) =>
        spec.pilotExperiment.includes(b.pilotMetricId),
      ) &&
      /opportunity|hypothesis|program|gate|checkpoint|fork|reconfig|cue|rule/i.test(
        spec.pilotExperiment,
      );
    push(
      "causal_pilot",
      pilotBound,
      pilotBound
        ? "Pilot tests an opportunity-derived metric/hypothesis."
        : "Pilot does not test the opportunity-derived design hypothesis.",
    );

    const rulesOk = (spec.operatingRules?.length ?? 0) >= 2;
    push(
      "operating_rules",
      rulesOk,
      rulesOk
        ? `Operating rules=${spec.operatingRules!.length}.`
        : "Missing structured operating rules for opportunity program.",
    );

    // Reject legacy append-only framing markers without program specialization
    const superficial =
      /Opportunity lens \(|Mid beat applies the opportunity design implication/i.test(
        `${spec.audience} ${spec.journey.map((j) => j.action).join(" ")}`,
      ) && !hasProgram;
    push(
      "no_superficial_framing",
      !superficial,
      superficial
        ? "Superficial opportunity framing detected without compiled operating program."
        : "No superficial append-only opportunity framing.",
    );

    // Fingerprint must not be a bare mechanism clone marker
    const fpOk = !/^[^|]+\|[^|]+\|[^|]+\|[^|]+\|[^|]+\|opp:/i.test(
      spec.mechanicFingerprint,
    ) || Boolean(spec.operatingProgramFingerprint);
    push(
      "program_fingerprint",
      Boolean(spec.operatingProgramFingerprint) && fpOk,
      spec.operatingProgramFingerprint
        ? "Operating-program fingerprint present for deduplication."
        : "Missing operating-program fingerprint.",
    );
  }

  // Dedup by operating program fingerprint when available
  if (spec.operatingProgramFingerprint) {
    const progDup = acceptedFingerprints.includes(
      `prog:${spec.operatingProgramFingerprint}`,
    );
    push(
      "program_differentiation",
      !progDup,
      progDup
        ? "Operating-program fingerprint duplicates an already-accepted concept."
        : "Operating-program fingerprint is unique among accepted concepts.",
    );
  }

  // Feasibility + risks + pilot
  push(
    "feasibility",
    spec.feasibilityAssumptions.length >= 1,
    `Feasibility assumptions=${spec.feasibilityAssumptions.length}.`,
  );
  push(
    "risks",
    spec.risksAndUnknowns.length >= 2,
    `Risks/unknowns=${spec.risksAndUnknowns.length} (need ≥2).`,
  );
  const pilotOk =
    spec.pilotExperiment.length >= 40 &&
    /\b(measure|count|observe|survey|session|pilot|week|guest|host|user|customer)\b/i.test(
      spec.pilotExperiment,
    );
  push(
    "pilot_testability",
    pilotOk,
    pilotOk
      ? "Pilot experiment is concrete and measurable."
      : "Pilot experiment missing operational measurement language (needs at least 40 characters and a plain measurement term such as measure, count, observe, survey, session, week, guest, host, user or customer).",
  );

  // Mechanical differentiation vs already accepted
  const dup = acceptedFingerprints.includes(spec.mechanicFingerprint);
  push(
    "mechanic_differentiation",
    !dup && spec.mechanicFingerprint.length > 0,
    dup
      ? "Mechanic fingerprint duplicates an already-accepted concept."
      : "Mechanic fingerprint is unique among accepted concepts.",
  );

  // Evidence boundary honesty
  push(
    "evidence_boundary",
    /hypothesis|mock|not\s+qloo|creative|observed attributes/i.test(
      spec.evidenceBoundary,
    ),
    "Evidence boundary labels hypothesis vs collected facts.",
  );

  // No demand language
  const demand =
    /\b(market demand|guaranteed|will go viral|proven roi|consumers will buy)\b/i.test(
      `${spec.proposition} ${spec.differentiationHypothesis} ${spec.pilotExperiment}`,
    );
  push(
    "no_demand_claims",
    !demand,
    demand
      ? "Contains unsupported demand/virality claims."
      : "No unsupported demand/virality claims detected.",
  );

  const failures = checks.filter((c) => !c.passed).map((c) => `${c.id}: ${c.detail}`);
  return {
    accepted: failures.length === 0,
    checks,
    failures,
  };
}

export function checkOutputCategoryCoherence(
  spec: ConceptSpec,
  output: OutputCategory,
): { ok: boolean; detail: string } {
  const blob = [
    spec.name,
    spec.proposition,
    spec.mechanics,
    spec.audience,
    spec.context,
    ...spec.journey.map((j) => j.action),
  ].join(" ");

  if (output === "product") {
    // P9.99: A commercial redemption flow is not a functional home product.
    const homeIntent =
      /\b(home|household|furniture|interior|homeware)\b/i.test(
        spec.frozenObjective,
      );

    if (homeIntent) {
      const hasHomeObject =
        /\b(lamp|lighting fixture|shelf|shelving|table|chair|stool|cabinet|storage unit|vase|planter|tray|room divider|wall panel|rug|cushion|ceramic vessel|coffee brewing kit)\b/i.test(
          spec.proposition,
        );

      const hasPhysicalFunction =
        /\b(illuminate|light|hold|store|organize|support|seat|display|divide|shade|contain|protect|absorb|cover|filter|hang|mount|adjust)\b/i.test(
          `${spec.proposition} ${spec.mechanics}`,
        );

      if (!hasHomeObject || !hasPhysicalFunction) {
        return {
          ok: false,
          detail:
            "Home-product intent requires an identifiable physical home object and a physical use function; SKU redemption or distribution alone is insufficient.",
        };
      }
    }

    const hasForm =
      /\b(product|kit|object|device|apparel|garment|tool|pack|edition|module|wearable|hardware|sku|goods|item|deck|card)\b/i.test(
        blob,
      );
    const hasFunction =
      /\b(use|wear|carry|configure|assemble|own|open|pack|redeem|timer|function)\b/i.test(
        blob,
      );
    const influenceNotDeliverable =
      !/^\s*an?\s+(experience|session|concert|screening)\b/i.test(spec.proposition);
    const ok = hasForm && hasFunction && influenceNotDeliverable;
    return {
      ok,
      detail: ok
        ? "Product specifies form, user function, and is not merely an activity description."
        : "Product concept missing concrete form/function, or reads as an activity/experience only.",
    };
  }

  if (output === "brand") {
    const hasBrand =
      /\b(brand|positioning|identity|touchpoint|membership|collection|line|platform|customers?|members?|offering)\b/i.test(
        blob,
      );
    const hasTouch =
      /\b(touchpoint|drop|invite|membership|channel|identity|positioning)\b/i.test(
        blob,
      );
    const ok = hasBrand && hasTouch;
    return {
      ok,
      detail: ok
        ? "Brand specifies offering/positioning and customer touchpoints."
        : "Brand concept missing offering, positioning, identity, or touchpoints.",
    };
  }

  // experience
  const hasParticipation =
    /\b(guest|participant|host|facilitator|session|experience|attend|listener)\b/i.test(
      blob,
    );
  const hasSequence = spec.journey.length >= 3;
  const ok = hasParticipation && hasSequence;
  return {
    ok,
    detail: ok
      ? "Experience specifies participation and a sequenced journey."
      : "Experience concept missing participation language or sequence.",
  };
}

/** Transparent structural heuristics — not creativity or market proof. */
export function structuralHeuristics(spec: ConceptSpec): {
  relevance: number;
  originality: number;
  evidenceCoverage: number;
  overall: number;
  notes: string[];
} {
  const notes = [
    "Structural heuristics only — not proof of real-world originality or commercial viability.",
    "Not Qloo Taste Graph scores or consumer predictions.",
  ];
  const journeyScore = Math.min(1, spec.journey.length / 4);
  const rationaleScore = Math.min(1, spec.rationales.length / 4);
  const relevance = clamp(
    0.5 * journeyScore + 0.5 * (spec.influenceMap.length >= 2 ? 1 : 0.4),
  );
  const originality = clamp(
    0.4 * (spec.mechanicFingerprint ? 0.85 : 0.2) +
      0.3 * rationaleScore +
      0.3 * (spec.differentiationHypothesis.length > 40 ? 1 : 0.4),
  );
  const evidenceCoverage = clamp(
    0.5 * (spec.rationales.length > 0 ? 1 : 0) +
      0.3 * (/hypothesis|observed/i.test(spec.evidenceBoundary) ? 1 : 0.5) +
      0.2 * (spec.influenceMap.length / 3),
  );
  const overall = clamp(
    0.4 * relevance + 0.25 * originality + 0.35 * evidenceCoverage,
  );
  return {
    relevance: round3(relevance),
    originality: round3(originality),
    evidenceCoverage: round3(evidenceCoverage),
    overall: round3(overall),
    notes,
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
