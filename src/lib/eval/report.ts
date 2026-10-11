import type { EvalReport, ScenarioEvalResult } from "./types";

/** Render a readable markdown evaluation report. */
export function formatEvalReportMarkdown(report: EvalReport): string {
  const lines: string[] = [];
  lines.push(`# ${report.title}`);
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push("");
  lines.push(`> ${report.disclaimer}`);
  lines.push("");
  lines.push("## Aggregate metrics");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("| --- | --- |");
  lines.push(
    `| Scenarios passed | ${report.aggregate.passedScenarios}/${report.aggregate.totalScenarios} |`,
  );
  lines.push(
    `| Happy path | ${report.aggregate.happyPassed}/${report.aggregate.happyTotal} |`,
  );
  lines.push(
    `| Adversarial | ${report.aggregate.adversarialPassed}/${report.aggregate.adversarialTotal} |`,
  );
  lines.push(
    `| Objective check pass rate | ${pct(report.aggregate.objectiveCheckPassRate)} |`,
  );
  lines.push(
    `| Unsupported claims detected (instances) | ${report.aggregate.unsupportedClaimsDetected} |`,
  );
  lines.push(
    `| Avg concept diversity (heuristic) | ${report.aggregate.avgConceptDiversity} |`,
  );
  lines.push(
    `| Avg relevance (heuristic) | ${report.aggregate.avgHeuristicRelevance} |`,
  );
  lines.push(
    `| Avg originality (heuristic) | ${report.aggregate.avgHeuristicOriginality} |`,
  );
  lines.push(
    `| Avg evidence-coverage heuristic | ${report.aggregate.avgHeuristicEvidenceCoverage} |`,
  );
  lines.push(
    `| Avg mutation consistency (heuristic) | ${
      report.aggregate.avgMutationConsistency ?? "n/a"
    } |`,
  );
  lines.push("");
  lines.push(
    "_Heuristic rows are lab instrumentation only — not scientifically validated consumer predictions or live Qloo metrics._",
  );
  lines.push("");
  lines.push("## Per-scenario outcomes");
  lines.push("");

  for (const scenario of report.scenarios) {
    lines.push(...formatScenarioSection(scenario));
  }

  lines.push("## Weaknesses");
  lines.push("");
  for (const weakness of report.weaknesses) {
    lines.push(`- ${weakness}`);
  }
  lines.push("");
  lines.push("## Next engineering priority");
  lines.push("");
  lines.push(report.nextPriority);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(
    "Do not describe these results as Qloo-powered success until real API evaluation passes.",
  );
  lines.push("");

  return lines.join("\n");
}

function formatScenarioSection(scenario: ScenarioEvalResult): string[] {
  const lines: string[] = [];
  const mark = scenario.passed ? "PASS" : "FAIL";
  lines.push(`### ${mark} · ${scenario.scenarioId} — ${scenario.name}`);
  lines.push("");
  lines.push(`- Kind: \`${scenario.kind}\``);
  lines.push(
    `- Outcome: expected \`${scenario.expectedOutcome}\`, actual \`${scenario.actualOutcome}\``,
  );
  if (scenario.errorCode) {
    lines.push(`- Error: \`${scenario.errorCode}\` — ${scenario.errorMessage}`);
  }
  lines.push("- Objective checks:");
  for (const check of scenario.objectiveChecks) {
    lines.push(
      `  - ${check.passed ? "PASS" : "FAIL"} \`${check.id}\`: ${check.detail}`,
    );
  }
  if (scenario.subjective) {
    lines.push(
      `- Subjective heuristics: relevance=${scenario.subjective.avgRelevance}, originality=${scenario.subjective.avgOriginality}, evidenceCoverage=${scenario.subjective.avgEvidenceCoverageHeuristic}, diversity=${scenario.subjective.conceptDiversity}${
        scenario.subjective.mutationConsistency !== undefined
          ? `, mutation=${scenario.subjective.mutationConsistency}`
          : ""
      }`,
    );
  }
  if (scenario.unsupportedClaims.length) {
    lines.push("- Unsupported claims:");
    for (const claim of scenario.unsupportedClaims.slice(0, 6)) {
      lines.push(`  - ${claim}`);
    }
  }
  lines.push("");
  return lines;
}

function pct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}
