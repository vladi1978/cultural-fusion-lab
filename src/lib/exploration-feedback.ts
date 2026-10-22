/** Non-technical, actionable messages for known evidence/quality outcomes. */
export type ExplorationFeedback = {
  heading: string;
  explanation: string;
  suggestion: string;
  diagnostic?: string;
};

export function classifyExplorationOutcome(code: unknown, mode: "demo" | "live"): ExplorationFeedback | null {
  const source = mode === "demo" ? "fictional Demo Mode dataset" : "available source data";
  switch (code) {
    case "CREATIVE_QUALITY_REJECTED":
      return {
        heading: "Concept did not pass quality review",
        explanation: "The AI generated a proposal, but it did not demonstrate the required operational transfer between the cultural traditions. The proposal was rejected rather than presented as a validated concept.",
        suggestion: "Revise the brief to specify the intended participants, operating constraints, and the role each cultural tradition must play.",
      };
    case "AGENT_EMPTY_EVIDENCE":
      return {
        heading: "Not enough cultural evidence",
        explanation: `The ${source} does not contain enough usable cultural references for this brief. No concepts were invented to fill the gap.`,
        suggestion: "Refine the cultural interest or try another brief. This does not mean the idea lacks real-world potential.",
      };
    case "AGENT_IRRELEVANT_EVIDENCE":
      return {
        heading: "Cultural references could not be supported",
        explanation: `The ${source} did not sufficiently match the requested cultural interest. Unrelated entities were not used as proof.`,
        suggestion: "Try a different cultural interest supported by the available dataset, or revise the brief.",
      };
    case "AGENT_INSUFFICIENT_QUALITY":
    case "AGENT_INSUFFICIENT_DIFFERENTIATION":
      return {
        heading: "No concepts met the quality standard",
        explanation: "Candidate concepts were evaluated, but none passed the required quality or differentiation checks. This alone does not establish that cultural evidence was missing.",
        suggestion: "Refine the objective or cultural interest and run a new exploration. The system will not substitute weak concepts.",
      };
    default:
      return null;
  }
}
