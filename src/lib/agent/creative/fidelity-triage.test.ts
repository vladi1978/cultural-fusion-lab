import { describe, expect, it } from "vitest";
import { triageCreativeFidelity } from "./fidelity-triage";
import type { CreativeFrame } from "./types";
import type { ConceptSpec } from "../../types";

const frame = (coreMechanics: string[], offBrief: string[] = []): CreativeFrame => ({
  sourceDomains: [{ name: "Domain A", origin: "test", essence: "test", coreMechanics }],
  experientialGoals: [], requirements: [], offBrief, evidenceProbes: [],
});
const spec = (mechanics: string): ConceptSpec => ({
  name: "Test", proposition: "Test", audience: "people", context: "test", mechanics,
  journey: [{ id: "s1", actor: "participant", action: mechanics, influenceEntityIds: [] }],
  influenceMap: [], rationales: [], differentiationHypothesis: "unknown",
  feasibilityAssumptions: [], risksAndUnknowns: [], pilotExperiment: "pilot",
  evidenceBoundary: "unverified", mechanicFingerprint: "test", mechanismId: "test",
  frozenObjective: "test", frozenOutputCategory: "experience",
});

describe("domain-agnostic fidelity triage (diagnostic, offline)", () => {
  it("never automatically accepts missing lexical evidence, including legitimate paraphrases", () => {
    const result = triageCreativeFidelity(frame(["rainwater harvesting"]), spec("Collect rainfall in cisterns"));
    expect(result.disposition).toBe("needs_review");
    expect(result.semanticVerificationRequired).toBe(true);
  });
  // The original test expected needs_review for a paraphrase that shares NO distinctive
  // vocabulary with the exclusion ("Famous chefs compete for prizes" vs "Celebrity cooking
  // competition"). A lexical gate cannot know that, and fidelity-exclusions.test.ts already
  // documents it; the orchestrator contract (triage-e2e) is provisional + explicit warning.
  // Asserting needs_review there tested a capability the gate does not have. Replaced by:
  it("zero-overlap semantic paraphrase of an exclusion stays provisional with an explicit verification warning (known limitation)", () => {
    const result = triageCreativeFidelity(frame(["shared preparation"], ["Celebrity cooking competition"]), spec("Famous chefs compete for prizes during shared preparation"), {
      expectedOutputCategory: "experience", declaredOutputCategory: "experience",
    });
    expect(result.disposition).toBe("provisionally_accepted");
    expect(result.semanticVerificationRequired).toBe(true);
    expect(result.reasons.join(" ")).toMatch(/off-brief exclusions require semantic verification/i);
  });
  it("flags a paraphrased exclusion when distinctive terms co-occur in one operating step", () => {
    const result = triageCreativeFidelity(frame(["shared preparation"], ["Celebrity cooking competition"]), spec("Famous chefs enter a cooking competition judged on shared preparation"), {
      expectedOutputCategory: "experience", declaredOutputCategory: "experience",
    });
    expect(result.disposition).toBe("needs_review");
    expect(result.reasons.join(" ")).toMatch(/Probable off-brief exclusion/);
  });
  it("does not flag a concept that shares one word with an exclusion, or only the practice's own vocabulary", () => {
    const f = frame(["community cooking"], ["Generic music festival"]);
    const one = triageCreativeFidelity(f, spec("Neighbours practise community cooking while a musician plays softly"), { expectedOutputCategory: "experience", declaredOutputCategory: "experience" });
    expect(one.disposition).toBe("provisionally_accepted");
    const own = triageCreativeFidelity(frame(["community cooking"], ["Celebrity cooking competition"]), spec("Neighbours run community cooking evenings"), { expectedOutputCategory: "experience", declaredOutputCategory: "experience" });
    expect(own.disposition).toBe("provisionally_accepted");
  });
  it("does not combine exclusion terms scattered across unrelated steps", () => {
    const f = frame(["shared preparation"], ["Celebrity cooking competition"]);
    const sp = spec("Shared preparation of a meal.");
    sp.journey = [
      { id: "a", actor: "host", action: "A celebrity guest greets arrivals during shared preparation.", influenceEntityIds: [] },
      { id: "b", actor: "host", action: "Afterwards a short cooking demo runs.", influenceEntityIds: [] },
    ];
    expect(triageCreativeFidelity(f, sp, { expectedOutputCategory: "experience", declaredOutputCategory: "experience" }).disposition).toBe("provisionally_accepted");
  });
  it("rejects independently declared output category mismatch", () => {
    const result = triageCreativeFidelity(frame(["replaceable modules"]), spec("Workshop with replaceable modules"), {
      expectedOutputCategory: "physical_product", declaredOutputCategory: "experience",
    });
    expect(result.disposition).toBe("rejected");
  });
  it("does not misrepresent lexical passes as semantic certification", () => {
    const result = triageCreativeFidelity(frame(["shared preparation"]), spec("Participants perform shared preparation"), {
      expectedOutputCategory: "experience", declaredOutputCategory: "experience",
    });
    expect(result.disposition).toBe("provisionally_accepted");
    expect(result.semanticVerificationRequired).toBe(true);
  });
  it("keeps category checks independent of cultural domain", () => {
    const result = triageCreativeFidelity(frame(["crop rotation"]), spec("Use crop rotation"), {
      expectedOutputCategory: "service", declaredOutputCategory: "physical_product",
    });
    expect(result.disposition).toBe("rejected");
  });
});
