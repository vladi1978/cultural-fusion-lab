import { describe, expect, it } from "vitest";
import { classifyExplorationOutcome } from "./exploration-feedback";

describe("P10.22 exploration outcomes", () => {
  it("presents rejected creative composition as quality feedback", () => {
    const result = classifyExplorationOutcome("CREATIVE_QUALITY_REJECTED", "demo");
    expect(result?.heading).toContain("quality");
    expect(result?.explanation).toContain("operational transfer");
    expect(result?.suggestion).toBeTruthy();
  });

  it("distinguishes evidence gaps from quality rejection", () => {
    const evidence = classifyExplorationOutcome("AGENT_IRRELEVANT_EVIDENCE", "demo");
    const quality = classifyExplorationOutcome("AGENT_INSUFFICIENT_QUALITY", "demo");
    expect(evidence?.heading).toContain("Cultural");
    expect(evidence?.explanation).toContain("fictional Demo Mode dataset");
    expect(quality?.heading).toContain("quality");
    expect(quality?.explanation).toContain("does not establish");
  });
  it("does not disguise server failures as expected outcomes", () => {
    expect(classifyExplorationOutcome("QLOO_UPSTREAM", "demo")).toBeNull();
    expect(classifyExplorationOutcome(undefined, "demo")).toBeNull();
  });
  it("distinguishes live provenance wording", () => {
    expect(classifyExplorationOutcome("AGENT_EMPTY_EVIDENCE", "live")?.explanation).toContain("available source data");
  });
});
