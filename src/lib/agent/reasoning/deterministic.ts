/**
 * Deterministic ReasoningProvider for Cultural Opportunity Intelligence.
 * Rule-based only — no LLM. Does not invent Qloo relationships or demand.
 */

import { assessMechanismCompatibility } from "../mechanism-compat";
import { gateOpportunityHypotheses } from "../opportunity-gates";
import type {
  CulturalSignalGraph,
  OpportunityHypothesis,
  OpportunityKind,
  ReasoningContext,
} from "../opportunity-types";
import { buildCulturalSignalGraph } from "../signal-graph";
import type { InterpretedObjective, MechanismId } from "../types";
import type { ReasoningProvider } from "./provider";

export function createDeterministicReasoningProvider(): ReasoningProvider {
  return {
    id: "deterministic",

    buildSignalGraph(context: ReasoningContext): CulturalSignalGraph {
      return buildCulturalSignalGraph({
        entities: context.entities,
        evidence: context.evidence,
        affinities: context.affinities,
        conflicts: context.conflicts,
        provenanceByEntityId: context.provenanceByEntityId,
        mode: context.mode,
      });
    },

    proposeOpportunities(options: {
      graph: CulturalSignalGraph;
      interpreted: InterpretedObjective;
    }): OpportunityHypothesis[] {
      return proposeFromGraph(options.graph, options.interpreted);
    },

    gateOpportunities(options: {
      opportunities: OpportunityHypothesis[];
      interpreted: InterpretedObjective;
      graph: CulturalSignalGraph;
    }): OpportunityHypothesis[] {
      return gateOpportunityHypotheses(options);
    },
  };
}

function proposeFromGraph(
  graph: CulturalSignalGraph,
  interpreted: InterpretedObjective,
): OpportunityHypothesis[] {
  const interestTokens = tokenize(interpreted.culturalInterest);
  const out: OpportunityHypothesis[] = [];
  const conflictPairKeys = new Set(
    graph.conflicts.map((c) => pairKey(c.leftEntityId, c.rightEntityId)),
  );

  // Tension opportunities from explicit conflicts
  for (const conflict of graph.conflicts) {
    const rel = graph.relationships.find((r) => r.id === `rel-${conflict.id}`);
    const left = graph.entities.find((e) => e.id === conflict.leftEntityId);
    const right = graph.entities.find((e) => e.id === conflict.rightEntityId);
    if (!left || !right) continue;

    const signalIds = graph.signals
      .filter(
        (s) =>
          (s.entityId === left.id || s.entityId === right.id) &&
          conflict.opposition.some((o) => s.signal.includes(o.toLowerCase())),
      )
      .map((s) => s.id);

    const mechanism = pickMechanism(
      ["tension_dual"],
      [left, right],
      interpreted,
    );

    out.push({
      id: `opp-tension-${conflict.id}`,
      kind: "tension",
      title: `Unresolved ${conflict.opposition.join(" vs ")} tension`,
      supportingEntityIds: [left.id, right.id],
      supportingSignalIds: signalIds,
      whyCreativelyUseful: `Hypothesis: keeping ${conflict.opposition.join(" vs ")} as parallel poles may be creatively useful because collected tags explicitly oppose — not because affinity is verified.`,
      designImplication: `Design implication: shape the ${interpreted.outputCategory} journey as a dual-path fork that names the unresolved tension rather than inventing a false harmony.`,
      uncertainty:
        "Opposition is tag-level only; guest/user comprehension and desirability are unknown.",
      unsupportedAssumptions: [
        "No claim that audiences prefer tension-based formats.",
        "No Qloo affinity or demand signal supports this hypothesis.",
      ],
      evidenceIds: unique([
        ...(rel?.evidenceIds ?? []),
        ...evidenceForEntities(graph, [left.id, right.id]),
      ]),
      suggestedMechanismId: mechanism,
      status: "accepted",
      relationshipIds: rel ? [rel.id] : [],
    });
  }

  // Relationship-driven opportunities (skip pairs already in conflict for convergence)
  for (const rel of graph.relationships) {
    if (rel.basis === "explicit_conflict") continue;
    const key = pairKey(rel.leftEntityId, rel.rightEntityId);
    const left = graph.entities.find((e) => e.id === rel.leftEntityId);
    const right = graph.entities.find((e) => e.id === rel.rightEntityId);
    if (!left || !right) continue;
    if (left.category === right.category) continue;

    const shared = rel.sharedSignals.map((s) => s.toLowerCase());
    const nonInterestShared = shared.filter((s) => !interestTokens.has(s));
    const leftUnique = uniqueTags(left).filter(
      (t) => !shared.includes(t) && !interestTokens.has(t),
    );
    const rightUnique = uniqueTags(right).filter(
      (t) => !shared.includes(t) && !interestTokens.has(t),
    );

    const hasConflict = conflictPairKeys.has(key);

    let kind: OpportunityKind;
    if (hasConflict) {
      kind = "contrast";
    } else if (
      nonInterestShared.length > 0 &&
      leftUnique.length > 0 &&
      rightUnique.length > 0
    ) {
      kind = "complementarity";
    } else if (nonInterestShared.length >= 1) {
      kind = "convergence";
    } else if (shared.length > 0 && nonInterestShared.length === 0) {
      // Shared-interest-only — still propose so gates can reject transparently
      kind = "convergence";
    } else if (rel.basis === "co_collected") {
      kind = "convergence";
    } else {
      continue;
    }

    if (hasConflict && kind === "convergence") {
      kind = "contrast";
    }

    const mechanisms = suggestMechanisms(left.category, right.category, kind);
    const mechanism = pickMechanism(mechanisms, [left, right], interpreted);

    const signalIds = graph.signals
      .filter(
        (s) =>
          (s.entityId === left.id || s.entityId === right.id) &&
          (shared.includes(s.signal) ||
            leftUnique.includes(s.signal) ||
            rightUnique.includes(s.signal)),
      )
      .map((s) => s.id)
      .slice(0, 8);

    out.push({
      id: `opp-${kind}-${encodeURIComponent(left.id)}--${encodeURIComponent(right.id)}`,
      kind,
      title: titleFor(kind, left, right, nonInterestShared, shared),
      supportingEntityIds: [left.id, right.id],
      supportingSignalIds: signalIds,
      whyCreativelyUseful: whyFor(kind, left, right, nonInterestShared, shared, rel.basis),
      designImplication: implicationFor(
        kind,
        interpreted.outputCategory,
        left,
        right,
        nonInterestShared,
        leftUnique,
        rightUnique,
        mechanism,
      ),
      uncertainty: uncertaintyFor(rel.basis, graph.mode),
      unsupportedAssumptions: [
        "Creative usefulness is a hypothesis — not proven consumer demand.",
        "Shared tags are string overlaps, not verified Taste Graph edges.",
        ...(rel.basis === "co_collected"
          ? ["Co-collection does not establish cultural affinity."]
          : []),
      ],
      evidenceIds: unique([
        ...rel.evidenceIds,
        ...evidenceForEntities(graph, [left.id, right.id]),
      ]),
      suggestedMechanismId: mechanism,
      status: "accepted",
      relationshipIds: [rel.id],
    });
  }

  // Stable deterministic order
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

function suggestMechanisms(
  left: string,
  right: string,
  kind: OpportunityKind,
): MechanismId[] {
  if (kind === "tension" || kind === "contrast") {
    return ["tension_dual", "narrative_chapters", "spatial_circuit"];
  }
  const cats = new Set([left, right]);
  const ranked: MechanismId[] = [];
  if (cats.has("fashion")) ranked.push("material_layer");
  if (cats.has("brands")) ranked.push("brand_drop");
  if (cats.has("food")) ranked.push("hospitality_course");
  if (cats.has("places")) ranked.push("spatial_circuit");
  if (cats.has("music")) ranked.push("sonic_set");
  if (cats.has("film")) ranked.push("narrative_chapters");
  if (kind === "complementarity" && cats.has("fashion") && cats.has("brands")) {
    return ["material_layer", "brand_drop"];
  }
  if (kind === "complementarity" && cats.has("music") && cats.has("places")) {
    return ["sonic_set", "spatial_circuit"];
  }
  return ranked.length ? ranked : ["spatial_circuit"];
}

function pickMechanism(
  candidates: MechanismId[],
  entities: { category: string }[],
  interpreted: InterpretedObjective,
): MechanismId | undefined {
  const hingeByMechanism = {
    tension_dual: "tension",
    spatial_circuit: "places",
    narrative_chapters: "film",
    sonic_set: "music",
    brand_drop: "brands",
    material_layer: "fashion",
    hospitality_course: "food",
  } as const;

  const observedCategories = new Set(entities.map((entity) => entity.category));

  const supportedMechanisms = (
    Object.keys(hingeByMechanism) as MechanismId[]
  ).filter((mechanismId) => {
    const hinge = hingeByMechanism[mechanismId];
    return hinge !== "tension" && observedCategories.has(hinge);
  });

  const ordered = [...new Set([...candidates, ...supportedMechanisms])];

  for (const mechanismId of ordered) {
    const hingeCategory = hingeByMechanism[mechanismId];

    if (
      hingeCategory !== "tension" &&
      !observedCategories.has(hingeCategory)
    ) {
      continue;
    }

    const compatibility = assessMechanismCompatibility({
      mechanismId,
      output: interpreted.outputCategory,
      hingeCategory,
      culturalInterest: interpreted.culturalInterest,
      rawObjective: interpreted.rawObjective,
    });

    if (compatibility.applicable) {
      return mechanismId;
    }
  }

  return undefined;
}

function titleFor(
  kind: OpportunityKind,
  left: { name: string; category: string },
  right: { name: string; category: string },
  nonInterestShared: string[],
  shared: string[],
): string {
  const signal = nonInterestShared[0] ?? shared[0] ?? "cross-category";
  switch (kind) {
    case "complementarity":
      return `${left.category} × ${right.category} complementarity (${signal})`;
    case "convergence":
      return `${left.category} ↔ ${right.category} convergence on “${signal}”`;
    case "contrast":
      return `${left.category} / ${right.category} contrast`;
    case "tension":
      return `${left.name} vs ${right.name} tension`;
  }
}

function whyFor(
  kind: OpportunityKind,
  left: { name: string; category: string },
  right: { name: string; category: string },
  nonInterestShared: string[],
  shared: string[],
  basis: string,
): string {
  const signal = nonInterestShared[0] ?? shared[0] ?? "co-collection";
  if (kind === "complementarity") {
    return `Hypothesis: “${left.name}” (${left.category}) and “${right.name}” (${right.category}) may combine creatively because they share observed “${signal}” while contributing distinct category roles — basis=${basis}. Not a verified affinity.`;
  }
  if (kind === "contrast") {
    return `Hypothesis: contrast between “${left.name}” and “${right.name}” may be creatively useful if the deliverable makes the difference legible — not a resolved affinity.`;
  }
  return `Hypothesis: convergence on observed “${signal}” across ${left.category} and ${right.category} may justify a shared operating cue — still interpretive (basis=${basis}).`;
}

function implicationFor(
  kind: OpportunityKind,
  output: string,
  left: { name: string; category: string },
  right: { name: string; category: string },
  nonInterestShared: string[],
  leftUnique: string[],
  rightUnique: string[],
  mechanism?: MechanismId,
): string {
  const shared = nonInterestShared[0] ?? "shared cue";
  const mech = mechanism ?? "mechanism";
  if (kind === "complementarity") {
    return `Design implication: let “${left.name}” supply ${leftUnique[0] ?? left.category} structure and “${right.name}” supply ${rightUnique[0] ?? right.category} texture; shape the ${output} via ${mech} so the shared “${shared}” cue appears in the journey without claiming demand.`;
  }
  if (kind === "tension" || kind === "contrast") {
    return `Design implication: encode the ${kind} in the ${output} as an explicit fork or dual beat (${mech}), using “${left.name}” and “${right.name}” as opposing poles rather than averaging them.`;
  }
  return `Design implication: use the converged “${shared}” attribute to drive a single ${mech} rule across the ${output}, with “${left.name}” as hinge and “${right.name}” as supporting texture.`;
}

function uncertaintyFor(basis: string, mode: "demo" | "live"): string {
  const parts = [
    `Relationship basis=${basis} is not proof of real-world cultural affinity.`,
  ];
  if (mode === "demo") {
    parts.push("Demo fixtures — not live Qloo Taste Graph data.");
  }
  parts.push("No behavioral or purchase-intent evidence accompanies this hypothesis.");
  return parts.join(" ");
}

function evidenceForEntities(
  graph: CulturalSignalGraph,
  entityIds: string[],
): string[] {
  return graph.signals
    .filter((s) => entityIds.includes(s.entityId))
    .flatMap((s) => s.evidenceIds);
}

function uniqueTags(entity: { tags: string[] }): string[] {
  return [...new Set(entity.tags.map((t) => t.toLowerCase().trim()))].filter(
    (t) => t.length > 2,
  );
}

function tokenize(interest: string): Set<string> {
  return new Set(
    interest
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2),
  );
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("::");
}

function unique(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}
