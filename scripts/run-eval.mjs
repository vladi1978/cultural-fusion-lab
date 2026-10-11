#!/usr/bin/env node
/**
 * Offline evaluation entrypoint — synthetic fixtures only.
 * Usage: npm run eval
 */

import { spawnSync } from "node:child_process";
import path from "node:path";

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["vitest", "run", "src/lib/eval/harness.test.ts"],
  {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  },
);

const reportPath = path.join(
  process.cwd(),
  "eval-reports",
  "OFFLINE_EVALUATION_REPORT.md",
);

console.log(`\n${"=".repeat(60)}`);
console.log("Offline evaluation complete.");
console.log(`Readable report: ${reportPath}`);
console.log(
  "IMPORTANT: Results use synthetic fixtures only — not live Qloo success,",
);
console.log(
  "and heuristic scores are not scientifically validated consumer predictions.",
);
console.log("=".repeat(60));

process.exit(result.status ?? 1);
