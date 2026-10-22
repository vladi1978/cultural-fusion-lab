import { describe, expect, it } from "vitest";
import fixture from "../../qloo/fixtures/live-probe-tags-2026-10-21.json";
import tagTypes from "../../qloo/fixtures/live-probe-tagtypes-2026-10-22.json";
import tagTypesList from "../../qloo/fixtures/live-probe-tagtypes-list-2026-10-22.json";
import { chooseFilterTags, chooseSignalTags, isSpeculativeNamedQuery, targetTypesFor, topicPhrasesOf } from "./qloo-discovery";
import type { QlooTag } from "../../qloo/schemas";

const brief = { creativeObjective: "Design a Wednesday evening where people ride bicycles between small venues in Louisville and end with a listening session of live jazz", culturalInterest: "jazz", location: "Louisville, Kentucky" };
const cyclingTags = fixture.tagsCycling.results.tags as QlooTag[];

describe("speculative named queries are never sent to Qloo", () => {
  it("flags the recalled proper names that returned unrelated entities in the first live run", () => {
    for (const q of ["Village Vanguard", "Jazz kissa Basie Ichinoseki", "Slow Roll Detroit", "The Jazz Factory Louisville", "Actors Theatre of Louisville"]) {
      expect(isSpeculativeNamedQuery(q, brief)).toBe(true);
    }
  });
  it("allows generic topic words, with or without a leading capital", () => {
    for (const q of ["bicycle", "Bicycle", "cycling culture", "listening room", "Jazz", "Louisville"]) {
      expect(isSpeculativeNamedQuery(q, brief)).toBe(false);
    }
  });
  it("is domain-agnostic: a remembered brand is flagged in a product brief too", () => {
    expect(isSpeculativeNamedQuery("Kiln Works Studio", { creativeObjective: "Design stoneware", culturalInterest: "ceramics" })).toBe(true);
    expect(isSpeculativeNamedQuery("stoneware", { creativeObjective: "Design stoneware", culturalInterest: "ceramics" })).toBe(false);
  });
});

describe("topic phrases and target types", () => {
  it("splits a multi-part interest and caps at two phrases", () => {
    expect(topicPhrasesOf({ ...brief, culturalInterest: "Japanese omotenashi + Dutch cycling", outputCategory: "experience" })).toEqual(["japanese omotenashi", "dutch cycling"]);
  });
  it("adds the most specific objective word, but never the location, when the interest is a single phrase", () => {
    const phrases = topicPhrasesOf({ ...brief, outputCategory: "experience" });
    expect(phrases[0]).toBe("jazz");
    expect(phrases).toHaveLength(2);
    expect(phrases[1]).not.toMatch(/louisville|kentucky/);
  });
  it("chooses entity types from the output and the location, not from a topic", () => {
    expect(targetTypesFor({ ...brief, location: undefined, outputCategory: "product" })).toEqual(["urn:entity:brand"]);
    expect(targetTypesFor({ ...brief, outputCategory: "experience" })).toEqual(["urn:entity:place"]);
    expect(targetTypesFor({ ...brief, outputCategory: "brand" })).toEqual(["urn:entity:brand", "urn:entity:place"]);
  });
});

describe("signal tag choice (real /v2/tags response for 'cycling')", () => {
  it("uses only place-namespaced tags for places: a media tag returned a pet shop and a fast-food chain", () => {
    const ids = chooseSignalTags(cyclingTags, "urn:entity:place", ["cycling"]).map(t => t.id);
    expect(ids).toContain("urn:tag:amenity:place:cycling_lanes");
    expect(ids).toContain("urn:tag:category:place:cycling_park");
    expect(ids.some(id => id.includes("genre:media"))).toBe(false);
    expect(ids.some(id => !id.includes(":place:"))).toBe(false);
  });
  it("accepts any topic-named tag for brands and ranks the exact name first", () => {
    const tags = chooseSignalTags(cyclingTags, "urn:entity:brand", ["cycling"]);
    expect(tags.length).toBeGreaterThan(0);
    expect(tags[0]!.name.toLowerCase()).toBe("cycling");
    expect(tags.length).toBeLessThanOrEqual(3);
  });
  it("returns nothing when no tag matches the topic, so no Insights call is made and nothing is invented", () => {
    expect(chooseSignalTags(cyclingTags, "urn:entity:place", ["ceramics"])).toEqual([]);
  });
  it("is domain-agnostic: works on tags for an unrelated topic", () => {
    const tags: QlooTag[] = [
      { id: "urn:tag:category:place:ceramics_studio", name: "Ceramics studio", type: "urn:tag:category:place", popularity: 0.9 },
      { id: "urn:tag:genre:media:ceramics", name: "Ceramics", type: "urn:tag:genre:media", popularity: 0.99 },
    ];
    expect(chooseSignalTags(tags, "urn:entity:place", ["ceramics"]).map(t => t.id)).toEqual(["urn:tag:category:place:ceramics_studio"]);
    expect(chooseSignalTags(tags, "urn:entity:brand", ["ceramics"])[0]!.name).toBe("Ceramics");
  });
});

describe("hard-filter tag choice (real place-type /v2/tags responses, 2026-10-22)", () => {
  const jazzTags = tagTypes.results[0]!.tags as QlooTag[];
  const cyclingPlaceTags = tagTypesList.results[0]!.tags as QlooTag[];

  it("prefers the plain genre tag over the restaurant and hotel variants for 'jazz'", () => {
    const [jazz] = chooseFilterTags(jazzTags, "urn:entity:place", ["jazz"]);
    expect(jazz!.candidates[0]!.id).toBe("urn:tag:genre:place:jazz_club");
    expect(jazz!.candidates.map(t => t.id)).toContain("urn:tag:genre:place:restaurant:jazz_club");
  });

  it("returns one list per phrase and never reuses a tag across phrases", () => {
    const plan = chooseFilterTags([...cyclingPlaceTags, ...jazzTags], "urn:entity:place", ["cycling", "jazz"]);
    expect(plan.map(p => p.phrase)).toEqual(["cycling", "jazz"]);
    expect(plan[0]!.candidates.every(t => /cycling/i.test(t.name))).toBe(true);
    expect(plan[1]!.candidates.every(t => /jazz/i.test(t.name))).toBe(true);
    const ids = plan.flatMap(p => p.candidates.map(t => t.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never offers a tag that does not overlap the phrase, and returns no candidates for an unrelated topic", () => {
    expect(chooseFilterTags(cyclingPlaceTags, "urn:entity:place", ["ceramics"])[0]!.candidates).toEqual([]);
  });

  it("never combines tags: candidates are single tags, for the caller to send one per call", () => {
    for (const p of chooseFilterTags(cyclingPlaceTags, "urn:entity:place", ["cycling"])) expect(p.candidates.every(t => !t.id.includes(","))).toBe(true);
  });

  it("is domain-agnostic: works on invented place tags for an unrelated topic", () => {
    const tags = [
      { id: "urn:tag:genre:place:pottery_studio", name: "Pottery studio", type: "urn:tag:genre:place" },
      { id: "urn:tag:genre:place:restaurant:pottery_studio", name: "Pottery Studio", type: "urn:tag:genre:place" },
    ] as QlooTag[];
    expect(chooseFilterTags(tags, "urn:entity:place", ["pottery"])[0]!.candidates[0]!.id).toBe("urn:tag:genre:place:pottery_studio");
  });
});
