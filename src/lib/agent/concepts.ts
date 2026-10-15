/**
 * Concept candidate generation (Engine V2).
 * Uses mechanism synthesis + quality gates. Does not force intimate/communal/systems.
 */

import type {
  ConceptNarrative,
  CulturalEntity,
  EvidenceItem,
  QualityGateReport,
} from "../types";
import { compareConcepts } from "../eval/concept-similarity";
import { conflictsForInfluences } from "./conflicts";
import { extractSignals } from "./mutation-transform";
import type { OpportunityHypothesis } from "./opportunity-types";
import { structuralHeuristics, runQualityGates } from "./quality-gates";
import {
  selectObservedSignal,
  specToNarrative,
  synthesizeConceptCandidates,
} from "./synthesis";
import type {
  ConceptClaim,
  CrossCategoryAffinity,
  EvidenceConflict,
  EvaluatedConcept,
  InterpretedObjective,
} from "./types";
import { AgentError } from "./types";

export interface GenerateConceptsResult {
  concepts: EvaluatedConcept[];
  hypothesisEvidence: EvidenceItem[];
  quality: {
    candidatesGenerated: number;
    candidatesAccepted: number;
    rejectedSummaries: string[];
  };
}

/**
 * Generate 1–3 quality-gated concept candidates.
 * Opportunities (P1) influence mechanism choice and framing when provided.
 * Throws INSUFFICIENT_QUALITY when none pass gates (never pads with weak clones).
 */
export function generateConceptCandidates(options: {
  interpreted: InterpretedObjective;
  entities: CulturalEntity[];
  evidence: EvidenceItem[];
  affinities: CrossCategoryAffinity[];
  conflicts?: EvidenceConflict[];
  seedKey: string;
  mode?: "demo" | "live";
  /** Accepted/downgraded opportunities from ReasoningProvider. */
  opportunities?: OpportunityHypothesis[];
}): GenerateConceptsResult {
  const {
    interpreted,
    entities,
    evidence,
    affinities,
    conflicts = [],
    seedKey,
    mode = "demo",
    opportunities = [],
  } = options;

  if (entities.length < 2) {
    throw new AgentError(
      "EMPTY_EVIDENCE",
      "Need at least two cultural entities to synthesize concepts.",
      `Collected ${entities.length} entities.`,
    );
  }

  const synthesized = synthesizeConceptCandidates({
    interpreted,
    entities,
    conflicts,
    modeLabel: mode,
    seedKey,
    opportunities,
  });

  if (synthesized.length === 0) {
    throw new AgentError(
      "INSUFFICIENT_QUALITY",
      "No structurally distinct mechanism candidates could be formed from the collected neighborhood.",
      "Need more category diversity or usable tags among topical entities.",
    );
  }

  const evidenceEntityIds = new Set(entities.map((e) => e.id));
  const entityAttributeIndex = new Map(
    entities.map((e) => [
      e.id,
      new Set(
        [
          e.category,
          e.name.toLowerCase(),
          ...e.tags.map((t) => t.toLowerCase()),
          selectObservedSignal(e).toLowerCase(),
          ...extractSignals(e).map((s) => s.toLowerCase()),
          ...e.description
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .filter((t) => t.length > 2),
        ].filter(Boolean),
      ),
    ]),
  );
  const acceptedFingerprints: string[] = [];
  const accepted: EvaluatedConcept[] = [];
  const usedTitles = new Set<string>();
  const usedConceptIds = new Set<string>();
  const rejectedSummaries: string[] = [];
  const hypothesisEvidence: EvidenceItem[] = [];
  const now = new Date().toISOString();

  // Two-pass selection: prioritize mechanism diversity among valid concepts,
  // then fill remaining slots with distinct operating programs.
  // Opportunities retain priority within each mechanism.
  const prioritized = [
    ...synthesized.filter((candidate) => Boolean(candidate.opportunityId)),
    ...synthesized.filter((candidate) => !candidate.opportunityId),
  ];

  const acceptedMechanisms = new Set<string>();
  const acceptedCandidateIndexes = new Set<number>();

  for (const diversityPass of [true, false]) {
    for (const [index, candidate] of prioritized.entries()) {
      if (accepted.length >= 3) break;
      if (acceptedCandidateIndexes.has(index)) continue;
      if (diversityPass && acceptedMechanisms.has(candidate.mechanismId)) {
        continue;
      }
    const gate = runQualityGates({
      spec: candidate.spec,
      interpreted,
      acceptedFingerprints,
      evidenceEntityIds,
      entityAttributeIndex,
    });

    if (!gate.accepted) {
      rejectedSummaries.push(
        `${candidate.spec.name} [${candidate.mechanismId}]: ${gate.failures.slice(0, 3).join("; ")}`,
      );
      continue;
    }

    // P1.17: Independent semantic-content audit before accepting a candidate.
    // Conservative threshold; IDs and fingerprints alone are insufficient.
    const candidateForSimilarity = {
      id: `candidate-${index}`,
      title: candidate.spec.name,
      positioning: candidate.spec.mechanics,
      outputCategory: interpreted.outputCategory,
      culturalInfluences: candidate.influences,
      evidenceIds: [],
      summary: candidate.spec.proposition,
      spec: candidate.spec,
    };

    const redundantWith = accepted.find((previous) => {
      const finding = compareConcepts(
        candidateForSimilarity,
        previous,
        [interpreted.culturalInterest, interpreted.location ?? ""],
      );

      return finding.overall >= 0.85 ||
        (finding.dimensions.proposition >= 0.90 &&
         finding.dimensions.mechanics >= 0.90);
    });

    if (redundantWith) {
      rejectedSummaries.push(
        `${candidate.spec.name}: content overlaps with accepted concept ${redundantWith.title}.`,
      );
      continue;
    }

    const influences = candidate.influences;
    const localConflicts = conflictsForInfluences(influences, conflicts);
    const entityEvidenceIds = evidence
      .filter((e) =>
        e.relatedEntityIds?.some((id) =>
          influences.some((inf) => inf.id === id),
        ),
      )
      .map((e) => e.id);

    if (entityEvidenceIds.length === 0) {
      rejectedSummaries.push(
        `${candidate.spec.name}: no evidence-linked influences.`,
      );
      continue;
    }

    const affinityIds = affinities
      .filter((aff) =>
        influences.some(
          (inf) =>
            inf.id === aff.leftEntityId || inf.id === aff.rightEntityId,
        ),
      )
      .map((aff) => aff.id)
      .slice(0, 4);

    // Resolve display identity only after quality and evidence gates.
    // Do not change the causal operating program or its fingerprints.
    const baseName = candidate.spec.name;
    let uniqueName = baseName;
    if (usedTitles.has(uniqueName.toLowerCase())) {
      const context = candidate.spec.operatingProgramId
        ?.replace(/[_-]+/g, " ")
        .trim();
      const hinge = candidate.hinge.name.replace(/^Eval\\s+|^Mock\\s+/i, "").trim();
      const candidates = [
        context ? `${baseName} — ${context}` : "",
        hinge ? `${baseName} — ${hinge}` : "",
        context && hinge ? `${baseName} — ${context} ${hinge}` : "",
      ].filter(Boolean);
      uniqueName =
        candidates.find((name) => !usedTitles.has(name.toLowerCase())) ??
        `${baseName} — ${accepted.length + 1}`;
    }

    const spec = { ...candidate.spec, name: uniqueName };
    const conceptIdBase = `agent-concept-${seedKey}-${candidate.mechanismId}`;
    let conceptId = conceptIdBase;
    if (usedConceptIds.has(conceptId)) {
      conceptId = `${conceptIdBase}-${accepted.length + 1}`;
    }

    const narrative = specToNarrative(spec);
    const hypId = `ev-hyp-concept-${conceptId}`;
    hypothesisEvidence.push({
      id: hypId,
      source: "agent_hypothesis",
      label: `Hypothesis: ${spec.name}`,
      detail: `${spec.proposition} ${spec.evidenceBoundary}`,
      relatedEntityIds: influences.map((e) => e.id),
      createdAt: now,
    });

    const claims = buildClaims({
      index,
      specName: spec.name,
      influences,
      entityEvidenceIds,
      hypId,
      affinities: affinities.filter((a) => affinityIds.includes(a.id)),
      conflicts: localConflicts,
      rationales: spec.rationales,
    });

    const heuristics = structuralHeuristics(spec);

    const concept: EvaluatedConcept = {
      id: conceptId,
      title: spec.name,
      positioning: composePositioning(narrative),
      outputCategory: interpreted.outputCategory,
      culturalInfluences: influences,
      evidenceIds: unique([...entityEvidenceIds, hypId]),
      summary: spec.proposition,
      narrative,
      spec,
      claims,
      affinityIds,
      conflictIds: localConflicts.map((c) => c.id),
      qualityGate: gate,
      evaluation: {
        relevance: heuristics.relevance,
        originality: heuristics.originality,
        evidenceCoverage: heuristics.evidenceCoverage,
        overall: heuristics.overall,
        notes: heuristics.notes,
      },
    };

    accepted.push(concept);
    acceptedMechanisms.add(candidate.mechanismId);
    usedTitles.add(uniqueName.toLowerCase());
    usedConceptIds.add(conceptId);
    acceptedFingerprints.push(candidate.spec.mechanicFingerprint);
    if (candidate.spec.operatingProgramFingerprint) {
      acceptedFingerprints.push(
        `prog:${candidate.spec.operatingProgramFingerprint}`,
      );
    }

      acceptedCandidateIndexes.add(index);
    }
    if (accepted.length >= 3) break;
  }

  if (accepted.length === 0) {
    throw new AgentError(
      "INSUFFICIENT_QUALITY",
      "No concept candidates passed professional quality gates.",
      rejectedSummaries.slice(0, 6).join(" | ") ||
        "All candidates failed specificity, journey, rationale, or differentiation checks.",
    );
  }

  return {
    concepts: accepted,
    hypothesisEvidence,
    quality: {
      candidatesGenerated: synthesized.length,
      candidatesAccepted: accepted.length,
      rejectedSummaries,
    },
  };
}

/** @deprecated Prefer synthesizeConceptCandidates — kept for narrow legacy callers. */
export function buildConceptNarrative(options: {
  interpreted: InterpretedObjective;
  direction: { id: string } | string;
  influences: CulturalEntity[];
  localConflicts?: EvidenceConflict[];
  modeLabel?: "demo" | "live";
}): ConceptNarrative {
  const synthesized = synthesizeConceptCandidates({
    interpreted: options.interpreted,
    entities: options.influences,
    conflicts: options.localConflicts,
    modeLabel: options.modeLabel,
    seedKey: "legacy",
  });
  if (synthesized[0]) return specToNarrative(synthesized[0].spec);
  return {
    whatItIs: `A ${options.interpreted.outputCategory} exploration of ${options.interpreted.culturalInterest}.`,
    whoItServes: "Audience undefined — insufficient mechanism synthesis.",
    howItWorks: "No journey available.",
    distinctive: "Insufficient structural differentiation.",
    inspiredBy: options.influences.map((e) => e.name).join(" · "),
    evidenceBoundary: "Hypothesis only.",
  };
}

export function composePositioning(narrative: ConceptNarrative): string {
  return `${narrative.whatItIs} ${narrative.whoItServes} ${narrative.howItWorks} Distinctive: ${narrative.distinctive} ${narrative.inspiredBy} ${narrative.evidenceBoundary}`;
}

function buildClaims(options: {
  index: number;
  specName: string;
  influences: CulturalEntity[];
  entityEvidenceIds: string[];
  hypId: string;
  affinities: CrossCategoryAffinity[];
  conflicts: EvidenceConflict[];
  rationales: { id: string; featureDescription: string; influenceEntityId: string; attributeOrSignal: string; creativeInterpretation: string; whyItProducesMechanic: string }[];
}): ConceptClaim[] {
  const {
    index,
    specName,
    influences,
    entityEvidenceIds,
    hypId,
    affinities,
    conflicts,
    rationales,
  } = options;

  const claims: ConceptClaim[] = influences.map((entity, i) => ({
    id: `claim-ref-${index}-${i}`,
    statement: `Cultural anchor: “${entity.name}” (${entity.category}) informs “${specName}”.`,
    evidenceIds: entityEvidenceIds.slice(0, 3),
    kind: "cultural_reference" as const,
  }));

  for (const claim of claims) {
    if (claim.evidenceIds.length === 0) {
      claim.evidenceIds = [...entityEvidenceIds];
    }
  }

  for (const [ri, rationale] of rationales.slice(0, 4).entries()) {
    claims.push({
      id: `claim-rat-${index}-${ri}`,
      statement: `Rationale (${rationale.attributeOrSignal}): ${rationale.creativeInterpretation} → ${rationale.whyItProducesMechanic}`,
      evidenceIds: [hypId, ...entityEvidenceIds.slice(0, 2)],
      kind: "positioning_hypothesis",
    });
  }

  for (const [ai, aff] of affinities.slice(0, 2).entries()) {
    claims.push({
      id: `claim-aff-${index}-${ai}`,
      statement: `Cross-category inference (${aff.basis}): ${aff.leftCategory} ↔ ${aff.rightCategory}${
        aff.sharedTags.length ? ` via tags [${aff.sharedTags.join(", ")}]` : ""
      }. ${aff.note}`,
      evidenceIds: [...aff.evidenceIds],
      kind: "affinity_inference",
    });
  }

  for (const [ci, conflict] of conflicts.slice(0, 1).entries()) {
    claims.push({
      id: `claim-conflict-${index}-${ci}`,
      statement: `Unresolved conflict labeled (not resolved): ${conflict.note}`,
      evidenceIds: [...entityEvidenceIds.slice(0, 2), hypId],
      kind: "positioning_hypothesis",
    });
  }

  for (const claim of claims) {
    if (!claim.evidenceIds.length) {
      throw new AgentError(
        "CLAIM_UNGROUNDED",
        "A cultural claim was generated without evidence references.",
        claim.statement,
      );
    }
  }

  return claims;
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}

export type { QualityGateReport };
