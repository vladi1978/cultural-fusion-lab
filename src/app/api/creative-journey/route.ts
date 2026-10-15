import { NextResponse } from "next/server";
import { runExplorationAgent } from "@/lib/agent/orchestrator";
import { generateCausalDraftsFromExploration } from "@/lib/agent/causal-v2/from-exploration";
import type { ExplorationRequest } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const input = body as Record<string, unknown>;

    if (
      typeof input.creativeObjective !== "string" ||
      !input.creativeObjective.trim() ||
      typeof input.culturalInterest !== "string" ||
      !input.culturalInterest.trim() ||
      !["product", "brand", "experience"].includes(
        String(input.outputCategory),
      )
    ) {
      return NextResponse.json(
        { error: "Missing or invalid exploration fields." },
        { status: 400 },
      );
    }

    const exploration: ExplorationRequest = {
      creativeObjective: input.creativeObjective,
      culturalInterest: input.culturalInterest,
      location:
        typeof input.location === "string" ? input.location : undefined,
      outputCategory: input.outputCategory as ExplorationRequest["outputCategory"],
      mode: "demo",
    };

    const result = await runExplorationAgent(exploration);
    const opportunities = result.opportunities ?? [];

    const interpreted = result.agentTrace.interpreted;

    if (!interpreted) {
      return NextResponse.json(
        { error: "Agent interpretation unavailable." },
        { status: 422 },
      );
    }

    const drafts = generateCausalDraftsFromExploration({
      opportunities,
      entities: result.entities,
      evidence: result.evidence,
      interpreted,
    });

    return NextResponse.json({
      source: "demo-agent",
      mode: "demo",
      request: exploration,
      acceptedOpportunities: opportunities.length,
      drafts,
      evidenceBoundary:
        "Synthetic demo evidence. Creative hypotheses are not verified Qloo findings or market forecasts.",
    });
  } catch {
    return NextResponse.json(
      { error: "Creative Journey generation failed." },
      { status: 500 },
    );
  }
}
