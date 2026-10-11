/**
 * Deterministic agentic orchestration engine for Cultural Fusion Lab.
 *
 * Workflow:
 * 1. Interpret creative objective
 * 2. Plan Qloo entity searches
 * 3. Collect + normalize cultural evidence (demo fixtures or live Qloo)
 * 4. Identify cross-category affinities (no invented Qloo scores)
 * 5. Generate three explainable concept candidates with evidence refs
 * 6. Evaluate relevance / originality / evidence coverage
 * 7. Mutate + re-evaluate on demand
 *
 * Does not call paid LLMs. Live Mode remains gated elsewhere until a real key works.
 */

import { clusterCulturalEntities } from "../qloo/mapper";
import type {
  ExplorationRequest,
  MutationRequest,
} from "../types";
import { DEMO_DISCLAIMER } from "../types";
import { identifyAffinities } from "./affinities";
import { detectEvidenceConflicts } from "./conflicts";
import { generateConceptCandidates } from "./concepts";
import { evaluateConcepts } from "./evaluate";
import { interpretObjective } from "./interpret";
import { mutateAndReevaluate } from "./mutate";
import { planSearches } from "./plan";
import {
  applyRelevanceGate,
  assertTopicalNeighborhood,
} from "./relevance";
import { createDemoSource } from "./sources/demo-source";
import type {
  AgentExplorationResult,
  AgentMutationResult,
  AgentStepTrace,
  AgentTrace,
  CulturalEvidenceSource,
} from "./types";
import { AgentError } from "./types";

export interface OrchestratorOptions {
  source?: CulturalEvidenceSource;
  /** Injected clock for tests */
  now?: () => string;
}

function stamp(now: () => string): string {
  return now();
}

function pushStep(
  steps: AgentStepTrace[],
  step: Omit<AgentStepTrace, "at">,
  now: () => string,
): void {
  steps.push({ ...step, at: stamp(now) });
}

function seedKey(request: ExplorationRequest): string {
  let h = 2166136261;
  const raw = [
    request.creativeObjective,
    request.culturalInterest,
    request.location ?? "",
    request.outputCategory,
    request.mode,
  ].join("|");
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export async function runExplorationAgent(
  request: ExplorationRequest,
  options: OrchestratorOptions = {},
): Promise<AgentExplorationResult> {
  const now = options.now ?? (() => new Date().toISOString());
  const source = options.source ?? createDemoSource();
  const steps: AgentStepTrace[] = [];
  const warnings: string[] = [];

  if (request.mode === "live" && source.id === "demo") {
    warnings.push(
      "Live mode was requested but a demo source was injected — results remain labeled mock/demo unless a Qloo source is used.",
    );
  }

  // 1. Interpret
  const interpreted = interpretObjective(request);
  pushStep(
    steps,
    {
      id: "interpret",
      title: "Interpret creative objective",
      status: "ok",
      detail: interpreted.summary,
    },
    now,
  );

  // 2. Plan searches
  const plan = planSearches(interpreted);
  pushStep(
    steps,
    {
      id: "plan",
      title: "Plan cultural searches",
      status: plan.searches.length ? "ok" : "empty",
      detail: `${plan.searches.length} planned searches across documented entity types. ${plan.notes[0] ?? ""}`,
    },
    now,
  );

  // 3. Collect evidence
  const collected = await source.collect({ request, plan });
  if (collected.entities.length === 0) {
    pushStep(
      steps,
      {
        id: "collect",
        title: "Collect cultural evidence",
        status: "error",
        detail: "Source returned no entities.",
      },
      now,
    );
    throw new AgentError(
      "EMPTY_EVIDENCE",
      "Cultural evidence collection returned no entities.",
      collected.collectionNotes.join(" "),
    );
  }

  pushStep(
    steps,
    {
      id: "collect",
      title: "Collect cultural evidence",
      status: "ok",
      detail: `Collected ${collected.entities.length} entities via ${source.id} source. ${collected.collectionNotes[0] ?? ""}`,
    },
    now,
  );

  // 3b. Topical relevance gate (objective; distinguishes empty vs irrelevant)
  const relevanceGate = applyRelevanceGate({
    entities: collected.entities,
    interpreted,
  });
  try {
    assertTopicalNeighborhood(relevanceGate, collected.entities.length);
  } catch (err) {
    pushStep(
      steps,
      {
        id: "relevance",
        title: "Topical relevance gate",
        status: "error",
        detail: err instanceof Error ? err.message : "Relevance gate failed.",
      },
      now,
    );
    throw err;
  }
  pushStep(
    steps,
    {
      id: "relevance",
      title: "Topical relevance gate",
      status: "ok",
      detail: `Kept ${relevanceGate.kept.length}, rejected ${relevanceGate.rejected.length}. ${relevanceGate.notes[0] ?? ""}`,
    },
    now,
  );
  if (relevanceGate.rejected.length > 0) {
    warnings.push(
      `Relevance gate rejected ${relevanceGate.rejected.length} off-topic entit(y/ies): ${relevanceGate.rejected
        .slice(0, 4)
        .map((e) => e.name)
        .join(", ")}.`,
    );
  }

  const topicalEntities = relevanceGate.kept;

  // Ensure entity-linked evidence exists for affinity/claim tracing
  let evidence = [...collected.evidence];
  const orphanEntities = topicalEntities.filter(
    (e) => !evidence.some((ev) => ev.relatedEntityIds?.includes(e.id)),
  );
  if (orphanEntities.length > 0) {
    const sourceLabel =
      source.id === "qloo" ? ("verified_api" as const) : ("mock_demo" as const);
    evidence.push({
      id: `ev-agent-collect-${seedKey(request)}`,
      source: sourceLabel,
      label:
        source.id === "qloo"
          ? "Collected Qloo entities"
          : "Collected demo entities",
      detail:
        source.id === "qloo"
          ? "Entity set returned by the live Qloo source during agent collection."
          : "Entity set from labeled demo fixtures during agent collection. Not Qloo Taste Graph data.",
      relatedEntityIds: orphanEntities.map((e) => e.id),
      createdAt: stamp(now),
    });
  }

  // 3c. Conflict awareness (label unresolved; do not invent resolutions)
  const conflicts = detectEvidenceConflicts(topicalEntities);
  pushStep(
    steps,
    {
      id: "conflicts",
      title: "Conflict awareness",
      status: conflicts.length ? "ok" : "empty",
      detail: conflicts.length
        ? `Labeled ${conflicts.length} unresolved explicit tag opposition(s). Different genres alone are not treated as incompatible.`
        : "No explicit opposing-tag conflicts detected.",
    },
    now,
  );
  for (const conflict of conflicts) {
    warnings.push(conflict.note);
    evidence.push({
      id: `ev-${conflict.id}`,
      source: "agent_hypothesis",
      label: `Unresolved conflict: ${conflict.opposition.join(" vs ")}`,
      detail: conflict.note,
      relatedEntityIds: [conflict.leftEntityId, conflict.rightEntityId],
      createdAt: stamp(now),
    });
  }

  // 4. Affinities (topical entities only; no invented scores)
  const affinities = identifyAffinities({
    entities: topicalEntities,
    evidence,
    provenanceByEntityId: collected.provenanceByEntityId,
  });
  pushStep(
    steps,
    {
      id: "affinities",
      title: "Identify cross-category affinities",
      status: affinities.length ? "ok" : "empty",
      detail: affinities.length
        ? `Found ${affinities.length} evidence-linked affinities (shared tags / co-collection / API-reported scores only — none invented).`
        : "No cross-category affinities could be grounded in evidence.",
    },
    now,
  );

  // 5. Concepts
  const { concepts: drafts, hypothesisEvidence } = generateConceptCandidates({
    interpreted,
    entities: topicalEntities,
    evidence,
    affinities,
    conflicts,
    seedKey: seedKey(request),
    mode: request.mode,
  });
  evidence = [...evidence, ...hypothesisEvidence];
  pushStep(
    steps,
    {
      id: "concepts",
      title: "Generate concept candidates",
      status: "ok",
      detail: `Generated ${drafts.length} directionally distinct candidates (intimate / communal / systems) with claim→evidence references.`,
    },
    now,
  );

  // 6. Evaluate
  const concepts = evaluateConcepts({
    concepts: drafts,
    interpreted,
    totalEntityCount: topicalEntities.length,
  });
  pushStep(
    steps,
    {
      id: "evaluate",
      title: "Evaluate candidates",
      status: "ok",
      detail: `Ranked by overall heuristic (relevance / originality / evidence coverage). Top: ${concepts[0]?.title ?? "n/a"} (${concepts[0]?.evaluation.overall ?? 0}).`,
    },
    now,
  );

  // Affinity inference evidence rows (hypothesis) for transparency
  for (const aff of affinities.filter((a) => a.basis === "co_collected")) {
    evidence.push({
      id: `ev-${aff.id}`,
      source: "agent_hypothesis",
      label: `Affinity inference: ${aff.leftCategory} ↔ ${aff.rightCategory}`,
      detail: aff.note,
      relatedEntityIds: [aff.leftEntityId, aff.rightEntityId],
      createdAt: stamp(now),
    });
  }

  const agentTrace: AgentTrace = {
    engine: "deterministic-v1",
    mode: request.mode,
    steps,
    interpreted,
    plan,
    affinityCount: affinities.length,
    warnings: [
      ...warnings,
      ...collected.collectionNotes.filter((n) =>
        /DEMO SOURCE|not Qloo/i.test(n),
      ),
    ],
    relevance: {
      kept: relevanceGate.kept.length,
      rejected: relevanceGate.rejected.length,
      intentTerms: relevanceGate.intentTerms,
    },
    conflicts,
  };

  const disclaimer =
    request.mode === "demo" || source.id === "demo"
      ? DEMO_DISCLAIMER
      : "LIVE MODE — verified_api rows come from Qloo. Concept positioning, co-collection affinities, and evaluation scores are agent heuristics — not Taste Graph forecasts.";

  return {
    mode: request.mode,
    request,
    clusters: clusterCulturalEntities(topicalEntities),
    entities: topicalEntities,
    concepts,
    affinities,
    conflicts,
    evidence,
    generatedAt: stamp(now),
    disclaimer,
    agentTrace,
  };
}

export async function runMutationAgent(
  request: MutationRequest,
  options: OrchestratorOptions = {},
): Promise<AgentMutationResult> {
  const now = options.now ?? (() => new Date().toISOString());
  const source = options.source ?? createDemoSource();
  const steps: AgentStepTrace[] = [];

  const original = request.concepts.find((c) => c.id === request.conceptId);
  if (!original) {
    throw new AgentError("MISSING_CONCEPT", "Concept not found for mutation.");
  }

  const interpreted = interpretObjective(request.exploration);
  pushStep(
    steps,
    {
      id: "interpret",
      title: "Re-load objective for mutation",
      status: "ok",
      detail: interpreted.summary,
    },
    now,
  );

  const { mutated, evidence } = await mutateAndReevaluate({
    concept: original,
    replaceEntityId: request.replaceEntityId,
    newEntityId: request.newEntityId,
    availableEntities: request.entities,
    evidence: request.evidence,
    interpreted,
    source,
    mutationRequest: request,
  });

  pushStep(
    steps,
    {
      id: "mutate",
      title: "Mutate concept influence",
      status: "ok",
      detail: mutated.mutationNote ?? "Mutation applied.",
    },
    now,
  );

  pushStep(
    steps,
    {
      id: "evaluate",
      title: "Re-evaluate mutated concept",
      status: "ok",
      detail: `Updated overall score: ${mutated.evaluation.overall} (relevance ${mutated.evaluation.relevance}, originality ${mutated.evaluation.originality}, evidence ${mutated.evaluation.evidenceCoverage}).`,
    },
    now,
  );

  // Light affinity refresh on mutated influences only
  const plan = planSearches(interpreted);
  const affinities = identifyAffinities({
    entities: mutated.culturalInfluences,
    evidence,
    provenanceByEntityId: Object.fromEntries(
      request.entities.map((e) => [
        e.id,
        request.mode === "live" ? "verified_api" : "mock_demo",
      ]),
    ),
  });

  pushStep(
    steps,
    {
      id: "affinities",
      title: "Refresh affinities after mutation",
      status: affinities.length ? "ok" : "empty",
      detail: `${affinities.length} affinities linked to mutated influences.`,
    },
    now,
  );

  void plan;

  return {
    mode: request.mode,
    originalConcept: original,
    mutatedConcept: mutated,
    evidence,
    affinities,
    generatedAt: stamp(now),
    disclaimer:
      request.mode === "demo" || source.id === "demo"
        ? DEMO_DISCLAIMER
        : "LIVE MODE — mutation narrative is agent hypothesis; replacement entities cite linked evidence provenance.",
    agentTrace: {
      engine: "deterministic-v1",
      mode: request.mode,
      steps,
      interpreted,
      plan,
      affinityCount: affinities.length,
      warnings:
        source.id === "demo"
          ? [
              "DEMO SOURCE — mutation used labeled mock/demo evidence, not live Qloo insights.",
            ]
          : [],
    },
  };
}
