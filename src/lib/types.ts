/** Shared domain types for Cultural Fusion Lab */

export type EntityCategory =
  | "music"
  | "film"
  | "brands"
  | "places"
  | "fashion"
  | "food"
  | "other";

export type OutputCategory = "product" | "brand" | "experience";

export type EvidenceSource = "verified_api" | "agent_hypothesis" | "mock_demo";

export type LabMode = "demo" | "live";

export type LabStage =
  | "landing"
  | "explore"
  | "discovery"
  | "concepts"
  | "mutation";

export interface CulturalEntity {
  id: string;
  name: string;
  category: EntityCategory;
  description: string;
  affinity: number; // 0–1 conceptual affinity score (demo: fictional)
  /** Explicit Qloo affinity only; never inferred from popularity. */
  apiReportedAffinity?: number;
  tags: string[];
}

export interface EvidenceItem {
  id: string;
  source: EvidenceSource;
  label: string;
  detail: string;
  relatedEntityIds?: string[];
  /** Qloo Search seeds used to produce this Insights result set. */
  insightSeedEntityIds?: string[];
  createdAt: string;
}

export interface ExplorationRequest {
  creativeObjective: string;
  culturalInterest: string;
  location?: string;
  outputCategory: OutputCategory;
  mode: LabMode;
}

export interface CulturalCluster {
  category: EntityCategory;
  label: string;
  entities: CulturalEntity[];
}

export interface ConceptClaim {
  id: string;
  statement: string;
  evidenceIds: string[];
  kind: "cultural_reference" | "positioning_hypothesis" | "affinity_inference";
}

export interface ConceptEvaluation {
  relevance: number;
  originality: number;
  evidenceCoverage: number;
  overall: number;
  notes: string[];
}

/** Structured concept narrative — concrete proposal, not a template dump of the objective. */
export interface ConceptNarrative {
  whatItIs: string;
  whoItServes: string;
  howItWorks: string;
  distinctive: string;
  inspiredBy: string;
  /** Explicit boundary between evidence-backed anchors and creative hypothesis. */
  evidenceBoundary: string;
}

/** Role an influence plays inside a ConceptSpec. */
export type InfluenceRole =
  | "hinge"
  | "texture"
  | "tension"
  | "constraint"
  | "distribution";

export interface JourneyStep {
  id: string;
  actor: string;
  action: string;
  /** Entity IDs that causally justify this step. */
  influenceEntityIds: string[];
}

/**
 * Causal design rationale — creative interpretation must stay labeled.
 * Never invent Qloo relationships beyond collected attributes/signals.
 */
export interface DesignRationale {
  id: string;
  featureId: string;
  featureDescription: string;
  influenceEntityId: string;
  /** Tag or observable attribute taken from collected entity metadata. */
  attributeOrSignal: string;
  creativeInterpretation: string;
  whyItProducesMechanic: string;
}

export interface InfluenceMapEntry {
  entityId: string;
  entityName: string;
  category: EntityCategory;
  role: InfluenceRole;
  signalsUsed: string[];
}

/** Judge-facing opportunity → design trace (P1). */
export type OpportunityTraceStage =
  | "observed_signal"
  | "opportunity_hypothesis"
  | "design_decision"
  | "concept_mechanism"
  | "proposed_pilot";

export interface OpportunityTraceStep {
  stage: OpportunityTraceStage;
  label: string;
  detail: string;
  hypothesis: boolean;
  evidenceIds: string[];
}

export interface OpportunityTrace {
  opportunityId: string;
  opportunityKind: "convergence" | "contrast" | "complementarity" | "tension";
  steps: OpportunityTraceStep[];
}

/**
 * Typed causal binding from observed signals → operating rules → journey → pilot.
 * Presence of bindings (not keyword overlap) proves opportunity causality.
 */
export interface CausalBinding {
  id: string;
  observedSignalIds: string[];
  observedSignals: string[];
  opportunityId: string;
  designDecisionId: string;
  operatingRuleId: string;
  journeyStepIds: string[];
  pilotMetricId: string;
  evidenceIds: string[];
  /** Labeled creative interpretation — not verified cultural law. */
  creativeInterpretation: string;
}

export interface OperatingRule {
  id: string;
  rule: string;
  boundSignalIds: string[];
}

/**
 * Professional concept specification (Engine V2).
 * Prefer this over thin narrative templates for judge-facing rigor.
 */
export interface ConceptSpec {
  name: string;
  proposition: string;
  audience: string;
  context: string;
  journey: JourneyStep[];
  mechanics: string;
  influenceMap: InfluenceMapEntry[];
  differentiationHypothesis: string;
  feasibilityAssumptions: string[];
  risksAndUnknowns: string[];
  pilotExperiment: string;
  evidenceBoundary: string;
  rationales: DesignRationale[];
  /** Frozen user objective text. */
  frozenObjective: string;
  frozenOutputCategory: OutputCategory;
  /** Stable fingerprint of operating mechanics (for anti-duplication). */
  mechanicFingerprint: string;
  mechanismId: string;
  /** P1 opportunity that drove this concept (when present). */
  opportunityId?: string;
  opportunityKind?: OpportunityTrace["opportunityKind"];
  /** Observed signal → opportunity → design → mechanism → pilot. */
  opportunityTrace?: OpportunityTrace;
  /** P1.1 specialized operating program (opportunity-compiled). */
  operatingProgramId?: string;
  /** Fingerprint of the operating program — not merely mechanismId. */
  operatingProgramFingerprint?: string;
  culturalFingerprint?: string;
  structuralFingerprint?: string;
  operatingRules?: OperatingRule[];
  causalBindings?: CausalBinding[];
}

export interface QualityGateCheck {
  id: string;
  passed: boolean;
  detail: string;
}

export interface QualityGateReport {
  accepted: boolean;
  checks: QualityGateCheck[];
  failures: string[];
}

/** Structured before/after field produced by influence-sensitive mutation. */
export interface MutationFieldDiff {
  field: "mechanics" | "audience" | "inspiration" | "distinctive" | "format";
  before: string;
  after: string;
  changed: boolean;
  /** Why the incoming influence drives this change. */
  why: string;
  /** Creative interpretation vs entity metadata basis. */
  basis: "creative_interpretation" | "entity_metadata";
}

/** Cross-category link surfaced to the UI (never invent scores). */
export interface CulturalAffinityLink {
  id: string;
  leftEntityId: string;
  rightEntityId: string;
  leftCategory: EntityCategory;
  rightCategory: EntityCategory;
  basis: "shared_tag" | "co_collected" | "api_reported_score";
  sharedTags: string[];
  note: string;
  /** Only when an upstream verified API score was present — never invented. */
  apiReportedScore?: number;
}

export interface FusionConcept {
  id: string;
  title: string;
  positioning: string;
  outputCategory: OutputCategory;
  culturalInfluences: CulturalEntity[];
  evidenceIds: string[];
  summary: string;
  narrative?: ConceptNarrative;
  /** Engine V2 professional specification (preferred). */
  spec?: ConceptSpec;
  /** @deprecated Legacy direction axis — optional; V2 uses mechanismId on spec. */
  directionId?: "intimate" | "communal" | "systems";
  parentConceptId?: string;
  mutationNote?: string;
  /** Structured before/after diffs when this concept is a mutation variant. */
  mutationDiffs?: MutationFieldDiff[];
  /** Present when produced by the deterministic agent orchestrator. */
  claims?: ConceptClaim[];
  evaluation?: ConceptEvaluation;
  affinityIds?: string[];
  /** Quality-gate diagnostics when available. */
  qualityGate?: QualityGateReport;
}

export interface MutationRequest {
  conceptId: string;
  replaceEntityId: string;
  newEntityId: string;
  mode: LabMode;
  exploration: ExplorationRequest;
  concepts: FusionConcept[];
  entities: CulturalEntity[];
  evidence: EvidenceItem[];
}

export interface AgentStepTrace {
  id: string;
  title: string;
  status: "ok" | "empty" | "error";
  detail: string;
  at: string;
}

export interface AgentTraceSummary {
  engine: string;
  mode: LabMode;
  steps: AgentStepTrace[];
  affinityCount: number;
  warnings: string[];
  relevance?: {
    kept: number;
    rejected: number;
    intentTerms: string[];
  };
  quality?: {
    candidatesGenerated: number;
    candidatesAccepted: number;
    rejectedSummaries: string[];
  };
  opportunities?: {
    accepted: number;
    rejected: number;
    downgraded: number;
    summaries: string[];
  };
}

export interface ExplorationResult {
  mode: LabMode;
  request: ExplorationRequest;
  clusters: CulturalCluster[];
  entities: CulturalEntity[];
  concepts: FusionConcept[];
  /** Evidence-linked cross-category relationships (may be empty). */
  affinities?: CulturalAffinityLink[];
  evidence: EvidenceItem[];
  generatedAt: string;
  disclaimer: string;
  /** Deterministic agent workflow trace (when orchestrator ran). */
  agentTrace?: AgentTraceSummary;
}

export interface MutationResult {
  mode: LabMode;
  originalConcept: FusionConcept;
  mutatedConcept: FusionConcept;
  /** Structured field-level diffs (also mirrored on mutatedConcept.mutationDiffs). */
  mutationDiffs?: MutationFieldDiff[];
  evidence: EvidenceItem[];
  generatedAt: string;
  disclaimer: string;
  agentTrace?: AgentTraceSummary;
}

export interface ApiErrorBody {
  error: string;
  code?: string;
  details?: string;
}

export const ENTITY_CATEGORY_LABELS: Record<EntityCategory, string> = {
  music: "Music",
  film: "Film & TV",
  brands: "Brands",
  places: "Places",
  fashion: "Fashion",
  food: "Food & Drink",
  other: "Other",
};

export const OUTPUT_CATEGORY_LABELS: Record<OutputCategory, string> = {
  product: "Product",
  brand: "Brand",
  experience: "Experience",
};

export const EVIDENCE_SOURCE_LABELS: Record<EvidenceSource, string> = {
  verified_api: "Verified API data",
  agent_hypothesis: "Agent-generated hypothesis",
  mock_demo: "Mock demo data",
};

export const DEMO_DISCLAIMER =
  "DEMO MODE — All cultural entities, affinities, and concepts are fictional sample data for product demonstration. They are not Qloo Taste Graph insights and must not be treated as real cultural signals.";
