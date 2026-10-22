import { describe, expect, it } from "vitest";
import { liveBoundary } from "./compose";

describe("liveBoundary", () => {
  it("removes claims that live entities are fictional demo data", () => {
    const out = liveBoundary("This is a hypothesis. The entities are fictional demo metadata, not verified Qloo evidence or proof of Louisville demand. No evidence verifies Louisville audience.");
    expect(/fictional|demo/i.test(out)).toBe(false);
    expect(out).toContain("hypothesis");
    expect(out).toContain("real Qloo API results");
    expect(out).toContain("No evidence verifies Louisville audience.");
  });
  it("adds the word hypothesis when the model omitted it", () => {
    const out = liveBoundary("Demo entities are fictional.");
    expect(out.startsWith("This is a hypothesis.")).toBe(true);
    expect(/fictional/i.test(out)).toBe(false);
  });
  it("keeps honest limits untouched", () => {
    const out = liveBoundary("This is a hypothesis. Demand and permits are unverified.");
    expect(out).toContain("Demand and permits are unverified.");
  });
  it("does not repeat the provenance note when the model already stated it", () => {
    const out = liveBoundary("This is a hypothesis. The Qloo entities are real results but only loose proxies; they do not verify demand.");
    expect(out.match(/loose prox/gi)?.length).toBe(1);
  });
});
