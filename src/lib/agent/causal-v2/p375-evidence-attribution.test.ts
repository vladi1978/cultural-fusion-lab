import { attributableEvidenceIds } from "./evidence-attribution";
import { describe, expect, it } from "vitest";
import type { EvidenceItem } from "../../types";

/**
 * P3.7.5 — Evidence attribution contract.
 *
 * Collection evidence is not proof of cultural affinity.
 * An observation may cite only evidence explicitly linked
 * to its supporting entity.
 */

const evidence: EvidenceItem[] = [
  {
    id: "ev-artist",
    source: "mock_demo",
    label: "Artist fixture",
    detail: "Synthetic artist metadata",
    relatedEntityIds: ["artist"],
    createdAt: "2026-10-11T00:00:00.000Z",
  },
  {
    id: "ev-brand",
    source: "mock_demo",
    label: "Brand fixture",
    detail: "Synthetic brand metadata",
    relatedEntityIds: ["brand"],
    createdAt: "2026-10-11T00:00:00.000Z",
  },
  {
    id: "ev-shared",
    source: "mock_demo",
    label: "Shared collection",
    detail: "Synthetic collection metadata, not affinity proof",
    relatedEntityIds: ["artist", "brand"],
    createdAt: "2026-10-11T00:00:00.000Z",
  },
  {
    id: "ev-unrelated",
    source: "mock_demo",
    label: "Unrelated fixture",
    detail: "Synthetic film metadata",
    relatedEntityIds: ["film"],
    createdAt: "2026-10-11T00:00:00.000Z",
  },
];

describe("P3.7.5 evidence attribution contract", () => {
  it("attributes evidence only to explicitly linked entities", () => {
    const ids = evidence.map(item => item.id);

    expect(attributableEvidenceIds("artist", ids, evidence))
      .toEqual(["ev-artist", "ev-shared"]);

    expect(attributableEvidenceIds("brand", ids, evidence))
      .toEqual(["ev-brand", "ev-shared"]);
  });

  it("does not assign unrelated evidence to an observation", () => {
    expect(
      attributableEvidenceIds(
        "artist",
        ["ev-brand", "ev-unrelated"],
        evidence,
      ),
    ).toEqual([]);
  });

  it("does not invent missing evidence identifiers", () => {
    expect(
      attributableEvidenceIds("artist", ["missing-id"], evidence),
    ).toEqual([]);
  });

  it("does not treat an unlisted evidence ID as authorized", () => {
    expect(
      attributableEvidenceIds("artist", ["ev-brand"], evidence),
    ).toEqual([]);
  });
});
