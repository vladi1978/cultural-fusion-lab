import { describe, expect, it } from "vitest";
import { interpretProductIntent } from "./product-intent";
import { assessMechanismCompatibility } from "./mechanism-compat";

describe("P9.129 physical product intent", () => {
  it("prioritizes a requested lamp over ceramic cultural signals", () => {
    const result = interpretProductIntent(
      "Design a ceramic table lamp combining Moroccan craftsmanship and Scandinavian design",
    );
    expect(result.kind).toBe("explicit");
    if (result.kind === "explicit") {
      expect(result.object).toBe("table lamp");
      expect(result.function).toMatch(/illuminate/);
    }
  });

  it("recognizes a coffee brewing kit", () => {
    expect(
      interpretProductIntent("Design a home coffee ritual product kit"),
    ).toMatchObject({
      kind: "explicit",
      object: "coffee brewing kit",
    });
  });

  it("recognizes an explicitly requested organizer tray", () => {
    expect(
      interpretProductIntent("Create a functional organizer tray for the home"),
    ).toMatchObject({
      kind: "explicit",
      object: "organizer tray",
    });
  });

  it("does not invent a product from cultural influences alone", () => {
    expect(
      interpretProductIntent(
        "Create a functional home product combining Moroccan craftsmanship and Scandinavian design",
      ),
    ).toEqual({ kind: "unspecified" });
  });

  it("does not mistake a coffee-themed brand for a physical brewing kit", () => {
    expect(
      interpretProductIntent("Build a coffee-inspired cultural brand"),
    ).toEqual({ kind: "unspecified" });
  });
});

describe("P9.133 extended physical product catalog", () => {
  it.each([
    ["Design a Scandinavian chair", "chair"],
    ["Create a modular bookshelf", "shelf"],
    ["Develop a ceramic planter", "planter"],
  ])("recognizes %s", (objective, expected) => {
    const result = interpretProductIntent(objective);
    expect(result.kind).toBe("explicit");
    if (result.kind === "explicit") {
      expect(result.object).toBe(expected);
      expect(result.function.length).toBeGreaterThan(8);
      expect(result.components.length).toBeGreaterThan(0);
    }
  });

  it("does not invent a chair from a cultural reference alone", () => {
    expect(
      interpretProductIntent(
        "Create a cultural experience inspired by Scandinavian design",
      ),
    ).toEqual({ kind: "unspecified" });
  });
});


describe("P9.200 explicit product fidelity", () => {
  it.each([
    "table lamp",
    "coffee brewing kit",
    "organizer tray",
    "chair",
    "shelf",
    "planter",
  ])("rejects apparel substitution for %s", (object) => {
    const result = assessMechanismCompatibility({
      mechanismId: "material_layer",
      output: "product",
      hingeCategory: "fashion",
      culturalInterest: "Moroccan craftsmanship and Scandinavian textile design",
      rawObjective: `Design a Moroccan-Scandinavian ${object}`,
    });

    expect(result.applicable).toBe(false);
    expect(result.needsBridge).toBe(false);
    expect(result.reason).toMatch(/requested.*product|home product/i);
  });

  it("preserves apparel mechanisms when no physical catalog object is requested", () => {
    const result = assessMechanismCompatibility({
      mechanismId: "material_layer",
      output: "product",
      hingeCategory: "fashion",
      culturalInterest: "Scandinavian textile design",
      rawObjective: "Design a modular fashion garment",
    });

    expect(result.applicable).toBe(true);
  });
});
