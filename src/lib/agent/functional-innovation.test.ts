import { describe, expect, it } from "vitest";
import { proposeCulturalTransfer } from "./cultural-transfer";
import { proposeFunctionalInnovation } from "./functional-innovation";

describe("P9.162 functional innovation hypotheses", () => {
  it("creates a testable candidate from two distinct contributions", () => {
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

    const result = proposeFunctionalInnovation(
      "table lamp",
      [ceramic, textile],
    );

    expect(result.status).toBe("insufficient_evidence");
    expect(result.hypothesis).toMatch(/not a demonstrated new function/i);
    expect(result.hypothesis).toContain("lamp base");
    expect(result.hypothesis).toContain("lamp shade");
    expect(result.hypothesis).toMatch(
      /not a demonstrated new function or functional innovation/i,
    );
    expect(result.prototypeTest).toMatch(/conventional/i);
    expect(result.prototypeTest).toMatch(
      /investigate existing comparable products/i,
    );
  });

  it("does not invent innovation from one unsupported contribution", () => {
    const ceramic = proposeCulturalTransfer(
      "Moroccan Artisan Studio",
      "ceramic",
      "plant container",
    );
    const textile = proposeCulturalTransfer(
      "Nordic Textile Design",
      "textile",
      "drainage provision",
    );

    const result = proposeFunctionalInnovation(
      "planter",
      [ceramic, textile],
    );

    expect(result.status).toBe("insufficient_evidence");
    expect(result.hypothesis).not.toMatch(/improved|proven/i);
  });
});
