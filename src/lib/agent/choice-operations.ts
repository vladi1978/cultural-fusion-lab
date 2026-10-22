/** P10.23-C: explicit participant choices with observable alternatives.
 * Creative operating hypotheses, never claims of observed cultural preferences.
 */
import type { ConceptSpec, JourneyStep } from "../types";

type Dimension = { label: string; match: RegExp; alternatives: string; observation: string };
const DIMENSIONS: Dimension[] = [
  { label: "sequence", match: /\b(?:sequence|order|route|path|progression)\b/i,
    alternatives: "either the reflection stage first or the guided activity first",
    observation: "record which stage ran first" },
  { label: "intensity", match: /\b(?:intensity|pace|pacing|difficulty|tempo)\b/i,
    alternatives: "either a low-intensity or a higher-intensity version of the next activity, subject to participant comfort and safety",
    observation: "record which intensity was delivered" },
  { label: "social dynamics", match: /\b(?:social dynamics|social interaction|group dynamics|social format|group size)\b/i,
    alternatives: "either a solo reflection or a facilitated small-group exchange",
    observation: "record whether the next stage was solo or group-based" },
  { label: "duration", match: /\b(?:duration|length|time spent)\b/i,
    alternatives: "either a shorter or a longer stage, within the host's available schedule",
    observation: "record the actual duration" },
  { label: "materials", match: /\b(?:materials?|ingredients?|components?)\b/i,
    alternatives: "either the standard or an alternate available material set",
    observation: "record which set was used" },
];
const CHOICE=/\b(?:choices?|choos(?:e|es|ing)|decisions?|decid(?:e|es|ing)|select(?:s|ing)?|options?)\b/i;
const CHANGE=/\b(?:chang(?:e|es|ing)|alter(?:s|ing)?|modif(?:y|ies)|affect(?:s|ing)?|adjust(?:s|ing)?|determin(?:e|es))\b/i;

export function deriveChoiceOperations(objective: string): { mechanics: string; journey: JourneyStep[] } | null {
  if (!CHOICE.test(objective) || !CHANGE.test(objective)) return null;
  const dimensions=DIMENSIONS.filter(d=>d.match.test(objective));
  if (!dimensions.length) return null;
  return {
    mechanics: `Participants make meaningful choices that change the operating sequence, intensity or social format only where requested: ${dimensions.map(d=>`${d.label}: ${d.alternatives}`).join("; ")}. The host implements the chosen branch and records its consequence; this is a proposed design, not cultural evidence.`,
    journey: dimensions.map((d,i)=>({
      id:`choice-${i+1}`, actor:"Participant",
      action:`At decision point ${i+1}, participants choose ${d.alternatives}; the host changes ${d.label} accordingly and must ${d.observation}.`,
      influenceEntityIds:[], // Draft only: do NOT insert these unbound steps into a ConceptSpec.
    })),
  };
}

/** Apply choices to already evidence-bound journey steps, not as fabricated cultural steps.
 * Existing step IDs, influence links, and causal rationales are preserved.
 */
export function enrichChoiceDependentExperience(objective: string, spec: ConceptSpec): ConceptSpec {
  const operations=deriveChoiceOperations(objective);
  if (!operations || !spec.journey.length) return spec;
  // Do not invent cultural support for an unsupported stage.
  if (spec.journey.some(s=>s.influenceEntityIds.length===0)) return spec;
  const journey=spec.journey.map((step,i)=>({ ...step }));
  for (let i=0;i<operations.journey.length;i++) {
    const target=journey[i % journey.length]!;
    target.action += ` Proposed interactive branch: ${operations.journey[i]!.action}`;
  }
  const goal: string[]=[];
  if (/\b(?:urban professionals?|city workers?)\b/i.test(objective) && /\b(?:digital stress|screen stress|disconnect|unplug)\b/i.test(objective)) {
    goal.push("For urban professionals facing digital stress, the host offers an opt-in device-free interval, records a before/after stress self-rating, and gives participants a way to disconnect without requiring device surrender.");
  }
  if (/\b(?:wellness|wellbeing|well-being)\b/i.test(objective)) {
    goal.push("The interactive wellness pilot records participant comfort and permits opting out of any activity.");
  }
  return {
    ...spec,
    mechanics: `${spec.mechanics} ${operations.mechanics} ${goal.join(" ")}`.trim(),
    journey,
    pilotExperiment: `${spec.pilotExperiment} Log the actual choice branches and their observed outcomes, plus participant feedback on whether those choices affected the experience.`,
  };
}
