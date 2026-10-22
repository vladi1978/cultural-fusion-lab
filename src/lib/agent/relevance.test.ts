import { describe, expect, it } from "vitest";

import {
  applyRelevanceGate,
  assertTopicalNeighborhood,
  scoreEntityRelevance,
  termsMatch,
  tokenizeMeaningful,
} from "./relevance";
import { AgentError } from "./types";
import type { InterpretedObjective } from "./types";

const interpretedJazz: InterpretedObjective = {
  rawObjective: "Design a late-night hospitality product",
  culturalInterest: "jazz",
  outputCategory: "product",
  intentTokens: ["design", "hospitality", "product", "jazz"],
  themes: ["nocturnal", "hospitality", "sonic"],
  summary: "test",
};

describe("topical relevance gate", () => {
  it("rejects naive substring false positives (jazz ⊄ jazzercise)", () => {
    const entityTerms = new Set(tokenizeMeaningful("Jazzercise Pro Golf"));
    expect(entityTerms.has("jazzercise")).toBe(true);
    expect(termsMatch("jazz", entityTerms)).toBe(false);
  });

  it("matches whole-token interest terms on tags/names", () => {
    const score = scoreEntityRelevance(
      {
        id: "1",
        name: "Harbor Quartet",
        category: "music",
        description: "fixture",
        affinity: 0.7,
        tags: ["jazz", "night"],
      },
      ["jazz", "hospitality"],
      1,
    );
    expect(score.relevant).toBe(true);
    expect(score.matchedTerms).toContain("jazz");
  });

  it("distinguishes irrelevant evidence from empty volume", () => {
    const gate = applyRelevanceGate({
      entities: [
        {
          id: "g1",
          name: "Fairway Club",
          category: "places",
          description: "golf",
          affinity: 0.5,
          tags: ["golf"],
        },
        {
          id: "g2",
          name: "Putter Brand",
          category: "brands",
          description: "golf",
          affinity: 0.5,
          tags: ["golf"],
        },
        {
          id: "g3",
          name: "Green Doc",
          category: "film",
          description: "golf",
          affinity: 0.5,
          tags: ["golf"],
        },
      ],
      interpreted: interpretedJazz,
    });

    expect(gate.kept).toHaveLength(0);
    expect(() => assertTopicalNeighborhood(gate, 3)).toThrow(AgentError);
    try {
      assertTopicalNeighborhood(gate, 3);
    } catch (err) {
      expect(err).toMatchObject({ code: "IRRELEVANT_EVIDENCE" });
    }

    expect(() => assertTopicalNeighborhood(gate, 2)).toThrowError(
      /Insufficient cultural evidence volume/i,
    );
  });

  it("keeps unusual but supported cross-category links via shared topical tags", () => {
    const gate = applyRelevanceGate({
      entities: [
        {
          id: "a",
          name: "Quartet",
          category: "music",
          description: "x",
          affinity: 0.8,
          tags: ["jazz"],
        },
        {
          id: "b",
          name: "Listening Room",
          category: "places",
          description: "x",
          affinity: 0.7,
          tags: ["jazz", "listening"],
        },
        {
          id: "c",
          name: "Craft Label",
          category: "brands",
          description: "x",
          affinity: 0.6,
          tags: ["jazz", "craft"],
        },
      ],
      interpreted: interpretedJazz,
    });
    expect(gate.kept).toHaveLength(3);
    expect(() => assertTopicalNeighborhood(gate, 3)).not.toThrow();
  });

  it("ignores generic stopwords and does not treat category alone as topical proof", () => {
    const score = scoreEntityRelevance(
      {
        id: "m1",
        name: "Generic Ensemble",
        category: "music",
        description: "design a product brand experience",
        affinity: 0.5,
        tags: ["ambient"],
      },
      ["jazz", "design", "product", "brand"],
      1,
    );
    expect(score.relevant).toBe(false);
    expect(score.matchedTerms).toHaveLength(0);
  });

  it("rejects a multi-cultural brief supported only by incidental demo tags", () => {
    const interpreted: InterpretedObjective = {
      ...interpretedJazz,
      rawObjective: "Design an interactive wellness experience",
      culturalInterest: "Japanese Shinrin-yoku and Nordic sauna culture",
      outputCategory: "experience",
    };
    const entities = ["music", "food", "brands"].map((category, index) => ({
      id: `demo-${index}`,
      name: `Demo entity ${index}`,
      category: category as "music" | "food" | "brands",
      description: "A cultural creative fixture",
      affinity: 0.6,
      tags: ["culture", "ambient", "creative"],
    }));
    const gate = applyRelevanceGate({ entities, interpreted });
    expect(gate.kept).toHaveLength(0);
    expect(() => assertTopicalNeighborhood(gate, entities.length)).toThrowError(
      /Insufficient cultural-interest coverage/,
    );
  });

  it("matches coffee interest via cafe alias without substring tricks", () => {
    const score = scoreEntityRelevance(
      {
        id: "c1",
        name: "Harbor Cafe",
        category: "places",
        description: "specialty hospitality",
        affinity: 0.7,
        tags: ["cafe", "hospitality"],
      },
      ["coffee"],
      1,
    );
    expect(score.relevant).toBe(true);
    expect(termsMatch("coffee", new Set(["cafe"]))).toBe(true);
  });
});
