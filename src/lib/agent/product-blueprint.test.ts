import { describe, expect, it } from "vitest";
import { interpretProductIntent } from "./product-intent";
import { buildProductBlueprint } from "./product-blueprint";

describe("P9.135 reusable physical product blueprint", () => {
  it.each([
    ["Design a Moroccan-Scandinavian table lamp", "table lamp", /illuminate/],
    ["Create a functional chair", "chair", /support a seated person/],
    ["Design a modular bookshelf", "shelf", /hold and display/],
    ["Develop a ceramic planter", "planter", /contain a plant/],
    ["Create a home coffee brewing kit", "coffee brewing kit", /filter coffee/],
    ["Design an organizer tray", "organizer tray", /organize/],
  ])("creates a functional blueprint for %s", (objective, object, functionPattern) => {
    const blueprint = buildProductBlueprint(interpretProductIntent(objective));

    expect(blueprint).toBeDefined();
    expect(blueprint?.object).toBe(object);
    expect(blueprint?.proposition).toMatch(functionPattern);
    expect(blueprint?.mechanics).toMatch(/Physical components:/);
    expect(blueprint?.journey).toHaveLength(3);
    expect(blueprint?.journey[1]).toMatch(functionPattern);
  });

  it("does not invent a physical object for an unspecified objective", () => {
    expect(
      buildProductBlueprint(
        interpretProductIntent("Create a culturally inspired home product"),
      ),
    ).toBeUndefined();
  });
});
