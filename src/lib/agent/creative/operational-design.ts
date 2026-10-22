import type { CreativeFrame } from "./types";
import type { CreativeModel } from "./model";
import {
  buildTransferContract,
  buildOperationalTransferTemplate,
} from "./transfer";
import {
  validateOperationalTransfer,
  type TransferValidationInput,
} from "./transfer-validation";

export class OperationalDesignError extends Error {}

function parseObject(raw: string): unknown {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");

  if (start < 0 || end <= start) {
    throw new OperationalDesignError(
      "Operational design did not return a JSON object."
    );
  }

  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new OperationalDesignError(
      "Opeational design returned invalid JSON."
    );
  }
}

export async function generateOperationalDesign(input: {
  frame: CreativeFrame;
  objective: string;
  outputCategory: string;
  location?: string;
  model: CreativeModel;
}): Promise<TransferValidationInput> {
  const { frame, model } = input;
  const designConstraints = frame.sourceDomains.map(d => ({ domain: d.name, mechanisms: d.coreMechanics }));
  let feedback: string | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
  const raw = await model.complete({
    stage: "operational_design",
    maxTokens: 1800,
    designConstraints,
    system: `You are designing the operational foundations of a
cross-cultural commercial concept.

Return ONLY one JSON object. No markdown.

Your task is NOT to write a complete product or service concept.

Design concrete operating decisions derived from the supplied
cultural mechanisms.

Required fields:
- transfers: one entry for each source cultural domain
- crossCulturalDependency
- removalConsequences: one explanation per domain
- feasibilityUnknowns
- pilotTest

Each transfer must contain:
- sourceDomain
- sourceMechanism
- operatingDecision
- participantAction
- dependency

Use the exact sourceDomain names supplied in the template.

Each sourceMechanism must exactly match one of the
coreMechanics listed for that cultural domain.

The operatingDecision must describe a real operating rule.
The participantAction must describe observable behavior.
The dependency must explain why that rule needs its
cultural mechanism.

The crossCulturalDependency must explain how mechanisms
from BOTH cultural domains jointly determine an essential
operating decision.

For removalConsequences, explain separately what would
break if each cultural domain were removed.

Do not invent infrastructure, partnerships, cultural evidence,
performance statistics, or local feasibility facts.

Explicitly identify unknowns that require real-world verification.

Design a concrete, falsifiable pilot test.

Respect the user's output category and exclusions.

Do not produce generic transportation apps, bicycle rentals,
or tourism experiences when the brief excludes them.`,
    user: JSON.stringify({
      objective: input.objective,
      outputCategory: input.outputCategory,
      location: input.location ?? null,
      frame,
      transferContract: buildTransferContract(frame),
      requiredStructure: buildOperationalTransferTemplate(frame),
      allowedMechanisms: designConstraints,
      repairFeedback: feedback,
      repairInstruction: feedback
        ? "Your previous design was rejected for the reasons in repairFeedback. Return a corrected design. Every sourceMechanism must be copied exactly, character for character, from allowedMechanisms for its domain."
        : null,
    }),
  });

  const parsed = parseObject(raw);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new OperationalDesignError(
      "Operational design must be a JSON object."
    );
  }

  const design = parsed as TransferValidationInput;
  canonicalizeDomains(frame, design);
  canonicalizeMechanisms(frame, design);
  const validation = validateOperationalTransfer(frame, design);

  if (validation.passed) return design;
  // Name what was expected and what came back (domain names only, no model prose), so a rejection is diagnosable.
  const returned = Array.isArray(design.transfers)
    ? design.transfers.map(t => (t && typeof (t as { sourceDomain?: unknown }).sourceDomain === "string" ? (t as { sourceDomain: string }).sourceDomain : "(missing)"))
    : [];
  const diagnostic = `expected domains ${JSON.stringify(frame.sourceDomains.map(d => d.name))}; returned transfer domains ${JSON.stringify(returned)}`;
  feedback = validation.failures.join("; ") + ` | ${diagnostic}` +
    ` | allowed mechanisms: ${JSON.stringify(designConstraints)}`;
  if (attempt === 1) {
    throw new OperationalDesignError(
      "Operational design rejected: " +
        validation.failures.join("; ") + ` (${diagnostic})`
    );
  }
  }
  throw new OperationalDesignError("Operational design rejected.");
}

const norm = (s: string) => s.trim().replace(/^[`"'“”]+|[`"'“”.;:,]+$/g, "").replace(/\s+/g, " ").toLowerCase();

/**
 * A source-domain name that differs from a frame domain only by case, whitespace, quotes or trailing punctuation
 * is rewritten to the frame's exact name, but only when it identifies exactly one domain and no other transfer
 * already uses that domain. Extra, missing or duplicated transfers are never repaired; they still fail validation.
 */
function canonicalizeDomains(frame: CreativeFrame, design: TransferValidationInput): void {
  const transfers = (design as { transfers?: unknown }).transfers;
  if (!Array.isArray(transfers)) return;
  const exact = new Set(frame.sourceDomains.map(d => d.name));
  const used = new Set<string>();
  for (const t of transfers) {
    const name = t && typeof t === "object" ? (t as Record<string, unknown>).sourceDomain : undefined;
    if (typeof name === "string" && exact.has(name)) used.add(name);
  }
  for (const t of transfers) {
    if (!t || typeof t !== "object") continue;
    const rec = t as Record<string, unknown>;
    if (typeof rec.sourceDomain !== "string" || exact.has(rec.sourceDomain)) continue;
    const hits = frame.sourceDomains.filter(d => norm(d.name) === norm(rec.sourceDomain as string));
    if (hits.length === 1 && !used.has(hits[0]!.name)) {
      rec.sourceDomain = hits[0]!.name;
      used.add(hits[0]!.name);
    }
  }
}

/**
 * A mechanism that differs from a listed one only by case, whitespace, quotes or trailing punctuation
 * is rewritten to the listed text. Anything else is left untouched and fails validation.
 */
function canonicalizeMechanisms(frame: CreativeFrame, design: TransferValidationInput): void {
  const transfers = (design as { transfers?: unknown }).transfers;
  if (!Array.isArray(transfers)) return;
  for (const t of transfers) {
    if (!t || typeof t !== "object") continue;
    const rec = t as Record<string, unknown>;
    const domain = frame.sourceDomains.find(d => d.name === rec.sourceDomain);
    if (!domain || typeof rec.sourceMechanism !== "string" || domain.coreMechanics.includes(rec.sourceMechanism)) continue;
    const hits = domain.coreMechanics.filter(m => norm(m) === norm(rec.sourceMechanism as string));
    if (hits.length === 1) rec.sourceMechanism = hits[0];
  }
}
