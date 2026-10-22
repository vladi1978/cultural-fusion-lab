import { describe, expect, it } from "vitest";
import { generateOperationalDesign, OperationalDesignError } from "./operational-design";
import type { CreativeModel, CreativeModelRequest } from "./model";
import type { CreativeFrame } from "./types";

const frame: CreativeFrame = {
  sourceDomains: [
    { name: "Culture A", origin: "A", essence: "e", coreMechanics: ["Anticipate needs before requests", "Coordinate staff handoffs"] },
    { name: "Culture B", origin: "B", essence: "e", coreMechanics: ["Separated predictable routes", "Steady trip chaining"] },
  ],
  experientialGoals: ["g"], requirements: ["r"], offBrief: [], evidenceProbes: [],
};
const design = (mechA: string, mechB: string) => JSON.stringify({
  transfers: [
    { sourceDomain: "Culture A", sourceMechanism: mechA, operatingDecision: "The dispatcher checks each worker's shift end before assigning an escort.", participantAction: "Workers confirm shift end and fatigue before leaving the building.", dependency: "Escort assignment depends on anticipating the need before the request." },
    { sourceDomain: "Culture B", sourceMechanism: mechB, operatingDecision: "Riders follow fixed protected corridors with priority crossings at every junction.", participantAction: "Workers choose a corridor and chain one errand stop along it.", dependency: "Corridor predictability makes the escort timing reliable and repeatable." },
  ],
  crossCulturalDependency: "The anticipated escort follows the predictable corridor the worker selects, so corridor choice determines escort timing and shelter placement together.",
  removalConsequences: ["Without anticipation, the escort would never be ready when the corridor ride starts.", "Without predictable corridors, the escort would have no repeatable route to follow."],
  feasibilityUnknowns: ["Whether dispatchers can confirm shift ends in time."],
  pilotTest: "Run a supervised two-week pilot recording escort readiness, corridor completion and worker feedback without claiming safety outcomes.",
});
const mk = (replies: string[]) => {
  const calls: CreativeModelRequest[] = [];
  const model: CreativeModel = { id: "t", async complete(c) { calls.push(c); return replies[Math.min(calls.length - 1, replies.length - 1)]; } };
  return { calls, run: () => generateOperationalDesign({ frame, objective: "o", outputCategory: "experience", model }) };
};

describe("operational design reliability (offline)", () => {
  it("passes per-domain mechanism constraints to the model", async () => {
    const { calls, run } = mk([design("Anticipate needs before requests", "Separated predictable routes")]);
    await run();
    expect(calls[0].designConstraints).toEqual([
      { domain: "Culture A", mechanisms: ["Anticipate needs before requests", "Coordinate staff handoffs"] },
      { domain: "Culture B", mechanisms: ["Separated predictable routes", "Steady trip chaining"] },
    ]);
  });
  it("rewrites only exact case/punctuation variants of a listed mechanism", async () => {
    const { run } = mk([design("anticipate needs before requests.", "  SEPARATED predictable routes ")]);
    const d = await run();
    expect(d.transfers.map((t: { sourceMechanism: string }) => t.sourceMechanism)).toEqual(["Anticipate needs before requests", "Separated predictable routes"]);
  });
  it("retries once with feedback listing the allowed mechanisms, then succeeds", async () => {
    const { calls, run } = mk([design("Anticipating customers", "Separated predictable routes"), design("Coordinate staff handoffs", "Steady trip chaining")]);
    await run();
    expect(calls).toHaveLength(2);
    const retry = JSON.parse(calls[1].user);
    expect(retry.repairFeedback).toMatch(/Unrecognized source mechanism for Culture A/);
    expect(retry.repairFeedback).toContain("Coordinate staff handoffs");
  });
  it("never accepts a paraphrased mechanism: fails after the single retry", async () => {
    const { calls, run } = mk([design("Anticipating customers", "Separated predictable routes")]);
    await expect(run()).rejects.toThrow(OperationalDesignError);
    expect(calls).toHaveLength(2);
  });
});
