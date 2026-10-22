import type { CulturalTransfer } from "./cultural-transfer";
import { identifyFunctionalNeed } from "./functional-needs";

export interface FunctionalMechanism {
  status: "proposed" | "insufficient_evidence";
  origin: "engineering_hypothesis" | "not_established";
  functionalEvidence: "not_established";
  mechanism: string;
  userAction: string;
  measurableEffect: string;
  verification: string;
}

export function proposeFunctionalMechanism(
  object: string,
  transfers: readonly CulturalTransfer[],
  objective: string = "",
): FunctionalMechanism {
  const unsupported: FunctionalMechanism = {
    status: "insufficient_evidence",
    origin: "not_established",
    functionalEvidence: "not_established",
    mechanism: "No specific functional mechanism justified.",
    userAction: "No new functional action proposed.",
    measurableEffect: "No functional improvement established.",
    verification: "Identify a physically testable mechanism before claiming a functional change.",
  };

  const functionalNeed = identifyFunctionalNeed(objective, object);

  if (object.trim().toLowerCase() === "chair") {
    if (functionalNeed.need !== "adapt_seat_height") return unsupported;

    // Functional engineering hypotheses follow the user's explicit need.
    // Cultural evidence is evaluated separately and must not be invented
    // or used as a prerequisite for a mechanically testable proposal.
    return {
      status: "proposed",
      origin: "engineering_hypothesis",
      functionalEvidence: "not_established",
      mechanism:
        "Explore a chair with an independently engineered, positively locking seat-height adjustment mechanism. Structural strength, stability, adjustment range, and compatibility with the proposed cultural material treatment remain unverified.",
      userAction:
        "With the chair unoccupied, adjust the seat height and confirm that the locking mechanism is engaged before sitting.",
      measurableEffect:
        "Compare supported seat-height range, adjustment time, and task fit across different desk heights against a fixed-height chair.",
      verification:
        "Build and mechanically test a prototype, evaluate stability and structural loading with qualified review, assess pinch and locking hazards, measure task performance, and research existing height-adjustable chairs before claiming novelty.",
    };
  }

  if (object.trim().toLowerCase() === "organizer tray") {
    if (functionalNeed.need !== "adapt_storage") return unsupported;
    const compatible = transfers.some(
      (transfer) =>
        transfer.status === "hypothesis" &&
        /\b(ceramic|wood|woodwork|woodworking|timber)\b/i.test(
          transfer.observedSignal,
        ) &&
        /\b(tray body|raised edge)\b/i.test(
          transfer.designDecision,
        ),
    );

    if (!compatible) return unsupported;

    return {
      status: "proposed",
      origin: "engineering_hypothesis",
      functionalEvidence: "not_established",
      mechanism:
        "Explore a tray with repositionable internal dividers, using a separately engineered retention interface. Divider stability and compatibility with the proposed tray material remain unverified.",
      userAction:
        "Move the dividers to accommodate differently sized everyday objects.",
      measurableEffect:
        "Compare object fit, retrieval time, and storage efficiency against a fixed-compartment tray.",
      verification:
        "Prototype divider retention and load stability, test repeated adjustments, compare task performance, and research existing adjustable organizers before claiming novelty.",
    };
  }

  if (object.trim().toLowerCase() !== "table lamp") {
    return unsupported;
  }

  if (functionalNeed.need !== "reduce_glare") return unsupported;

  const ceramicBase = transfers.some(
    (transfer) =>
      transfer.status === "hypothesis" &&
      /\bceramic\b/i.test(transfer.observedSignal) &&
      /\b(?:lamp\s+)?base\b/i.test(transfer.designDecision),
  );

  const textileShade = transfers.some(
    (transfer) =>
      transfer.status === "hypothesis" &&
      /\b(textile|woven|fabric)\b/i.test(transfer.observedSignal) &&
      /\b(?:lamp\s+)?shade\b/i.test(transfer.designDecision),
  );

  if (!ceramicBase || !textileShade) {
    return unsupported;
  }

  return {
    status: "proposed",
    origin: "engineering_hypothesis",
    functionalEvidence: "not_established",
    mechanism:
      "Explore a removable textile shade sleeve on a ceramic-base table lamp, using a separately engineered attachment interface. The attachment design and material suitability remain unverified.",
    userAction:
      "With the lamp disconnected and cool, exchange a compatible shade sleeve before use.",
    measurableEffect:
      "Compare light distribution and glare between shade configurations at the same lamp output.",
    verification:
      "Prototype the attachment, assess heat and electrical safety with qualified review, and measure illuminance and glare against a conventional shade. Research comparable products before claiming novelty.",
  };
}
