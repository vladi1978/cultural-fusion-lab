import { describe, expect, it } from "vitest";
import { buildProgramIdentity } from "./program-identity";

const base = {
  programId: "signal_specialized",
  outputCategory: "experience",
  opportunityKind: "convergence",
  hingeId: "jazz-entity",
  secondaryId: "jazz-place",
  primarySignal: "listening",
  secondarySignal: "night",
  ruleIds: [
    "rule-signal-os",
    "rule-secondary-texture",
    "rule-hypothesis-bound",
  ],
  journey: [
    { actor: "Host", influenceEntityIds: ["jazz-entity"] },
    { actor: "Guest", influenceEntityIds: ["jazz-entity", "jazz-place"] },
    { actor: "Host", influenceEntityIds: ["jazz-place", "jazz-entity"] },
  ],
};

describe("P1.18-D program identity", () => {
  it("separates cultural provenance from the same known program structure", () => {
    const jazz = buildProgramIdentity(base);
    const anime = buildProgramIdentity({
      ...base,
      hingeId: "anime-entity",
      secondaryId: "anime-place",
      primarySignal: "animation",
      secondarySignal: "visual",
      journey: [
        { actor: "Host", influenceEntityIds: ["anime-entity"] },
        { actor: "Guest", influenceEntityIds: ["anime-entity", "anime-place"] },
        { actor: "Host", influenceEntityIds: ["anime-place", "anime-entity"] },
      ],
    });

    expect(jazz.culturalFingerprint).not.toBe(anime.culturalFingerprint);
    expect(jazz.structuralFingerprint).toBe(anime.structuralFingerprint);
  });

  it("distinguishes different known operating flows", () => {
    const original = buildProgramIdentity(base);
    const different = buildProgramIdentity({
      ...base,
      programId: "craft_cocreate",
      ruleIds: ["rule-make", "rule-checkpoint"],
      journey: [
        { actor: "Maker", influenceEntityIds: ["jazz-entity"] },
        { actor: "Guest", influenceEntityIds: ["jazz-place"] },
      ],
    });

    expect(original.structuralFingerprint)
      .not.toBe(different.structuralFingerprint);
  });
});
