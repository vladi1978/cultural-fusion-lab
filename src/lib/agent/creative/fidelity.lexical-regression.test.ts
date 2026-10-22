import { describe, expect, it } from "vitest";
import { assessCreativeFidelity } from "./fidelity";
import type { CreativeFrame } from "./types";
import type { ConceptSpec } from "../../types";
const frame: CreativeFrame = {sourceDomains:[
 {name:"Oral history",origin:"test",essence:"test",coreMechanics:["intergenerational interviewing","narrative verification"]},
 {name:"Interactive learning",origin:"test",essence:"test",coreMechanics:["branching scenarios","learner feedback"]}],
 experientialGoals:[],requirements:[],offBrief:[],evidenceProbes:[]};
const candidate = (mechanics:string,action:string):ConceptSpec => ({
 name:"Test",proposition:"Test",audience:"users",context:"test",mechanics,
 journey:[{id:"1",actor:"participant",action,influenceEntityIds:[]}],
 influenceMap:[],rationales:[],differentiationHypothesis:"test",feasibilityAssumptions:[],risksAndUnknowns:[],
 pilotExperiment:"test",evidenceBoundary:"test",mechanicFingerprint:"test",mechanismId:"test",
 frozenObjective:"test",frozenOutputCategory:"experience"});
describe("Fidelity multi-token mechanism regression",()=>{
 it("rejects isolated buzzwords",()=>{
  const result=assessCreativeFidelity(frame,candidate("Sell narrative-branded merchandise with branching discounts","Customer chooses a discount"));
  expect(result.accepted).toBe(false);
  expect(result.failures).toHaveLength(2);
 });
 it("preserves fully expressed practices",()=>{
  const result=assessCreativeFidelity(frame,candidate("Use intergenerational interviewing and branching scenarios","Verify narratives through narrative verification and collect learner feedback"));
  expect(result.accepted).toBe(true);
 });
});
