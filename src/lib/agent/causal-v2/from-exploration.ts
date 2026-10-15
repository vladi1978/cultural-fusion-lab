import type { CulturalEntity, EvidenceItem } from "../../types";
import type { InterpretedObjective } from "../types";
import type { OpportunityHypothesis } from "../opportunity-types";
import type { CausalConceptDraft } from "./types";
import { generateCausalDraft } from "./generate";

export interface CausalExplorationInput {
  opportunities: OpportunityHypothesis[];
  entities: CulturalEntity[];
  interpreted: InterpretedObjective;
  evidence?: EvidenceItem[];
}

export function generateCausalDraftsFromExploration(
  input: CausalExplorationInput,
): CausalConceptDraft[] {
  const drafts: CausalConceptDraft[] = [];
  const seen = new Set<string>();

  for (const opportunity of input.opportunities) {
    if (opportunity.status !== "accepted") continue;

    const draft = generateCausalDraft({
      opportunity,
      influences: input.entities,
      interpreted: input.interpreted,
      evidence: input.evidence,
    });

    if (!draft || seen.has(draft.opportunityId)) continue;

    seen.add(draft.opportunityId);
    drafts.push(draft);
  }

  return drafts;
}
