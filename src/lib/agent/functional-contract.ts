/**
 * Conservative, deterministic extraction of explicit user requirements.
 * This is NOT semantic verification and never manufactures cultural evidence.
 */
export interface FunctionalContract {
  requirements: string[];
  choiceDependent: boolean;
  verification: "explicit" | "unverified";
}
const CHOICE = /\b(?:choos(?:e|es|ing)|choices?|decid(?:e|es|ing)|decisions?|select(?:s|ing)?|options?|pick(?:s|ing)?)\b/i;
const CHANGE = /\b(?:chang(?:e|es|ing)|alter(?:s|ing)?|modif(?:y|ies)|adjust(?:s|ing)?|affect(?:s|ing)?|control(?:s|ling)?|determin(?:e|es)|influenc(?:e|es))\b/i;
const OBLIGATION = /\b(?:must|should|need(?:s)? to|has to|required to)\b/i;
export function extractFunctionalContract(objective: string): FunctionalContract {
  const sentences=objective.split(/[.!?;\n]+/).map(s=>s.trim()).filter(Boolean);
  const requirements=sentences.filter(s=>OBLIGATION.test(s)||(CHOICE.test(s)&&CHANGE.test(s)));
  return { requirements, choiceDependent: CHOICE.test(objective)&&CHANGE.test(objective),
    verification: requirements.length ? "explicit" : "unverified" };
}
/** Ranking signal only, never proof that a concept fulfills a requirement. */
export function functionalAlignmentScore(
  contract: FunctionalContract,
  spec: { mechanics: string; journey: {action:string}[] }
): number {
  if (!contract.choiceDependent) return 0;
  const operations=[spec.mechanics,...spec.journey.map(s=>s.action)].join(" ");
  return (CHOICE.test(operations)?1:0)+(CHANGE.test(operations)?1:0);
}
