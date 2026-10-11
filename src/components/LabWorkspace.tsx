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
import { DemoBanner } from "./DemoBanner";
import { DiscoveryView } from "./DiscoveryView";
import { EmptyState, ErrorState, LoadingState } from "./StatusBlocks";
import { EvidencePanel } from "./EvidencePanel";
import { ExplorationForm } from "./ExplorationForm";
import { LabHeader } from "./LabHeader";
import { LandingHero } from "./LandingHero";
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
      setHighlightEvidence([]);
      setStage("discovery");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Exploration failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const openMutation = (concept: FusionConcept) => {
    if (!result) return;
    setSelectedConcept(concept);
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
        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <ExplorationForm
            value={request}
            onChange={setRequest}
            onSubmit={runExploration}
            isLoading={isLoading}
          />
          <div className="space-y-4">
            <EvidencePanel items={result?.evidence ?? []} />
            {!result && !isLoading ? (
              <EmptyState
                title="No exploration yet"
                description="Run Cultural Discovery to populate the network, concepts, and evidence trail."
              />
            ) : null}
            {isLoading ? (
              <LoadingState label="Running deterministic agent orchestration…" />
            ) : null}
            <AgentTracePanel trace={result?.agentTrace} />
          </div>
        </div>
      ) : null}

      {stage === "discovery" ? (
        isLoading ? (
          <LoadingState />
        ) : result ? (
          <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
            <DiscoveryView
              clusters={result.clusters}
              entities={result.entities}
              onContinue={() => goTo("concepts")}
            />
            <div className="space-y-4">
              <EvidencePanel
                items={result.evidence}
                highlightIds={highlightEvidence}
              />
              <AgentTracePanel trace={result.agentTrace} />
            </div>
          </div>
        ) : (
          <EmptyState
            title="Discovery is empty"
            description="Start an exploration to see grouped cultural entities."
          />
        )
      ) : null}

      {stage === "concepts" ? (
        result ? (
          <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
            <ConceptCards
              concepts={result.concepts}
              selectedId={selectedConcept?.id}
              onSelect={setSelectedConcept}
              onOpenMutation={openMutation}
              onSelectEvidence={setHighlightEvidence}
            />
            <div className="space-y-4">
              <EvidencePanel
                items={result.evidence}
                highlightIds={highlightEvidence}
              />
              <AgentTracePanel trace={result.agentTrace} />
            </div>
          </div>
        ) : (
          <EmptyState
            title="No concepts yet"
            description="Complete discovery first to generate fusion concepts."
          />
        )
      ) : null}

      {stage === "mutation" ? (
        result && selectedConcept ? (
          <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
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
            </div>
            <div className="space-y-4">
              <EvidencePanel
                items={result.evidence}
                highlightIds={highlightEvidence}
              />
              <AgentTracePanel trace={result.agentTrace} />
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
