import { describe, expect, it } from "vitest";
import { identifyFunctionalNeed } from "./functional-needs";

describe("P9.176 explicit functional needs", () => {
  it("recognizes a lamp glare problem", () => {
    const result = identifyFunctionalNeed(
      "Design a table lamp to reduce glare",
      "table lamp",
    );

    expect(result.need).toBe("reduce_glare");
    expect(result.status).toBe("explicit");
  });

  it("recognizes an adjustable storage problem", () => {
    const result = identifyFunctionalNeed(
      "Create an organizer tray for objects of different sizes",
      "organizer tray",
    );

    expect(result.need).toBe("adapt_storage");
    expect(result.status).toBe("explicit");
  });

  it("does not invent a need from cultural materials", () => {
    const result = identifyFunctionalNeed(
      "Create a Moroccan-Scandinavian ceramic organizer tray",
      "organizer tray",
    );

    expect(result.need).toBe("not_established");
    expect(result.status).toBe("not_established");
  });

  it("does not transfer a need to an unrelated product", () => {
    const result = identifyFunctionalNeed(
      "Reduce glare in a room",
      "planter",
    );

    expect(result.need).toBe("not_established");
  });
});
