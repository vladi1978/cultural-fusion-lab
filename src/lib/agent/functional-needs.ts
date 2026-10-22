export type FunctionalNeed =
  | "reduce_glare"
  | "adapt_storage"
  | "adapt_seat_height"
  | "not_established";

export interface FunctionalNeedAssessment {
  need: FunctionalNeed;
  evidence: string;
  status: "explicit" | "not_established";
}

export function identifyFunctionalNeed(
  objective: string,
  object: string,
): FunctionalNeedAssessment {
  const normalizedObjective = objective.trim();
  const normalizedObject = object.trim().toLowerCase();

  if (
    normalizedObject === "table lamp" &&
    /\b(glare|glare reduction|reduce glare|deslumbramiento)\b/i.test(
      normalizedObjective,
    )
  ) {
    return {
      need: "reduce_glare",
      evidence: normalizedObjective,
      status: "explicit",
    };
  }

  if (
    normalizedObject === "organizer tray" &&
    /\b(adjustable compartments|different sizes|variable sizes|compartimentos ajustables|tamaños diferentes)\b/i.test(
      normalizedObjective,
    )
  ) {
    return {
      need: "adapt_storage",
      evidence: normalizedObjective,
      status: "explicit",
    };
  }

  if (
    normalizedObject === "chair" &&
    /\b(different (?:desk|work(?:ing)?) heights|varying (?:desk|work(?:ing)?) heights|adjustable seat height|adjust seat height|altura ajustable del asiento|diferentes alturas de trabajo)\b/i.test(
      normalizedObjective,
    )
  ) {
    return {
      need: "adapt_seat_height",
      evidence: normalizedObjective,
      status: "explicit",
    };
  }

  return {
    need: "not_established",
    evidence: "",
    status: "not_established",
  };
}
