import { NextResponse } from "next/server";

import { generateDemoMutation } from "@/lib/demo-data";
import {
  isQlooConfigured,
  mutateWithQloo,
  QlooNotConfiguredError,
  QlooNotImplementedError,
} from "@/lib/qloo/adapter";
import type {
  ApiErrorBody,
  CulturalEntity,
  EvidenceItem,
  ExplorationRequest,
  FusionConcept,
  MutationRequest,
  OutputCategory,
} from "@/lib/types";

function isOutputCategory(value: unknown): value is OutputCategory {
  return value === "product" || value === "brand" || value === "experience";
}

function parseMutation(body: unknown): MutationRequest | null {
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;

  if (
    typeof data.conceptId !== "string" ||
    typeof data.replaceEntityId !== "string" ||
    typeof data.newEntityId !== "string" ||
    !Array.isArray(data.concepts) ||
    !Array.isArray(data.entities) ||
    !Array.isArray(data.evidence) ||
    !data.exploration ||
    typeof data.exploration !== "object"
  ) {
    return null;
  }

  const explorationRaw = data.exploration as Record<string, unknown>;
  if (
    typeof explorationRaw.creativeObjective !== "string" ||
    typeof explorationRaw.culturalInterest !== "string" ||
    !isOutputCategory(explorationRaw.outputCategory)
  ) {
    return null;
  }

  const exploration: ExplorationRequest = {
    creativeObjective: explorationRaw.creativeObjective,
    culturalInterest: explorationRaw.culturalInterest,
    location:
      typeof explorationRaw.location === "string"
        ? explorationRaw.location
        : undefined,
    outputCategory: explorationRaw.outputCategory,
    mode: explorationRaw.mode === "live" ? "live" : "demo",
  };

  return {
    conceptId: data.conceptId,
    replaceEntityId: data.replaceEntityId,
    newEntityId: data.newEntityId,
    mode: data.mode === "live" ? "live" : "demo",
    exploration,
    concepts: data.concepts as FusionConcept[],
    entities: data.entities as CulturalEntity[],
    evidence: data.evidence as EvidenceItem[],
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

  const mutation = parseMutation(json);
  if (!mutation) {
    return NextResponse.json<ApiErrorBody>(
      {
        error:
          "Provide conceptId, replaceEntityId, newEntityId, exploration, concepts, entities, and evidence.",
        code: "VALIDATION_ERROR",
      },
      { status: 400 },
    );
  }

  if (mutation.mode === "demo") {
    try {
      const result = generateDemoMutation(mutation);
      return NextResponse.json(result);
    } catch (err) {
      return NextResponse.json<ApiErrorBody>(
        {
          error: err instanceof Error ? err.message : "Mutation failed.",
          code: "MUTATION_ERROR",
        },
        { status: 400 },
      );
    }
  }

  if (!isQlooConfigured()) {
    return NextResponse.json<ApiErrorBody>(
      {
        error:
          "Live mode requires QLOO_API_KEY on the server. Use Demo Mode for mutations.",
        code: "QLOO_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  try {
    const result = await mutateWithQloo(mutation);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof QlooNotImplementedError) {
      return NextResponse.json<ApiErrorBody>(
        {
          error: err.message,
          code: "QLOO_NOT_IMPLEMENTED",
          details: "Use Demo Mode until Qloo mutation endpoints are validated.",
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
      { error: "Unexpected error during mutation.", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
