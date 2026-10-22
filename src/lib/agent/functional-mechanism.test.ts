import { describe, expect, it } from "vitest";
import { proposeCulturalTransfer } from "./cultural-transfer";
import { proposeFunctionalMechanism } from "./functional-mechanism";

describe("P9.166 functional mechanism generation", () => {
  const ceramic = proposeCulturalTransfer(
    "Moroccan Artisan Studio",
    "ceramic",
    "lamp base",
  );

  const textile = proposeCulturalTransfer(
    "Nordic Textile Design",
    "textile",
    "lamp shade",
  );

  it("proposes a physical interaction and measurable effect", () => {
    const result = proposeFunctionalMechanism(
      "table lamp",
      [ceramic, textile],
      "Design a table lamp to reduce glare",
    );

    expect(result.status).toBe("proposed");
    expect(result.origin).toBe("engineering_hypothesis");
    expect(result.functionalEvidence).toBe("not_established");
    expect(result.mechanism).toMatch(/removable/i);
    expect(result.userAction).toMatch(/exchange/i);
    expect(result.measurableEffect).toMatch(/light distribution/i);
    expect(result.verification).toMatch(/safety/i);
  });

  it("proposes a measurable organizer tray mechanism", () => {
    const result = proposeFunctionalMechanism(
      "organizer tray",
      [
        proposeCulturalTransfer(
          "Moroccan Artisan Studio",
          "ceramic",
          "tray body",
        ),
      ],
      "Create an organizer tray for objects of different sizes",
    );

    expect(result.status).toBe("proposed");
    expect(result.origin).toBe("engineering_hypothesis");
    expect(result.functionalEvidence).toBe("not_established");
    expect(result.mechanism).toMatch(/repositionable internal dividers/i);
    expect(result.userAction).toMatch(/move the dividers/i);
    expect(result.measurableEffect).toMatch(/retrieval time/i);
    expect(result.verification).toMatch(/existing adjustable organizers/i);
  });

  it("does not invent a functional need from cultural materials", () => {
    const result = proposeFunctionalMechanism(
      "table lamp",
      [ceramic, textile],
      "Create a Moroccan-Scandinavian ceramic table lamp",
    );

    expect(result.status).toBe("insufficient_evidence");
    expect(result.origin).toBe("not_established");
    expect(result.functionalEvidence).toBe("not_established");
  });

  it("rejects unsupported functional mechanisms", () => {
    const result = proposeFunctionalMechanism(
      "planter",
      [ceramic, textile],
    );

    expect(result.status).toBe("insufficient_evidence");
    expect(result.origin).toBe("not_established");
    expect(result.functionalEvidence).toBe("not_established");
    expect(result.mechanism).not.toMatch(/removable textile/i);
  });

  it("requires both compatible design contributions", () => {
    const result = proposeFunctionalMechanism(
      "table lamp",
      [ceramic],
    );

    expect(result.status).toBe("insufficient_evidence");
    expect(result.origin).toBe("not_established");
    expect(result.functionalEvidence).toBe("not_established");
  });
});


describe("P9.202 chair functional mechanism", () => {
  const structural = proposeCulturalTransfer(
    "Scandinavian Woodworking Studio",
    "woodworking",
    "support structure",
  );

  it("proposes a testable mechanism for an explicit height need", () => {
    const result = proposeFunctionalMechanism(
      "chair",
      [structural],
      "Design a chair for different desk heights",
    );

    expect(result.status).toBe("proposed");
    expect(result.origin).toBe("engineering_hypothesis");
    expect(result.functionalEvidence).toBe("not_established");
    expect(result.mechanism).toMatch(/locking seat-height adjustment/i);
    expect(result.measurableEffect).toMatch(/adjustment time/i);
    expect(result.verification).toMatch(/structural loading/i);
    expect(result.verification).toMatch(/existing height-adjustable chairs/i);
  });

  it("does not invent height adjustment for a generic chair", () => {
    const result = proposeFunctionalMechanism(
      "chair",
      [structural],
      "Design a Moroccan-Scandinavian chair",
    );

    expect(result.status).toBe("insufficient_evidence");
  });

  it("keeps engineering hypotheses independent of cultural material evidence", () => {
    const textile = proposeCulturalTransfer(
      "Nordic Textile Design",
      "textile",
      "seat upholstery",
    );

    const result = proposeFunctionalMechanism(
      "chair",
      [textile],
      "Design a chair for different desk heights",
    );

    expect(result.status).toBe("proposed");
    expect(result.origin).toBe("engineering_hypothesis");
    expect(result.functionalEvidence).toBe("not_established");
    expect(result.verification).toMatch(/test|prototype/i);
  });
});
