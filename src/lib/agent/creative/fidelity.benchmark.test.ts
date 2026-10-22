import { describe, expect, it } from "vitest";
import { assessCreativeFidelity } from "./fidelity";
import type { CreativeFrame } from "./types";
import type { ConceptSpec } from "../../types";

type Case = {
  id: string; family: string; expected: boolean; reason: string;
  domains: Array<{ name: string; mechanics: string[] }>;
  requirements?: string[]; offBrief?: string[];
  mechanics: string; action: string; proposition?: string;
};

// Evaluation examples only: NEVER used as production rules, templates or prompts.
const cases: Case[] = [
  {id:"forest-thermal-valid",family:"wellness",expected:true,reason:"operational practices and required choices",domains:[{name:"Forest attention",mechanics:["slow sensory observation","guided attention"]},{name:"Thermal recovery",mechanics:["heat cooling cycles","rest between rounds"]}],requirements:["Choices change sequence and intensity"],mechanics:"Choose sequence and intensity for slow sensory observation and heat cooling cycles",action:"Select guided attention, then rest between rounds"},
  {id:"forest-thermal-apparel",family:"wellness",expected:false,reason:"names practices but implements clothing",domains:[{name:"Forest attention",mechanics:["slow sensory observation","guided attention"]},{name:"Thermal recovery",mechanics:["heat cooling cycles","rest between rounds"]}],mechanics:"Sell customized apparel and play ambient music",action:"Choose a shirt",proposition:"Forest attention meets thermal recovery"},
  {id:"agriculture-water-valid",family:"agriculture",expected:true,reason:"operational crop and water mechanisms",domains:[{name:"Regenerative agriculture",mechanics:["crop rotation","soil cover"]},{name:"Water stewardship",mechanics:["rainwater harvesting","moisture monitoring"]}],mechanics:"Use crop rotation and rainwater harvesting for a neighborhood farm",action:"Farmers inspect moisture monitoring readings and maintain soil cover"},
  {id:"agriculture-water-paraphrase",family:"agriculture",expected:true,reason:"semantic paraphrases should be accepted",domains:[{name:"Regenerative agriculture",mechanics:["crop rotation","soil cover"]},{name:"Water stewardship",mechanics:["rainwater harvesting","moisture monitoring"]}],mechanics:"Alternate planted species between growing seasons and collect rainfall in cisterns",action:"Growers keep the ground protected and inspect soil humidity"},
  {id:"education-heritage-valid",family:"education",expected:true,reason:"both practices implemented",domains:[{name:"Oral history",mechanics:["intergenerational interviewing","narrative verification"]},{name:"Interactive learning",mechanics:["branching scenarios","learner feedback"]}],mechanics:"Combine intergenerational interviewing with branching scenarios",action:"Students gather narrative verification and receive learner feedback"},
  {id:"education-heritage-buzzwords",family:"education",expected:false,reason:"isolated keyword overlap is not operational implementation",domains:[{name:"Oral history",mechanics:["intergenerational interviewing","narrative verification"]},{name:"Interactive learning",mechanics:["branching scenarios","learner feedback"]}],mechanics:"Sell narrative-branded merchandise with branching discounts",action:"Customer chooses a discount"},
  {id:"mobility-access-valid",family:"mobility",expected:true,reason:"transport and accessibility practices",domains:[{name:"Accessible mobility",mechanics:["step free boarding","assisted transfers"]},{name:"Transit reliability",mechanics:["arrival forecasting","service recovery"]}],mechanics:"Coordinate step free boarding with arrival forecasting",action:"Dispatchers arrange assisted transfers and service recovery"},
  {id:"mobility-access-unrelated",family:"mobility",expected:false,reason:"unrelated recommendation",domains:[{name:"Accessible mobility",mechanics:["step free boarding","assisted transfers"]},{name:"Transit reliability",mechanics:["arrival forecasting","service recovery"]}],mechanics:"Recommend collectible shoes using trending music",action:"Browse influencer photos"},
  {id:"hospitality-food-valid",family:"hospitality",expected:true,reason:"service and food processes",domains:[{name:"Community cooking",mechanics:["shared preparation","ingredient storytelling"]},{name:"Low waste hospitality",mechanics:["portion planning","surplus redistribution"]}],mechanics:"Guests participate in shared preparation and portion planning",action:"Staff lead ingredient storytelling and surplus redistribution"},
  {id:"hospitality-food-offbrief",family:"hospitality",expected:false,reason:"explicitly excluded format",domains:[{name:"Community cooking",mechanics:["shared preparation","ingredient storytelling"]},{name:"Low waste hospitality",mechanics:["portion planning","surplus redistribution"]}],offBrief:["Celebrity cooking competition"],mechanics:"Celebrity cooking competition with shared preparation and portion planning",action:"Hosts guide ingredient storytelling and surplus redistribution"},
  {id:"hospitality-food-paraphrased-offbrief",family:"hospitality",expected:false,reason:"semantic exclusion without exact phrase",domains:[{name:"Community cooking",mechanics:["shared preparation","ingredient storytelling"]},{name:"Low waste hospitality",mechanics:["portion planning","surplus redistribution"]}],offBrief:["Celebrity cooking competition"],mechanics:"Famous chefs compete for prizes using shared preparation and portion planning",action:"Hosts guide ingredient storytelling and surplus redistribution"},
  {id:"craft-energy-valid",family:"physical product",expected:true,reason:"mechanisms from two domains",domains:[{name:"Repair culture",mechanics:["replaceable modules","tool free access"]},{name:"Energy efficiency",mechanics:["adaptive dimming","low power standby"]}],mechanics:"A desk light uses replaceable modules and adaptive dimming",action:"Owners perform tool free access and verify low power standby"},
  {id:"craft-energy-wrong-category",family:"physical product",expected:false,reason:"cultural mechanics without product form",domains:[{name:"Repair culture",mechanics:["replaceable modules","tool free access"]},{name:"Energy efficiency",mechanics:["adaptive dimming","low power standby"]}],mechanics:"A guided workshop demonstrates replaceable modules and adaptive dimming",action:"Participants learn tool free access and low power standby"}
];

function evaluate(c: Case): boolean {
  const frame: CreativeFrame = {
    sourceDomains: c.domains.map(d => ({name:d.name,origin:"benchmark-only",essence:"benchmark-only",coreMechanics:d.mechanics})),
    experientialGoals:[], requirements:c.requirements ?? [],offBrief:c.offBrief ?? [],evidenceProbes:[]
  };
  const spec = {
    name:"Benchmark candidate", proposition:c.proposition ?? "Prototype", audience:"users", context:"benchmark",
    mechanics:c.mechanics,journey:[{id:"step-1",actor:"participant",action:c.action,influenceEntityIds:[]}],
    influenceMap:[],rationales:[],differentiationHypothesis:"unverified",feasibilityAssumptions:[],risksAndUnknowns:[],pilotExperiment:"small pilot",evidenceBoundary:"benchmark, not Qloo evidence",mechanicFingerprint:c.id,mechanismId:"benchmark",frozenObjective:"benchmark",frozenOutputCategory:"experience"
  } as ConceptSpec;
  return assessCreativeFidelity(frame,spec).accepted;
}

describe("domain-diverse Creative Fidelity benchmark (offline; diagnostic)", () => {
  it("measures acceptance, rejection, false acceptance and false rejection across unrelated domains", () => {
    const results=cases.map(c=>({...c,actual:evaluate(c)}));
    const tp=results.filter(c=>c.expected && c.actual).length;
    const tn=results.filter(c=>!c.expected && !c.actual).length;
    const fp=results.filter(c=>!c.expected && c.actual);
    const fn=results.filter(c=>c.expected && !c.actual);
    console.log("\nCFL BENCHMARK — DETERMINISTIC FIDELITY GATE (not autonomous creativity)");
    console.log(JSON.stringify({cases:results.length,domains:[...new Set(results.map(c=>c.family))],trueAccept:tp,trueReject:tn,falseAccept:fp.map(c=>({id:c.id,reason:c.reason})),falseReject:fn.map(c=>({id:c.id,reason:c.reason})),accuracy:(tp+tn)/results.length},null,2));
    expect(results.length).toBeGreaterThanOrEqual(12);
    expect(new Set(results.map(c=>c.family)).size).toBeGreaterThanOrEqual(5);
    expect(results.find(c=>c.id==="forest-thermal-valid")?.actual).toBe(true);
    expect(results.find(c=>c.id==="forest-thermal-apparel")?.actual).toBe(false);
    expect(results.find(c=>c.id==="hospitality-food-offbrief")?.actual).toBe(false);
    // Known gaps are reported, not disguised as passing semantic quality tests.
  });
});
