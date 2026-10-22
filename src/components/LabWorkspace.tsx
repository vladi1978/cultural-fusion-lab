"use client";

import { useEffect, useState } from "react";

import { getMutationCandidates } from "@/lib/demo-data";
import { classifyExplorationOutcome, type ExplorationFeedback } from "@/lib/exploration-feedback";
import { parseLiveAvailability, resolveLiveUi, type LiveAvailability } from "@/lib/live-availability";
import {
  clearDraft,
  clearResult,
  loadDraft,
  loadResult,
  loadStage,
  saveDraft,
  saveResult,
  saveStage,
} from "@/lib/storage";
import type {
  ApiErrorBody,
  ExplorationRequest,
  ExplorationResult,
  FusionConcept,
  LabStage,
  MutationResult,
} from "@/lib/types";

import { AgentTracePanel } from "./AgentTracePanel";
import { AblationPanel } from "./AblationPanel";
import { EvidenceDecisionsPanel } from "./EvidenceDecisionsPanel";
import { ConceptCards } from "./ConceptCards";
import { CulturalNetwork } from "./CulturalNetwork";
import { DemoBanner, LiveBanner, LiveUnavailableBanner } from "./DemoBanner";
import { DiscoveryView } from "./DiscoveryView";
import { EmptyState, ErrorState, LoadingState } from "./StatusBlocks";
import { EvidencePanel } from "./EvidencePanel";
import { ExplorationForm } from "./ExplorationForm";
import { LabHeader } from "./LabHeader";
import { LandingHero } from "./LandingHero";
import { MutationComparison } from "./MutationComparison";
import { MutationStudio } from "./MutationStudio";

const DEFAULT_REQUEST: ExplorationRequest = {
  creativeObjective: "",
  culturalInterest: "",
  location: "",
  outputCategory: "product",
  mode: "demo",
};

export function LabWorkspace() {
  const [stage, setStage] = useState<LabStage>("landing");
  const [request, setRequest] = useState<ExplorationRequest>(DEFAULT_REQUEST);
  const [result, setResult] = useState<ExplorationResult | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<FusionConcept | null>(
    null,
  );
  const [mutationBaseline, setMutationBaseline] = useState<FusionConcept | null>(
    null,
  );
  const [lastMutation, setLastMutation] = useState<MutationResult | null>(null);
  const [highlightEvidence, setHighlightEvidence] = useState<string[]>([]);
  const [replaceEntityId, setReplaceEntityId] = useState("");
  const [newEntityId, setNewEntityId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explorationFeedback, setExplorationFeedback] = useState<ExplorationFeedback | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  // Live Qloo mode is an explicit opt-in via ?live=1 so a public/demo visit can never spend Qloo calls.
  const [liveRequested, setLiveRequested] = useState(false);
  // Live is active only when the SERVER says so. The URL parameter alone never enables it (fail closed).
  const [liveReport, setLiveReport] = useState<LiveAvailability | "pending" | "error">("pending");
  const liveUi = resolveLiveUi(liveRequested ? "1" : null, liveReport);

  useEffect(() => {
    const draft = loadDraft();
    const savedResult = loadResult();
    const savedStage = loadStage();

    // Defer so hydration sync is not a synchronous setState-in-effect cascade.
    queueMicrotask(() => {
      setLiveRequested(new URLSearchParams(window.location.search).get("live") === "1");
      if (draft?.request) {
        setRequest({
          ...DEFAULT_REQUEST,
          ...draft.request,
          mode: "demo",
        });
      }
      if (savedResult) {
        setResult(savedResult);
      }
      if (savedStage) {
        setStage(savedStage);
      }
      setStorageReady(true);
    });
  }, []);

  useEffect(() => {
    if (!liveRequested) return;
    let cancelled = false;
    fetch("/api/live/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("status"))))
      .then((raw) => { if (!cancelled) setLiveReport(parseLiveAvailability(raw)); })
      .catch(() => { if (!cancelled) setLiveReport("error"); });
    return () => { cancelled = true; };
  }, [liveRequested]);

  useEffect(() => {
    if (!storageReady) return;
    saveDraft(request);
  }, [request, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    saveStage(stage);
  }, [stage, storageReady]);

  const goTo = (next: LabStage) => {
    setError(null);
    setExplorationFeedback(null);
    setStage(next);
  };

  const resetLab = () => {
    clearDraft();
    clearResult();
    setRequest(DEFAULT_REQUEST);
    setResult(null);
    setSelectedConcept(null);
    setMutationBaseline(null);
    setLastMutation(null);
    setHighlightEvidence([]);
    setReplaceEntityId("");
    setNewEntityId("");
    setError(null);
    setExplorationFeedback(null);
    setStage("landing");
  };

  const runExploration = async () => {
    setIsLoading(true);
    setError(null);
    setExplorationFeedback(null);
    try {
      const response = await fetch("/api/explore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...request, mode: liveUi.liveActive ? "live" : "demo" }),
      });

      if (!response.ok) {
        const body = (await response.json()) as ApiErrorBody;
        const expected = response.status === 422
          ? classifyExplorationOutcome(body.code, liveUi.liveActive ? "live" : "demo")
          : null;
        if (expected) {
          setResult(null);
          clearResult();
          setSelectedConcept(null);
          setMutationBaseline(null);
          setLastMutation(null);
          setHighlightEvidence([]);
          setExplorationFeedback({
            ...expected,
            diagnostic:
              body.code === "CREATIVE_QUALITY_REJECTED" &&
              typeof body.details === "string"
                ? body.details.slice(0, 1600)
                : undefined,
          });
          setStage("explore");
          return;
        }
        throw new Error(body.error || "Exploration failed.");
      }

      const data = (await response.json()) as ExplorationResult;
      setResult(data);
      saveResult(data);
      setSelectedConcept(null);
      setMutationBaseline(null);
      setLastMutation(null);
      setHighlightEvidence([]);
      // Concepts are the primary attraction after exploration.
      setStage("concepts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Exploration failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const openCreativeJourney = () => {
    if (!result) return;

    window.sessionStorage.setItem(
      "cfl-creative-journey-context-v2",
      JSON.stringify({
        version: 2,
        exploration: result,
        selectedConceptId: selectedConcept?.id ?? result.concepts[0]?.id ?? null,
      }),
    );

    window.sessionStorage.setItem(
      "cfl-creative-journey-request",
      JSON.stringify({
        ...result.request,
        mode: "demo",
      }),
    );

    window.location.assign("/causal-lab?source=custom");
  };

  const openMutation = (concept: FusionConcept) => {
    if (!result) return;
    setSelectedConcept(concept);
    setMutationBaseline(concept);
    setLastMutation(null);
    const firstReplace = concept.culturalInfluences[0]?.id ?? "";
    setReplaceEntityId(firstReplace);
    const candidates = getMutationCandidates(
      result.entities,
      concept.culturalInfluences.map((e) => e.id),
    );
    setNewEntityId(candidates[0]?.id ?? "");
    setStage("mutation");
  };

  const runMutation = async () => {
    if (!result || !selectedConcept) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/mutate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "demo",
          conceptId: selectedConcept.id,
          replaceEntityId,
          newEntityId,
          exploration: result.request,
          concepts: result.concepts,
          entities: result.entities,
          evidence: result.evidence,
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as ApiErrorBody;
        throw new Error(body.error || "Mutation failed.");
      }

      const data = (await response.json()) as MutationResult;
      const nextConcepts = [
        data.mutatedConcept,
        ...result.concepts.filter((c) => c.id !== selectedConcept.id),
      ].slice(0, 3);

      const nextResult: ExplorationResult = {
        ...result,
        concepts: nextConcepts,
        evidence: data.evidence,
        generatedAt: data.generatedAt,
        disclaimer: data.disclaimer,
        agentTrace: data.agentTrace ?? result.agentTrace,
      };

      setResult(nextResult);
      saveResult(nextResult);
      setSelectedConcept(data.mutatedConcept);
      setMutationBaseline(data.originalConcept);
      setLastMutation(data);
      setHighlightEvidence(data.mutatedConcept.evidenceIds);
      setStage("concepts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mutation failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <LabHeader stage={stage} onNavigate={goTo} onReset={resetLab} />

      {stage !== "landing" ? (
        <div className="mb-6">
          {result ? (
            result.mode === "live" ? <LiveBanner /> : <DemoBanner />
          ) : liveUi.state === "checking" || liveUi.state === "unavailable" ? (
            <LiveUnavailableBanner state={liveUi.state} reason={liveUi.reason} />
          ) : liveUi.liveActive ? (
            <LiveBanner />
          ) : (
            <DemoBanner />
          )}
        </div>
      ) : null}

      {explorationFeedback && stage === "explore" ? (
        <section role="status" aria-live="polite" className="mb-6 rounded-2xl border border-amber-400/35 bg-amber-950/20 p-5">
          <h2 className="text-lg font-semibold text-amber-200">{explorationFeedback.heading}</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-200">{explorationFeedback.explanation}</p>
          <p className="mt-2 text-sm text-slate-300">{explorationFeedback.suggestion}</p>
          {explorationFeedback.diagnostic ? (
            <p className="mt-3 whitespace-pre-wrap break-words rounded-lg border border-amber-400/20 bg-black/20 p-3 text-xs leading-relaxed text-amber-100">
              {explorationFeedback.diagnostic}
            </p>
          ) : null}
          
          <button type="button" onClick={() => setExplorationFeedback(null)} className="mt-4 rounded-lg border border-slate-500 px-4 py-2 text-sm text-white hover:border-cyan-300">
            Revise exploration brief
          </button>
        </section>
      ) : null}

      {error ? (
        <div className="mb-6">
          <ErrorState message={error} onRetry={() => setError(null)} />
        </div>
      ) : null}

      {stage === "landing" ? (
        <LandingHero onStart={() => goTo("explore")} />
      ) : null}

      {stage === "explore" ? (
        <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
          <ExplorationForm
            value={request}
            onChange={setRequest}
            onSubmit={runExploration}
            isLoading={isLoading}
            live={liveUi.liveActive}
            blocked={liveUi.state === "checking"}
            liveUnavailable={liveUi.state === "unavailable"}
          />
          <div className="space-y-4">
            {isLoading ? (
              <LoadingState label="Running deterministic agent orchestration…" />
            ) : (
              <EmptyState
                title="Ready to explore"
                description="Run Cultural Discovery to generate three differentiated fusion concepts. Evidence and agent trace stay secondary."
              />
            )}
            <EvidencePanel items={result?.evidence ?? []} collapsible defaultOpen={false} />
            <AgentTracePanel trace={result?.agentTrace} collapsible />
          </div>
        </div>
      ) : null}

      {stage === "discovery" ? (
        isLoading ? (
          <LoadingState />
        ) : result ? (
          <DiscoveryView
            clusters={result.clusters}
            entities={result.entities}
            affinities={result.affinities}
            evidence={result.evidence}
            mode={result.mode}
            onContinue={() => goTo("concepts")}
          />
        ) : (
          <EmptyState
            title="Discovery is empty"
            description="Start an exploration to see grouped cultural entities."
          />
        )
      ) : null}

      {stage === "concepts" ? (
        result ? (
          <div className="space-y-8">
            <div className="mb-6 rounded-2xl border border-cyan-400/30 bg-gradient-to-r from-cyan-950/60 to-slate-900 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">
                Continue your Creative Journey
              </h3>
              <p className="mt-1 text-sm text-slate-300">
                Turn cultural opportunities into interactive creative experiments.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreativeJourney}
              disabled={result?.mode === "live"}
              title={result?.mode === "live" ? "Creative Journey currently supports demo data only." : undefined}
              className="rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {result?.mode === "live" ? "Creative Journey: demo data only" : "Explore in Creative Journey →"}
            </button>
          </div>
        </div>
        <section role="status" aria-label="Creative engine verification status" className="rounded-2xl border border-slate-500/40 bg-slate-900/80 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cyan-400/40 px-3 py-1 text-xs font-semibold text-cyan-200">
              {result.agentTrace?.engine === "creative-llm-v1" ? "Generative creative pipeline" : "Deterministic exploration"}
            </span>
            <span className="text-xs text-slate-300">{result.mode === "demo" ? "Demo / simulated cultural data" : "Live cultural data"}</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            {result.agentTrace?.engine === "creative-llm-v1"
              ? "Creative Fidelity Triage is enabled for model-generated concepts. Visible concepts passed provisional checks only; semantic and cultural verification remains necessary."
              : "This run uses the deterministic engine, not autonomous generative creativity. Fidelity Triage applies to the optional generative pipeline and has not evaluated these deterministic concepts."}
          </p>
        </section>
        <ConceptCards
              concepts={result.concepts}
              selectedId={selectedConcept?.id}
              onSelect={setSelectedConcept}
              onOpenMutation={openMutation}
              onSelectEvidence={setHighlightEvidence}
            />

            {result.mode === "live" && result.concepts[0]?.spec ? (
              <EvidenceDecisionsPanel concept={result.concepts[0]} />
            ) : null}

            {result.mode === "live" && result.concepts[0]?.spec ? (
              <AblationPanel concept={result.concepts[0]} request={result.request} />
            ) : null}

            {lastMutation && mutationBaseline ? (
              <MutationComparison
                baseline={mutationBaseline}
                mutation={lastMutation}
              />
            ) : null}

            <div className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="font-display text-xl text-white">
                    Cultural neighborhood
                  </h3>
                  <p className="text-sm text-[var(--text-muted)]">
                    Supporting entities and provenance-labeled relationships.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost !px-3 !py-2 text-xs"
                  onClick={() => goTo("discovery")}
                >
                  Open full discovery
                </button>
              </div>
              <CulturalNetwork
                entities={result.entities}
                affinities={result.affinities}
                evidence={result.evidence}
                mode={result.mode}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <EvidencePanel
                items={result.evidence}
                highlightIds={highlightEvidence}
                collapsible
                defaultOpen={highlightEvidence.length > 0}
              />
              <AgentTracePanel trace={result.agentTrace} collapsible />
            </div>
          </div>
        ) : (
          <EmptyState
            title="No concepts yet"
            description="Run an exploration to generate fusion concepts."
          />
        )
      ) : null}

      {stage === "mutation" ? (
        result && selectedConcept ? (
          <div className="space-y-4">
            {isLoading ? (
              <LoadingState label="Mutating and re-evaluating concept…" />
            ) : null}
            <MutationStudio
              concept={selectedConcept}
              entities={result.entities}
              replaceEntityId={replaceEntityId}
              newEntityId={newEntityId}
              onReplaceChange={setReplaceEntityId}
              onNewChange={setNewEntityId}
              onMutate={runMutation}
              onBack={() => goTo("concepts")}
              isLoading={isLoading}
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <EvidencePanel
                items={result.evidence}
                highlightIds={highlightEvidence}
                collapsible
                defaultOpen={false}
              />
              <AgentTracePanel trace={result.agentTrace} collapsible />
            </div>
          </div>
        ) : (
          <EmptyState
            title="Select a concept to mutate"
            description="Open Fusion Concepts and choose Mutate on a card."
          />
        )
      ) : null}

      {result && stage !== "landing" ? (
        <p className="mt-8 text-center text-xs leading-relaxed text-[var(--text-dim)]">
          {result.disclaimer}
        </p>
      ) : null}
    </div>
  );
}
