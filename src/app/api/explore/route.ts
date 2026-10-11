import { NextResponse } from "next/server";

import {
  AgentError,
  runExplorationAgent,
} from "@/lib/agent";
import { isQlooConfigured } from "@/lib/qloo/adapter";
import { QlooError, toApiErrorPayload } from "@/lib/qloo/errors";
import { isLiveModeAllowed } from "@/lib/qloo/live-gate";
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
        : err.code === "EMPTY_EVIDENCE" || err.code === "IRRELEVANT_EVIDENCE"
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

  try {
    if (exploration.mode === "demo") {
      const result = await runExplorationAgent(exploration);
      return NextResponse.json(result);
    }

    // Live Mode remains disabled until key + opt-in + successful auth probe.
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

    const { createQlooSource } = await import(
      "@/lib/agent/sources/qloo-source"
    );
    const result = await runExplorationAgent(exploration, {
      source: createQlooSource(),
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AgentError) {
      return agentErrorResponse(err);
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
  }
}
