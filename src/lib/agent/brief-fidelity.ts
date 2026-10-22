/**
 * P10.20: Conservative brief-fidelity screening, not semantic understanding.
 * Only evaluates explicit multi-part requirements. Never counts the copied
 * frozenObjective, culturalInterest, or evidenceBoundary as proof of fidelity.
 * A failed check indicates missing textual support, not proven irrelevance.
 */
import type { ConceptSpec } from "../types";

const STOP = new Set((
  "the a an and or to of in on for with from through into that this their them who whose " +
  "design create build make use using should must need needs helps help can could would " +
  "participants users customers people product brand experience combination based including"
).split(" "));

function tokens(text: string): string[] {
  return [...new Set((text.toLowerCase().match(/[a-z\d]+/g) ?? [])
    .filter(word => word.length >= 4 && !STOP.has(word)))];
}

function stem(word: string): string {
  return word.replace(/(ing|ed|es|s)$/, "");
}

export function assessBriefFidelity(
  objective: string,
  spec: ConceptSpec,
): { ok: boolean; detail: string } {
  // Require a sufficiently descriptive brief before applying this screen.
  if (tokens(objective).length < 12) {
    return { ok: true, detail: "Brief too short for reliable lexical coverage; fidelity unverified." };
  }

  // Split user-authored requirements; do not infer requirements from demo entities.
  // Negated clauses ("must not be a generic rideshare...") state EXCLUSIONS, not requirements.
  // Demanding operational anchors for an excluded format would force the concept to describe it,
  // so they are skipped here; exclusions are enforced by the frame's offBrief checks instead.
  const NEGATED = /\b(must not|must never|should not|shall not|do not|does not|not be|never|avoid(?:s|ing)?)\b/i;
  const clauses = objective
    .split(/[.;!?]+|\b(?:through|while|where|so that|in order to)\b/gi)
    .filter(clause => !NEGATED.test(clause))
    .map(clause => tokens(clause))
    .filter(words => words.length >= 3);
  if (clauses.length < 2) {
    return { ok: true, detail: "No separable requirements; fidelity unverified." };
  }

  // Only generated, operational text. Explicitly exclude frozenObjective and
  // culture labels, which can be copied without implementing the brief.
  const operational = [
    spec.proposition, spec.mechanics,
    ...spec.journey.map(step => step.action),
    ...(spec.operatingRules ?? []).map(rule => rule.rule),
    spec.pilotExperiment,
  ].join(" ");
  const generated = new Set(tokens(operational).map(stem));
  const missing = clauses.filter(words => {
    const matches = words.filter(word => generated.has(stem(word))).length;
    return matches < Math.min(2, words.length);
  });
  return {
    ok: missing.length === 0,
    detail: missing.length === 0
      ? `All ${clauses.length} explicit brief clauses have at least two operational term anchors (lexical only; not semantic proof).`
      : `${missing.length}/${clauses.length} explicit brief clauses lack operational anchors: ${missing.map(words => words.slice(0, 5).join(" ")).join(" | ")}. Candidate rejected conservatively; no semantic verification claimed.`,
  };
}
