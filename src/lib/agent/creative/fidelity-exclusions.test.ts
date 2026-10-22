import { describe, expect, it } from "vitest";
import { assessCreativeFidelity } from "./fidelity";
import { triageCreativeFidelity } from "./fidelity-triage";
import type { CreativeFrame } from "./types";
import type { ConceptSpec } from "../../types";

describe("Adversarial off-brief exclusions", () => {
  const frame = {
    sourceDomains: [],
    requirements: [],
    offBrief: ["Celebrity cooking competition"],
  } as unknown as CreativeFrame;

  const makeSpec = (mechanics: string): ConceptSpec => ({
    proposition: "A participatory culinary event",
    mechanics,
    journey: [{ id: "step-1", actor: "host", action: mechanics, influenceEntityIds: [] }],
  }) as unknown as ConceptSpec;

  it("rejects an explicit prohibited activity", () => {
    const spec = makeSpec(
      "The host organizes a Celebrity cooking competition with audience voting."
    );

    const result = triageCreativeFidelity(frame, spec, {
      expectedOutputCategory: "experience",
      declaredOutputCategory: "experience",
    });

    expect(result.disposition).toBe("needs_review");
    expect(result.reasons.join(" ")).toMatch(/Matches off-brief exclusion/i);
  });

  it("documents that a semantic paraphrase is not detected by lexical screening", () => {
    const spec = makeSpec(
      "Famous chefs compete in a televised culinary contest with audience voting."
    );

    const lexical = assessCreativeFidelity(frame, spec);

    // This is a known limitation, NOT proof that the concept complies.
    expect(lexical.failures).not.toContain(
      "Matches off-brief exclusion: Celebrity cooking competition"
    );

    const triage = triageCreativeFidelity(frame, spec, {
      expectedOutputCategory: "experience",
      declaredOutputCategory: "experience",
    });

    expect(triage.semanticVerificationRequired).toBe(true);
  });
});
