"use client";

import { useEffect, useState } from "react";

import { getMutationCandidates } from "@/lib/demo-data";
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
import { ConceptCards } from "./ConceptCards";
import { CulturalNetwork } from "./CulturalNetwork";
import { DemoBanner } from "./DemoBanner";
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
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    const draft = loadDraft();
    const savedResult = loadResult();
    const savedStage = loadStage();

    // Defer so hydration sync is not a synchronous setState-in-effect cascade.
    queueMicrotask(() => {
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
    if (!storageReady) return;
    saveDraft(request);
  }, [request, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    saveStage(stage);
  }, [stage, storageReady]);

  const goTo = (next: LabStage) => {
    setError(null);
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
    setStage("landing");
  };

  const runExploration = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/explore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...request, mode: "demo" }),
      });

      if (!response.ok) {
        const body = (await response.json()) as ApiErrorBody;
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
          <DemoBanner />
        </div>
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
              className="rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Explore in Creative Journey →
            </button>
          </div>
        </div>
        <ConceptCards
              concepts={result.concepts}
              selectedId={selectedConcept?.id}
              onSelect={setSelectedConcept}
              onOpenMutation={openMutation}
              onSelectEvidence={setHighlightEvidence}
            />

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
