/**
 * Deterministic agentic orchestration engine for Cultural Fusion Lab.
 *
 * Workflow:
 * 1. Interpret creative objective
 * 2. Plan Qloo entity searches
 * 3. Collect + normalize cultural evidence (demo fixtures or live Qloo)
 * 4. Identify cross-category affinities (no invented Qloo scores)
 * 5. Synthesize mechanism-distinct concept candidates (1–3 after quality gates)
 * 6. Evaluate structural heuristics separately from creative claims
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
import { selectableOpportunities } from "./opportunity-gates";
import type { OpportunityHypothesis } from "./opportunity-types";
import { planSearches } from "./plan";
import { createDeterministicReasoningProvider } from "./reasoning/deterministic";
import type { ReasoningProvider } from "./reasoning/provider";
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
  /** Defaults to deterministic ReasoningProvider (no LLM). */
  reasoning?: ReasoningProvider;
  /** Optional local observation hook; does not change the public result. */
  onOpportunities?: (opportunities: OpportunityHypothesis[]) => void;
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
  const reasoning =
    options.reasoning ?? createDeterministicReasoningProvider();
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
    evidence: source.id === "qloo" ? collected.evidence : undefined,
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
    // P3.7.4: Collection provenance is entity-specific, not a
    // fabricated cross-entity affinity or cultural relationship.
    for (const entity of orphanEntities) {
      evidence.push({
        id: `ev-agent-collect-${seedKey(request)}-${entity.id}`,
        source: sourceLabel,
        label:
          source.id === "qloo"
            ? `Collected Qloo entity: ${entity.name}`
            : `Collected demo entity: ${entity.name}`,
        detail:
          source.id === "qloo"
            ? "Entity returned by the live Qloo source during agent collection. Collection alone does not establish cultural affinity."
            : "Entity from labeled synthetic demo fixtures. Collection alone does not establish cultural affinity or Qloo Taste Graph findings.",
        relatedEntityIds: [entity.id],
        createdAt: stamp(now),
      });
    }
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
    culturalInterest: interpreted.culturalInterest,
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

  // 5. Opportunity intelligence (P1) — signal graph → hypotheses → gates
  const signalGraph = reasoning.buildSignalGraph({
    entities: topicalEntities,
    evidence,
    affinities,
    conflicts,
    provenanceByEntityId: collected.provenanceByEntityId,
    mode: request.mode,
    culturalInterest: interpreted.culturalInterest,
  });
  const proposedOpportunities = reasoning.proposeOpportunities({
    graph: signalGraph,
    interpreted,
  });
  const gatedOpportunities = reasoning.gateOpportunities({
    opportunities: proposedOpportunities,
    interpreted,
    graph: signalGraph,
  });
  const selectedOpportunities = selectableOpportunities(gatedOpportunities);
  options.onOpportunities?.([...selectedOpportunities]);
  const opportunityStats = {
    accepted: gatedOpportunities.filter((o) => o.status === "accepted").length,
    rejected: gatedOpportunities.filter((o) => o.status === "rejected").length,
    downgraded: gatedOpportunities.filter((o) => o.status === "downgraded")
      .length,
    summaries: gatedOpportunities.slice(0, 8).map((o) =>
      o.status === "accepted"
        ? `ACCEPT ${o.kind}: ${o.title}`
        : `${o.status.toUpperCase()} ${o.kind}: ${o.title} — ${o.rejectionReason ?? o.uncertainty}`,
    ),
  };
  pushStep(
    steps,
    {
      id: "opportunities",
      title: "Opportunity intelligence",
      status: selectedOpportunities.length ? "ok" : "empty",
      detail: `ReasoningProvider=${reasoning.id}. Graph signals=${signalGraph.signals.length}, relationships=${signalGraph.relationships.length}. Opportunities accepted=${opportunityStats.accepted}, downgraded=${opportunityStats.downgraded}, rejected=${opportunityStats.rejected}. Hypotheses only — not demand or Qloo affinity proof. Rejection diagnostics: ${opportunityStats.summaries.join(" | ")}`,
    },
    now,
  );
  for (const note of signalGraph.uncertainties.slice(0, 3)) {
    warnings.push(note);
  }
  if (opportunityStats.rejected > 0) {
    warnings.push(
      `Opportunity gates rejected ${opportunityStats.rejected} weak/unsupported hypothes(e/s).`,
    );
  }

  // Hypothesis evidence rows for accepted opportunities
  for (const opp of selectedOpportunities) {
    evidence.push({
      id: `ev-${opp.id}`,
      source: "agent_hypothesis",
      label: `Opportunity hypothesis (${opp.kind}): ${opp.title}`,
      detail: `${opp.whyCreativelyUseful} ${opp.designImplication} Uncertainty: ${opp.uncertainty}`,
      relatedEntityIds: [...opp.supportingEntityIds],
      createdAt: stamp(now),
    });
  }

  // 6. Concepts (opportunity-influenced synthesis + quality gates; never pad)
  const {
    concepts: drafts,
    hypothesisEvidence,
    quality,
  } = generateConceptCandidates({
    interpreted,
    entities: topicalEntities,
    evidence,
    affinities,
    conflicts,
    seedKey: seedKey(request),
    mode: request.mode,
    opportunities: selectedOpportunities,
  });
  evidence = [...evidence, ...hypothesisEvidence];
  pushStep(
    steps,
    {
      id: "concepts",
      title: "Generate concept candidates",
      status: "ok",
      detail: `Accepted ${quality.candidatesAccepted}/${quality.candidatesGenerated} mechanism-distinct candidates after quality gates (1–3 max; no padding). Mechanisms: ${drafts
        .map((c) => c.spec?.mechanismId ?? "legacy")
        .join(", ")}. Opportunity-linked: ${drafts.filter((c) => c.spec?.opportunityId).length}.`,
    },
    now,
  );
  if (quality.rejectedSummaries.length > 0) {
    warnings.push(
      `Quality gates rejected ${quality.rejectedSummaries.length} candidate(s).`,
    );
  }

  // 7. Evaluate (transparent heuristics — not creativity/market proof)
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
      detail: `Ranked by structural heuristics (relevance / originality / evidence coverage). Not proof of real-world originality or commercial viability. Top: ${concepts[0]?.title ?? "n/a"} (${concepts[0]?.evaluation.overall ?? 0}).`,
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
    engine: "deterministic-v2.1",
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
    quality,
    opportunities: opportunityStats,
  };

  const disclaimer =
    request.mode === "demo" || source.id === "demo"
      ? DEMO_DISCLAIMER
      : "LIVE MODE — verified_api rows come from Qloo. Concept positioning, co-collection affinities, and evaluation scores are agent heuristics — not Taste Graph forecasts.";

  return {
    mode: request.mode,
    request,
    opportunities: selectedOpportunities,
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
    culturalInterest: interpreted.culturalInterest,
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
    mutationDiffs: mutated.mutationDiffs,
    evidence,
    affinities,
    generatedAt: stamp(now),
    disclaimer:
      request.mode === "demo" || source.id === "demo"
        ? DEMO_DISCLAIMER
        : "LIVE MODE — mutation narrative is agent hypothesis; replacement entities cite linked evidence provenance.",
    agentTrace: {
      engine: "deterministic-v2.1",
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
