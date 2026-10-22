import { describe, expect, it } from "vitest";
import { assessCreativeFidelity } from "./fidelity";
import type { CreativeFrame } from "./types";
import type { ConceptSpec } from "../../types";
const frame: CreativeFrame = {
 sourceDomains:[
  {name:"Shinrin-yoku",origin:"Japan",essence:"nature",coreMechanics:["slow sensory attention","guided forest observation"]},
  {name:"Nordic sauna",origin:"Nordic countries",essence:"thermal recovery",coreMechanics:["heat cooling cycles","rest between sauna rounds"]}],
 experientialGoals:["reduce stress"], requirements:["Choices change sequence, intensity, and social dynamics"],
 offBrief:["Generic music festival","Clothing customization"],evidenceProbes:[]
};
const spec = (mechanics:string, action:string, proposition="Wellness experience"): ConceptSpec => ({
 name:"Test",proposition,audience:"urban professionals",context:"Seattle",mechanics,
 journey:[{id:"1",actor:"guest",action,influenceEntityIds:[]}],influenceMap:[],
 differentiationHypothesis:"test",feasibilityAssumptions:[],risksAndUnknowns:[],pilotExperiment:"pilot",evidenceBoundary:"demo",rationales:[],
 frozenObjective:"test",frozenOutputCategory:"experience",mechanicFingerprint:"test",mechanismId:"test"
});
describe("Creative Fidelity Gate (heuristic, not semantic proof)",()=>{
 it("rejects music/retail drift even with cultures named in proposition",()=>{
  const r=assessCreativeFidelity(frame,spec("Listen to synthwave while customizing apparel", "Walk through a music gallery", "Shinrin-yoku and Nordic sauna"));
  expect(r.accepted).toBe(false); expect(r.failures.some(x=>x.includes("Shinrin-yoku"))).toBe(true);expect(r.failures.some(x=>x.includes("Nordic sauna"))).toBe(true);
 });
 it("rejects missing participant decisions and choice dimensions",()=>{
  const r=assessCreativeFidelity(frame,spec("Slow sensory attention then heat cooling cycles", "Walk to the forest and rest between sauna rounds"));
  expect(r.accepted).toBe(false);expect(r.failures.some(x=>x.includes("choice"))).toBe(true);
 });
 it("rejects explicit off-brief content",()=>{
  const r=assessCreativeFidelity(frame,spec("Generic music festival with slow sensory attention, heat cooling cycles; choose sequence, intensity and social setting", "Choose forest route and sauna round"));
  expect(r.failures.some(x=>x.includes("off-brief"))).toBe(true);
 });
 it("accepts a candidate with both practices and operating choice dimensions",()=>{
  const r=assessCreativeFidelity(frame,spec("Choose sequence of slow sensory attention and heat cooling cycles; select intensity and social format", "Choose a guided forest observation route, then rest between sauna rounds"));
  expect(r).toEqual({accepted:true,failures:[]});
 });
});
