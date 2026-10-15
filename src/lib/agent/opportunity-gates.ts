/**
 * Critical gates for OpportunityHypothesis acceptance.
 * Rejects weak shared-interest-only links and unsupported cross-domain claims.
 */

import { assessMechanismCompatibility } from "./mechanism-compat";
import type {
  CulturalSignalGraph,
  OpportunityHypothesis,
} from "./opportunity-types";
import type { InterpretedObjective } from "./types";

const INTEREST_STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "culture",
  "cultural",
]);

export function gateOpportunityHypotheses(options: {
  opportunities: OpportunityHypothesis[];
  interpreted: InterpretedObjective;
  graph: CulturalSignalGraph;
}): OpportunityHypothesis[] {
  const { opportunities, interpreted, graph } = options;
  const interestTokens = tokenizeInterest(interpreted.culturalInterest);

  return opportunities.map((opp) => {
    const failures: string[] = [];

    // Design implication must be concrete
    if (
      opp.designImplication.trim().length < 40 ||
      !/\b(imply|implies|suggests?|shape|inform|drive|use|sequence|kit|touchpoint|journey|mechanic|mechanism|deliverable)\b/i.test(
        opp.designImplication,
      )
    ) {
      failures.push("Missing concrete design implication for the deliverable.");
    }

    // Evidence required
    if (opp.evidenceIds.length === 0) {
      failures.push("No traceable evidence IDs.");
    }
    if (opp.supportingEntityIds.length < 2) {
      failures.push("Need at least two supporting entities.");
    }

    // Shared-interest-only weakness
    const rels = graph.relationships.filter((r) =>
      opp.relationshipIds.includes(r.id),
    );
    const sharedFromRels = new Set(
      rels.flatMap((r) => r.sharedSignals.map((s) => s.toLowerCase())),
    );
    const nonInterestShared = [...sharedFromRels].filter(
      (s) => !interestTokens.has(s) && !INTEREST_STOP.has(s),
    );

    if (opp.kind === "convergence" || opp.kind === "complementarity") {
      const onlyCoCollected =
        rels.length > 0 &&
        rels.every((r) => r.basis === "co_collected");
      if (onlyCoCollected) {
        failures.push(
          "Co-collection-only link without shared attributes — too weak.",
        );
      }
      if (sharedFromRels.size > 0 && nonInterestShared.length === 0) {
        failures.push(
          "Shared-interest-only link without meaningful additional attributes.",
        );
      }
    }

    // Contradictions must not be presented as verified affinity / convergence
    const conflictRels = rels.filter((r) => r.basis === "explicit_conflict");
    if (
      conflictRels.length > 0 &&
      (opp.kind === "convergence" || opp.kind === "complementarity")
    ) {
      failures.push(
        "Contradiction presented as convergence/complementarity — treat as tension/contrast instead.",
      );
    }
    if (
      opp.kind === "tension" &&
      /verified affinity|proven affinity|confirmed taste/i.test(
        opp.whyCreativelyUseful + opp.designImplication,
      )
    ) {
      failures.push("Tension mislabeled as verified affinity.");
    }

    // Unsupported behavioral / demand claims
    if (
      /\b(underserved market|proven demand|consumers will|behavioral pattern|will purchase|guaranteed affinity)\b/i.test(
        `${opp.whyCreativelyUseful} ${opp.designImplication}`,
      )
    ) {
      failures.push(
        "Unsupported behavioral or market-demand claim in opportunity text.",
      );
    }

    // Mechanism compatibility with output category
    if (opp.suggestedMechanismId) {
      const mechHinge = hingeForMechanism(opp.suggestedMechanismId);
      const compat = assessMechanismCompatibility({
        mechanismId: opp.suggestedMechanismId,
        output: interpreted.outputCategory,
        hingeCategory: mechHinge,
        culturalInterest: interpreted.culturalInterest,
        rawObjective: interpreted.rawObjective,
      });
      if (!compat.applicable) {
        failures.push(
          `Suggested mechanism ${opp.suggestedMechanismId} incompatible with output ${interpreted.outputCategory}.`,
        );
      }
    }

    // Sparse evidence downgrade (not hard reject if otherwise strong)
    const sparse =
      graph.entities.length < 3 ||
      opp.evidenceIds.length < 1 ||
      graph.uncertainties.some((u) => /sparse/i.test(u));

    if (failures.length > 0) {
      return {
        ...opp,
        status: "rejected" as const,
        rejectionReason: failures.join(" "),
      };
    }

    if (sparse && opp.kind !== "tension") {
      return {
        ...opp,
        status: "downgraded" as const,
        rejectionReason:
          "Sparse neighborhood — opportunity kept as weak hypothesis only.",
        uncertainty: `${opp.uncertainty} Sparse evidence reduces confidence.`,
      };
    }

    return { ...opp, status: "accepted" as const, rejectionReason: undefined };
  });
}

function tokenizeInterest(interest: string): Set<string> {
  return new Set(
    interest
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2 && !INTEREST_STOP.has(t)),
  );
}

function hingeForMechanism(
  mechanismId: OpportunityHypothesis["suggestedMechanismId"],
): Parameters<typeof assessMechanismCompatibility>[0]["hingeCategory"] {
  switch (mechanismId) {
    case "spatial_circuit":
      return "places";
    case "narrative_chapters":
      return "film";
    case "sonic_set":
      return "music";
    case "brand_drop":
      return "brands";
    case "material_layer":
      return "fashion";
    case "hospitality_course":
      return "food";
    case "tension_dual":
      return "tension";
    default:
      return "music";
  }
}

/** Opportunities usable for synthesis (accepted, plus non-rejected downgraded as last resort). */
export function selectableOpportunities(
  gated: OpportunityHypothesis[],
): OpportunityHypothesis[] {
  const accepted = gated.filter((o) => o.status === "accepted");
  if (accepted.length > 0) return accepted;
  return gated.filter((o) => o.status === "downgraded");
}
