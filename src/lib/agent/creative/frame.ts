/**
 * Stage 1: objective → CreativeFrame.
 * The model reasons about what the objective actually asks for. Nothing here
 * invents Qloo facts; probes are only *queries* to be run against Qloo later.
 */

import { isQlooEntityType } from "../../qloo/schemas";
import type { ExplorationRequest } from "../../types";
import type { CreativeModel } from "./model";
import {
  CreativeFrameError,
  type CreativeFrame,
  type EvidenceProbe,
  type SourceDomain,
} from "./types";

export const FRAME_SYSTEM = `You are the creative lead for a cultural-fusion studio. Read the objective like a brief from a client.
Decide what is actually being asked for before anything else.
Rules:
- Identify EACH cultural practice or domain the objective names or clearly implies. Describe what it is *for* and the concrete mechanics that could transfer to a new design.
- Apply FUNCTIONAL CULTURAL TRANSFER: distinguish the literal cultural activity from the operating principle that makes it effective. A source practice may inspire rules for coordination, reliability, safety, trust, anticipation, participation, or decision-making without reproducing its original physical activity.
- For EACH source domain, provide at least TWO distinct transferable coreMechanics expressed as actionable operating rules, not cultural labels, aesthetic motifs, objects, or generic virtues.
- Do not assume that infrastructure, organizations, customs, or resources from the source culture exist in the destination location. Identify such dependencies as unverified assumptions, not facts.
- Seek mechanisms that can interact causally with mechanisms from the other source domains. Their combination should change how the eventual solution operates, rather than merely combine two recognizable cultural features.
- Preserve any physical activity explicitly required by the user; functional transfer must not override the brief. Conversely, do not introduce bicycles, rentals, hospitality venues, mobile apps, or other literal implementations unless the objective requires them or their necessity can be justified.
- Distinguish cultural interpretations from verified facts. Do not claim that a proposed transferable mechanism has been culturally validated without supporting evidence.
- State requirements the result must satisfy (medium, interaction, audience, setting). Quote the objective's own constraints; do not add genre or aesthetic preferences it never expressed.
- List "offBrief": plausible-looking results that ignore the practices themselves (e.g. a generic music or retail concept layered on top).
- Do not prescribe a solution prematurely. A mobility experience does not necessarily require a mobile app, bicycle rental, or bike-sharing. Preserve the client's actual constraints and explore multiple possible operating models.
- Separate what the client explicitly requires from your own assumptions. Never present an assumption as a requirement.
- Propose 3-6 evidence probes: short, GENERIC lowercase topic words (a practice, activity, genre, material or setting) to look up in Qloo's taste graph. Never write a proper name of a venue, brand, person, artist or film you happen to recall: such names are not sent to Qloo. Never reuse the whole objective as a query.
- Match every probe to its actual entity type. A hospitality practice is not an artist. A demographic group is not a person. Infrastructure is not a person. Do not force abstract concepts into unrelated entity types.
- Prefer concrete topic words over abstract ones, and never invent organizations.
- If a cultural practice cannot be directly represented by Qloo's supported entity types, use a relevant generic topic word as a proxy and explicitly explain its limitations in the why field.
Return ONLY JSON, no prose, matching:
{"sourceDomains":[{"name":"","origin":"","essence":"","coreMechanics":[""]}],
 "experientialGoals":[""],"requirements":[""],"offBrief":[""],
 "evidenceProbes":[{"query":"","entityType":"urn:entity:artist|urn:entity:movie|urn:entity:brand|urn:entity:place|urn:entity:person","why":""}]}`;

export function buildFrameUser(request: ExplorationRequest): string {
  return [
    `Creative objective: ${request.creativeObjective}`,
    `Cultural interest: ${request.culturalInterest}`,
    request.location ? `Location: ${request.location}` : null,
    `Output category: ${request.outputCategory}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function strArray(v: unknown, field: string, min: number): string[] {
  if (
    !Array.isArray(v) ||
    v.length < min ||
    !v.every((s) => typeof s === "string" && s.trim().length > 0)
  ) {
    throw new CreativeFrameError(`"${field}" must be ≥${min} non-empty strings.`);
  }
  return v.map((s: string) => s.trim());
}

function text(v: unknown, field: string): string {
  if (typeof v !== "string" || !v.trim()) {
    throw new CreativeFrameError(`"${field}" must be a non-empty string.`);
  }
  return v.trim();
}

export function parseCreativeFrame(
  raw: string,
  request: ExplorationRequest,
): CreativeFrame {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new CreativeFrameError("No JSON object in model output.", raw);
  }
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new CreativeFrameError("Model output was not valid JSON.", raw);
  }

  const domainsRaw = data.sourceDomains;
  if (!Array.isArray(domainsRaw) || domainsRaw.length < 1) {
    throw new CreativeFrameError('"sourceDomains" must have ≥1 entry.', raw);
  }
  const sourceDomains: SourceDomain[] = domainsRaw.map((d, i) => {
    const o = (d ?? {}) as Record<string, unknown>;
    return {
      name: text(o.name, `sourceDomains[${i}].name`),
      origin: text(o.origin, `sourceDomains[${i}].origin`),
      essence: text(o.essence, `sourceDomains[${i}].essence`),
      coreMechanics: strArray(o.coreMechanics, `sourceDomains[${i}].coreMechanics`, 2),
    };
  });

  const probesRaw = data.evidenceProbes;
  if (!Array.isArray(probesRaw) || probesRaw.length < 2) {
    throw new CreativeFrameError('"evidenceProbes" must have ≥2 entries.', raw);
  }
  const objectiveNorm = request.creativeObjective.trim().toLowerCase();
  const evidenceProbes: EvidenceProbe[] = probesRaw.map((p, i) => {
    const o = (p ?? {}) as Record<string, unknown>;
    const query = text(o.query, `evidenceProbes[${i}].query`);
    if (query.toLowerCase() === objectiveNorm) {
      throw new CreativeFrameError("A probe reused the raw objective as its query.", raw);
    }
    const entityType = String(o.entityType);
    if (!isQlooEntityType(entityType)) {
      throw new CreativeFrameError(`evidenceProbes[${i}].entityType is not a documented Qloo type.`, raw);
    }
    return {
      query,
      entityType,
      why: text(o.why, `evidenceProbes[${i}].why`),
    };
  });

  return {
    sourceDomains,
    experientialGoals: strArray(data.experientialGoals, "experientialGoals", 1),
    requirements: strArray(data.requirements, "requirements", 1),
    offBrief: strArray(data.offBrief, "offBrief", 0),
    evidenceProbes,
  };
}

/** One call, plus at most one repair retry that feeds back the validation error. */
export async function deriveCreativeFrame(
  request: ExplorationRequest,
  model: CreativeModel,
): Promise<CreativeFrame> {
  const user = buildFrameUser(request);
  const first = await model.complete({ stage: "frame", system: FRAME_SYSTEM, user, maxTokens: 1500 });
  try {
    const frame = parseCreativeFrame(first, request);
    if (process.env.CFL_CREATIVE_DEBUG === "true") {
      const { writeFileSync } = await import("node:fs");
      writeFileSync(
        "/tmp/cfl-last-frame.json",
        JSON.stringify(frame, null, 2),
        "utf8",
      );
    }
    return frame;
  } catch (err) {
    if (!(err instanceof CreativeFrameError)) throw err;
    const retry = await model.complete({
      stage: "frame",
      system: FRAME_SYSTEM,
      user: `${user}\n\nYour previous answer was rejected: ${err.message}\nReturn corrected JSON only.`,
      maxTokens: 1500,
    });
    return parseCreativeFrame(retry, request);
  }
}
