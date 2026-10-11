/**
 * Offline evaluation harness runner.
 * Uses synthetic fixtures only — does not call live Qloo or paid LLMs.
 */

import { runExplorationAgent, runMutationAgent } from "../agent/orchestrator";
import { AgentError } from "../agent/types";
import { computeSubjectiveMetrics } from "./metrics";
import { EVAL_SCENARIOS } from "./scenarios";
import type {
  AggregateEvalMetrics,
  EvalReport,
  EvalScenario,
  ObjectiveCheckResult,
  ScenarioEvalResult,
} from "./types";
import {
  listUnsupportedClaimMessages,
  runObjectiveChecks,
} from "./validators";

export const EVAL_DISCLAIMER =
  "OFFLINE EVALUATION — All scenarios use synthetic fixtures. Results are not Qloo-powered success metrics, not scientifically validated consumer predictions, and not live Taste Graph measurements.";

export async function runScenario(
  scenario: EvalScenario,
): Promise<ScenarioEvalResult> {
  const warnings = [EVAL_DISCLAIMER];
  const unsupportedClaims: string[] = [];

  // Synthetic adversarial payloads — validate without orchestrating.
  if (scenario.syntheticResult) {
    const checks = runObjectiveChecks({
      result: scenario.syntheticResult,
      expectMutation: false,
    });
    unsupportedClaims.push(
      ...listUnsupportedClaimMessages(scenario.syntheticResult),
    );

    const expectedOutcomeCheck: ObjectiveCheckResult = {
      id: "expected_outcome",
      passed: true,
      detail: "Synthetic fixture validated without agent execution.",
    };
    const allChecks = [expectedOutcomeCheck, ...checks];
    const passed = evaluateScenarioPass(scenario, allChecks, "success");

    return {
      scenarioId: scenario.id,
      name: scenario.name,
      kind: scenario.kind,
      passed,
      expectedOutcome: scenario.expectedOutcome,
      actualOutcome: "success",
      objectiveChecks: allChecks,
      subjective: computeSubjectiveMetrics(scenario.syntheticResult),
      unsupportedClaims,
      warnings: [
        ...warnings,
        "Synthetic adversarial fixture — orchestration skipped.",
      ],
    };
  }

  try {
    const result = await runExplorationAgent(scenario.request, {
      source: scenario.createSource(),
      now: () => "2026-10-11T15:00:00.000Z",
    });

    let mutation = undefined;
    if (scenario.runMutation && result.concepts[0]) {
      const concept = result.concepts[0];
      const outgoing = concept.culturalInfluences[0]!;
      const incoming =
        result.entities.find(
          (e) =>
            e.id !== outgoing.id &&
            !concept.culturalInfluences.some((inf) => inf.id === e.id),
        ) ?? result.entities.find((e) => e.id !== outgoing.id);

      if (incoming) {
        mutation = await runMutationAgent(
          {
            mode: "demo",
            conceptId: concept.id,
            replaceEntityId: outgoing.id,
            newEntityId: incoming.id,
            exploration: scenario.request,
            concepts: result.concepts,
            entities: result.entities,
            evidence: result.evidence,
          },
          { source: scenario.createSource() },
        );
      } else {
        warnings.push("Mutation skipped — no alternate entity available.");
      }
    }

    const checks = runObjectiveChecks({
      result,
      mutation,
      expectMutation: Boolean(scenario.runMutation),
    });

    const expectedOutcomeCheck: ObjectiveCheckResult = {
      id: "expected_outcome",
      passed: scenario.expectedOutcome === "success",
      detail:
        scenario.expectedOutcome === "success"
          ? "Agent completed successfully as expected."
          : `Expected agent_error (${scenario.expectedErrorCode ?? "any"}) but orchestration succeeded.`,
    };

    unsupportedClaims.push(...listUnsupportedClaimMessages(result));
    const allChecks = [expectedOutcomeCheck, ...checks];
    const passed = evaluateScenarioPass(scenario, allChecks, "success");

    return {
      scenarioId: scenario.id,
      name: scenario.name,
      kind: scenario.kind,
      passed,
      expectedOutcome: scenario.expectedOutcome,
      actualOutcome: "success",
      objectiveChecks: allChecks,
      subjective: computeSubjectiveMetrics(result, mutation),
      unsupportedClaims,
      warnings: [
        ...warnings,
        ...result.agentTrace.warnings.slice(0, 3),
      ],
    };
  } catch (err) {
    const isAgent = err instanceof AgentError;
    const code = isAgent ? err.code : "UNEXPECTED";
    const actualOutcome = isAgent ? "agent_error" : "unexpected_error";

    const outcomeOk =
      scenario.expectedOutcome === "agent_error" &&
      isAgent &&
      (!scenario.expectedErrorCode ||
        scenario.expectedErrorCode === err.code);

    const expectedOutcomeCheck: ObjectiveCheckResult = {
      id: "expected_outcome",
      passed: outcomeOk,
      detail: outcomeOk
        ? `Agent failed closed as expected (${code}).`
        : `Unexpected outcome: ${actualOutcome}${isAgent ? `/${code}` : ""} — ${
            err instanceof Error ? err.message : "unknown error"
          }`,
    };

    return {
      scenarioId: scenario.id,
      name: scenario.name,
      kind: scenario.kind,
      passed: outcomeOk && !scenario.expectObjectiveFailures,
      expectedOutcome: scenario.expectedOutcome,
      actualOutcome,
      errorCode: String(code),
      errorMessage: err instanceof Error ? err.message : String(err),
      objectiveChecks: [expectedOutcomeCheck],
      unsupportedClaims: [],
      warnings,
    };
  }
}

function evaluateScenarioPass(
  scenario: EvalScenario,
  checks: ObjectiveCheckResult[],
  actualOutcome: "success",
): boolean {
  if (scenario.expectObjectiveFailures?.length) {
    const byId = new Map(checks.map((c) => [c.id, c]));
    return scenario.expectObjectiveFailures.every((id) => {
      const check = byId.get(id);
      return check && check.passed === false;
    });
  }

  if (scenario.expectedOutcome !== actualOutcome) return false;
  return checks.every((c) => c.passed);
}

export async function runEvaluationHarness(
  scenarios: EvalScenario[] = EVAL_SCENARIOS,
): Promise<EvalReport> {
  const results: ScenarioEvalResult[] = [];
  for (const scenario of scenarios) {
    results.push(await runScenario(scenario));
  }

  const aggregate = aggregateMetrics(results);
  const weaknesses = detectWeaknesses(results);
  const nextPriority = recommendNextPriority(results, weaknesses);

  return {
    title: "Cultural Fusion Lab — Offline Evaluation Report",
    generatedAt: new Date().toISOString(),
    disclaimer: EVAL_DISCLAIMER,
    scenarios: results,
    aggregate,
    weaknesses,
    nextPriority,
  };
}

export function aggregateMetrics(
  results: ScenarioEvalResult[],
): AggregateEvalMetrics {
  const happy = results.filter((r) => r.kind === "happy");
  const adversarial = results.filter((r) => r.kind === "adversarial");
  const allChecks = results.flatMap((r) => r.objectiveChecks);
  const withSubjective = results.filter((r) => r.subjective);

  const mutationScores = withSubjective
    .map((r) => r.subjective?.mutationConsistency)
    .filter((n): n is number => typeof n === "number");

  return {
    totalScenarios: results.length,
    passedScenarios: results.filter((r) => r.passed).length,
    failedScenarios: results.filter((r) => !r.passed).length,
    happyPassed: happy.filter((r) => r.passed).length,
    happyTotal: happy.length,
    adversarialPassed: adversarial.filter((r) => r.passed).length,
    adversarialTotal: adversarial.length,
    objectiveCheckPassRate:
      allChecks.length === 0
        ? 0
        : round3(allChecks.filter((c) => c.passed).length / allChecks.length),
    unsupportedClaimsDetected: results.reduce(
      (sum, r) => sum + r.unsupportedClaims.length,
      0,
    ),
    avgConceptDiversity: round3(
      avg(withSubjective.map((r) => r.subjective!.conceptDiversity)),
    ),
    avgHeuristicRelevance: round3(
      avg(withSubjective.map((r) => r.subjective!.avgRelevance)),
    ),
    avgHeuristicOriginality: round3(
      avg(withSubjective.map((r) => r.subjective!.avgOriginality)),
    ),
    avgHeuristicEvidenceCoverage: round3(
      avg(
        withSubjective.map((r) => r.subjective!.avgEvidenceCoverageHeuristic),
      ),
    ),
    avgMutationConsistency:
      mutationScores.length === 0 ? null : round3(avg(mutationScores)),
    disclaimer: EVAL_DISCLAIMER,
  };
}

function detectWeaknesses(results: ScenarioEvalResult[]): string[] {
  const weaknesses: string[] = [];
  const happy = results.filter((r) => r.kind === "happy" && r.subjective);

  const diversities = happy.map((r) => r.subjective!.conceptDiversity);
  if (diversities.length && avg(diversities) < 0.35) {
    weaknesses.push(
      `Low concept diversity on happy paths (avg=${avg(diversities).toFixed(3)}). Influence-set overlap is high across the three candidates.`,
    );
  }

  const irrelevant = results.find((r) => r.scenarioId === "A04-irrelevant-entities");
  if (
    irrelevant &&
    !(
      irrelevant.passed &&
      irrelevant.actualOutcome === "agent_error" &&
      irrelevant.errorCode === "IRRELEVANT_EVIDENCE"
    )
  ) {
    weaknesses.push(
      "Irrelevant-entity adversarial case did not fail closed with IRRELEVANT_EVIDENCE.",
    );
  }

  const conflicting = results.find((r) => r.scenarioId === "A03-conflicting-signals");
  if (conflicting?.passed && conflicting.actualOutcome === "success") {
    // Soft note only when conflicts were expected to be labeled — checked via tests.
  }

  const mutations = happy.filter(
    (r) => typeof r.subjective?.mutationConsistency === "number",
  );
  if (mutations.length) {
    const avgMut = avg(
      mutations.map((r) => r.subjective!.mutationConsistency!),
    );
    if (avgMut < 0.7) {
      weaknesses.push(
        `Mutation consistency heuristic below 0.70 (avg=${avgMut.toFixed(3)}).`,
      );
    }
  }

  const failedHappy = results.filter((r) => r.kind === "happy" && !r.passed);
  if (failedHappy.length) {
    weaknesses.push(
      `Happy-path failures: ${failedHappy.map((r) => r.scenarioId).join(", ")}.`,
    );
  }

  if (weaknesses.length === 0) {
    weaknesses.push(
      "No critical harness failures detected. Remaining gap: live Qloo authentication and real-API evaluation are still blocked.",
    );
  }

  return weaknesses;
}

function recommendNextPriority(
  results: ScenarioEvalResult[],
  weaknesses: string[],
): string {
  const failedHappy = results.filter((r) => r.kind === "happy" && !r.passed);
  if (failedHappy.length) {
    return `Fix happy-path objective failures (${failedHappy[0]!.scenarioId}) before expanding features.`;
  }

  if (weaknesses.some((w) => /concept diversity/i.test(w))) {
    return "Further differentiate concept influence selection while keeping claim→evidence grounding.";
  }

  return "Obtain and verify the real Qloo API key, run live auth probe, then extend this harness with a clearly separated live-API evaluation suite.";
}

function avg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
