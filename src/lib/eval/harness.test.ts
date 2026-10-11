import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { EVAL_DISCLAIMER, runEvaluationHarness, runScenario } from "./harness";
import { formatEvalReportMarkdown } from "./report";
import { EVAL_SCENARIOS, getScenarioById } from "./scenarios";
import {
  assertsVerifiedQlooClaim,
  checkDemoNotVerifiedQlooAffinity,
  checkUnsupportedCulturalClaims,
  checkClaimTraceability,
  checkDuplicateConcepts,
} from "./validators";
import {
  EVAL_FIXTURE_LABEL,
  syntheticFakeVerifiedAffinityResult,
  syntheticUngroundedClaimResult,
} from "./fixtures";

describe("offline evaluation harness", () => {
  it("defines at least 12 scenarios across product/brand/experience + adversarial cases", () => {
    expect(EVAL_SCENARIOS.length).toBeGreaterThanOrEqual(12);
    const outputs = new Set(
      EVAL_SCENARIOS.filter((s) => s.kind === "happy").map(
        (s) => s.request.outputCategory,
      ),
    );
    expect(outputs.has("product")).toBe(true);
    expect(outputs.has("brand")).toBe(true);
    expect(outputs.has("experience")).toBe(true);

    const adversarialIds = EVAL_SCENARIOS.filter((s) => s.kind === "adversarial").map(
      (s) => s.id,
    );
    expect(adversarialIds).toEqual(
      expect.arrayContaining([
        "A01-insufficient-evidence",
        "A02-empty-results",
        "A03-conflicting-signals",
        "A04-irrelevant-entities",
        "A05-ungrounded-claim-synthetic",
        "A06-fake-verified-affinity",
        "A07-duplicate-concepts-synthetic",
      ]),
    );
  });

  it("fails closed on irrelevant entities with IRRELEVANT_EVIDENCE", async () => {
    const scenario = getScenarioById("A04-irrelevant-entities");
    expect(scenario).toBeTruthy();
    const result = await runScenario(scenario!);
    expect(result.passed).toBe(true);
    expect(result.actualOutcome).toBe("agent_error");
    expect(result.errorCode).toBe("IRRELEVANT_EVIDENCE");
  });

  it("runs the full offline suite, writes a report, and passes all scenarios", async () => {
    const report = await runEvaluationHarness();

    expect(report.disclaimer).toBe(EVAL_DISCLAIMER);
    expect(EVAL_FIXTURE_LABEL).toMatch(/OFFLINE EVAL FIXTURE/);
    expect(report.aggregate.totalScenarios).toBe(EVAL_SCENARIOS.length);

    const failed = report.scenarios.filter((s) => !s.passed);
    expect(
      failed.map((f) => ({
        id: f.scenarioId,
        checks: f.objectiveChecks.filter((c) => !c.passed),
        error: f.errorMessage,
      })),
    ).toEqual([]);

    const markdown = formatEvalReportMarkdown(report);
    const outDir = path.join(process.cwd(), "eval-reports");
    mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, "OFFLINE_EVALUATION_REPORT.md");
    writeFileSync(outPath, markdown, "utf8");

    expect(markdown).toMatch(/OFFLINE EVALUATION/);
    expect(markdown).toMatch(/Per-scenario outcomes/);
    expect(markdown).toMatch(/not scientifically validated consumer predictions/i);
    expect(markdown).toMatch(/not Qloo-powered success/i);
  }, 30_000);

  it("fails unsupported cultural claims instead of accepting high heuristic scores", () => {
    const synthetic = syntheticUngroundedClaimResult();
    expect(synthetic.concepts[0]!.evaluation.overall).toBeGreaterThan(0.8);

    const traceability = checkClaimTraceability(synthetic);
    const unsupported = checkUnsupportedCulturalClaims(synthetic);
    expect(traceability.passed).toBe(false);
    expect(unsupported.passed).toBe(false);
  });

  it("rejects demo shared-tag affinities labeled as verified Qloo api_reported_score", () => {
    const synthetic = syntheticFakeVerifiedAffinityResult();
    const affinityCheck = checkDemoNotVerifiedQlooAffinity(synthetic);
    const unsupported = checkUnsupportedCulturalClaims(synthetic);
    expect(affinityCheck.passed).toBe(false);
    expect(unsupported.passed).toBe(false);
  });

  it("detects duplicate concept regressions", () => {
    const scenario = getScenarioById("A07-duplicate-concepts-synthetic");
    expect(scenario?.syntheticResult).toBeTruthy();
    const dupCheck = checkDuplicateConcepts(scenario!.syntheticResult!);
    expect(dupCheck.passed).toBe(false);
  });

  it("treats insufficient evidence as an expected agent_error pass", async () => {
    const scenario = getScenarioById("A01-insufficient-evidence");
    expect(scenario).toBeTruthy();
    const result = await runScenario(scenario!);
    expect(result.passed).toBe(true);
    expect(result.actualOutcome).toBe("agent_error");
    expect(result.errorCode).toBe("EMPTY_EVIDENCE");
  });

  it("does not treat negated Qloo disclaimers as affirmative verified claims", () => {
    expect(
      assertsVerifiedQlooClaim(
        "Shared tags across music and film. This is not a verified Qloo affinity edge.",
      ),
    ).toBe(false);
    expect(
      assertsVerifiedQlooClaim(
        "Cultural anchor is a verified Qloo affinity driver.",
      ),
    ).toBe(true);
  });
});
