import type { CulturalTransfer } from "./cultural-transfer";

export interface FunctionalInnovation {
  status: "candidate" | "insufficient_evidence";
  hypothesis: string;
  prototypeTest: string;
}

export function proposeFunctionalInnovation(
  object: string,
  transfers: readonly CulturalTransfer[],
): FunctionalInnovation {
  const supported = transfers.filter(
    (transfer) => transfer.status === "hypothesis",
  );

  if (!object.trim() || supported.length < 2) {
    return {
      status: "insufficient_evidence",
      hypothesis:
        "No functional innovation established from the available transfers.",
      prototypeTest:
        "Obtain two independently justified design contributions before testing a combined prototype.",
    };
  }

  const [first, second] = supported;

  if (
    first.source.trim() === second.source.trim() ||
    first.designDecision === second.designDecision
  ) {
    return {
      status: "insufficient_evidence",
      hypothesis:
        "The proposed contributions are not sufficiently independent.",
      prototypeTest:
        "Identify distinct sources and design decisions.",
    };
  }

  return {
    status: "insufficient_evidence",
    hypothesis:
      `A combined ${object} prototype is possible: ` +
      `${first.designDecision} ${second.designDecision} ` +
      "These contributions establish design variation, not a demonstrated new function or functional innovation.",
    prototypeTest:
      `Compare a conventional ${object} with the combined prototype. ` +
      "Identify a specific functional difference, measure usability and durability, " +
      "and investigate existing comparable products before making any innovation claim.",
  };
}
