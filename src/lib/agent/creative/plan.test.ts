import { describe, expect, it } from "vitest";
import { planCreativeSearches } from "./plan";
import type { CreativeFrame } from "./types";
import type { InterpretedObjective } from "../types";

describe("objective-first search plan", () => {
  it("uses practice probes rather than a raw interest as the Qloo query", () => {
    const interpreted: InterpretedObjective = {rawObjective:"Explore forest bathing and sauna",culturalInterest:"Japanese Shinrin-yoku and Nordic sauna",outputCategory:"experience",intentTokens:[],themes:[],summary:"wellness"};
    const frame: CreativeFrame = {sourceDomains:[{name:"Shinrin-yoku",origin:"Japan",essence:"sensory nature attention",coreMechanics:["slow walking","sensory focus"]}],experientialGoals:["reduce stress"],requirements:["participant choices"],offBrief:["synthwave theme"],evidenceProbes:[{query:"forest bathing",entityType:"urn:entity:place",why:"nature"},{query:"sauna",entityType:"urn:entity:brand",why:"sauna"}]};
    const plan=planCreativeSearches(interpreted,frame);
    expect(plan.searches.map(s=>s.query)).toEqual(["forest bathing","sauna"]);
    expect(plan.tagQuery).toBeUndefined();
  });
});
