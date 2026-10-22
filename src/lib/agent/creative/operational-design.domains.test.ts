import { describe, expect, it } from "vitest";
import { generateOperationalDesign, OperationalDesignError } from "./operational-design";
import type { CreativeModel } from "./model";
import type { CreativeFrame } from "./types";

const frame: CreativeFrame = {
  sourceDomains: [
    { name: "Group cycling culture", origin: "A", essence: "e", coreMechanics: ["Pace to the slowest rider"] },
    { name: "Live jazz listening", origin: "B", essence: "e", coreMechanics: ["Hold attention for a full set"] },
  ],
  experientialGoals: ["g"], requirements: ["r"], offBrief: [], evidenceProbes: [],
};
const transfer = (sourceDomain: string, sourceMechanism: string) => ({
  sourceDomain, sourceMechanism,
  operatingDecision: "Set the ride pace to the slowest rider on every leg.",
  participantAction: "Riders regroup at each stop before moving on together.",
  dependency: "The rule only works because pace follows the slowest rider.",
});
const body = (transfers: unknown[]) => JSON.stringify({
  transfers,
  crossCulturalDependency: "The ride pace sets how long each listening set can run, and the set length sets the stop timing.",
  removalConsequences: ["Without cycling there is no pace rule to schedule sets.", "Without jazz there is no set to hold the group still."],
  feasibilityUnknowns: ["Venue availability"], pilotTest: "Run two evenings and count how many riders stay for the full set.",
});
const run = (outputs: string[]) => {
  let i = 0; const calls = { n: 0 };
  const model: CreativeModel = { id: "offline", async complete() { calls.n++; return outputs[Math.min(i++, outputs.length - 1)]!; } };
  return { calls, p: generateOperationalDesign({ frame, objective: "o", outputCategory: "experience", model }) };
};
const good = [transfer("Group cycling culture", "Pace to the slowest rider"), transfer("Live jazz listening", "Hold attention for a full set")];

describe("operational design: source-domain names", () => {
  it("accepts exact names unchanged", async () => {
    const { p, calls } = run([body(good)]);
    const d = await p;
    expect(d.transfers.map(t => t.sourceDomain)).toEqual(["Group cycling culture", "Live jazz listening"]);
    expect(calls.n).toBe(1);
  });

  it("repairs a name that differs only by case, spacing or trailing punctuation, without another model call", async () => {
    const { p, calls } = run([body([transfer("Group Cycling Culture", "Pace to the slowest rider"), transfer("  live jazz   listening. ", "Hold attention for a full set")])]);
    const d = await p;
    expect(d.transfers.map(t => t.sourceDomain)).toEqual(["Group cycling culture", "Live jazz listening"]);
    expect(calls.n).toBe(1);
  });

  it("does NOT invent a match for a different name", async () => {
    const { p } = run([body([good[0], transfer("Jazz clubs", "Hold attention for a full set")])]);
    await expect(p).rejects.toThrow(/Expected exactly one transfer for Live jazz listening/);
  });

  it("does not repair a duplicated transfer or an extra one", async () => {
    const dup = body([good[0], good[0], good[1]]);
    await expect(run([dup]).p).rejects.toThrow(/Unexpected or duplicated/);
    const two = body([good[0], transfer("Group Cycling Culture", "Pace to the slowest rider")]);
    await expect(run([two]).p).rejects.toThrow(OperationalDesignError);
  });

  it("makes exactly one corrective retry and then names expected and returned domains in the error", async () => {
    const bad = body([good[0]]);
    const { p, calls } = run([bad, bad]);
    await expect(p).rejects.toThrow(/expected domains \["Group cycling culture","Live jazz listening"\]; returned transfer domains \["Group cycling culture"\]/);
    expect(calls.n).toBe(2);
  });

  it("succeeds on the corrective retry when the second answer is valid", async () => {
    const { p, calls } = run([body([good[0]]), body(good)]);
    await p;
    expect(calls.n).toBe(2);
  });
});
