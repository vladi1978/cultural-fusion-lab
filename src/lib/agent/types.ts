import type { OpportunityHypothesis } from "./opportunity-types";
/**
 * Typed contracts for the deterministic Cultural Fusion Lab agent.
 * No paid LLM is used — planning, synthesis, and evaluation are rule-based.
 */

import type {
  CulturalEntity,
  EntityCategory,
  EvidenceItem,
  ExplorationRequest,
  ExplorationResult,
  FusionConcept,
  MutationRequest,
  MutationResult,
  OutputCategory,
} from "../types";
import type { QlooEntityType } from "../qloo/schemas";

export type AgentStepId =
  | "interpret"
  | "plan"
  | "collect"
  | "relevance"
  | "eligibility"
  | "conflicts"
  | "affinities"
  | "opportunities"
  | "concepts"
  | "evaluate"
  | "mutate";

/** @deprecated Prefer ConceptSpec.mechanismId — kept for mutation lens fallback. */
export type CreativeDirectionId = "intimate" | "communal" | "systems";

export type MechanismId =
  | "spatial_circuit"
  | "narrative_chapters"
  | "sonic_set"
  | "brand_drop"
  | "material_layer"
  | "hospitality_course"
  | "tension_dual";

export interface EntityRelevanceScore {
  entityId: string;
  score: number;
  matchedTerms: string[];
  relevant: boolean;
}

export interface RelevanceGateResult {
  intentTerms: string[];
  primaryInterestTerms: string[];
  kept: CulturalEntity[];
  rejected: CulturalEntity[];
  scores: EntityRelevanceScore[];
  notes: string[];
}

export interface EvidenceConflict {
  id: string;
  leftEntityId: string;
  rightEntityId: string;
  leftTags: string[];
  rightTags: string[];
  opposition: [string, string];
  status: "unresolved";
  note: string;
}

export type AffinityBasis =
  | "shared_tag"
  | "co_collected"
  | "api_reported_score";

export type ClaimKind =
  | "cultural_reference"
  | "positioning_hypothesis"
  | "affinity_inference";

export interface InterpretedObjective {
  rawObjective: string;
  culturalInterest: string;
  location?: string;
  outputCategory: OutputCategory;
  /** Deterministic keyword tokens extracted from the objective (not LLM). */
  intentTokens: string[];
  themes: string[];
  summary: string;
}

export interface PlannedSearch {
  id: string;
  query: string;
  entityType: QlooEntityType;
  category: EntityCategory;
  rationale: string;
}

export interface SearchPlan {
  searches: PlannedSearch[];
  tagQuery?: string;
  notes: string[];
}

export interface CollectedBundle {
  entities: CulturalEntity[];
  evidence: EvidenceItem[];
  /** Entity IDs that came from verified API (live) or mock_demo (demo). */
  provenanceByEntityId: Record<string, EvidenceItem["source"]>;
  collectionNotes: string[];
}

export interface CrossCategoryAffinity {
  id: string;
  leftEntityId: string;
  rightEntityId: string;
  leftCategory: EntityCategory;
  rightCategory: EntityCategory;
  basis: AffinityBasis;
  sharedTags: string[];
  /**
   * Only populated when a score was present on an upstream API entity payload.
   * Never invented by the agent.
   */
  apiReportedScore?: number;
  evidenceIds: string[];
  note: string;
}

export interface ConceptClaim {
  id: string;
  statement: string;
  evidenceIds: string[];
  kind: ClaimKind;
}

export interface ConceptEvaluation {
  relevance: number;
  originality: number;
  evidenceCoverage: number;
  overall: number;
  notes: string[];
}

export interface EvaluatedConcept extends FusionConcept {
  claims: ConceptClaim[];
  evaluation: ConceptEvaluation;
  affinityIds: string[];
  directionId?: CreativeDirectionId;
  conflictIds?: string[];
}

export interface AgentStepTrace {
  id: AgentStepId;
  title: string;
  status: "ok" | "empty" | "error";
  detail: string;
  at: string;
}

export interface AgentTrace {
  engine: "deterministic-v1" | "deterministic-v2" | "deterministic-v2.1" | "creative-llm-v1";
  mode: ExplorationRequest["mode"];
  steps: AgentStepTrace[];
  interpreted?: InterpretedObjective;
  plan?: SearchPlan;
  affinityCount: number;
  warnings: string[];
  relevance?: {
    kept: number;
    rejected: number;
    intentTerms: string[];
  };
  conflicts?: EvidenceConflict[];
  /** V2 quality diagnostics when concepts were filtered. */
  quality?: {
    candidatesGenerated: number;
    candidatesAccepted: number;
    rejectedSummaries: string[];
  };
  /** P1 opportunity intelligence diagnostics. */
  opportunities?: {
    accepted: number;
    rejected: number;
    downgraded: number;
    summaries: string[];
  };
}

export interface AgentExplorationResult extends ExplorationResult {
  opportunities?: OpportunityHypothesis[];
  concepts: EvaluatedConcept[];
  affinities: CrossCategoryAffinity[];
  conflicts?: EvidenceConflict[];
  agentTrace: AgentTrace;
}

export interface AgentMutationResult extends MutationResult {
  mutatedConcept: EvaluatedConcept;
  affinities: CrossCategoryAffinity[];
  agentTrace: AgentTrace;
}

export interface CulturalSourceContext {
  request: ExplorationRequest;
  plan: SearchPlan;
}

export interface CulturalEvidenceSource {
  readonly id: "demo" | "qloo";
  collect(context: CulturalSourceContext): Promise<CollectedBundle>;
  /**
   * Optional mutation candidate lookup. Demo uses local pool;
   * live may query insights. Must not invent affinity scores.
   */
  suggestReplacements?(options: {
    request: MutationRequest;
    outgoing: CulturalEntity;
    seeds: CulturalEntity[];
  }): Promise<{
    candidates: CulturalEntity[];
    evidence: EvidenceItem[];
  }>;
}

export class AgentError extends Error {
  readonly code:
    | "VALIDATION"
    | "EMPTY_EVIDENCE"
    | "IRRELEVANT_EVIDENCE"
    | "MISSING_CONCEPT"
    | "MUTATION_INVALID"
    | "INSUFFICIENT_DIFFERENTIATION"
    | "INSUFFICIENT_QUALITY"
    | "CLAIM_UNGROUNDED"
    | "LIVE_DISABLED"
    | "SOURCE_FAILURE";

  constructor(
    code: AgentError["code"],
    message: string,
    readonly details?: string,
  ) {
    super(message);
    this.name = "AgentError";
    this.code = code;
  }
}
