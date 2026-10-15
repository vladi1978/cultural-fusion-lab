import { describe, expect, it } from "vitest";

import type { ConceptNarrative, CulturalEntity } from "../types";
import {
  assessMutationDifferentiation,
  transformConceptForMutation,
} from "./mutation-transform";
import { AgentError } from "./types";
import type { InterpretedObjective } from "./types";

const interpreted: InterpretedObjective = {
  rawObjective: "Design a late-night hospitality experience for curious travelers",
  culturalInterest: "jazz",
  location: "Lisbon",
  outputCategory: "experience",
  intentTokens: ["hospitality", "travelers", "jazz", "night"],
  themes: ["nocturnal", "hospitality", "sonic"],
  summary: "test",
};

const originalNarrative: ConceptNarrative = {
  whatItIs:
    "A private jazz listening salon in Lisbon: reserved seats, low light, and a single curated arc.",
  whoItServes:
    "Hosts and guests who want jazz to feel personal in Lisbon — typically 2–6 people, not a crowd.",
  howItWorks:
    "Small groups rotate through a space echoing Rooftop Listening Rooms; programming stitches Midnight Souk Ensemble with tactile pauses so conversation stays secondary to attention.",
  distinctive:
    "The experience sells focus — guided one-to-few encounters instead of nightlife volume.",
  inspiredBy:
    "Influences: Rooftop Listening Rooms (places) · Midnight Souk Ensemble (music) · Vinyl Clay (brands).",
  evidenceBoundary: "Demo hypothesis boundary.",
};

const rooftop: CulturalEntity = {
  id: "place-rooftop",
  name: "Rooftop Listening Rooms",
  category: "places",
  description: "Intimate venue fixture",
  affinity: 0.7,
  tags: ["jazz", "intimate", "listening"],
};

const orbitFilm: CulturalEntity = {
  id: "film-orbit",
  name: "Orbit of Ordinary Gods",
  category: "film",
  description: "Speculative film fixture",
  affinity: 0.7,
  tags: ["jazz", "speculative", "myth"],
};

const chromeMusic: CulturalEntity = {
  id: "music-chrome",
  name: "Chrome Lotus",
  category: "music",
  description: "Alt music fixture",
  affinity: 0.7,
  tags: ["jazz", "alt", "city"],
};

const weakTwin: CulturalEntity = {
  id: "place-twin",
  name: "Rooftop Twin Rooms",
  category: "places",
  description: "Near-duplicate place",
  affinity: 0.7,
  tags: ["jazz", "intimate", "listening"],
};

const retained: CulturalEntity[] = [
  {
    id: "music-1",
    name: "Midnight Souk Ensemble",
    category: "music",
    description: "x",
    affinity: 0.8,
    tags: ["jazz", "night"],
  },
  {
    id: "brand-1",
    name: "Vinyl Clay",
    category: "brands",
    description: "x",
    affinity: 0.7,
    tags: ["jazz", "craft"],
  },
];

describe("mutation transform engine", () => {
  it("makes a places→film mutation materially different (not a Variant rename)", () => {
    const result = transformConceptForMutation({
      interpreted,
      directionId: "intimate",
      originalTitle: "jazz Private Listening",
      originalNarrative,
      outgoing: rooftop,
      incoming: orbitFilm,
      retainedInfluences: retained,
      modeLabel: "demo",
    });

    expect(result.title).not.toMatch(/Variant/i);
    expect(result.title.toLowerCase()).not.toBe("jazz private listening");
    expect(result.narrative.whatItIs).not.toMatch(/reserved seats, low light/i);
    expect(result.narrative.whatItIs).toMatch(/screening|chapter|narrative|myth/i);
    expect(result.narrative.howItWorks).toMatch(/scene|chapter/i);
    expect(result.narrative.howItWorks).not.toBe(originalNarrative.howItWorks);
    expect(result.narrative.whoItServes).not.toBe(originalNarrative.whoItServes);
    expect(result.narrative.distinctive).toMatch(/film|chapter|mythic|narrative/i);

    const changed = result.diffs.filter((d) => d.changed);
    expect(changed.map((d) => d.field)).toEqual(
      expect.arrayContaining(["format", "mechanics", "audience", "distinctive"]),
    );
    for (const diff of changed) {
      expect(diff.why.length).toBeGreaterThan(20);
      expect(["creative_interpretation", "entity_metadata"]).toContain(diff.basis);
    }

    // Objective preserved in note
    expect(result.mutationNote).toMatch(/Design a late-night hospitality experience/i);
    expect(result.mutationNote).toMatch(/experience/);
  });

  it("yields different transformations for different incoming categories", () => {
    const film = transformConceptForMutation({
      interpreted,
      directionId: "intimate",
      originalTitle: "jazz Private Listening",
      originalNarrative,
      outgoing: rooftop,
      incoming: orbitFilm,
      retainedInfluences: retained,
    });
    const music = transformConceptForMutation({
      interpreted,
      directionId: "intimate",
      originalTitle: "jazz Private Listening",
      originalNarrative,
      outgoing: rooftop,
      incoming: chromeMusic,
      retainedInfluences: retained,
    });

    expect(film.incomingLens).toBe("narrative");
    expect(music.incomingLens).toBe("sonic");
    expect(film.narrative.howItWorks).not.toBe(music.narrative.howItWorks);
    expect(film.title).not.toBe(music.title);
    expect(film.narrative.whatItIs).not.toBe(music.narrative.whatItIs);
  });

  it("rejects weak same-category near-duplicates as insufficient differentiation", () => {
    expect(assessMutationDifferentiation(rooftop, weakTwin).sufficient).toBe(false);
    expect(() =>
      transformConceptForMutation({
        interpreted,
        directionId: "intimate",
        originalTitle: "jazz Private Listening",
        originalNarrative,
        outgoing: rooftop,
        incoming: weakTwin,
        retainedInfluences: retained,
      }),
    ).toThrow(AgentError);

    try {
      transformConceptForMutation({
        interpreted,
        directionId: "intimate",
        originalTitle: "jazz Private Listening",
        originalNarrative,
        outgoing: rooftop,
        incoming: weakTwin,
        retainedInfluences: retained,
      });
    } catch (err) {
      expect(err).toMatchObject({ code: "INSUFFICIENT_DIFFERENTIATION" });
    }
  });

  it("is deterministic for the same mutation inputs", () => {
    const a = transformConceptForMutation({
      interpreted,
      directionId: "intimate",
      originalTitle: "jazz Private Listening",
      originalNarrative,
      outgoing: rooftop,
      incoming: orbitFilm,
      retainedInfluences: retained,
      modeLabel: "demo",
    });
    const b = transformConceptForMutation({
      interpreted,
      directionId: "intimate",
      originalTitle: "jazz Private Listening",
      originalNarrative,
      outgoing: rooftop,
      incoming: orbitFilm,
      retainedInfluences: retained,
      modeLabel: "demo",
    });

    expect(a.title).toBe(b.title);
    expect(a.narrative).toEqual(b.narrative);
    expect(a.diffs).toEqual(b.diffs);
    expect(a.mutationNote).toBe(b.mutationNote);
  });
});
