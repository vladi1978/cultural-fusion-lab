import type { InterpretedObjective, SearchPlan } from "../types";
import type { CreativeFrame } from "./types";
import { planSearches } from "../plan";
const categories = {"urn:entity:artist":"music","urn:entity:movie":"film","urn:entity:brand":"brands","urn:entity:place":"places","urn:entity:person":"other"} as const;
export function planCreativeSearches(interpreted:InterpretedObjective,frame:CreativeFrame):SearchPlan {
  const fallback=planSearches(interpreted);
  const searches=frame.evidenceProbes.slice(0,6).map((p,i)=>({id:`creative-probe-${i}`,query:p.query,
    entityType:p.entityType,category:p.entityType in categories ? categories[p.entityType as keyof typeof categories] : "other",rationale:`Objective-first practice probe: ${p.why}`}));
  return {...fallback,searches,tagQuery:undefined,notes:["LLM-framed queries; not evidence until collected.",...fallback.notes]};
}
