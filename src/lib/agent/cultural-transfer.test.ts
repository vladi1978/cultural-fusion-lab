import * as CulturalTransferModule from "./cultural-transfer";
import { describe, expect, it } from "vitest";
import { proposeCulturalTransfer } from "./cultural-transfer";

describe("P9.141 evidence-constrained cultural transfer", () => {
  it("proposes a testable ceramic design hypothesis", () => {
    const result = proposeCulturalTransfer(
      "Moroccan Artisan Studio",
      "ceramic",
      "lamp base",
    );

    expect(result.status).toBe("hypothesis");
    expect(result.designDecision).toMatch(/ceramic.*lamp base/i);
    expect(result.verification).toMatch(/test/i);
  });

  it("does not invent a physical attribute from an unrelated signal", () => {
    const result = proposeCulturalTransfer(
      "Cultural Archive",
      "popular with visitors",
      "chair backrest",
    );

    expect(result.status).toBe("insufficient_evidence");
    expect(result.designDecision).not.toMatch(/ceramic|woven|wood|geometric/i);
  });

  it("does not treat a cultural identity as material evidence", () => {
    const result = proposeCulturalTransfer(
      "Scandinavian Design House",
      "Scandinavian",
      "shelf",
    );

    expect(result.status).toBe("insufficient_evidence");
  });

  it("proposes a testable textile transfer", () => {
    const result = proposeCulturalTransfer(
      "Nordic Textile Design",
      "woven textile",
      "chair seat",
    );

    expect(result.status).toBe("hypothesis");
    expect(result.designDecision).toMatch(/textile|woven/i);
  });
});

describe("P9.145 physical design signal selection", () => {
  it("finds ceramic even when generic tags appear first", async () => {
    const { selectPhysicalDesignSignal } =
      await import("./cultural-transfer");

    expect(
      selectPhysicalDesignSignal(
        ["craft", "handmade", "ceramic"],
        "craft",
      ),
    ).toBe("ceramic");
  });

  it("finds textile among several cultural tags", async () => {
    const { selectPhysicalDesignSignal } =
      await import("./cultural-transfer");

    expect(
      selectPhysicalDesignSignal(
        ["minimal", "utility", "woven textile"],
        "minimal",
      ),
    ).toBe("woven textile");
  });

  it("preserves the fallback when evidence is insufficient", async () => {
    const { selectPhysicalDesignSignal } =
      await import("./cultural-transfer");

    expect(
      selectPhysicalDesignSignal(
        ["popular", "traditional", "regional"],
        "traditional",
      ),
    ).toBe("traditional");
  });
});

describe("P9.148 complementary physical design transfers", () => {
  it("assigns two observed signals to different components", async () => {
    const { proposeComplementaryTransfers } =
      await import("./cultural-transfer");

    const [primary, secondary] = proposeComplementaryTransfers(
      { source: "Moroccan Artisan Studio", signal: "ceramic" },
      { source: "Nordic Textile Design", signal: "textile" },
      ["lamp base", "lamp shade"],
    );

    expect(primary.status).toBe("hypothesis");
    expect(primary.designDecision).toMatch(/ceramic.*lamp base/i);

    expect(secondary.status).toBe("hypothesis");
    expect(secondary.designDecision).toMatch(/textile.*lamp shade/i);

    expect(primary.source).not.toBe(secondary.source);
  });

  it("does not invent a second component when only one exists", async () => {
    const { proposeComplementaryTransfers } =
      await import("./cultural-transfer");

    const [, secondary] = proposeComplementaryTransfers(
      { source: "Studio A", signal: "ceramic" },
      { source: "Studio B", signal: "textile" },
      ["tray body"],
    );

    expect(secondary.status).toBe("insufficient_evidence");
    expect(secondary.designDecision).toBe(
      "No design transfer proposed.",
    );
  });
});

describe("P9.152 preliminary material compatibility", () => {
  it("blocks textile transfer to a drainage component", () => {
    const result = proposeCulturalTransfer(
      "Textile Studio",
      "textile",
      "drainage provision",
    );
    expect(result.status).toBe("insufficient_evidence");
    expect(result.verification).toMatch(/engineering review/i);
  });

  it("blocks ceramic transfer to a mounting structure", () => {
    const result = proposeCulturalTransfer(
      "Ceramic Studio",
      "ceramic",
      "mounting or support structure",
    );
    expect(result.status).toBe("insufficient_evidence");
  });

  it("preserves a ceramic hypothesis for a lamp base", () => {
    const result = proposeCulturalTransfer(
      "Ceramic Studio",
      "ceramic",
      "base",
    );
    expect(result.status).toBe("hypothesis");
  });
});

describe("P9.155 compatible component selection", () => {
  it("skips incompatible drainage and selects another component", () => {
    const [primary, secondary] = CulturalTransferModule.proposeComplementaryTransfers(
      { source: "Ceramic Studio", signal: "ceramic" },
      { source: "Textile Studio", signal: "textile" },
      ["plant container", "drainage provision", "decorative sleeve"],
    );

    expect(primary.status).toBe("hypothesis");
    expect(secondary.status).toBe("hypothesis");
    expect(secondary.designDecision).toContain("decorative sleeve");
    expect(secondary.designDecision).not.toContain("drainage provision");
  });

  it("preserves insufficient evidence when no compatible alternative exists", () => {
    const [, secondary] = CulturalTransferModule.proposeComplementaryTransfers(
      { source: "Ceramic Studio", signal: "ceramic" },
      { source: "Textile Studio", signal: "textile" },
      ["plant container", "drainage provision"],
    );

    expect(secondary.status).toBe("insufficient_evidence");
    expect(secondary.verification).toMatch(/engineering review/i);
  });
});

describe("P9.157 bidirectional component compatibility", () => {
  it("moves the primary influence away from an incompatible component", () => {
    const [primary, secondary] =
      CulturalTransferModule.proposeComplementaryTransfers(
        { source: "Ceramic Studio", signal: "ceramic" },
        { source: "Textile Studio", signal: "textile" },
        ["mounting structure", "lamp base", "lamp shade"],
      );

    expect(primary.status).toBe("hypothesis");
    expect(primary.designDecision).toContain("lamp base");
    expect(secondary.status).toBe("hypothesis");
    expect(secondary.designDecision).toContain("lamp shade");
  });

  it("does not assign both influences to a single component", () => {
    const [primary, secondary] =
      CulturalTransferModule.proposeComplementaryTransfers(
        { source: "Ceramic Studio", signal: "ceramic" },
        { source: "Textile Studio", signal: "textile" },
        ["tray body"],
      );

    expect(primary.status).toBe("hypothesis");
    expect(secondary.status).toBe("insufficient_evidence");
  });
});
