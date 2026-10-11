/**
 * Offline evaluation harness types.
 * All scenarios use synthetic fixtures — never claim live Qloo success.
 */

import type { ExplorationRequest } from "../types";
import type {
  AgentError,
  AgentExplorationResult,
  AgentMutationResult,
  CulturalEvidenceSource,
} from "../agent/types";

export type ScenarioKind = "happy" | "adversarial";

export type ExpectedOutcome = "success" | "agent_error";

/** Objective checks are binary pass/fail — not heuristic quality scores. */
export type ObjectiveCheckId =
  | "expected_outcome"
  | "claim_traceability"
  | "unsupported_cultural_claims"
  | "demo_not_verified_qloo_affinity"
  | "concept_count"
  | "duplicate_concepts"
  | "evidence_provenance_labels"
  | "mutation_consistency";

export interface ObjectiveCheckResult {
  id: ObjectiveCheckId;
  passed: boolean;
  detail: string;
}

/** Subjective lab heuristics — NOT scientifically validated consumer predictions. */
export interface SubjectiveMetrics {
  avgRelevance: number;
  avgOriginality: number;
  avgEvidenceCoverageHeuristic: number;
  conceptDiversity: number;
  mutationConsistency?: number;
  notes: string[];
}

export interface EvalScenario {
  id: string;
  name: string;
  kind: ScenarioKind;
  description: string;
  request: ExplorationRequest;
  expectedOutcome: ExpectedOutcome;
  expectedErrorCode?: AgentError["code"];
  /** Build an injected cultural source (fixtures only). */
  createSource: () => CulturalEvidenceSource;
  runMutation?: boolean;
  /**
   * When set, skip orchestration and validate this crafted result instead.
   * Used for adversarial claim/affinity regressions.
   */
  syntheticResult?: AgentExplorationResult;
  /**
   * If set, the scenario PASSES only when these objective checks fail.
   * Used to verify the harness rejects unsupported claims / fake affinities.
   */
  expectObjectiveFailures?: ObjectiveCheckId[];
}

export interface ScenarioEvalResult {
  scenarioId: string;
  name: string;
  kind: ScenarioKind;
  passed: boolean;
  expectedOutcome: ExpectedOutcome;
  actualOutcome: ExpectedOutcome | "unexpected_error";
  errorCode?: string;
  errorMessage?: string;
  objectiveChecks: ObjectiveCheckResult[];
  subjective?: SubjectiveMetrics;
  unsupportedClaims: string[];
  warnings: string[];
}

export interface AggregateEvalMetrics {
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  happyPassed: number;
  happyTotal: number;
  adversarialPassed: number;
  adversarialTotal: number;
  objectiveCheckPassRate: number;
  unsupportedClaimsDetected: number;
  avgConceptDiversity: number;
  avgHeuristicRelevance: number;
  avgHeuristicOriginality: number;
  avgHeuristicEvidenceCoverage: number;
  avgMutationConsistency: number | null;
  disclaimer: string;
}

export interface EvalReport {
  title: string;
  generatedAt: string;
  disclaimer: string;
  scenarios: ScenarioEvalResult[];
  aggregate: AggregateEvalMetrics;
  weaknesses: string[];
  nextPriority: string;
}

export type { AgentExplorationResult, AgentMutationResult };
