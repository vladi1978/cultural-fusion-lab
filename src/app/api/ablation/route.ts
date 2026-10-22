import { NextResponse } from "next/server";
import { getValidationBudget, ValidationBudgetError, type ValidationBudget } from "@/lib/validation-session";
import { createAnthropicCreativeModel, isCreativeLlmEnabled } from "@/lib/agent/creative/model";
import { AblationError, runAblation } from "@/lib/agent/ablation/ablation";
import type { CulturalEntity, ExplorationRequest } from "@/lib/types";

/**
 * Qloo ablation (hosted model). Off unless CFL_ABLATION_ENABLED=true, requires the creative model to be
 * enabled, and every model call still passes through the persistent spend guard.
 * A per-process run cap keeps an exposed server from being used as an open model proxy.
 */
let runsThisProcess = 0;
const MAX_BODY_CHARS = 80_000;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length < 6000;

export async function POST(req: Request) {
  if (process.env.CFL_ABLATION_ENABLED?.trim().toLowerCase() !== "true") {
    return NextResponse.json({ error: "Ablation is disabled on this server.", code: "ABLATION_DISABLED" }, { status: 403 });
  }
  if (!isCreativeLlmEnabled()) {
    return NextResponse.json({ error: "The creative model is not enabled on this server.", code: "CREATIVE_MODEL_DISABLED" }, { status: 503 });
  }
  const parsedMax = Number.parseInt(process.env.CFL_ABLATION_MAX_RUNS ?? "5", 10);
  const maxRuns = Number.isFinite(parsedMax) && parsedMax > 0 ? Math.min(parsedMax, 50) : 5;
  if (runsThisProcess >= maxRuns) {
    return NextResponse.json({ error: "Ablation run limit reached for this server process.", code: "ABLATION_LIMIT" }, { status: 429 });
  }

  const text = await req.text();
  if (text.length > MAX_BODY_CHARS) return NextResponse.json({ error: "Request too large.", code: "BAD_REQUEST" }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(text); } catch { return NextResponse.json({ error: "Invalid JSON.", code: "BAD_REQUEST" }, { status: 400 }); }
  if (!isObj(body) || !isObj(body.concept) || !isObj(body.request)) {
    return NextResponse.json({ error: "Expected { concept, request }.", code: "BAD_REQUEST" }, { status: 400 });
  }
  const concept = body.concept;
  const spec = concept.spec;
  const influencesRaw = concept.culturalInfluences;
  const r = body.request;
  if (body.mode !== "live") {
    return NextResponse.json({ error: "The comparison only runs on live Qloo results; demo entities are fictional.", code: "NOT_LIVE" }, { status: 422 });
  }
  if (!isObj(spec) || !spec.operationalTransfer || !Array.isArray(influencesRaw) || influencesRaw.length < 1 || influencesRaw.length > 8 || !str(r.creativeObjective)) {
    return NextResponse.json({ error: "Concept is missing required fields.", code: "BAD_REQUEST" }, { status: 400 });
  }
  const influences: CulturalEntity[] = influencesRaw.filter(isObj).map(e => ({
    id: String(e.id ?? ""), name: String(e.name ?? ""), category: (e.category as CulturalEntity["category"]) ?? "other",
    description: String(e.description ?? "").slice(0, 600), affinity: Number(e.affinity ?? 0), tags: Array.isArray(e.tags) ? e.tags.filter((t): t is string => typeof t === "string").slice(0, 20) : [],
  }));

  const sufficiency = (spec.evidenceSufficiency ?? null) as { status?: string; reason?: string } | null;
  if (sufficiency?.status === "insufficient") {
    return NextResponse.json({ error: `The concept was generated without validated Qloo evidence, so there is nothing to compare. ${sufficiency.reason ?? ""}`.trim(), code: "NO_ELIGIBLE_EVIDENCE" }, { status: 422 });
  }

  // Shared validation session (opt-in): one comparison per session, duplicate clicks rejected.
  let budget: ValidationBudget | null = null;
  let started = false;
  try {
    budget = getValidationBudget();
    if (budget) { budget.startRun("ablation"); started = true; }
  } catch (err) {
    if (err instanceof ValidationBudgetError) {
      return NextResponse.json({ error: err.message, code: `VALIDATION_${err.code}` }, { status: err.code === "DUPLICATE_RUN" || err.code === "RUN_IN_FLIGHT" ? 409 : err.code === "BUDGET_EXHAUSTED" ? 429 : 503 });
    }
    throw err;
  }

  runsThisProcess++;
  try {
    const result = await runAblation({
      operationalTransfer: spec.operationalTransfer,
      influences,
      request: { creativeObjective: r.creativeObjective, outputCategory: (r.outputCategory as ExplorationRequest["outputCategory"]) ?? "experience", location: typeof r.location === "string" ? r.location : undefined },
      model: createAnthropicCreativeModel(),
    });
    return NextResponse.json(result);
  } catch (err) {
    runsThisProcess--; // a failed run produced no result; the spend guard still counts any tokens used
    console.error("[CFL ABLATION ERROR]", err instanceof Error ? err.message : err);
    if (err instanceof ValidationBudgetError) {
      return NextResponse.json({ error: err.message, code: `VALIDATION_${err.code}` }, { status: err.code === "BUDGET_EXHAUSTED" ? 429 : err.code === "DUPLICATE_RUN" || err.code === "RUN_IN_FLIGHT" ? 409 : 503 });
    }
    if (err instanceof AblationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.code === "NO_OPERATIONAL_DESIGN" || err.code === "NO_EVIDENCE" ? 422 : 502 });
    }
    return NextResponse.json({ error: "Ablation failed.", code: "ABLATION_FAILED" }, { status: 500 });
  } finally {
    if (budget && started) budget.finishRun("ablation");
  }
}
