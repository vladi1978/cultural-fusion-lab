import type { FusionConcept, ExplorationResult } from "@/lib/types";
import type { CausalConceptDraft } from "./types";
import { validateCausalDraft } from "./types";

export function generateCausalDraftFromConcept(
  concept: FusionConcept,
  exploration: ExplorationResult,
): CausalConceptDraft | null {
  const spec = concept.spec;
  if (!spec) return null;

  const influences = concept.culturalInfluences.filter(entity =>
    exploration.entities.some(item => item.id === entity.id),
  );

  const observations = influences
    .map(entity => {
      const rationale = spec.rationales.find(
        item => item.influenceEntityId === entity.id,
      );
      const evidenceIds = exploration.evidence
        .filter(item => item.relatedEntityIds?.includes(entity.id) === true)
        .map(item => item.id);

      return {
        entityId: entity.id,
        signal: rationale?.attributeOrSignal ||
          spec.influenceMap.find(item => item.entityId === entity.id)
            ?.signalsUsed[0] ||
          "",
        evidenceIds,
      };
    })
    .filter(item => item.signal && item.evidenceIds.length > 0)
    .slice(0, 2);

  if (observations.length < 2) return null;

  const rule = spec.operatingRules?.[0];
  const firstStep = spec.journey[0];

  const optionA = "Test the proposed operating mechanism";
  const optionB = "Test a simplified baseline without that mechanism";

  const mechanism = spec.mechanics.trim();
  if (!mechanism) return null;

  const draft: CausalConceptDraft = {
    id: `causal-concept-${concept.id}`,
    opportunityId: spec.opportunityId || concept.id,
    outputCategory: concept.outputCategory,
    observations,
    opportunityHypothesis: spec.proposition,
    action: {
      actor: firstStep?.actor || spec.audience,
      verb: "evaluate",
      object: spec.name,
      observableResult: "Compare observed pilot outcomes against a baseline.",
    },
    decision: {
      actor: firstStep?.actor || spec.audience,
      question: `Should ${spec.name} use its proposed operating mechanism?`,
      options: [optionA, optionB],
      consequencesByOption: {
        [optionA]: `Pilot tests the proposed mechanism: ${mechanism}`,
        [optionB]: `Pilot tests a simplified baseline without the proposed mechanism.`,
      },
    },
    constraint: {
      rule: rule?.rule || "Pilot outcomes must remain explicitly unverified.",
      enforcement: "Do not present simulated results as validated evidence.",
    },
    consequence: `The experiment compares two design conditions for ${spec.name}.`,
    causalExplanation: `The hypothesis is that the proposed mechanism (${mechanism}) changes observable pilot behavior relative to a baseline. This remains unverified.`,
    differentiationHypothesis: spec.differentiationHypothesis,
    pilotExperiment: spec.pilotExperiment,
    evidenceBoundary: spec.evidenceBoundary,
  };

  return validateCausalDraft(draft).valid ? draft : null;
}
