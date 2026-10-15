import { describe, expect, it } from "vitest";
import { mapSubtypeToCategory } from "./mapper";

describe("Qloo category fallback", () => {
  it("uses a recognized parent type when subtype is unknown", () => {
    expect(
      mapSubtypeToCategory(
        "urn:entity:artist:musician",
        "urn:entity:artist",
      ),
    ).toBe("music");
  });

  it("preserves recognized subtypes", () => {
    expect(
      mapSubtypeToCategory(
        "urn:entity:tv_show",
        "urn:entity:movie",
      ),
    ).toBe("film");
  });

  it("keeps unknown types classified as other", () => {
    expect(
      mapSubtypeToCategory(
        "urn:entity:unknown",
        "urn:entity:unknown",
      ),
    ).toBe("other");
  });
});
