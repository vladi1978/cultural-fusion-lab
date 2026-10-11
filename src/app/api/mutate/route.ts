import { NextResponse } from "next/server";

import { AgentError, runMutationAgent } from "@/lib/agent";
import { isQlooConfigured } from "@/lib/qloo/adapter";
import { QlooError, toApiErrorPayload } from "@/lib/qloo/errors";
import { isLiveModeAllowed } from "@/lib/qloo/live-gate";
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

function agentErrorResponse(err: AgentError) {
  const status =
    err.code === "VALIDATION" ||
    err.code === "MUTATION_INVALID" ||
    err.code === "CLAIM_UNGROUNDED" ||
    err.code === "MISSING_CONCEPT"
      ? 400
      : err.code === "LIVE_DISABLED"
        ? 503
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

  try {
    if (mutation.mode === "demo") {
      const result = await runMutationAgent(mutation);
      return NextResponse.json(result);
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
            "Agent mutation orchestration is ready, but live Qloo access remains locked.",
        },
        { status: 503 },
      );
    }

    const { createQlooSource } = await import(
      "@/lib/agent/sources/qloo-source"
    );
    const result = await runMutationAgent(mutation, {
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
        : new QlooError("UPSTREAM", "Unexpected error during mutation.", {
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
