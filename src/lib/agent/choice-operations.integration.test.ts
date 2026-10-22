import { describe, expect, it } from "vitest";
import { enrichChoiceDependentExperience } from "./choice-operations";
import type { ConceptSpec } from "../types";

const objective="Design an interactive wellness experience that helps urban professionals disconnect from digital stress through Japanese forest bathing principles and Nordic sauna rituals. Participants should make meaningful choices that change the sequence, intensity, and social dynamics of the experience.";
function fixture(): ConceptSpec {
  return {
    frozenObjective: objective, frozenOutputCategory: "experience",
    mechanics: "A guided cultural experience.",
    journey: [
      {id:"step-1", actor:"Host", action:"Guide a stage.", influenceEntityIds:["observed-1"]},
      {id:"step-2", actor:"Host", action:"Guide another stage.", influenceEntityIds:["observed-2"]},
      {id:"step-3", actor:"Host", action:"Guide final stage.", influenceEntityIds:["observed-1"]},
    ],
    pilotExperiment: "Test the stages.",
  } as ConceptSpec;
}
describe("P10.23-C shared post-synthesis enrichment",()=>{
  it("preserves cultural bindings and step identities while making choices consequential",()=>{
    const input=fixture();
    const result=enrichChoiceDependentExperience(objective,input);
    expect(result.journey.map(s=>s.id)).toEqual(input.journey.map(s=>s.id));
    expect(result.journey.map(s=>s.influenceEntityIds)).toEqual(input.journey.map(s=>s.influenceEntityIds));
    expect(result.journey.map(s=>s.action).join(" ")).toMatch(/sequence|stage first/);
    expect(result.journey.map(s=>s.action).join(" ")).toContain("intensity");
    expect(result.journey.map(s=>s.action).join(" ")).toContain("solo");
    expect(result.mechanics).toContain("urban professionals");
    expect(result.mechanics).toContain("digital stress");
    expect(input.journey[0].action).toBe("Guide a stage.");
  });
  it("does not add branches to a non-interactive brief",()=>{
    const spec=fixture();
    expect(enrichChoiceDependentExperience("A cultural exhibition.",spec)).toBe(spec);
  });
  it("does not launder unbound steps into supported ones",()=>{
    const spec=fixture(); spec.journey[0].influenceEntityIds=[];
    expect(enrichChoiceDependentExperience(objective,spec)).toBe(spec);
  });
});
