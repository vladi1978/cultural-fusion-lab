import { NextResponse } from "next/server";
import type { OpportunityHypothesis } from "@/lib/agent/opportunity-types";
import { runExplorationAgent } from "@/lib/agent/orchestrator";
import { generateCausalDraftsFromExploration } from "@/lib/agent/causal-v2/from-exploration";
import { EVAL_SCENARIOS } from "@/lib/eval/scenarios";


export async function GET(request: Request) {
  const url = new URL(request.url);
  const scenarioId =
    url.searchParams.get("scenario") || "H01-product-jazz-lisbon";

  const scenario = EVAL_SCENARIOS.find(
    item => item.id === scenarioId && item.id.startsWith("H"),
  );

  if (!scenario) {
    return NextResponse.json(
      { error: "Synthetic evaluation scenario unavailable." },
      { status: 500 },
    );
  }

  try {
    const opportunities: OpportunityHypothesis[] = [];

    const result = await runExplorationAgent(scenario.request, {
      source: scenario.createSource(),
      now: () => "2026-10-11T00:00:00.000Z",
      onOpportunities: items => opportunities.push(...items),
    });

    const drafts = generateCausalDraftsFromExploration({
      opportunities,
      entities: result.entities ?? [],
      evidence: result.evidence ?? [],
      interpreted: {
        rawObjective: scenario.request.creativeObjective,
        culturalInterest: scenario.request.culturalInterest,
        location: scenario.request.location,
        outputCategory: scenario.request.outputCategory,
        intentTokens: [],
        themes: [],
        summary: scenario.request.creativeObjective,
      },
    });

    return NextResponse.json({
      source: "synthetic-evaluation-fixture",
      scenario: [
        scenario.request.culturalInterest,
        scenario.request.location || "No location",
        scenario.request.outputCategory,
      ].join(" / "),
      acceptedOpportunities: opportunities.length,
      drafts,
      evidenceBoundary:
        "Synthetic evaluation data. No live Qloo requests or validated market findings.",
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to generate experimental causal drafts." },
      { status: 500 },
    );
  }
}
