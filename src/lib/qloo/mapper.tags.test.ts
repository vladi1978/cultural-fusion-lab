import { describe, expect, it } from "vitest";
import { mapQlooEntityToCultural } from "./mapper";

describe("Qloo cultural tag preservation", () => {
  it("preserves meaningful tags beyond the sixth position", () => {
    const entity = mapQlooEntityToCultural({
      entity_id: "artist-jazz-1",
      name: "Jazz Artist",
      type: "urn:entity:artist",
      tags: [
        { id: "t1", name: "jazz" },
        { id: "t2", name: "music" },
        { id: "t3", name: "performance" },
        { id: "t4", name: "culture" },
        { id: "t5", name: "instrumental" },
        { id: "t6", name: "concert" },
        { id: "t7", name: "intimate listening" },
      ],
    });

    expect(entity.tags).toContain("intimate listening");
    expect(entity.tags).toHaveLength(7);
  });
});
