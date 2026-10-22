/** Objective-first LLM composition. All cultural references must resolve to collected metadata. */
import type { ConceptSpec, CulturalEntity, EvidenceItem } from "../../types";
import type { InterpretedObjective, EvaluatedConcept } from "../types";
import { runQualityGates } from "../quality-gates";
import { specToNarrative } from "../synthesis";
import { evaluateConcepts } from "../evaluate";
import type { CreativeFrame } from "./types";
import type { CreativeModel } from "./model";
import { assessCreativeFidelity } from "./fidelity";
import { triageCreativeFidelity } from "./fidelity-triage";
import { buildTransferContract, buildOperationalTransferTemplate } from "./transfer";
import { generateOperationalDesign } from "./operational-design";
import { buildReferenceContract, canonicalizeReferences, diagnoseReferences, pruneUnresolvableReferences, REFERENCE_SHAPE_EXAMPLE } from "./references";
import { validateOperationalTransfer, type TransferValidationInput } from "./transfer-validation";
import type { EligibilityReport } from "../evidence/eligibility";
import { buildEvidenceDecisionContract, evidenceBoundarySentence, EVIDENCE_DECISION_SHAPE_EXAMPLE, rejectedPlacesInUse, resolveEvidenceDecisions } from "./evidence-decisions";

export class CreativeCompositionError extends Error {}

export async function composeCreativeConcepts(input: {
  frame: CreativeFrame;
  interpreted: InterpretedObjective;
  entities: CulturalEntity[];
  evidence: EvidenceItem[];
  model: CreativeModel;
  /** Opt-in strict triage; legacy preserves existing replay behavior. */
  fidelityPolicy?: "legacy" | "triage";
  /** Internal retry guard: at most one corrective composition. */
  repairAttempt?: number;
  /** Diagnostics from the previous rejected composition. */
  repairFeedback?: string;
  /** Original rejected model response for targeted revision. */
  repairDraft?: string;
  /** Reuse validated operational decisions during composition repair. */
  operationalDesign?: TransferValidationInput;
  /** Which collected entities passed geographic and topical validation. Omit for demo/legacy runs. */
  eligibility?: EligibilityReport;
}): Promise<{ concepts: EvaluatedConcept[]; hypothesisEvidence: EvidenceItem[]; quality: {candidatesGenerated:number;candidatesAccepted:number;rejectedSummaries:string[]} }> {
  const { frame, interpreted, entities, evidence, model } = input;

  // Strict mode: design and validate cultural operations before composition.
  const operationalDesign =
    input.fidelityPolicy === "triage"
      ? input.operationalDesign ?? await generateOperationalDesign({
          frame,
          objective: interpreted.rawObjective,
          outputCategory: interpreted.outputCategory,
          location: interpreted.location,
          model,
        })
      : null;

  const eligibility = input.eligibility && input.eligibility.sufficiency.status !== "not_applicable" ? input.eligibility : undefined;
  const entityIds = new Set(entities.map(e => e.id));
  // Provenance decides which evidence wording is truthful: real Qloo results vs labeled demo fixtures.
  const liveEvidence = evidence.some(e => e.source === "verified_api");
  const evidenceIds = new Set(evidence.map(e => e.id));
  const entityAttributeIndex = new Map(entities.map(e => [e.id, new Set([
    e.category, e.name.toLowerCase(), ...e.tags.map(t => t.toLowerCase()),
    ...e.description.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2),
  ])] as const));
  const source = entities.map(e => ({id:e.id,name:e.name,category:e.category,tags:e.tags,description:e.description,
    evidenceIds:evidence.filter(ev => ev.relatedEntityIds?.includes(e.id)).map(ev => ev.id)}));
  const raw = await model.complete({
    stage:"compose", maxTokens:6500, allowedEntityIds:entities.map(e => e.id),
    system:`You are designing ONE original, commercially testable cross-cultural experience.

The user objective is authoritative. Do not create a generic app, rideshare service, bicycle rental, route planner, or culturally decorated version of an existing service.

DESIGN ORDER — FOLLOW STRICTLY:

1. Read frame.sourceDomains and transferContract.
2. Choose exactly ONE sourceMechanism from each cultural domain. Copy its wording exactly from frame.sourceDomains[].coreMechanics.
3. Define a concrete operatingDecision and participantAction for each mechanism. These must change how the service actualoperates.
4. Design ONE workflow in which the two operating decisions depend on each other. Explain the causal dependency and what breaks if either mechanism is removed.
5. Translate that workflow into mechanics and 3–4 journey steps. Both cultural operating decisions must be visible in those fields.
6. Identify practical feasibility unknowns and a falsifiable, small-scale pilot. Do not invent local infrastructure, partnerships, demand, verified cultural evidence, or performance results.
7. Only then construct the complete JSON concept.

MANDATORY OUTPUT STRUCTURE:

Return JSON only, with exactly one object in concepts:

{"concepts":[{
  "declaredOutputCategory":"experience",
  "name":"...",
  "proposition":"...",
  "audience":"...",
  "context":"...",
  "mechanics":"...",
  "journey":[{"id":"...","actor":"...","action":"...","influenceEntityIds":[]}],
  "operationalTransfer":{
    "transfers":[
      {"sourceDomain":"EXACT FRAME DOMAIN NAME","sourceMechanism":"EXACT FRAME CORE MECHANISM","operatingDecision":"...","participantAction":"...","dependency":"..."}
    ],
    "crossCulturalDependency":"...",
    "removalConsequences":["..."],
    "feasibilityUnknowns":["..."],
    "pilotTest":"..."
  },
  "influenceMap":[],${eligibility ? `\n  ${EVIDENCE_DECISION_SHAPE_EXAMPLE},` : ""}
  "differentiationHypothesis":"...",
  "feasibilityAssumptions":["..."],
  "risksAndUnknowns":["..."],
  "pilotExperiment":"...",
  "evidenceBoundary":"...",
  "rationales":[],
  "mechanicFingerprint":"...",
  "mechanismId":"..."
}]}

REQUIREMENTS:
- operationalTransfer.transfers must contain exactly one entry per source domain.
- removalConsequences must contain one substantive entry per domain, in frame order.
- Each transfer must identify a real operating decision, participant action, and dependency.
- The mechanics and journey must implement the SAME operationalTransfer.
- The declaredOutputCategory must describe the actual output form; do not merely copy the user's requested category.
- Include requested choice dimensions as operational decisions.
- Respect all frame.offBrief exclusions, includg paraphrases.
- Do NOT add influence entries beyond those you can justify; two genuine ones are enough. An id that is not in allowedEntities (for example one you built by imitating the id pattern) is discarded and may make the concept fail.
- Cite influences ONLY by copying ids from evidenceReferenceContract.allowedEntities, following evidenceReferenceContract.rules exactly. Never invent entity IDs, signals or evidence. Required reference shape:
${REFERENCE_SHAPE_EXAMPLE}
- ${liveEvidence ? "The entities are real Qloo API results, but name or category matches are loose proxies: they do not verify the practices named in the objective, local demand, or the audience. Never call these entities fictional or demo data." : "Fictional demo entities are not verified cultural evidence."}
- Do not attach irrelevant entities to satisfy quality checks.
- If evidence is missing, explicitly state the limitation.
- Never invent quantitative performance claims.
- Keep descriptions concise, specific, and internally consistent.
- If repairFeedback and rejectedDraft are provided, correct that draft rather than starting over.
- Never include opportunityId or opportunityTrace.

${eligibility ? `EVIDENCE-TO-DECISION CONTRACT:
- Only evidenceDecisionContract.eligibleEvidence passed geographic and topical validation. Operating decisions that rely on collected evidence (a stop, a sequence, an activity, a component, a material, a partner, an audience, a channel) may use ONLY those entities.
- Zero decisions is allowed. Do not name, recommend or imply any venue, brand, product, place, person or organization that is not in eligibleEvidence. If status is "insufficient", return "evidenceDecisions": [] and say in evidenceBoundary that Qloo evidence was insufficient to ground any decision.

` : ""}AUTOMATIC QUALITY CONTRACT — each item is machine-checked and a violation rejects the concept:
- name: 2 to 5 separate words with spaces (never one CamelCase word), no repeated word, not a bare generic word such as system, platform, kit or session.
- proposition: 24 to 280 characters; a concrete operating service, not a slogan.
- mechanics: at least 60 characters; use the word "participants" (or guests, hosts, facilitator) and state the order in which things happen.
- journey: 3 or 4 steps.
- Never write these words in proposition or mechanics: innovative, seamless, cutting-edge, next-level, elevate, unlock, synergy, holistic.
- Never write "market demand", "guaranteed", "will go viral", "proven ROI" or "consumers will buy" in proposition, differentiationHypothesis or pilotExperiment.
- evidenceBoundary: must contain the word "hypothesis" and say plainly what is not verified (${liveEvidence ? "entities are real Qloo results but only loose proxies; the practices, demand and audience are unverified" : "for demo data: fictional, not Qloo evidence"}).
- Every explicit requirement in the user's objective (who participates, operating constraints, dependencies, the pilot) must be answered in proposition, mechanics, journey or pilotExperiment using the objective's own concrete nouns. Do not restate or describe the excluded formats; simply avoid them.
- pilotExperiment: at least 40 characters, a small pilot stated in plain words that names what is measured and over how long (for example "Over two weeks, measure ..."); it must contain at least one of the words measure, count, observe, survey, session, pilot, week, guest, host, user or customer.
- risksAndUnknowns: at least 2 items.
- mechanicFingerprint: a short unique phrase naming the operating mechanism.

Use operationalTransferTemplate as the required JSON shape.
Complete every empty field with a substantive, observable operating decision.
The prefilled sourceMechanism is only a candidate; choose another exact
coreMechanic from the same domain if it produces a better causal transfer.
Do not copy empty placeholders into the final concept.
Before returning JSON, verify that operationalTransfer exists and that removing either cultural source materially changes the workflow.`,
    user: JSON.stringify({ objective:interpreted.rawObjective, outputCategory:interpreted.outputCategory,
      culturalInterest:interpreted.culturalInterest,location:interpreted.location,frame,transferContract:buildTransferContract(frame),
      operationalTransferTemplate:buildOperationalTransferTemplate(frame),
      validatedOperationalDesign:operationalDesign,
      operationalDesignInstruction:operationalDesign
        ? "Use the supplied validatedOperationalDesign as the exact operationalTransfer in every concept. Do not redesign or omit it. Develop the commercial experience around those operating rules."
        : null,
      evidenceReferenceContract:buildReferenceContract(entities),
      evidenceDecisionContract: eligibility ? buildEvidenceDecisionContract(eligibility) : undefined,
      collectedEvidence:source, evidenceBoundary:liveEvidence ? "Entities are real Qloo API results; matches are loose proxies and do not verify the named practices, demand or audience." : "Demo entities are fictional when demo mode is used.",
      repairFeedback:input.repairFeedback ?? null,
      rejectedDraft:input.repairDraft ?? null,
      repairInstruction:input.repairFeedback
        ? "Revise the supplied rejectedDraft to address EVERY diagnostic. Preserve the original objective and cultural sources. Do not invent evidence, partnerships, infrastructure, or performance claims. Return a complete corrected concept with operationalTransfer."
        : null }),
  });
  // Local debugging: preserve the model output before fidelity checks.
  if (process.env.CFL_CREATIVE_DEBUG === "true") {
    const { writeFileSync } = await import("node:fs");
    writeFileSync("/tmp/cfl-last-compose.json", raw, "utf8");
    console.log("[CFL DEBUG] Saved composition to /tmp/cfl-last-compose.json");
  }

  let parsed: unknown;
  try { parsed=JSON.parse(raw.slice(raw.indexOf("{"),raw.lastIndexOf("}")+1)); }
  catch { throw new CreativeCompositionError("Model returned invalid composition JSON"); }
  const drafts = (parsed as {concepts?:unknown})?.concepts;
  if (!Array.isArray(drafts) || drafts.length < 1 || drafts.length > 3) throw new CreativeCompositionError("Expected 1-3 concept specifications");
  const concepts: EvaluatedConcept[] = [];
  const hypothesisEvidence: EvidenceItem[] = [];
  const rejectedSummaries: string[] = [];
  for (const [i, value] of drafts.entries()) {
    if (!value || typeof value !== "object") { rejectedSummaries.push(`Candidate ${i+1}: invalid object`); continue; }
    if (operationalDesign) {
      (value as Record<string, unknown>).operationalTransfer =
        operationalDesign;
    }
    const refNotes = canonicalizeReferences(value as Record<string, unknown>, entities);
    const pruneNotes = pruneUnresolvableReferences(value as Record<string, unknown>, entities);
    const refDiag = diagnoseReferences(value as Record<string, unknown>, entities);
    const allowedList = entities.map(e => e.id).slice(0, 40).join(", ");
    const refSuffix = pruneNotes.length || refDiag.invalidIds.length || refDiag.signalProblems.length
      ? ` | reference problems: ${[...pruneNotes, ...refDiag.invalidIds.map(x => `invalid entity id at ${x}`), ...refDiag.signalProblems].slice(0, 8).join("; ")} | allowed entity ids: [${allowedList}]`
      : "";
    const d = value as Partial<ConceptSpec>;
    if (!Array.isArray(d.journey) || !Array.isArray(d.rationales) || !Array.isArray(d.influenceMap) ||
        !Array.isArray(d.feasibilityAssumptions) || !Array.isArray(d.risksAndUnknowns) ||
        ![d.name,d.proposition,d.audience,d.context,d.mechanics,d.differentiationHypothesis,d.pilotExperiment,d.evidenceBoundary,d.mechanicFingerprint,d.mechanismId].every(v => typeof v === "string" && v.length > 0)) {
      rejectedSummaries.push(`Candidate ${i+1}: incomplete ConceptSpec`); continue;
    }
    const spec: ConceptSpec = { ...d, frozenObjective:interpreted.rawObjective, frozenOutputCategory:interpreted.outputCategory } as ConceptSpec;
    if (input.fidelityPolicy === "triage") {
    const transfer = (value as Record<string, unknown>).operationalTransfer;
    if (!transfer || typeof transfer !== "object" || Array.isArray(transfer)) {
      rejectedSummaries.push(`${spec.name}: missing operationalTransfer`);
      continue;
    }
    const transferResult = validateOperationalTransfer(
      frame,
      transfer as TransferValidationInput,
    );
    if (!transferResult.passed) {
      rejectedSummaries.push(
        `${spec.name}: operational transfer invalid: ${transferResult.failures.join("; ")}`,
      );
      continue;
    }

    }
    if (input.fidelityPolicy === "triage") {
      // The model's category declaration must be independent of the frozen user brief.
      // Never use spec.frozenOutputCategory as proof: it was set by this orchestrator.
      const declared = (value as Record<string, unknown>).declaredOutputCategory;
      const triage = triageCreativeFidelity(frame, spec, {
        expectedOutputCategory: interpreted.outputCategory,
        declaredOutputCategory: typeof declared === "string" ? declared : undefined,
      });
      if (triage.disposition !== "provisionally_accepted") {
        rejectedSummaries.push(`${spec.name}: fidelity ${triage.disposition}: ${triage.reasons.join("; ")}${refSuffix}`);
        continue;
      }
      if (liveEvidence) spec.evidenceBoundary = liveBoundary(spec.evidenceBoundary);
      // Provisional acceptance is NOT semantic certification; surface this in the concept.
      spec.evidenceBoundary = [
        spec.evidenceBoundary,
        "Fidelity triage: provisional only; semantic and cultural verification required.",
        ...triage.reasons,
      ].join(" ");
    } else {
      const fidelity = assessCreativeFidelity(frame, spec);
      if (!fidelity.accepted) { rejectedSummaries.push(`${spec.name}: ${fidelity.failures.join("; ")}${refSuffix}`); continue; }
    }
    const referenced = [...spec.influenceMap.map(m => m.entityId),...spec.journey.flatMap(j => j.influenceEntityIds),...spec.rationales.map(r => r.influenceEntityId)];
    if (referenced.some(id => !entityIds.has(id))) { rejectedSummaries.push(`${spec.name}: invented entity IDs${refSuffix || ` | allowed entity ids: [${allowedList}]`}`); continue; }
    if (eligibility) {
      const operatingText = [spec.mechanics, ...spec.journey.map(j => j.action)].join(" ");
      const sharedContext = `${interpreted.rawObjective} ${interpreted.culturalInterest} ${interpreted.location ?? ""} ${JSON.stringify(operationalDesign ?? (value as Record<string, unknown>).operationalTransfer ?? "")}`;
      const leaked = rejectedPlacesInUse(operatingText, eligibility, entities);
      if (leaked.length) { rejectedSummaries.push(`${spec.name}: names place(s) that failed geographic or topical validation (${leaked.join(", ")}); use only eligibleEvidence or no named place${refSuffix}`); continue; }
      const resolved = resolveEvidenceDecisions((value as Record<string, unknown>).evidenceDecisions, eligibility, operatingText, sharedContext);
      spec.evidenceDecisions = resolved.decisions;
      spec.evidenceSufficiency = eligibility.sufficiency;
      const sentence = evidenceBoundarySentence(eligibility.sufficiency, resolved.decisions);
      spec.evidenceBoundary = [spec.evidenceBoundary, sentence, ...resolved.notes].filter(Boolean).map(part => (/[.!?…"”]$/.test(part.trim()) ? part.trim() : `${part.trim()}.`)).join(" ");
    } else {
      delete (spec as { evidenceDecisions?: unknown }).evidenceDecisions;
    }
    const influences = entities.filter(e => spec.influenceMap.some(m => m.entityId === e.id));
    if (influences.length < 2) { rejectedSummaries.push(`${spec.name}: fewer than two justified cultural influences${refSuffix}`); continue; }
    const evidenceForConcept = evidence.filter(ev => ev.relatedEntityIds?.some(id => influences.some(e => e.id === id))).map(ev => ev.id).filter(id => evidenceIds.has(id));
    if (!evidenceForConcept.length) { rejectedSummaries.push(`${spec.name}: no collected evidence for cited influences${refSuffix}`); continue; }
    const gate=runQualityGates({spec,interpreted,acceptedFingerprints:concepts.map(c => c.spec!.mechanicFingerprint),evidenceEntityIds:entityIds,entityAttributeIndex});
    if (!gate.accepted) { rejectedSummaries.push(`${spec.name}: ${gate.failures.slice(0,5).join("; ")}${refSuffix}`); continue; }
    if (refNotes.length) spec.evidenceBoundary = `${spec.evidenceBoundary} Reference normalization (exact matches only): ${refNotes.join("; ")}.`;
    if (pruneNotes.length) spec.evidenceBoundary = `${spec.evidenceBoundary} Unsupported model-emitted entity references were discarded, not replaced: ${pruneNotes.join("; ")}.`;
    const id=`creative-${i+1}-${spec.mechanicFingerprint.replace(/[^a-z0-9]/gi,"-").slice(0,35)}`;
    const hypId=`ev-hyp-${id}`;
    hypothesisEvidence.push({id:hypId,source:"agent_hypothesis",label:`Creative hypothesis: ${spec.name}`,detail:`${spec.proposition} ${spec.evidenceBoundary}`,relatedEntityIds:influences.map(e=>e.id),createdAt:new Date().toISOString()});
    const narrative=specToNarrative(spec);
    concepts.push({id,title:spec.name,positioning:`${narrative.whatItIs} ${narrative.howItWorks}`,outputCategory:interpreted.outputCategory,
      culturalInfluences:influences,evidenceIds:[...evidenceForConcept,hypId],summary:spec.proposition,narrative,spec,
      claims:[],affinityIds:[],conflictIds:[],qualityGate:gate,
      evaluation:{relevance:0,originality:0,evidenceCoverage:0,overall:0,notes:[]}});
  }
  if (!concepts.length) {
    const feedback = rejectedSummaries.join(" | ").slice(0,3200);
    const nonRepairable = rejectedSummaries.some(reason =>
      /rejected.*output category/i.test(reason)
    );
    if (
      input.fidelityPolicy === "triage" &&
      (input.repairAttempt ?? 0) === 0 &&
      !nonRepairable
    ) {
      return composeCreativeConcepts({
        ...input,
        repairAttempt: 1,
        repairFeedback: feedback,
        repairDraft: raw.slice(0, 12000),
        operationalDesign: operationalDesign ?? undefined,
      });
    }
    throw new CreativeCompositionError(`No model-generated concept passed existing quality gates: ${feedback}`);
  }
  return {concepts:evaluateConcepts({concepts,interpreted,totalEntityCount:entities.length}),hypothesisEvidence,
    quality:{candidatesGenerated:drafts.length,candidatesAccepted:concepts.length,rejectedSummaries}};
}

/** For live (verified_api) runs: drop any model-written claim that the entities are fictional/demo, and state the real provenance. */
export function liveBoundary(text: string): string {
  const kept = text.split(/(?<=[.!?])\s+/).filter(sentence => !/\b(fictional|demo|synthetic)\b/i.test(sentence));
  const base = kept.join(" ").trim();
  const note = "Entities come from real Qloo API results, but matches are loose proxies and verify none of the named practices, local demand or audience.";
  // The model often already says this; do not repeat it.
  if (/\breal\b.{0,40}\bresults?\b/i.test(base) && /loose prox/i.test(base)) return /hypothesis/i.test(base) ? base : `This is a hypothesis. ${base}`;
  return /hypothesis/i.test(base) ? `${base} ${note}` : `This is a hypothesis. ${base} ${note}`.replace(/\s+/g, " ").trim();
}
