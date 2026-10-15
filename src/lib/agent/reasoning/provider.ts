/**
 * ReasoningProvider — typed interface for opportunity intelligence.
 * Deterministic implementation ships now; model-based provider is reserved.
 * Keep Qloo adapters independent from this interface.
 */

import type { InterpretedObjective } from "../types";
import type {
  CulturalSignalGraph,
  OpportunityHypothesis,
  ReasoningContext,
} from "../opportunity-types";

export type ReasoningProviderId = "deterministic" | "model_reserved";

export interface ReasoningProvider {
  readonly id: ReasoningProviderId;

  buildSignalGraph(context: ReasoningContext): CulturalSignalGraph;

  /**
   * Propose opportunity hypotheses from the graph.
   * Output may include candidates that later fail opportunity gates.
   */
  proposeOpportunities(options: {
    graph: CulturalSignalGraph;
    interpreted: InterpretedObjective;
  }): OpportunityHypothesis[];

  /**
   * Accept / reject / downgrade proposals. Must not invent evidence.
   */
  gateOpportunities(options: {
    opportunities: OpportunityHypothesis[];
    interpreted: InterpretedObjective;
    graph: CulturalSignalGraph;
  }): OpportunityHypothesis[];
}
