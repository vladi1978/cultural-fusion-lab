import { describe, expect, it } from "vitest";
import { assessCreativeFidelity } from "./fidelity";
import { triageCreativeFidelity } from "./fidelity-triage";
import type { CreativeFrame } from "./types";
import type { ConceptSpec } from "../../types";

// The exclusion text is test data, not logic: the screen has no knowledge of any culture or topic.
const frame = {
  sourceDomains: [],
  requirements: [],
  offBrief: ["A solution that assumes the city has protected bike lanes or employer partners."],
} as unknown as CreativeFrame;

const spec = (mechanics: string): ConceptSpec => ({
  proposition: "A coordinated shift-change service",
  mechanics,
  journey: [{ id: "step-1", actor: "host", action: "Participants meet at the depot and set off together.", influenceEntityIds: [] }],
}) as unknown as ConceptSpec;

describe("off-brief screen: disclaimers versus requirements", () => {
  it("does not reject a step that only disclaims the excluded assumption, and says so", () => {
    const r = assessCreativeFidelity(frame, spec("The service never assumes protected bike lanes or employer partners exist; participants gather at a depot."));
    expect(r.accepted).toBe(true);
    expect((r.warnings ?? []).length).toBe(1);
    expect(r.warnings![0]).toMatch(/negation/i);
  });

  it("still never reports a verified pass: triage stays provisional and mentions the disclaimer", () => {
    const t = triageCreativeFidelity(frame, spec("The service never assumes protected bike lanes or employer partners exist; participants gather at a depot."));
    expect(t.disposition).toBe("provisionally_accepted");
    expect(t.semanticVerificationRequired).toBe(true);
    expect(t.reasons.join(" ")).toMatch(/disclaimer/i);
  });

  it("rejects a step that requires the excluded assumption, and quotes the step", () => {
    const r = assessCreativeFidelity(frame, spec("The service assumes protected bike lanes and employer partners are available to every participant."));
    expect(r.accepted).toBe(false);
    expect(r.failures.join(" ")).toMatch(/Probable off-brief exclusion/);
    expect(r.failures.join(" ")).toMatch(/The service assumes protected bike lanes/);
  });

  it("is not fooled by a negation that comes after the matching terms", () => {
    const r = assessCreativeFidelity(frame, spec("The service assumes protected bike lanes and employer partners exist, with no depot required."));
    expect(r.accepted).toBe(false);
  });

  it("is not fooled by a negation far from the matching terms", () => {
    const r = assessCreativeFidelity(frame, spec("No fees apply on weekends and holidays during the first month of operation for new riders, but the service assumes protected bike lanes and employer partners."));
    expect(r.accepted).toBe(false);
  });

  it("an exact copy of the exclusion is still rejected even inside a negated sentence", () => {
    const r = assessCreativeFidelity(frame, spec("Never offer A solution that assumes the city has protected bike lanes or employer partners."));
    expect(r.accepted).toBe(false);
    expect(r.failures.join(" ")).toMatch(/Matches off-brief exclusion/);
  });
});
