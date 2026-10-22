import { describe, expect, it } from "vitest";
import { assessBriefFidelity } from "./brief-fidelity";
import type { ConceptSpec } from "../types";

const objective = "Design an original urban mobility experience for shift workers in Louisville combining anticipatory hospitality and coordinated cycling. Both traditions must determine how the service operates, how workers participate, and how trips are coordinated. The result must not be a generic rideshare service, bicycle rental, tourist experience, or conventional shuttle. Identify operational dependencies, practical constraints, and a testable pilot without inventing infrastructure.";
const spec = (text: string): ConceptSpec => ({
  proposition: text, mechanics: text, journey: [{ id: "a", actor: "w", action: text, influenceEntityIds: [] }], pilotExperiment: text,
} as unknown as ConceptSpec);

describe("brief fidelity: exclusions are not requirements", () => {
  it("does not demand operational anchors for the excluded formats", () => {
    const good = spec("Shift workers participate by confirming shift end; trips are coordinated along protected cycling corridors with anticipatory hospitality at the exit. Operational dependencies and practical constraints are listed and a testable pilot measures service operation.");
    const r = assessBriefFidelity(objective, good);
    expect(r.detail).not.toMatch(/rideshare/);
    expect(r.ok).toBe(true);
  });
  it("still rejects a concept that ignores the positive requirements", () => {
    const r = assessBriefFidelity(objective, spec("A colorful loyalty app with badges and playlists for everyone."));
    expect(r.ok).toBe(false);
  });
});
