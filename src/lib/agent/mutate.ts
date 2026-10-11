import type { CulturalEntity, EvidenceItem, FusionConcept } from "../types";
import { evaluateSingleConcept } from "./evaluate";
import type {
  ConceptClaim,
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

  const now = new Date().toISOString();
  const mutEvidence: EvidenceItem = {
    id: `ev-agent-mut-${Date.now()}`,
    source:
      options.mutationRequest.mode === "live" ? "agent_hypothesis" : "mock_demo",
    label: "Agent mutation variant",
    detail: `Replaced “${outgoing.name}” with “${incoming.name}”. Provenance of the replacement entity must be read from linked evidence — mutation narrative remains a hypothesis.`,
    relatedEntityIds: newInfluences.map((e) => e.id),
    createdAt: now,
  };

  const hypEvidence: EvidenceItem = {
    id: `ev-agent-mut-hyp-${Date.now()}`,
    source: "agent_hypothesis",
    label: "Variant positioning shift",
    detail: `Hypothesis: introducing ${incoming.name} (${incoming.category}) reframes the concept. Not a predictive claim.`,
    relatedEntityIds: [incoming.id],
    createdAt: now,
  };

  const incomingEvidenceIds = [...evidence, ...extraEvidence]
    .filter((e) => e.relatedEntityIds?.includes(incoming!.id))
    .map((e) => e.id);

  const claims: ConceptClaim[] = [
    {
      id: `claim-mut-ref-${incoming.id.slice(0, 8)}`,
      statement: `Cultural anchor after mutation: “${incoming.name}” (${incoming.category}) replaces “${outgoing.name}”.`,
      evidenceIds:
        incomingEvidenceIds.length > 0
          ? incomingEvidenceIds
          : [mutEvidence.id, ...extraEvidence.map((e) => e.id)],
      kind: "cultural_reference",
    },
    {
      id: `claim-mut-pos`,
      statement: `Positioning hypothesis updated around ${incoming.name}.`,
      evidenceIds: [hypEvidence.id, mutEvidence.id],
      kind: "positioning_hypothesis",
    },
  ];

  for (const claim of claims) {
    if (!claim.evidenceIds.length) {
      throw new AgentError(
        "CLAIM_UNGROUNDED",
        "Mutation produced an ungrounded cultural claim.",
      );
    }
  }

  const base: EvaluatedConcept = {
    ...concept,
    id: `${concept.id}-mut-${incoming.id.slice(0, 8)}`,
    title: `${concept.title} · ${incoming.name.split(" ")[0]} Variant`,
    parentConceptId: concept.id,
    mutationNote: `Swapped ${outgoing.name} → ${incoming.name}`,
    culturalInfluences: newInfluences,
    evidenceIds: unique([
      ...concept.evidenceIds,
      mutEvidence.id,
      hypEvidence.id,
      ...extraEvidence.map((e) => e.id),
    ]),
    positioning: `${concept.positioning} Mutation emphasizes ${incoming.name} as the new cultural hinge.`,
    summary: `Variant of “${concept.title}” with ${incoming.name} replacing ${outgoing.name}.`,
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
