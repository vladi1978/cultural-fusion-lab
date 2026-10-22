import { describe, expect, it } from "vitest";
import { describePhysicalProduct } from "./physical-product";

describe("P9.123 physical product function", () => {
  it("describes a tangible object independently of distribution", () => {
    const result = describePhysicalProduct({
      object: "Ceramic organizer tray",
      action: "hold and organize",
      target: "keys and everyday objects",
      components: ["ceramic tray", "raised edge"],
      userSteps: [
        "Place keys in the tray.",
        "Keep objects contained.",
        "Retrieve objects when needed.",
      ],
    });

    expect(result.proposition).toContain("Ceramic organizer tray");
    expect(result.mechanics).toContain("hold and organize");
    expect(result.journey).toHaveLength(3);
    expect(result.mechanics).not.toMatch(/redeem invite|checkpoint card/i);
  });

  it("rejects a product without a physical function", () => {
    expect(() =>
      describePhysicalProduct({
        object: "Membership drop",
        action: "",
        target: "",
        components: [],
        userSteps: ["Join", "Redeem", "Receive"],
      }),
    ).toThrow();
  });
});
