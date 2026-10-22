import { describe, expect, it } from "vitest";
import fixture from "../../qloo/fixtures/live-probe-tags-2026-10-21.json";
import { mapQlooEntityToCultural } from "../../qloo/mapper";
import { parseEntitiesResponse } from "../../qloo/schemas";
import { assessEvidenceEligibility, validateGeography } from "./eligibility";
import type { CulturalEntity } from "../../types";

type Place = NonNullable<CulturalEntity["qloo"]>["place"];
const place = (id: string, name: string, tags: string[], description: string, p?: Place, type = "urn:entity:place"): CulturalEntity => ({
  id, name, category: type === "urn:entity:place" ? "places" : "brands", description, affinity: 0.5, tags,
  qloo: { provider: "qloo", entityId: id, entityType: type, retrievedVia: "insights", ...(p ? { place: p } : {}) },
});
const req = { creativeObjective: "Design a cycling night ride service in Louisville", culturalInterest: "cycling", location: "Louisville, Kentucky" };
const louisville: Place = { city: "Louisville", region: "Kentucky", country: "United States", address: "1 Main St Louisville, KY" };

describe("geography validation", () => {
  it("verifies a place whose Qloo city and region match, ignoring case and diacritics", () => {
    expect(validateGeography(place("a", "A", [], "", { city: "LOUISVILLE", region: "kentucky" }), "Louisville, Kentucky").status).toBe("verified");
    expect(validateGeography(place("a", "A", [], "", { city: "São Paulo", region: "São Paulo" }), "Sao Paulo, Sao Paulo").status).toBe("verified");
  });
  it("rejects another city, and the same city name in another region", () => {
    expect(validateGeography(place("a", "A", [], "", { city: "Jeffersonville", region: "Indiana" }), "Louisville, Kentucky").status).toBe("mismatch");
    expect(validateGeography(place("a", "A", [], "", { city: "Louisville", region: "Colorado" }), "Louisville, Kentucky").status).toBe("mismatch");
  });
  it("treats missing place facts as unverifiable, never as a match", () => {
    expect(validateGeography(place("a", "A", [], ""), "Louisville, Kentucky").status).toBe("unverifiable");
    expect(validateGeography(place("a", "A", [], "", { address: "somewhere" }), "Louisville").status).toBe("unverifiable");
  });
  it("does not apply to non-places or to briefs without a location", () => {
    expect(validateGeography(place("b", "B", [], "", undefined, "urn:entity:brand"), "Louisville").status).toBe("not_required");
    expect(validateGeography(place("a", "A", [], ""), undefined).status).toBe("not_required");
  });
});

describe("topical validation", () => {
  const near = (tags: string[], description = "") => place("a", "Venue", tags, description, louisville);
  it("accepts one specific term from the declared interest", () => {
    expect(assessEvidenceEligibility({ entities: [near(["Cycling lanes"])], request: req }).eligible).toHaveLength(1);
  });
  it("accepts an Insights signal tag name as part of the declared subject", () => {
    const r = assessEvidenceEligibility({ entities: [near(["Velodrome"])], request: req, signalTagNames: ["Velodrome"] });
    expect(r.eligible).toHaveLength(1);
  });
  it("needs two distinct terms from the objective's wording when the interest is absent", () => {
    const oneWord = assessEvidenceEligibility({ entities: [near(["Night"], "ride")], request: { ...req, culturalInterest: "velodrome" } });
    expect(oneWord.eligible).toHaveLength(0);
  });
  it("rejects an entity with no topical overlap even when the geography is verified", () => {
    const r = assessEvidenceEligibility({ entities: [near(["Pet supply store", "Shopping"], "A neighborhood pet shop")], request: req });
    expect(r.eligible).toHaveLength(0);
    expect(r.rejected[0]!.geography.status).toBe("verified");
    expect(r.rejected[0]!.reasons.join(" ")).toMatch(/no term from the brief/);
  });
  it("is domain-agnostic: the same rules work for a product brief with no location", () => {
    const e = place("c", "Kiln & Co", ["Ceramics", "Stoneware"], "Hand-thrown stoneware", undefined, "urn:entity:brand");
    const r = assessEvidenceEligibility({ entities: [e], request: { creativeObjective: "Design a stoneware tableware line", culturalInterest: "ceramics" } });
    expect(r.sufficiency.status).toBe("sufficient");
  });
});

describe("sufficiency is explicit and never forced", () => {
  it("reports insufficient evidence, with a reason per entity, when nothing passes", () => {
    const r = assessEvidenceEligibility({ entities: [place("a", "Far Away", ["Cycling"], "", { city: "Detroit", region: "Michigan" })], request: req });
    expect(r.sufficiency.status).toBe("insufficient");
    expect(r.sufficiency.eligibleEntityIds).toEqual([]);
    expect(r.sufficiency.rejections[0]!.reason).toMatch(/Detroit/);
    expect(r.sufficiency.reason).toMatch(/No design decision is grounded/);
  });
  it("is sufficient when at least one entity passes and still lists the rejections", () => {
    const good = place("g", "Cycle Works", ["Cycling"], "Bicycle workshop", louisville);
    const bad = place("b", "Elsewhere", ["Cycling"], "", { city: "Detroit", region: "Michigan" });
    const r = assessEvidenceEligibility({ entities: [good, bad], request: req });
    expect(r.sufficiency.status).toBe("sufficient");
    expect(r.sufficiency.eligibleEntityIds).toEqual(["g"]);
    expect(r.sufficiency.rejections.map(x => x.entityId)).toEqual(["b"]);
  });
});

describe("real Qloo responses recorded 2026-10-21", () => {
  const meta = { retrievedVia: "insights" as const, signalTagIds: ["urn:tag:genre:media:cycling"], signalTagNames: ["Cycling"] };
  const places = parseEntitiesResponse(fixture.insightsPlaceByMediaTag).map(e => mapQlooEntityToCultural(e, meta));

  it("preserves Qloo ids, retrieval path, signal tags and place facts", () => {
    const cherokee = places.find(e => e.name === "Cherokee Park")!;
    expect(cherokee.qloo).toMatchObject({ provider: "qloo", entityId: cherokee.id, retrievedVia: "insights", signalTagIds: ["urn:tag:genre:media:cycling"] });
    expect(cherokee.qloo!.place).toMatchObject({ city: "Louisville", region: "Kentucky" });
    expect(cherokee.qloo!.place!.address).toMatch(/Louisville, KY/);
    expect(typeof cherokee.qloo!.place!.lat).toBe("number");
  });
  it("rejects the unrelated places Qloo returned for a media tag (pet shop, fast food) even though their geography is right", () => {
    const r = assessEvidenceEligibility({ entities: places, request: req });
    expect(places.length).toBeGreaterThanOrEqual(4);
    expect(r.entities.every(x => x.geography.status === "verified")).toBe(true);
    for (const name of ["Sandy's Pet Shop", "Zaxbys Chicken Fingers & Buffalo Wings", "Fiesta Time Amigos"]) {
      expect(r.rejected.map(x => x.name)).toContain(name);
    }
    for (const e of r.eligible) expect(r.entities.find(x => x.entityId === e.id)!.topic.matchedTerms.length).toBeGreaterThan(0);
  });
  it("the same recorded places are out of range when the brief asks for another city", () => {
    const r = assessEvidenceEligibility({ entities: places, request: { ...req, location: "Detroit, Michigan" } });
    expect(r.eligible).toHaveLength(0);
    expect(r.sufficiency.status).toBe("insufficient");
    expect(r.rejected.every(x => x.geography.status === "mismatch")).toBe(true);
  });
});

describe("description-only mentions are not classification", () => {
  const jazzReq = { creativeObjective: "Design a live jazz listening ride in Louisville", culturalInterest: "jazz", location: "Louisville, Kentucky" };
  const artist = (tags: string[], description: string) => place("art", "Some Artist", tags, description, undefined, "urn:entity:artist");
  it("rejects an artist whose only link to the subject is one word in its biography", () => {
    const r = assessEvidenceEligibility({ entities: [artist(["Biography"], "An American musician who played in a jazz quintet.")], request: jazzReq });
    expect(r.eligible).toHaveLength(0);
    expect(r.rejected[0]!.reasons.join(" ")).toMatch(/name or tags/);
  });
  it("accepts the same artist when its own tags classify it under the subject", () => {
    expect(assessEvidenceEligibility({ entities: [artist(["Jazz", "Bebop"], "An American musician.")], request: jazzReq }).eligible).toHaveLength(1);
  });
  it("accepts a description mention reinforced by a second distinct term from the objective", () => {
    const r = assessEvidenceEligibility({ entities: [artist([], "A jazz musician known for live listening sessions.")], request: jazzReq });
    expect(r.eligible).toHaveLength(1);
  });
});
