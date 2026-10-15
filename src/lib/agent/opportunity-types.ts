/**
 * P1 Cultural Opportunity Intelligence contracts.
 * Hypotheses only — never invent Qloo edges, demand, or behavioral patterns.
 */

import type {
  CulturalEntity,
  EvidenceItem,
  EvidenceSource,
} from "../types";
import type { CrossCategoryAffinity, EvidenceConflict, MechanismId } from "./types";

export type OpportunityKind =
  | "convergence"
  | "contrast"
  | "complementarity"
  | "tension";

export type OpportunityStatus = "accepted" | "rejected" | "downgraded";

export interface ObservedSignalNode {
  id: string;
  entityId: string;
  signal: string;
  kind: "tag" | "category" | "normalized_attribute";
  provenance: EvidenceSource;
  evidenceIds: string[];
}

export interface SignalRelationship {
  id: string;
  leftEntityId: string;
  rightEntityId: string;
  basis:
    | "shared_tag"
    | "co_collected"
    | "api_reported_score"
    | "explicit_conflict";
  sharedSignals: string[];
  evidenceIds: string[];
  /** Honest note — not a confidence score pretending to be Qloo. */
  confidenceNote: string;
  provenanceMix: EvidenceSource[];
}

export interface CulturalSignalGraph {
  entities: CulturalEntity[];
  signals: ObservedSignalNode[];
  relationships: SignalRelationship[];
  conflicts: EvidenceConflict[];
  uncertainties: string[];
  mode: "demo" | "live";
  provenanceByEntityId: Record<string, EvidenceSource>;
}

export interface OpportunityHypothesis {
  id: string;
  kind: OpportunityKind;
  title: string;
  supportingEntityIds: string[];
  supportingSignalIds: string[];
  /** Labeled creative hypothesis — not market demand. */
  whyCreativelyUseful: string;
  /** Concrete implication for the requested deliverable. */
  designImplication: string;
  uncertainty: string;
  unsupportedAssumptions: string[];
  evidenceIds: string[];
  suggestedMechanismId?: MechanismId;
  status: OpportunityStatus;
  rejectionReason?: string;
  /** Relationship ids from the signal graph that support this hypothesis. */
  relationshipIds: string[];
}

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
  /** True when the step is interpretive rather than observed fact. */
  hypothesis: boolean;
  evidenceIds: string[];
}

export interface OpportunityTrace {
  opportunityId: string;
  opportunityKind: OpportunityKind;
  steps: OpportunityTraceStep[];
}

export interface ReasoningContext {
  entities: CulturalEntity[];
  evidence: EvidenceItem[];
  affinities: CrossCategoryAffinity[];
  conflicts: EvidenceConflict[];
  provenanceByEntityId: Record<string, EvidenceSource>;
  mode: "demo" | "live";
  culturalInterest: string;
}
