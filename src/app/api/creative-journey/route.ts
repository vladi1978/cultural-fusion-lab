import { NextResponse } from "next/server";
import { resolveJourneyContext } from "@/lib/agent/causal-v2/journey-context";
import { generateCausalDraftFromConcept } from "@/lib/agent/causal-v2/from-concept";
import type { CreativeJourneyContext } from "@/lib/agent/causal-v2/journey-context";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid context." }, { status: 400 });
    }

    const { exploration, concept } = resolveJourneyContext(
      body as CreativeJourneyContext,
    );

    if (exploration.mode !== "demo") {
      return NextResponse.json(
        { error: "Creative Journey currently supports Demo Mode only." },
        { status: 400 },
      );
    }

    const draft = generateCausalDraftFromConcept(concept, exploration);

    if (!draft) {
      return NextResponse.json(
        {
          error: "The selected concept lacks sufficient attributable evidence for a causal experiment.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      source: "selected-concept",
      mode: "demo",
      scenario: concept.title,
      acceptedOpportunities: 1,
      conceptId: concept.id,
      drafts: [draft],
      evidenceBoundary:
        "Synthetic demo evidence. Experimental decisions are hypotheses, not verified Qloo findings or market forecasts.",
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid or unavailable Creative Journey context." },
      { status: 400 },
    );
  }
}
