import { describe, expect, it } from "vitest";
import { applyRelevanceGate } from "./relevance";
import type { CulturalEntity, EvidenceItem } from "../types";
import type { InterpretedObjective } from "./types";

const entities: CulturalEntity[] = [
  { id: "seed", name: "Jazz Ensemble", category: "music",
    description: "Jazz musicians", affinity: 0.8, tags: ["jazz"] },
  { id: "venue", name: "Lisbon Listening Room", category: "places",
    description: "An intimate venue", affinity: 0.7, tags: ["community"] },
  { id: "unrelated", name: "Golf Equipment", category: "brands",
    description: "Golf accessories", affinity: 0.6, tags: ["sports"] },
];

const interpreted = {
  rawObjective: "Create a jazz cultural experience",
  culturalInterest: "jazz",
  outputCategory: "experience",
  intentTokens: ["jazz"],
} as InterpretedObjective;

const evidence = (seeds: string[]): EvidenceItem[] => [{
  id: "insights-test",
  source: "verified_api",
  label: "Qloo Insights results",
  detail: "Fixture representing an Insights response",
  relatedEntityIds: ["venue"],
  insightSeedEntityIds: seeds,
  createdAt: "2026-10-13T12:00:00.000Z",
}];

describe("P1.13-C indirect Qloo relevance", () => {
  it("accepts an indirect Insights result with a relevant seed", () => {
    const result = applyRelevanceGate({
      entities, interpreted, evidence: evidence(["seed"]),
    });
    expect(result.kept.map((entity) => entity.id)).toContain("venue");
    expect(result.rejected.map((entity) => entity.id)).toContain("unrelated");
  });

  it("rejects an indirect result without a relevant seed", () => {
    const result = applyRelevanceGate({
      entities, interpreted, evidence: evidence(["unrelated"]),
    });
    expect(result.rejected.map((entity) => entity.id)).toContain("venue");
  });

  it("does not accept indirect results without verified evidence", () => {
    const result = applyRelevanceGate({ entities, interpreted });
    expect(result.rejected.map((entity) => entity.id)).toContain("venue");
  });

  it("rejects partially unverified seed sets", () => {
    const result = applyRelevanceGate({
      entities, interpreted, evidence: evidence(["seed", "missing"]),
    });
    expect(result.rejected.map((entity) => entity.id)).toContain("venue");
  });
});
