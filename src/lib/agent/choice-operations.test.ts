import { describe, expect, it } from "vitest";
import { deriveChoiceOperations } from "./choice-operations";
describe("P10.23-B explicit choice operations",()=>{
  it("creates distinct observable effects for explicit dimensions",()=>{
    const x=deriveChoiceOperations("Participants should make choices that change sequence, intensity and social dynamics.");
    expect(x?.journey).toHaveLength(3);
    expect(x?.mechanics).toContain("sequence");
    expect(x?.mechanics).toContain("intensity");
    expect(x?.mechanics).toContain("social dynamics");
  });
  it("does not invent interactivity for descriptive briefs",()=>{
    expect(deriveChoiceOperations("A cultural wellness exhibition.")).toBeNull();
  });
  it("does not invent dimensions when none are specified",()=>{
    expect(deriveChoiceOperations("Visitors choose things that change outcomes.")).toBeNull();
  });
});
