import { describe, expect, it } from "vitest";
import { composeCreativeConcepts, CreativeCompositionError } from "./compose";
import { createReplayCreativeModel } from "./model";
import type { CreativeFrame } from "./types";
import type { ConceptSpec } from "../../types";
import type { InterpretedObjective } from "../types";

const frame: CreativeFrame = {
  sourceDomains: [
    { name: "Shinrin-yoku", origin: "Japan", essence: "forest attention", coreMechanics: ["slow sensory attention", "guided forest observation"] },
    { name: "Nordic sauna", origin: "Nordic countries", essence: "thermal recovery", coreMechanics: ["heat cooling cycles", "rest between sauna rounds"] },
  ],
  experientialGoals: ["reduce stress"],
  requirements: ["Choices change sequence, intensity, and social dynamics"],
  offBrief: ["Generic music festival", "Clothing customization"],
  evidenceProbes: [],
};
const interpreted: InterpretedObjective = {
  rawObjective: "Design a participatory Shinrin-yoku and Nordic sauna experience with sequence, intensity and social choices",
  culturalInterest: "Shinrin-yoku and Nordic sauna", outputCategory: "experience",
  intentTokens: [], themes: [], summary: "Participatory thermal and forest experience",
};
function draft(mechanics: string, action: string, proposition = "Participatory wellness"): ConceptSpec {
  return {
    name: "Adversarial replay candidate", proposition, audience: "visitors", context: "Seattle", mechanics,
    journey: [{ id: "step1", actor: "visitor", action, influenceEntityIds: [] }],
    influenceMap: [], rationales: [], differentiationHypothesis: "prototype",
    feasibilityAssumptions: [], risksAndUnknowns: [], pilotExperiment: "small pilot",
    evidenceBoundary: "unverified hypothesis", mechanicFingerprint: "adversarial-test", mechanismId: "adversarial",
    frozenObjective: interpreted.rawObjective, frozenOutputCategory: "experience",
  };
}
async function replay(spec: ConceptSpec) {
  const model = createReplayCreativeModel([JSON.stringify({ concepts: [spec] })]);
  return composeCreativeConcepts({ frame, interpreted, entities: [], evidence: [], model });
}
describe("creative composition adversarial replay (no API calls)", () => {
  it("rejects culturally unrelated apparel/music even if it names both cultures", async () => {
    await expect(replay(draft("Customize apparel while listening to jazz", "Visit a music showroom", "Shinrin-yoku meets Nordic sauna")))
      .rejects.toThrow(/Missing operational mechanism for cultural domain: Shinrin-yoku/);
  });
  it("rejects an experience that names both practices but omits required choices", async () => {
    await expect(replay(draft("Slow sensory attention followed by heat cooling cycles", "Walk through forest then rest between sauna rounds")))
      .rejects.toThrow(/Requested participant choice absent/);
  });
  it("rejects an explicit off-brief festival despite having cultural mechanics and choices", async () => {
    await expect(replay(draft("Generic music festival with slow sensory attention and heat cooling cycles; choose sequence, intensity, and social setting", "Choose a guided forest observation and rest between sauna rounds")))
      .rejects.toThrow(/Matches off-brief exclusion: Generic music festival/);
  });
  it("distinguishes fidelity passing from evidence validation: no fake evidence acceptance", async () => {
    await expect(replay(draft("Choose sequence of slow sensory attention and heat cooling cycles; select intensity and social setting", "Choose guided forest observation and rest between sauna rounds")))
      .rejects.toThrow(/fewer than two justified cultural influences/);
  });
});
