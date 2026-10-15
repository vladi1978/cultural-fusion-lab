/**
 * Objective validity checks (binary pass/fail).
 * These are NOT heuristic quality scores and must fail unsupported cultural claims.
 */

import type { EvidenceItem } from "../types";
import type {
  AgentExplorationResult,
  AgentMutationResult,
  CrossCategoryAffinity,
  EvaluatedConcept,
} from "../agent/types";
import type { ObjectiveCheckResult } from "./types";

const AFFIRMATIVE_VERIFIED_QLOO_PATTERN =
  /\b(verified\s+qloo|qloo\s+affinity|taste\s+graph\s+edge|scientifically\s+validated)\b/i;

/** True only for affirmative overclaims — ignores explicit negations. */
export function assertsVerifiedQlooClaim(statement: string): boolean {
  const normalized = statement.replace(/\s+/g, " ").trim();
  if (
    /\bnot\s+(a\s+|an\s+)?(verified\s+qloo|qloo\s+affinity|taste\s+graph\s+edge)\b/i.test(
      normalized,
    ) ||
    /\bnever\s+(a\s+|an\s+)?(verified\s+qloo|qloo\s+affinity)\b/i.test(
      normalized,
    ) ||
    /\bno\s+fabricated\s+qloo\b/i.test(normalized) ||
    /\bnot\s+a\s+fabricated\s+qloo\b/i.test(normalized)
  ) {
    return false;
  }
  return AFFIRMATIVE_VERIFIED_QLOO_PATTERN.test(normalized);
}

export interface ValidationContext {
  result: AgentExplorationResult;
  mutation?: AgentMutationResult;
  expectMutation?: boolean;
}

export function runObjectiveChecks(
  ctx: ValidationContext,
): ObjectiveCheckResult[] {
  const checks: ObjectiveCheckResult[] = [
    checkClaimTraceability(ctx.result),
    checkUnsupportedCulturalClaims(ctx.result),
    checkDemoNotVerifiedQlooAffinity(ctx.result),
    checkConceptCount(ctx.result),
    checkDuplicateConcepts(ctx.result),
    checkEvidenceProvenanceLabels(ctx.result),
  ];

  if (ctx.expectMutation) {
    checks.push(checkMutationConsistency(ctx.result, ctx.mutation));
  }

  return checks;
}

/** Every claim evidenceId must exist in the evidence set. */
export function checkClaimTraceability(
  result: AgentExplorationResult,
): ObjectiveCheckResult {
  const evidenceIds = new Set(result.evidence.map((e) => e.id));
  const missing: string[] = [];

  for (const concept of result.concepts) {
    for (const claim of concept.claims) {
      if (claim.evidenceIds.length === 0) {
        missing.push(`${claim.id}:empty`);
        continue;
      }
      for (const id of claim.evidenceIds) {
        if (!evidenceIds.has(id)) {
          missing.push(`${claim.id}→${id}`);
        }
      }
    }
  }

  return {
    id: "claim_traceability",
    passed: missing.length === 0,
    detail:
      missing.length === 0
        ? "All claims reference existing evidence IDs."
        : `Ungrounded evidence refs: ${missing.slice(0, 8).join(", ")}`,
  };
}

/**
 * Unsupported cultural claims FAIL (not merely lower scores):
 * - cultural_reference / affinity_inference citing missing evidence
 * - statements asserting verified Qloo while linked evidence is mock_demo
 * - affinity_inference tied to api_reported_score affinities with mock provenance
 */
export function checkUnsupportedCulturalClaims(
  result: AgentExplorationResult,
): ObjectiveCheckResult {
  const evidenceById = new Map(result.evidence.map((e) => [e.id, e]));
  const affinityById = new Map(result.affinities.map((a) => [a.id, a]));
  const failures: string[] = [];

  for (const concept of result.concepts) {
    for (const claim of concept.claims) {
      if (
        (claim.kind === "cultural_reference" ||
          claim.kind === "affinity_inference") &&
        claim.evidenceIds.length === 0
      ) {
        failures.push(`${claim.id}: no evidence refs`);
      }

      const linked = claim.evidenceIds
        .map((id) => evidenceById.get(id))
        .filter((e): e is EvidenceItem => Boolean(e));

      const assertsVerified = assertsVerifiedQlooClaim(claim.statement);
      if (assertsVerified) {
        const hasVerified = linked.some((e) => e.source === "verified_api");
        if (!hasVerified) {
          failures.push(
            `${claim.id}: asserts verified Qloo without verified_api evidence`,
          );
        }
      }

      if (claim.kind === "affinity_inference") {
        for (const affId of concept.affinityIds) {
          const aff = affinityById.get(affId);
          if (!aff) continue;
          if (aff.basis === "api_reported_score") {
            const mockLinked = linked.some((e) => e.source === "mock_demo");
            const verifiedLinked = linked.some(
              (e) => e.source === "verified_api",
            );
            if (mockLinked && !verifiedLinked) {
              failures.push(
                `${claim.id}: affinity_inference uses api_reported_score with mock_demo evidence only`,
              );
            }
          }
        }
      }

      // Named cultural anchors must appear among related entities on linked evidence
      if (claim.kind === "cultural_reference") {
        const named = extractQuotedName(claim.statement);
        if (named) {
          const entity = result.entities.find((e) => e.name === named);
          if (entity) {
            const covers = linked.some((e) =>
              e.relatedEntityIds?.includes(entity.id),
            );
            if (!covers && linked.length > 0) {
              failures.push(
                `${claim.id}: cultural_reference “${named}” not covered by linked evidence relatedEntityIds`,
              );
            }
          }
        }
      }
    }
  }

  return {
    id: "unsupported_cultural_claims",
    passed: failures.length === 0,
    detail:
      failures.length === 0
        ? "No unsupported cultural claims detected."
        : failures.slice(0, 10).join(" | "),
  };
}

/**
 * Shared demo tags must never be treated as verified Qloo affinities.
 */
export function checkDemoNotVerifiedQlooAffinity(
  result: AgentExplorationResult,
): ObjectiveCheckResult {
  const evidenceById = new Map(result.evidence.map((e) => [e.id, e]));
  const bad = result.affinities.filter((aff) =>
    isFakeVerifiedAffinity(aff, evidenceById, result),
  );

  return {
    id: "demo_not_verified_qloo_affinity",
    passed: bad.length === 0,
    detail:
      bad.length === 0
        ? "No mock/demo affinities mislabeled as verified Qloo api_reported_score."
        : `Invalid verified affinities: ${bad.map((a) => a.id).join(", ")}`,
  };
}

function isFakeVerifiedAffinity(
  aff: CrossCategoryAffinity,
  evidenceById: Map<string, EvidenceItem>,
  result: AgentExplorationResult,
): boolean {
  if (aff.basis !== "api_reported_score") return false;

  const linked = aff.evidenceIds
    .map((id) => evidenceById.get(id))
    .filter((e): e is EvidenceItem => Boolean(e));

  const anyMock = linked.some((e) => e.source === "mock_demo");
  const anyVerified = linked.some((e) => e.source === "verified_api");

  const leftProv = inferEntityProvenance(result, aff.leftEntityId);
  const rightProv = inferEntityProvenance(result, aff.rightEntityId);
  const mockEntities =
    leftProv === "mock_demo" || rightProv === "mock_demo";

  return (anyMock && !anyVerified) || mockEntities;
}

function inferEntityProvenance(
  result: AgentExplorationResult,
  entityId: string,
): EvidenceItem["source"] | undefined {
  const hit = result.evidence.find((e) =>
    e.relatedEntityIds?.includes(entityId),
  );
  return hit?.source;
}

export function checkConceptCount(
  result: AgentExplorationResult,
): ObjectiveCheckResult {
  const n = result.concepts.length;
  const ok = n >= 1 && n <= 3;
  return {
    id: "concept_count",
    passed: ok,
    detail: ok
      ? `Produced ${n} quality-gated concept candidate(s) (allowed 1–3; no padding).`
      : `Expected 1–3 concepts, got ${n}.`,
  };
}

export function checkDuplicateConcepts(
  result: AgentExplorationResult,
): ObjectiveCheckResult {
  const titles = result.concepts.map((c) => normalizeTitle(c.title));
  const unique = new Set(titles);
  const mechanicFingerprints = result.concepts.map(
    (c) => c.spec?.mechanicFingerprint ?? c.spec?.mechanismId ?? "",
  );
  const hasMechanics = mechanicFingerprints.every((f) => f.length > 0);
  const uniqueMechanics = new Set(mechanicFingerprints);
  const influenceFingerprints = result.concepts.map((c) =>
    c.culturalInfluences
      .map((e) => e.id)
      .sort()
      .join("|"),
  );
  const uniqueInfluences = new Set(influenceFingerprints);

  const titleDup = unique.size !== titles.length;
  const mechanicDup =
    hasMechanics && uniqueMechanics.size !== mechanicFingerprints.length;
  const influenceDup =
    !hasMechanics && uniqueInfluences.size !== influenceFingerprints.length;

  const passed = !titleDup && !mechanicDup && !influenceDup;

  return {
    id: "duplicate_concepts",
    passed,
    detail: passed
      ? hasMechanics
        ? "Concept titles and mechanic fingerprints are distinct."
        : "Concept titles and influence sets are distinct."
      : `Duplicates detected (titles=${titleDup}, mechanics=${mechanicDup}, influences=${influenceDup}).`,
  };
}

export function checkEvidenceProvenanceLabels(
  result: AgentExplorationResult,
): ObjectiveCheckResult {
  const invalid = result.evidence.filter(
    (e) =>
      e.source !== "mock_demo" &&
      e.source !== "agent_hypothesis" &&
      e.source !== "verified_api",
  );

  const demoRunClaimsVerifiedOnly =
    result.mode === "demo" &&
    result.evidence.some((e) => e.source === "verified_api") &&
    result.agentTrace.warnings.every((w) => !/LIVE/i.test(w));

  // Demo orchestration using demo source should not emit verified_api.
  const demoLeak =
    result.mode === "demo" &&
    result.evidence.some((e) => e.source === "verified_api") &&
    result.agentTrace.warnings.some((w) => /DEMO SOURCE|MOCK|not Qloo/i.test(w));

  const passed = invalid.length === 0 && !demoLeak;

  return {
    id: "evidence_provenance_labels",
    passed,
    detail: passed
      ? "Evidence sources use allowed provenance labels; demo runs do not leak verified_api."
      : `Provenance issues (invalid=${invalid.length}, demoLeak=${demoLeak}, demoVerified=${demoRunClaimsVerifiedOnly}).`,
  };
}

export function checkMutationConsistency(
  before: AgentExplorationResult,
  mutation?: AgentMutationResult,
): ObjectiveCheckResult {
  if (!mutation) {
    return {
      id: "mutation_consistency",
      passed: false,
      detail: "Mutation was expected but no mutation result was produced.",
    };
  }

  const original = mutation.originalConcept;
  const mutated = mutation.mutatedConcept;
  const issues: string[] = [];

  if (mutated.parentConceptId !== original.id) {
    issues.push("parentConceptId mismatch");
  }
  if (!mutated.mutationNote) {
    issues.push("missing mutationNote");
  }
  if (mutated.id === original.id) {
    issues.push("mutated id unchanged");
  }

  const origIds = new Set(original.culturalInfluences.map((e) => e.id));
  const mutIds = new Set(mutated.culturalInfluences.map((e) => e.id));
  const changed =
    [...origIds].some((id) => !mutIds.has(id)) ||
    [...mutIds].some((id) => !origIds.has(id));
  if (!changed) {
    issues.push("influence set unchanged");
  }

  for (const claim of mutated.claims) {
    if (claim.evidenceIds.length === 0) {
      issues.push(`ungrounded claim ${claim.id}`);
    }
    for (const id of claim.evidenceIds) {
      if (!mutation.evidence.some((e) => e.id === id)) {
        issues.push(`missing evidence ${id}`);
      }
    }
  }

  // Heuristic scores must not be treated as scientific predictions in notes
  if (
    mutated.evaluation.notes.some((n) =>
      /scientifically validated|consumer prediction/i.test(n),
    )
  ) {
    issues.push("evaluation notes overclaim scientific validity");
  }

  void before;

  return {
    id: "mutation_consistency",
    passed: issues.length === 0,
    detail:
      issues.length === 0
        ? "Mutation swapped influences and retained grounded claims."
        : issues.join("; "),
  };
}

export function listUnsupportedClaimMessages(
  result: AgentExplorationResult,
): string[] {
  const check = checkUnsupportedCulturalClaims(result);
  if (check.passed) return [];
  return check.detail.split(" | ").filter(Boolean);
}

function extractQuotedName(statement: string): string | null {
  const match = statement.match(/“([^”]+)”|"([^"]+)"/);
  return match?.[1] ?? match?.[2] ?? null;
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

export function conceptsAreEvaluated(
  concepts: EvaluatedConcept[],
): concepts is EvaluatedConcept[] {
  return concepts.every((c) => Array.isArray(c.claims));
}
