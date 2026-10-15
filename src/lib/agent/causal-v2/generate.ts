import type { CulturalEntity, EvidenceItem } from "../../types";
import { attributableEvidenceIds } from "./evidence-attribution";
import type { InterpretedObjective } from "../types";
import type { OpportunityHypothesis } from "../opportunity-types";
import { resolveOpportunitySignals } from "../opportunity-signals";
import {
  validateCausalDraft,
  type CausalConceptDraft,
} from "./types";

export interface GenerateCausalDraftInput {
  opportunity: OpportunityHypothesis;
  influences: CulturalEntity[];
  interpreted: InterpretedObjective;
  evidence?: EvidenceItem[];
}

export function generateCausalDraft(
  input: GenerateCausalDraftInput,
): CausalConceptDraft | null {
  const { opportunity, influences, interpreted, evidence } = input;

  if (opportunity.status !== "accepted") return null;

  const supporters = opportunity.supportingEntityIds
    .map(id => influences.find(entity => entity.id === id))
    .filter((entity): entity is CulturalEntity => Boolean(entity));

  if (supporters.length < 2) return null;

  const [left, right] = supporters;

  if (!left || !right || left.id === right.id) return null;

  const signals = resolveOpportunitySignals({
    opportunity,
    entities: influences,
    culturalInterest: interpreted.culturalInterest,
  });

  const leftSignal = left.tags
    .map(tag => tag.trim().toLowerCase())
    .find(tag => tag === signals.primary || tag === signals.secondary);

  const rightSignal = right.tags
    .map(tag => tag.trim().toLowerCase())
    .find(tag => tag === signals.secondary || tag === signals.primary);

  if (!leftSignal || !rightSignal) return null;

  // A choice between identical attributes is not an operational decision.
  // Reject rather than disguising repetition with different entity names.
  const sharedConvergence =
    leftSignal === rightSignal && opportunity.kind === "convergence";

  // Route is a category-based interaction, not a choice between signals.
  // It remains meaningful when music and place share a cultural signal.
  const eligibleMusicPlaceRoute =
    opportunity.kind === "complementarity" &&
    [left.category, right.category].includes("music") &&
    [left.category, right.category].includes("places") &&
    left.category !== right.category &&
    interpreted.outputCategory === "product";

  const placeFilmReveal =
    opportunity.kind === "complementarity" &&
    [left.category, right.category].includes("places") &&
    [left.category, right.category].includes("film") &&
    left.category !== right.category &&
    interpreted.outputCategory === "product";

  const revealPlaceEntity = left.category === "places" ? left : right;
  const revealFilmEntity = left.category === "film" ? left : right;

  if (
    leftSignal === rightSignal &&
    !sharedConvergence &&
    !eligibleMusicPlaceRoute &&
    !placeFilmReveal
  ) return null;

  if (!opportunity.evidenceIds.length) return null;

  const signalPair = new Set([leftSignal, rightSignal]);

  const musicFilmSequence =
    opportunity.kind === "complementarity" &&
    new Set([left.category, right.category]).size === 2 &&
    [left.category, right.category].includes("music") &&
    [left.category, right.category].includes("film") &&
    interpreted.outputCategory === "product";

  const convergenceValidation = sharedConvergence;

  const nightListening =
    signalPair.has("night") && signalPair.has("listening");

  const craftListening =
    signalPair.has("craft") && signalPair.has("listening");

  const placeEntity = left.category === "places" ? left : right;
  const routeMusicEntity = left.category === "music" ? left : right;

  const musicEntity = left.category === "music" ? left : right;
  const filmEntity = left.category === "film" ? left : right;

  const optionA = musicFilmSequence
    ? "Reveal music first, then film"
    : eligibleMusicPlaceRoute
      ? "Follow the place-linked cultural route"
      : placeFilmReveal
      ? "Unlock the visual piece through a spatial interaction"
      : convergenceValidation
    ? "Validate the shared collection rule before release"
    : nightListening
    ? "Activate the night access window"
    : craftListening
      ? "Complete the listening checkpoint before release"
      : `Prioritize ${leftSignal} from ${left.name}`;

  const optionB = musicFilmSequence
    ? "Reveal film first, then music"
    : eligibleMusicPlaceRoute
      ? "Explore both references without a fixed route"
      : placeFilmReveal
      ? "View the visual piece directly"
      : convergenceValidation
    ? "Release a limited pilot collection for feedback"
    : nightListening
    ? "Offer an unrestricted listening preview"
    : craftListening
      ? "Release the artifact without the listening checkpoint"
      : `Prioritize ${rightSignal} from ${right.name}`;

  if (optionA === optionB) return null;

  const consequencesByOption: Record<string, string> = musicFilmSequence
    ? {
        [optionA]: `First reveal ${musicEntity.name}, then ${filmEntity.name}.`,
        [optionB]: `First reveal ${filmEntity.name}, then ${musicEntity.name}.`,
      }
    : eligibleMusicPlaceRoute
      ? {
        [optionA]: `Start at ${placeEntity.name}, then encounter ${routeMusicEntity.name}.`,
        [optionB]: `Explore ${placeEntity.name} and ${routeMusicEntity.name} in either order.`,
      }
      : placeFilmReveal
      ? {
        [optionA]: `Interact with ${revealPlaceEntity.name} before revealing ${revealFilmEntity.name}.`,
        [optionB]: `Reveal ${revealFilmEntity.name} immediately, while retaining ${revealPlaceEntity.name} as context.`,
      }
      : convergenceValidation
    ? {
        [optionA]: "Release is held until the collection rule is validated.",
        [optionB]: "A limited pilot is released with validation still pending.",
      }
    : nightListening
    ? {
        [optionA]: "Access is checked against the configured night window.",
        [optionB]: "The visitor can play a preview without the time gate.",
      }
    : craftListening
      ? {
          [optionA]: "Artifact release remains locked until listening completion.",
          [optionB]: "The artifact is released without a listening prerequisite.",
        }
      : {
          [optionA]: `The prototype applies ${leftSignal} as its primary design constraint.`,
          [optionB]: `The prototype applies ${rightSignal} as its primary design constraint.`,
        };

  // P4.6 — Opportunity-aware concepts.
  // Distinguishes hypotheses without claiming validated affinity.
  const relationshipLabel = opportunity.kind.replace(/_/g, " ");
  const conceptObject =
    `${interpreted.outputCategory} concept: ${opportunity.title} ` +
    `(${relationshipLabel}; ${left.name} × ${right.name})`;

  const draft: CausalConceptDraft = {
    id: `causal-${opportunity.id}`,
    opportunityId: opportunity.id,
    outputCategory: interpreted.outputCategory,

    observations: [
      {
        entityId: left.id,
        signal: leftSignal,
        evidenceIds: evidence
          ? attributableEvidenceIds(left.id, opportunity.evidenceIds, evidence)
          : [...opportunity.evidenceIds],
      },
      {
        entityId: right.id,
        signal: rightSignal,
        evidenceIds: evidence
          ? attributableEvidenceIds(right.id, opportunity.evidenceIds, evidence)
          : [...opportunity.evidenceIds],
      },
    ],

    opportunityHypothesis: opportunity.whyCreativelyUseful,

    action: musicFilmSequence
      ? {
          actor: "Participant",
          verb: "sequence",
          object: `a two-stage cultural reveal combining ${musicEntity.name} and ${filmEntity.name}`,
          observableResult: "The order of two attributed cultural references changes",
        }
      : eligibleMusicPlaceRoute
      ? {
          actor: "Participant",
          verb: "route",
          object: `a cultural exploration linking ${placeEntity.name} and ${routeMusicEntity.name}`,
          observableResult: "The participant follows a place-first route or explores freely",
        }
      : placeFilmReveal
      ? {
          actor: "Participant",
          verb: "reveal",
          object: `a visual piece inspired by ${revealFilmEntity.name} within the context of ${revealPlaceEntity.name}`,
          observableResult: "The visual piece is revealed after a simulated interaction or immediately",
        }
      : convergenceValidation
      ? {
          actor: "Collection steward",
          verb: "converge",
          object: `a ${leftSignal} collection across ${left.category} and ${right.category}`,
          observableResult: "The collection enters validation or limited pilot release",
        }
      : nightListening
      ? {
          actor: "Visitor",
          verb: "unlock",
          object: "a timed listening sequence",
          observableResult: "Access is granted only during the proposed night window",
        }
      : craftListening
        ? {
            actor: "Maker",
            verb: "assemble",
            object: "a physical artifact linked to a listening checkpoint",
            observableResult: "The artifact is released only after checkpoint completion",
          }
        : {
            actor: "Participant",
            verb: "configure",
            object: conceptObject,
            observableResult: "One configuration is recorded for comparison",
          },

    decision: {
      actor: "Participant",
      question: musicFilmSequence
        ? "Which cultural reference should the participant encounter first?"
        : eligibleMusicPlaceRoute
      ? "Should exploration follow a place-linked route or remain open?"
      : placeFilmReveal
      ? "Should the visual piece require a spatial interaction to unlock?"
      : convergenceValidation
        ? "Should the shared collection rule be validated before release?"
        : "Which observed cultural attribute should control the prototype?",
      options: [optionA, optionB],
      consequencesByOption,
    },

    constraint: musicFilmSequence
      ? {
          rule: "Both observed cultural references must appear exactly once.",
          enforcement: "Permit only the two explicitly defined reveal orders.",
        }
      : eligibleMusicPlaceRoute
      ? {
          rule: "Both cultural references remain included; no physical route is claimed.",
          enforcement: "Apply the place-first sequence only to Path A.",
        }
      : placeFilmReveal
      ? {
          rule: "Both cultural references remain included; no real-world location or access is verified.",
          enforcement: "Simulate the interaction gate on Path A and direct access on Path B.",
        }
      : convergenceValidation
      ? {
          rule: "Both supporting categories must remain represented in the collection.",
          enforcement: "Track validation and pilot release as separate operational states.",
        }
      : nightListening
      ? {
          rule: "The full listening sequence requires the night window; the preview remains available.",
          enforcement: "Check the time gate for full access, but permit the preview path.",
        }
      : craftListening
        ? {
            rule: "Checkpoint completion is required only on the gated release path.",
            enforcement: "Verify completion for gated release; allow the explicitly ungated path.",
          }
        : {
            rule: "Both observed attributes must remain represented in the prototype.",
            enforcement: "Reject configurations that omit either attributed observation.",
          },

    consequence: musicFilmSequence
      ? "The participant experiences a music-first or film-first reveal sequence."
      : eligibleMusicPlaceRoute
      ? "The participant follows a place-first sequence or explores both references freely."
      : placeFilmReveal
      ? "The visual piece is either gated by a simulated spatial interaction or shown directly."
      : convergenceValidation
      ? "The collection is either held for validation or released as a limited pilot."
      : nightListening
      ? "The visitor either unlocks the timed listening sequence or is denied access."
      : craftListening
        ? "The maker either completes the listening checkpoint and releases the artifact, or the artifact remains locked."
        : "A selected configuration and its observable result can be compared against the alternative.",

    causalExplanation:
      `Creative hypothesis (${relationshipLabel}): ${opportunity.designImplication} ` +
      `The observations from ${left.name} and ${right.name} offer ` +
      `alternative design priorities. The selected path changes which ` +
      `observed attribute leads the proposed concept.`,

    differentiationHypothesis:
      `Test whether prioritizing ${leftSignal} versus ${rightSignal} ` +
      `produces a meaningfully different ${interpreted.outputCategory} outcome.`,

    pilotExperiment: musicFilmSequence
      ? "Randomize the two reveal orders in a small opt-in prototype; measure completion and comprehension separately without inferring market demand."
      : convergenceValidation
      ? "Compare a validation-first collection against a limited pilot; measure rule compliance, completion, and feedback without inferring demand."
      : nightListening
      ? "Test timed access with a small opt-in group; measure successful unlocks, denied attempts, and listening completion."
      : craftListening
        ? "Run a small workshop; measure checkpoint completion, artifact releases, and abandoned attempts."
        : "Prototype both configurations, record completion and preference separately, " +
          "and compare outcomes without claiming market demand.",

    evidenceBoundary:
      "Entity attributes are observations from the supplied source. " +
      "The configuration, causal mechanism, and expected outcomes are unvalidated creative hypotheses.",
  };

  return validateCausalDraft(draft).valid ? draft : null;
}
