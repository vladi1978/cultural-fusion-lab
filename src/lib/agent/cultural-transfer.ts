export interface CulturalTransfer {
  source: string;
  observedSignal: string;
  designDecision: string;
  verification: string;
  status: "hypothesis" | "insufficient_evidence";
}

export function proposeCulturalTransfer(
  source: string,
  signal: string,
  component: string,
): CulturalTransfer {
  const observedSignal = signal.trim();
  const target = component.trim();

  if (!source.trim() || !target || !observedSignal) {
    return {
      source,
      observedSignal,
      designDecision: "No design transfer proposed.",
      verification: "Obtain attributable evidence before proposing a transfer.",
      status: "insufficient_evidence",
    };
  }

  const normalized = observedSignal.toLowerCase();
  const normalizedTarget = target.toLowerCase();

  // P9.152: conservative preliminary physical compatibility gate.
  // These rules identify review needs; they do not certify safety.
  const incompatible =
    (/\b(textile|woven|weaving|fabric)\b/.test(normalized) &&
      /\b(drainage|drain|filter holder|mounting|support structure)\b/.test(normalizedTarget)) ||
    (/\b(ceramic|pottery)\b/.test(normalized) &&
      /\b(backrest|support structure|mounting)\b/.test(normalizedTarget));

  if (incompatible) {
    return {
      source,
      observedSignal,
      designDecision: "No design transfer proposed.",
      verification:
        "Material-component compatibility requires engineering review before proposing this application.",
      status: "insufficient_evidence",
    };
  }

  const mappings: Array<{
    pattern: RegExp;
    decision: string;
    verification: string;
  }> = [
    {
      pattern: /\b(ceramic|pottery)\b/,
      decision: `Evaluate a ceramic construction or finish for the ${target}.`,
      verification: "Test material suitability, durability, and manufacturing feasibility.",
    },
    {
      pattern: /\b(textile|woven|weaving|fabric)\b/,
      decision: `Evaluate a woven or textile-based surface treatment for the ${target}.`,
      verification: "Test attachment, cleaning, durability, and suitability for the component.",
    },
    {
      pattern: /\b(wood|woodwork|woodworking|timber)\b/,
      decision: `Evaluate a wood-based construction detail for the ${target}.`,
      verification: "Test structural suitability, joints, finish, and manufacturing feasibility.",
    },
    {
      pattern: /\b(geometric|geometry|pattern)\b/,
      decision: `Explore a geometric surface composition on the ${target}.`,
      verification: "Compare documented source motifs and assess functional interference.",
    },
  ];

  const match = mappings.find((mapping) =>
    mapping.pattern.test(normalized),
  );

  if (!match) {
    return {
      source,
      observedSignal,
      designDecision: "No material or form decision justified by this signal.",
      verification: "Obtain specific evidence connecting the signal to a physical design attribute.",
      status: "insufficient_evidence",
    };
  }

  return {
    source,
    observedSignal,
    designDecision: match.decision,
    verification: match.verification,
    status: "hypothesis",
  };
}

export function selectPhysicalDesignSignal(
  tags: readonly string[],
  fallback: string,
): string {
  const candidates = tags
    .map((tag) => tag.trim())
    .filter(Boolean);

  for (const tag of candidates) {
    const transfer = proposeCulturalTransfer(
      "Evidence candidate",
      tag,
      "product component",
    );

    if (transfer.status === "hypothesis") {
      return tag;
    }
  }

  return fallback;
}

export function proposeComplementaryTransfers(
  primary: { source: string; signal: string },
  secondary: { source: string; signal: string },
  components: readonly string[],
): [CulturalTransfer, CulturalTransfer] {
  const usable = [...new Set(
    components.map((part) => part.trim()).filter(Boolean),
  )];

  const evaluate = (
    influence: { source: string; signal: string },
    component: string,
  ) => proposeCulturalTransfer(
    influence.source,
    influence.signal,
    component,
  );

  const primaryCandidates = usable.map((component) =>
    evaluate(primary, component),
  );

  // Keep the product's principal component whenever it is compatible.
  const firstIndex = primaryCandidates.findIndex(
    (candidate) => candidate.status === "hypothesis",
  );

  const selectedIndex = firstIndex >= 0 ? firstIndex : 0;
  const first = primaryCandidates[selectedIndex] ??
    evaluate(primary, "");

  // The second influence may use only another component.
  const secondaryCandidates = usable
    .filter((_, index) => index !== selectedIndex)
    .map((component) => evaluate(secondary, component));

  const second = secondaryCandidates.find(
    (candidate) => candidate.status === "hypothesis",
  ) ?? secondaryCandidates[0] ?? evaluate(secondary, "");

  return [first, second];
}
