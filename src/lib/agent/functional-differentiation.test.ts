import { describe, expect, it } from "vitest";
import { assessFunctionalDifferentiation } from "./functional-differentiation";
import { proposeFunctionalMechanism } from "./functional-mechanism";
import { proposeCulturalTransfer } from "./cultural-transfer";

describe("P9.205 functional differentiation", () => {
  const wood = proposeCulturalTransfer(
    "Scandinavian Woodworking Studio",
    "woodworking",
    "support structure",
  );

  it("requires comparison for a proposed chair mechanism", () => {
    const mechanism = proposeFunctionalMechanism(
      "chair",
      [wood],
      "Design a chair for different desk heights",
    );

    const result = assessFunctionalDifferentiation("chair", mechanism);

    expect(result.status).toBe("comparison_required");
    expect(result.baseline).toMatch(/existing comparable chair/i);
    expect(result.proposedDifference).toMatch(/seat-height adjustment/i);
    expect(result.measurementPlan).toMatch(/adjustment time/i);
    expect(result.competitiveEvidence).toBe("not_established");
    expect(result.performanceEvidence).toBe("not_established");
    expect(result.noveltyClaimAllowed).toBe(false);
  });

  it("does not claim differentiation for a generic chair", () => {
    const mechanism = proposeFunctionalMechanism(
      "chair",
      [wood],
      "Design a Moroccan-Scandinavian chair",
    );

    const result = assessFunctionalDifferentiation("chair", mechanism);

    expect(result.status).toBe("insufficient_evidence");
    expect(result.noveltyClaimAllowed).toBe(false);
    expect(result.conclusion).not.toMatch(/demonstrated improvement/i);
  });
});
