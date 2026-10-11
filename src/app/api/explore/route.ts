import { NextResponse } from "next/server";

import { generateDemoExploration } from "@/lib/demo-data";
import {
  exploreWithQloo,
  isQlooConfigured,
  QlooNotConfiguredError,
  QlooNotImplementedError,
} from "@/lib/qloo/adapter";
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

  if (!creativeObjective || !culturalInterest || !isOutputCategory(data.outputCategory)) {
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

  if (exploration.mode === "demo") {
    const result = generateDemoExploration(exploration);
    return NextResponse.json(result);
  }

  // Live mode scaffold — fail closed until Qloo integration is validated.
  if (!isQlooConfigured()) {
    return NextResponse.json<ApiErrorBody>(
      {
        error:
          "Live mode requires QLOO_API_KEY on the server. Use Demo Mode for the hackathon MVP walkthrough.",
        code: "QLOO_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  try {
    const result = await exploreWithQloo(exploration);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof QlooNotImplementedError) {
      return NextResponse.json<ApiErrorBody>(
        {
          error: err.message,
          code: "QLOO_NOT_IMPLEMENTED",
          details:
            "Switch to Demo Mode for a full interactive walkthrough while Qloo endpoints are validated.",
        },
        { status: 501 },
      );
    }
    if (err instanceof QlooNotConfiguredError) {
      return NextResponse.json<ApiErrorBody>(
        { error: err.message, code: "QLOO_NOT_CONFIGURED" },
        { status: 503 },
      );
    }
    return NextResponse.json<ApiErrorBody>(
      {
        error: "Unexpected error during exploration.",
        code: "INTERNAL_ERROR",
      },
      { status: 500 },
    );
  }
}
