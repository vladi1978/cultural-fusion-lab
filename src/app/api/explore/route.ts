import { getValidationBudget, ValidationBudgetError, type ValidationBudget } from "@/lib/validation-session";
import { NextResponse } from "next/server";
import { CreativeCompositionError } from "@/lib/agent/creative/compose";
import { OperationalDesignError } from "@/lib/agent/creative/operational-design";

import {
  AgentError,
  runExplorationAgent,
} from "@/lib/agent";
import { isQlooConfigured } from "@/lib/qloo/adapter";
import { getLiveAvailability } from "@/lib/live-availability";
import { QlooError, toApiErrorPayload } from "@/lib/qloo/errors";
import {
  isLiveModeAllowed,
  isLiveOptInEnabled,
  verifyQlooAuthentication,
} from "@/lib/qloo/live-gate";
import type { ApiErrorBody, ExplorationRequest, OutputCategory } from "@/lib/types";

function isOutputCategory(value: unknown): value is OutputCategory {
  return value === "product" || value === "brand" || value === "experience";
}

function parseRequest(body: unknown): ExplorationRequest | null {
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;

  const creativeObjective =
    typeof data.creativeObjective === "string"
      ? data.creativeObjective.trim()
      : "";
  const culturalInterest =
    typeof data.culturalInterest === "string"
      ? data.culturalInterest.trim()
      : "";
  const location =
    typeof data.location === "string" && data.location.trim()
      ? data.location.trim()
      : undefined;
  const mode = data.mode === "live" ? "live" : "demo";

  if (
    !creativeObjective ||
    !culturalInterest ||
    !isOutputCategory(data.outputCategory)
  ) {
    return null;
  }

  return {
    creativeObjective,
    culturalInterest,
    location,
    outputCategory: data.outputCategory,
    mode,
  };
}

function agentErrorResponse(err: AgentError) {
  const status =
    err.code === "VALIDATION" ||
    err.code === "MUTATION_INVALID" ||
    err.code === "CLAIM_UNGROUNDED" ||
    err.code === "MISSING_CONCEPT"
      ? 400
      : err.code === "LIVE_DISABLED"
        ? 503
        : err.code === "EMPTY_EVIDENCE" ||
            err.code === "IRRELEVANT_EVIDENCE" ||
            err.code === "INSUFFICIENT_DIFFERENTIATION" ||
            err.code === "INSUFFICIENT_QUALITY"
          ? 422
          : 502;

  return NextResponse.json<ApiErrorBody>(
    {
      error: err.message,
      code: `AGENT_${err.code}`,
      details: err.details,
    },
    { status },
  );
}

function findBudgetError(err: unknown): ValidationBudgetError | null {
  for (let e: unknown = err, depth = 0; e && depth < 5; depth++) {
    if (e instanceof ValidationBudgetError) return e;
    e = e instanceof Error ? (e as Error & { cause?: unknown }).cause : null;
  }
  return null;
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json<ApiErrorBody>(
      { error: "Invalid JSON body.", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  const exploration = parseRequest(json);
  if (!exploration) {
    return NextResponse.json<ApiErrorBody>(
      {
        error:
          "Provide creativeObjective, culturalInterest, and a valid outputCategory (product | brand | experience).",
        code: "VALIDATION_ERROR",
      },
      { status: 400 },
    );
  }

  let budget: ValidationBudget | null = null;
  let startedExplore = false;
  try {
    if (exploration.mode === "demo") {
      const result = await runExplorationAgent(exploration, { fidelityPolicy: "triage" });
      return NextResponse.json(result);
    }

    // Fail closed, first: Live runs only when the server explicitly enables it and holds the credentials.
    // The request body's "mode" is only a request; it never grants anything. Checked before any budget is touched.
    const liveGate = getLiveAvailability().exploration;
    if (!liveGate.available) {
      return NextResponse.json<ApiErrorBody>(
        { error: `${liveGate.reason} Use Demo Mode.`, code: "QLOO_LIVE_DISABLED", details: "Live collection is locked on this server." },
        { status: 503 },
      );
    }

    // Shared validation session (opt-in): one live exploration per session, duplicates rejected,
    // every Qloo/Anthropic request reserved against the shared budget. Config-only checks run first so a
    // misconfigured server does not burn the one-shot.
    if (isQlooConfigured() && isLiveOptInEnabled()) {
      budget = getValidationBudget();
      if (budget) {
        budget.startRun("explore");
        startedExplore = true;
        const u = budget.snapshot().used;
        console.log(`[CFL SESSION] validation session ACTIVE (used so far: qloo ${u.qlooHttp}, anthropic logical ${u.anthropicLogical}, anthropic http ${u.anthropicHttp})`);
      } else {
        console.log("[CFL SESSION] validation session NOT ACTIVE: no shared call budget is enforced for this run (start the server with CFL_VALIDATION_SESSION=true)");
      }
    }

    // Never contact Qloo unless Live was explicitly enabled.
    // A missing in-process verification is refreshed on demand.
    if (
      isQlooConfigured() &&
      isLiveOptInEnabled() &&
      !isLiveModeAllowed()
    ) {
      await verifyQlooAuthentication();
    }

    if (!isLiveModeAllowed()) {
      const reason = !isQlooConfigured()
        ? "Live Mode requires QLOO_API_KEY on the server. API key is still pending — use Demo Mode."
        : "Live Mode is disabled until QLOO_LIVE_ENABLED=true and Qloo authentication succeeds. Use Demo Mode.";

      return NextResponse.json<ApiErrorBody>(
        {
          error: reason,
          code: "QLOO_LIVE_DISABLED",
          details:
            "The agent orchestrator is ready, but live Qloo collection is locked until a real key authenticates.",
        },
        { status: 503 },
      );
    }

    // Creative mode (hosted/local model): run the agent's own planned probes.
    // Otherwise keep the legacy 3-request live source unchanged.
    const { isCreativeLlmEnabled } = await import("@/lib/agent/creative");
    const liveSource = isCreativeLlmEnabled()
      ? (await import("@/lib/agent/sources/qloo-plan-source")).createQlooPlanSource()
      : (await import("@/lib/agent/sources/qloo-source")).createQlooSource();
    const result = await runExplorationAgent(exploration, {
      source: liveSource,
      fidelityPolicy: "triage",
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[CFL EXPLORE ERROR]", err);
    const budgetErr = findBudgetError(err);
    if (budgetErr) {
      return NextResponse.json<ApiErrorBody>(
        { error: budgetErr.message, code: `VALIDATION_${budgetErr.code}` },
        { status: budgetErr.code === "DUPLICATE_RUN" || budgetErr.code === "RUN_IN_FLIGHT" ? 409 : budgetErr.code === "BUDGET_EXHAUSTED" ? 429 : 503 },
      );
    }
    if (err instanceof AgentError) {
      return agentErrorResponse(err);
    }

    if (err instanceof CreativeCompositionError || err instanceof OperationalDesignError) {
      return NextResponse.json<ApiErrorBody>(
        {
          error: "The generated concept did not pass the creative quality checks.",
          code: "CREATIVE_QUALITY_REJECTED",
          details: err.message,
        },
        { status: 422 },
      );
    }
    const payload = toApiErrorPayload(
      err instanceof QlooError
        ? err
        : new QlooError("UPSTREAM", "Unexpected error during exploration.", {
            cause: err,
          }),
    );
    return NextResponse.json<ApiErrorBody>(
      {
        error: payload.error,
        code: payload.code,
        details: payload.details,
      },
      { status: payload.status },
    );
  } finally {
    if (budget && startedExplore) budget.finishRun("explore");
  }
}
