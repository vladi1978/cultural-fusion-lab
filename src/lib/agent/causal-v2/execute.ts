import type { CausalConceptDraft } from "./types";

export interface CausalExecutionInput {
  selectedOption: string;
  withinTimeWindow?: boolean;
  listeningCompleted?: boolean;
}

export interface CausalExecutionResult {
  accepted: boolean;
  state: "unlocked" | "preview" | "released" | "locked" | "unsupported";
  explanation: string;
}

export function executeCausalDecision(
  draft: CausalConceptDraft,
  input: CausalExecutionInput,
): CausalExecutionResult {
  const { selectedOption } = input;

  if (!draft.decision.options.includes(selectedOption)) {
    return {
      accepted: false,
      state: "unsupported",
      explanation: "Selected option is not part of this concept.",
    };
  }

  if (draft.action.verb === "converge") {
    if (input.selectedOption === draft.decision.options[0]) {
      return {
        accepted: true,
        state: "locked",
        explanation: "Collection release is held for validation.",
      };
    }

    if (input.selectedOption === draft.decision.options[1]) {
      return {
        accepted: true,
        state: "released",
        explanation: "Limited pilot collection released; validation remains pending.",
      };
    }
  }

  if (draft.action.verb === "unlock") {
    if (selectedOption === "Offer an unrestricted listening preview") {
      return {
        accepted: true,
        state: "preview",
        explanation: "The visitor receives preview access.",
      };
    }

    if (selectedOption === "Activate the night access window") {
      const unlocked = input.withinTimeWindow === true;
      return {
        accepted: unlocked,
        state: unlocked ? "unlocked" : "locked",
        explanation: unlocked
          ? "The visitor meets the time-window requirement."
          : "The visitor is outside the required time window.",
      };
    }
  }

  if (draft.action.verb === "assemble") {
    if (
      selectedOption ===
      "Release the artifact without the listening checkpoint"
    ) {
      return {
        accepted: true,
        state: "released",
        explanation: "The artifact is released through the ungated path.",
      };
    }

    if (
      selectedOption ===
      "Complete the listening checkpoint before release"
    ) {
      const released = input.listeningCompleted === true;
      return {
        accepted: released,
        state: released ? "released" : "locked",
        explanation: released
          ? "Listening completion verified; artifact released."
          : "Listening checkpoint is incomplete; artifact remains locked.",
      };
    }
  }

  if (draft.action.verb === "sequence") {
    const index = draft.decision.options.indexOf(selectedOption);

    if (index !== 0 && index !== 1) {
      return {
        accepted: false,
        state: "unsupported",
        explanation: "Unsupported sequence option.",
      };
    }

    const firstCategory = index === 0 ? "music" : "film";
    const secondCategory = index === 0 ? "film" : "music";

    return {
      accepted: true,
      state: "preview",
      explanation:
        `Simulated reveal order: ${firstCategory} → ${secondCategory}. ` +
        "Both cultural references are included; this is not a validated user response.",
    };
  }

  if (draft.action.verb === "route") {
    const index = draft.decision.options.indexOf(selectedOption);

    if (index !== 0 && index !== 1) {
      return {
        accepted: false,
        state: "unsupported",
        explanation: "Unsupported route option.",
      };
    }

    return {
      accepted: true,
      state: "preview",
      explanation: index === 0
        ? "Simulated place-first route: place → music. Both references remain included; no physical route is verified."
        : "Simulated open exploration: place and music can be encountered in either order; no physical route is verified.",
    };
  }

  if (draft.action.verb === "reveal") {
    const index = draft.decision.options.indexOf(selectedOption);

    if (index !== 0 && index !== 1) {
      return {
        accepted: false,
        state: "unsupported",
        explanation: "Unsupported reveal option.",
      };
    }

    return {
      accepted: true,
      state: "preview",
      explanation: index === 0
        ? "Simulated spatial interaction → visual reveal. No physical location or user response is verified."
        : "Simulated direct visual reveal without an interaction gate. No user response is verified.",
    };
  }

  if (draft.action.verb === "configure") {
    const optionIndex = draft.decision.options.indexOf(selectedOption);

    if (optionIndex === 0 || optionIndex === 1) {
      const observation = draft.observations[optionIndex];

      if (!observation) {
        return {
          accepted: false,
          state: "unsupported",
          explanation: "The selected configuration lacks an observation.",
        };
      }

      return {
        accepted: true,
        state: "preview",
        explanation:
          `Configuration ${optionIndex === 0 ? "A" : "B"} selected: ` +
          `${observation.signal} controls the prototype. ` +
          "This is a simulated design decision, not a validated outcome.",
      };
    }
  }

  return {
    accepted: false,
    state: "unsupported",
    explanation: "No executable rule exists for this decision.",
  };
}
