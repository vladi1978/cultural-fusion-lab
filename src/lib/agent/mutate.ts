import type { CulturalEntity, EvidenceItem, FusionConcept } from "../types";
import { composePositioning } from "./concepts";
import { evaluateSingleConcept } from "./evaluate";
import { transformConceptForMutation } from "./mutation-transform";
import type {
  ConceptClaim,
  CreativeDirectionId,
  CulturalEvidenceSource,
  EvaluatedConcept,
  InterpretedObjective,
} from "./types";
import { AgentError } from "./types";

export async function mutateAndReevaluate(options: {
  concept: FusionConcept | EvaluatedConcept;
  replaceEntityId: string;
  newEntityId: string;
  availableEntities: CulturalEntity[];
  evidence: EvidenceItem[];
  interpreted: InterpretedObjective;
  source: CulturalEvidenceSource;
  mutationRequest: Parameters<
    NonNullable<CulturalEvidenceSource["suggestReplacements"]>
  >[0]["request"];
}): Promise<{
  mutated: EvaluatedConcept;
  evidence: EvidenceItem[];
}> {
  const {
    concept,
    replaceEntityId,
    availableEntities,
    evidence,
    interpreted,
    source,
  } = options;

  const outgoing = concept.culturalInfluences.find(
    (e) => e.id === replaceEntityId,
  );
  if (!outgoing) {
    throw new AgentError(
      "MUTATION_INVALID",
      "Selected influence to replace was not found on the concept.",
    );
  }

  let incoming =
    availableEntities.find((e) => e.id === options.newEntityId) ?? null;
  let extraEvidence: EvidenceItem[] = [];

  if (!incoming || incoming.id === outgoing.id) {
    if (!source.suggestReplacements) {
      throw new AgentError(
        "MUTATION_INVALID",
        "No replacement entity available for mutation.",
      );
    }
    const suggestion = await source.suggestReplacements({
      request: options.mutationRequest,
      outgoing,
      seeds: concept.culturalInfluences.filter((e) => e.id !== outgoing.id),
    });
    extraEvidence = suggestion.evidence;
    incoming =
      suggestion.candidates.find((c) => c.id === options.newEntityId) ??
      suggestion.candidates[0] ??
      null;
  }

  if (!incoming || incoming.id === outgoing.id) {
    throw new AgentError(
      "MUTATION_INVALID",
      "Select a different cultural influence to mutate.",
    );
  }

  const newInfluences = concept.culturalInfluences.map((e) =>
    e.id === outgoing.id ? incoming! : e,
  );
  const retainedInfluences = newInfluences.filter((e) => e.id !== incoming!.id);

  const directionId = (
    "directionId" in concept && concept.directionId
      ? concept.directionId
      : "intimate"
  ) as CreativeDirectionId;

  const originalNarrative = concept.narrative ?? {
    whatItIs: concept.summary || concept.positioning,
    whoItServes: concept.positioning,
    howItWorks: concept.positioning,
    distinctive: concept.summary || concept.positioning,
    inspiredBy: concept.culturalInfluences
      .map((e) => `${e.name} (${e.category})`)
      .join(" · "),
    evidenceBoundary:
      "Original concept narrative lacked structured fields; treated as prior hypothesis text.",
  };

  // Influence-sensitive rewrite — may throw INSUFFICIENT_DIFFERENTIATION.
  const transform = transformConceptForMutation({
    interpreted,
    directionId,
    originalTitle: concept.title,
    originalNarrative,
    outgoing,
    incoming,
    retainedInfluences,
    modeLabel: options.mutationRequest.mode,
  });

  // Deterministic evidence IDs (same inputs → same IDs).
  const mutEvidenceId = `ev-agent-mut-${stableId(concept.id, outgoing.id, incoming.id)}`;
  const hypEvidenceId = `ev-agent-mut-hyp-${stableId(concept.id, outgoing.id, incoming.id)}`;
  const createdAt = new Date().toISOString();

  const mutEvidence: EvidenceItem = {
    id: mutEvidenceId,
    source:
      options.mutationRequest.mode === "live" ? "agent_hypothesis" : "mock_demo",
    label: "Agent mutation variant",
    detail: `Replaced “${outgoing.name}” (${outgoing.category}) with “${incoming.name}” (${incoming.category}). Lens ${transform.outgoingLens} → ${transform.incomingLens}. Provenance of the replacement entity must be read from linked evidence.`,
    relatedEntityIds: newInfluences.map((e) => e.id),
    createdAt,
  };

  const hypEvidence: EvidenceItem = {
    id: hypEvidenceId,
    source: "agent_hypothesis",
    label: "Influence-sensitive positioning rewrite",
    detail: transform.diffs
      .filter((d) => d.changed)
      .map((d) => `[${d.field}] ${d.why}`)
      .join(" "),
    relatedEntityIds: [incoming.id],
    createdAt,
  };

  const incomingEvidenceIds = [...evidence, ...extraEvidence]
    .filter((e) => e.relatedEntityIds?.includes(incoming!.id))
    .map((e) => e.id);

  const claims: ConceptClaim[] = [
    {
      id: `claim-mut-ref-${incoming.id.slice(0, 8)}`,
      statement: `Cultural anchor after mutation: “${incoming.name}” (${incoming.category}) replaces “${outgoing.name}” (${outgoing.category}).`,
      evidenceIds:
        incomingEvidenceIds.length > 0
          ? incomingEvidenceIds
          : [mutEvidence.id, ...extraEvidence.map((e) => e.id)],
      kind: "cultural_reference",
    },
    {
      id: `claim-mut-pos`,
      statement: `Creative interpretation: ${transform.narrative.whatItIs} Mechanics: ${transform.narrative.howItWorks}`,
      evidenceIds: [hypEvidence.id, mutEvidence.id],
      kind: "positioning_hypothesis",
    },
    ...transform.diffs
      .filter((d) => d.changed && d.field !== "inspiration")
      .slice(0, 3)
      .map((d, i) => ({
        id: `claim-mut-diff-${d.field}-${i}`,
        statement: `Field “${d.field}” changed (${d.basis}): ${d.why}`,
        evidenceIds: [hypEvidence.id, mutEvidence.id],
        kind: "positioning_hypothesis" as const,
      })),
  ];

  for (const claim of claims) {
    if (!claim.evidenceIds.length) {
      throw new AgentError(
        "CLAIM_UNGROUNDED",
        "Mutation produced an ungrounded cultural claim.",
      );
    }
  }

  // Preserve user's objective/category — never rewrite outputCategory from mutation.
  if (concept.outputCategory !== interpreted.outputCategory) {
    throw new AgentError(
      "VALIDATION",
      "Mutation refused to alter the user's output category.",
    );
  }

  // Keep ConceptSpec compatible: remap replaced influence, refresh narrative fields.
  const remappedSpec =
    concept.spec != null
      ? {
          ...concept.spec,
          name: transform.title,
          proposition: transform.narrative.whatItIs,
          audience: transform.narrative.whoItServes.split(" Context:")[0]!.trim(),
          mechanics: transform.narrative.howItWorks,
          differentiationHypothesis: transform.narrative.distinctive,
          evidenceBoundary: transform.narrative.evidenceBoundary,
          frozenObjective: interpreted.rawObjective,
          frozenOutputCategory: interpreted.outputCategory,
          influenceMap: newInfluences.map((e) => {
            const prior = concept.spec!.influenceMap.find(
              (m) => m.entityId === e.id || m.entityId === outgoing.id,
            );
            return {
              entityId: e.id,
              entityName: e.name,
              category: e.category,
              role:
                e.id === incoming!.id
                  ? prior?.role ?? ("texture" as const)
                  : prior?.role ?? ("texture" as const),
              signalsUsed: e.tags.slice(0, 3),
            };
          }),
          journey: concept.spec.journey.map((step) => ({
            ...step,
            influenceEntityIds: step.influenceEntityIds.map((id) =>
              id === outgoing.id ? incoming!.id : id,
            ),
          })),
          rationales: concept.spec.rationales.map((r) => ({
            ...r,
            influenceEntityId:
              r.influenceEntityId === outgoing.id
                ? incoming!.id
                : r.influenceEntityId,
            attributeOrSignal:
              r.influenceEntityId === outgoing.id
                ? incoming!.tags[0] ?? incoming!.category
                : r.attributeOrSignal,
            creativeInterpretation:
              r.influenceEntityId === outgoing.id
                ? `After mutation, “${incoming!.name}” (${incoming!.category}) supplies this signal instead of “${outgoing.name}”.`
                : r.creativeInterpretation,
          })),
          mechanicFingerprint: `${concept.spec.mechanicFingerprint}|mut:${incoming.category}:${incoming.tags[0] ?? incoming.id}`,
        }
      : undefined;

  const base: EvaluatedConcept = {
    ...concept,
    id: `${concept.id}-mut-${stableId(outgoing.id, incoming.id).slice(0, 12)}`,
    title: transform.title,
    parentConceptId: concept.id,
    mutationNote: transform.mutationNote,
    mutationDiffs: transform.diffs,
    culturalInfluences: newInfluences,
    evidenceIds: unique([
      ...concept.evidenceIds,
      mutEvidence.id,
      hypEvidence.id,
      ...extraEvidence.map((e) => e.id),
    ]),
    positioning: composePositioning(transform.narrative),
    summary: transform.narrative.whatItIs,
    narrative: transform.narrative,
    spec: remappedSpec,
    outputCategory: interpreted.outputCategory,
    directionId,
    claims,
    affinityIds:
      "affinityIds" in concept && Array.isArray(concept.affinityIds)
        ? concept.affinityIds
        : [],
    evaluation: {
      relevance: 0,
      originality: 0,
      evidenceCoverage: 0,
      overall: 0,
      notes: [],
    },
  };

  const mutated = evaluateSingleConcept({
    concept: base,
    interpreted,
    totalEntityCount: availableEntities.length,
  });

  return {
    mutated,
    evidence: [...evidence, ...extraEvidence, mutEvidence, hypEvidence],
  };
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}

/** Stable non-cryptographic id fragment for deterministic evidence/concept ids. */
function stableId(...parts: string[]): string {
  const raw = parts.join("::");
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
