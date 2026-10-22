import { describe, expect, it } from "vitest";
import { buildTransferContract } from "./transfer";
import type { CreativeFrame } from "./types";

describe("functional cultural transfer", () => {
  it("preserves every cultural domain and its mechanisms", () => {
    const frame: CreativeFrame = {
      sourceDomains: [
        {
          name: "Culture A",
          origin: "Region A",
          essence: "Anticipatory coordination",
          coreMechanics: [
            "Anticipate needs before requests",
            "Adapt to changing conditions",
          ],
        },
        {
          name: "Culture B",
          origin: "Region B",
          essence: "Shared operational reliability",
          coreMechanics: [
            "Protect vulnerable participants",
            "Maintain predictable continuity",
          ],
        },
      ],
      experientialGoals: ["Improve reliability"],
      requirements: ["Serve workers"],
      offBrief: ["Generic rental service"],
      evidenceProbes: [],
    };

    const contract = buildTransferContract(frame);

    expect(contract.transfers).toHaveLength(2);

    expect(contract.transfers[0].sourceMechanisms).toEqual(
      frame.sourceDomains[0].coreMechanics,
    );

    expect(contract.transfers[1].sourceMechanisms).toEqual(
      frame.sourceDomains[1].coreMechanics,
    );

    expect(contract.combinationRule).toContain(
      "two different cultural domains",
    );

    expect(contract.feasibilityRule).toContain(
      "unverified dependencies",
    );

    expect(contract.evidenceRule).toContain(
      "fictional demo metadata",
    );

    expect(contract.exclusions).toEqual(frame.offBrief);
  });
});
