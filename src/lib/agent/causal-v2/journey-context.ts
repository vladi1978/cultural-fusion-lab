import type {
  ExplorationResult,
  FusionConcept,
} from "@/lib/types";

export interface CreativeJourneyContext {
  version: 2;
  exploration: ExplorationResult;
  selectedConceptId: string | null;
}

export interface ResolvedJourneyContext {
  exploration: ExplorationResult;
  concept: FusionConcept;
}

export function resolveJourneyContext(
  context: CreativeJourneyContext,
): ResolvedJourneyContext {
  if (context.version !== 2) {
    throw new Error("Unsupported Creative Journey context version.");
  }

  const { exploration, selectedConceptId } = context;

  if (!exploration || !Array.isArray(exploration.concepts)) {
    throw new Error("Invalid exploration context.");
  }

  if (!selectedConceptId) {
    throw new Error("No concept selected for Creative Journey.");
  }

  const concept = exploration.concepts.find(
    item => item.id === selectedConceptId,
  );

  if (!concept) {
    throw new Error("Selected concept does not belong to this exploration.");
  }

  if (concept.outputCategory !== exploration.request.outputCategory) {
    throw new Error("Concept category does not match exploration request.");
  }

  return { exploration, concept };
}
