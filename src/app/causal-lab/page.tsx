"use client";

import { useEffect, useMemo, useState } from "react";
import {
  executeCausalDecision,
  type CausalExecutionResult,
} from "@/lib/agent/causal-v2/execute";
import type { CausalConceptDraft } from "@/lib/agent/causal-v2/types";

interface CausalApiResponse {
  source: string;
  scenario: string;
  acceptedOpportunities: number;
  drafts: CausalConceptDraft[];
  evidenceBoundary: string;
}

// P3.6 SCENARIO SELECTOR
const CAUSAL_SCENARIOS = [
  { id: "H01-product-jazz-lisbon", label: "Jazz / Lisbon" },
  { id: "H02-product-streetwear-tokyo", label: "Streetwear / Tokyo" },
  { id: "H03-brand-anime-seoul", label: "Anime / Seoul" },
] as const;

export default function CausalLabPage() {
  const [experiments, setExperiments] = useState<CausalConceptDraft[]>([]);
  const [scenarioId, setScenarioId] = useState<string>(
    "H01-product-jazz-lisbon",
  );
  const [customJourney, setCustomJourney] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scenario, setScenario] = useState("");
  const [acceptedCount, setAcceptedCount] = useState(0);

  useEffect(() => {
    if (
      new URLSearchParams(window.location.search).get("source") === "custom"
    ) {
      queueMicrotask(() => setCustomJourney(true));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");
      setExperiments([]);
      setExperimentIndex(0);
      setOptionIndex(0);
      setWithinTimeWindow(false);
      setListeningCompleted(false);

      try {
        const savedRequest =
          typeof window !== "undefined"
            ? window.sessionStorage.getItem("cfl-creative-journey-context-v2")
            : null;

        if (customJourney && !savedRequest) {
          throw new Error(
            "Personalized Creative Journey request not found. Return to the main lab and generate concepts again.",
          );
        }

        const useCustom = customJourney;

        const response = await fetch(
          useCustom
            ? "/api/creative-journey"
            : `/api/causal-lab?scenario=${scenarioId}`,
          {
            method: useCustom ? "POST" : "GET",
            headers: useCustom
              ? { "Content-Type": "application/json" }
              : undefined,
            body: useCustom ? savedRequest : undefined,
            signal: controller.signal,
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error(`API returned HTTP ${response.status}`);
        }

        const data = (await response.json()) as CausalApiResponse;

        if (!Array.isArray(data.drafts)) {
          throw new Error("Invalid causal draft response.");
        }

        setExperiments(data.drafts);
        setScenario(
          useCustom
            ? "Personalized Creative Journey / Demo Mode"
            : data.scenario,
        );
        setAcceptedCount(data.acceptedOpportunities);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error ? cause.message : "Unable to load experiments."
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [scenarioId, customJourney]);

  const [experimentIndex, setExperimentIndex] = useState(0);
  const [optionIndex, setOptionIndex] = useState(0);
  const [withinTimeWindow, setWithinTimeWindow] = useState(false);
  const [listeningCompleted, setListeningCompleted] = useState(false);
  const [artworkUnlocked, setArtworkUnlocked] = useState(false);
  const [sequenceStep, setSequenceStep] = useState(0);
  const [routeVisits, setRouteVisits] = useState<string[]>([]);

  const experiment = experiments[experimentIndex];
  const selectedOption = experiment?.decision.options[optionIndex];

  const result: CausalExecutionResult | null = useMemo(
    () =>
      experiment && selectedOption
        ? executeCausalDecision(experiment, {
            selectedOption,
            withinTimeWindow,
            listeningCompleted,
          })
        : null,
    [experiment, selectedOption, withinTimeWindow, listeningCompleted],
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080c18] p-12 text-white">
        Loading agent-generated causal experiments...
      </main>
    );
  }

  if (error || !experiment || !result) {
    return (
      <main className="min-h-screen bg-[#080c18] p-12 text-white">

      <h1 className="text-2xl font-bold">Causal Decision Lab</h1>
        <p className="mt-4 text-amber-300">
          {error || "No executable causal drafts were generated."}
        </p>
        <a href="/" className="mt-6 inline-block text-cyan-300 underline">
          Return to Cultural Fusion Lab
        </a>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080c18] px-5 py-12 text-white">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-400">
            Cultural Fusion Lab / Experimental
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Causal Decision Lab
          </h1>
          <p className="max-w-2xl text-slate-300">
            Explore agent-generated causal concepts and simulate how decisions
            change their behavior. This evaluation uses synthetic data, not live Qloo findings.
          </p>
        </header>

        {/* P8.17 — Accurate journey context */}
        {customJourney ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <span className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200">
              Personalized Creative Journey · Demo Mode
            </span>
            <a
              href="/"
              className="text-sm text-cyan-300 underline underline-offset-4"
            >
              Return to Cultural Fusion Lab
            </a>
          </div>
        ) : (
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <label htmlFor="causal-scenario" className="text-sm text-cyan-200">
              Synthetic scenario
            </label>
            <select
              id="causal-scenario"
              value={scenarioId}
              onChange={(event) => setScenarioId(event.target.value)}
              className="rounded-lg border border-cyan-500/40 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              {CAUSAL_SCENARIOS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <p className="text-sm text-slate-400">
          {scenario} · {acceptedCount} accepted opportunities ·{" "}
          {experiments.length} causal experiments · Synthetic evaluation data
        </p>

        <section className="grid gap-3 sm:grid-cols-2">
          {experiments.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setExperimentIndex(index);
                setOptionIndex(0);
                setArtworkUnlocked(false);
                setSequenceStep(0);
                setRouteVisits([]);
              }}
              aria-pressed={experimentIndex === index}
              className={`rounded-2xl border p-5 text-left transition ${
                experimentIndex === index
                  ? "border-cyan-400 bg-cyan-400/10"
                  : "border-white/10 bg-white/5 hover:border-white/30"
              }`}
            >
              <span className="text-xs uppercase tracking-widest text-cyan-300">
                Experiment {index + 1}
              </span>
              <h2 className="mt-2 text-xl font-semibold">
                {item.observations.map(observation => observation.signal).join(" × ")}
              </h2>
              <p className="mt-2 line-clamp-2 text-sm text-slate-400">{item.opportunityHypothesis}</p>
            </button>
          ))}
        </section>


          {/* P6.1 — Creative Journey */}
          <section
            aria-label="Creative Journey"
            className="mb-8 overflow-hidden rounded-2xl border border-cyan-500/25 bg-[#0b1325] p-5 shadow-[0_0_35px_rgba(6,182,212,0.06)] sm:p-7"
          >
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-400">
                  Creative Journey
                </p>
                <h2 className="mt-2 text-xl font-bold text-white">
                  From cultural signals to interactive concepts
                </h2>
              </div>
              <span className="rounded-full border border-amber-400/30 px-3 py-1 text-xs text-amber-200">
                Synthetic demonstration
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  number: "01",
                  title: "Discover",
                  description: `${experiment.observations.length} cultural observations supporting this creative hypothesis.`,
                },
                {
                  number: "02",
                  title: "Create",
                  description: experiment.action.object,
                },
                {
                  number: "03",
                  title: "Experience",
                  description: `${experiment.action.verb.toUpperCase()} · ${selectedOption ?? "Select a decision path"}`,
                },
                {
                  number: "04",
                  title: "Evaluate",
                  description: `${result.state.toUpperCase()} · Simulated decision outcome; not market validation.`,
                },
              ].map((step) => (
                <div
                  key={step.number}
                  className="rounded-xl border border-white/10 bg-white/[0.035] p-4"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-400/10 text-xs font-bold text-cyan-300">
                      {step.number}
                    </span>
                    <h3 className="font-semibold text-white">{step.title}</h3>
                  </div>
                  <p className="line-clamp-3 text-sm leading-relaxed text-slate-400">{step.description}</p>
                </div>
              ))}
            </div>

            <p className="mt-5 border-t border-white/10 pt-4 text-xs leading-relaxed text-slate-400">
              This prototype demonstrates agent-generated concepts using
              synthetic evaluation fixtures. It does not establish real-world
              cultural affinity, consumer demand, or market validation.
            </p>
          </section>

          {/* P4.4 — Creative concept presentation */}
        <section className="overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/10 via-slate-900/80 to-violet-500/10 p-6 sm:p-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <span className="rounded-full border border-cyan-400/30 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-cyan-200">
              Creative concept
            </span>
            <span className="text-xs uppercase tracking-wider text-slate-400">
              Synthetic hypothesis
            </span>
          </div>

          <h2 className="max-w-3xl text-2xl font-bold leading-tight sm:te-3xl">
            {experiment.action.object}
          </h2>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200">
            {experiment.opportunityHypothesis}
          </p>

          <div className="mt-7 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-cyan-300">
                Cultural signals
              </h3>
              <div className="mt-4 space-y-3">
                {experiment.observations.map((observation, index) => (
                  <div key={`${observation.entityId}-${index}`}>
                    <p className="text-lg font-semibold capitalize text-white">
                      {observation.signal}
                    </p>
                    <p className="mt-1 break-all text-xs text-slate-400">
                      Entity: {observation.entityId}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {observation.evidenceIds.length} linked evidence reference(s)
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-violet-300">
                Experience mechanism
              </h3>
              <p className="mt-4 text-xl font-semibold capitalize">
                {experiment.action.verb}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {experiment.action.observableResult}
              </p>
              <p className="mt-4 border-t border-white/10 pt-4 text-xs leading-5 text-slate-400">
                Proposed pilot: {experiment.pilotExperiment}
              </p>
            </div>
          </div>

          <p className="mt-5 text-xs leading-5 text-slate-400">
            {experiment.evidenceBoundary}
          </p>
        </section>

        <section className="space-y-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400">
              Decision
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              {experiment.decision.question}
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {experiment.decision.options.map((option, index) => (
              <button
                key={option}
                type="button"
                aria-pressed={optionIndex === index}
                onClick={() => {
                  setOptionIndex(index);
                  setArtworkUnlocked(false);
                  setSequenceStep(0);
                  setRouteVisits([]);
                }}
                className={`rounded-xl border p-4 text-left text-sm transition ${
                  optionIndex === index
                    ? "border-cyan-400 bg-cyan-400/10 text-white"
                    : "border-white/10 bg-black/20 text-slate-300 hover:border-white/30"
                }`}
              >
                <span className="mb-2 block text-xs text-cyan-300">
                  Path {index === 0 ? "A" : "B"}
                </span>
                {option}
              </button>
            ))}
          </div>

          <div className="space-y-4 rounded-2xl bg-black/25 p-5">
            <h3 className="font-semibold">Simulation conditions</h3>

            {experiment.action.verb === "unlock" ? (
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={withinTimeWindow}
                  onChange={(event) => setWithinTimeWindow(event.target.checked)}
                  className="h-5 w-5 accent-cyan-400"
                />
                <span>Visitor is within the night access window</span>
              </label>
            ) : experiment.action.verb === "assemble" ? (
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={listeningCompleted}
                  onChange={(event) => setListeningCompleted(event.target.checked)}
                  className="h-5 w-5 accent-cyan-400"
                />
                <span>Listening checkpoint completed</span>
              </label>
            ) : (
              <p className="text-sm text-slate-300">
                This experiment is controlled by the selected decision path.
                No additional simulation conditions are required.
              </p>
            )}
          </div>

          {/* P5.3 — Interactive Route */}
          {experiment.action.verb === "route" && (
            <section
              aria-label="Interactive cultural route demonstration"
              className="overflow-hidden rounded-2xl border border-cyan-400/30 bg-[#090e20]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                    Interactive creative experience
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-white">
                    Cultural exploration · Route
                  </h3>
                </div>
                <span className="rounded-full border border-cyan-400/30 px-3 py-1 text-xs text-cyan-200">
                  Synthetic visual prototype
                </span>
              </div>

              <div className="px-5 pt-5">
                <p className="text-sm leading-6 text-slate-300">
                  {optionIndex === 0
                    ? "Guided route: visit Place first, then Music."
                    : "Open exploration: visit Place and Music in either order."}
                </p>
              </div>

              <div className="relative mx-5 my-5 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#111b37] via-[#17112d] to-[#092733] px-5 py-12 sm:px-10">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 opacity-25"
                  style={{
                    backgroundImage:
                      "linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)",
                    backgroundSize: "36px 36px",
                  }}
                />

                <div className="relative mx-auto max-w-xl">
                  <div className="mb-8 flex items-center justify-center gap-3">
                    <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">
                      {optionIndex === 0 ? "Guided route" : "Open exploration"}
                    </span>
                    <span className="text-xs text-slate-400">
                      {routeVisits.length}/2 discovered
                    </span>
                  </div>

                  <div className="relative grid grid-cols-2 gap-5 sm:gap-12">
                    <div
                      aria-hidden="true"
                      className={`pointer-events-none absolute left-1/4 right-1/4 top-12 border-t-2 ${
                        optionIndex === 0
                          ? "border-dashed border-cyan-400/70"
                          : "border-dashed border-violet-400/50"
                      }`}
                    />

                    {(["place", "music"] as const).map((node) => {
                      const visited = routeVisits.includes(node);
                      const blocked =
                        optionIndex === 0 &&
                        node === "music" &&
                        !routeVisits.includes("place");

                      return (
                        <button
                          key={node}
                          type="button"
                          disabled={blocked || visited}
                          onClick={() =>
                            setRouteVisits(previous =>
                              previous.includes(node)
                                ? previous
                                : [...previous, node],
                            )
                          }
                          className={`relative flex min-h-48 flex-col items-center justify-center rounded-2xl border p-4 text-center transition-all duration-300 ${
                            visited
                              ? "border-emerald-400 bg-emerald-400/15 shadow-[0_0_35px_rgba(52,211,153,.15)]"
                              : blocked
                                ? "cursor-not-allowed border-white/10 bg-slate-950/60 opacity-45"
                                : "border-cyan-400/50 bg-slate-950/70 hover:scale-[1.03] hover:border-cyan-300 hover:bg-cyan-400/10"
                          }`}
                        >
                          <span className="mb-4 text-5xl" aria-hidden="true">
                            {node === "place" ? "⌖" : "♫"}
                          </span>
                          <span className="text-lg font-bold text-white">
                            {node === "place" ? "Place" : "Music"}
                          </span>
                          <span className="mt-2 text-xs text-slate-300">
                            {visited
                              ? "✓ Discovered"
                              : blocked
                                ? "Visit Place first"
                                : "Select to explore"}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div
                    aria-live="polite"
                    className="mt-8 rounded-xl border border-white/10 bg-slate-950/70 p-4 text-center"
                  >
                    <p className="text-xs uppercase tracking-widest text-cyan-300">
                      Exploration progress
                    </p>
                    <p className="mt-2 text-sm text-white">
                      {routeVisits.length === 0
                        ? "Choose your first cultural reference."
                        : routeVisits.length === 2
                          ? `Exploration complete: ${routeVisits.join(" → ")}`
                          : `${routeVisits[0] === "place" ? "Place" : "Music"} discovered. Continue exploring.`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-5">
                <p className="text-sm text-slate-300">
                  Path {optionIndex === 0 ? "A" : "B"} ·{" "}
                  {routeVisits.length === 2
                    ? "Exploration completed"
                    : "Exploration in progress"}
                </p>
                <button                type="button"
                  onClick={() => setRouteVisits([])}
                  className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                >
                  Reset route
                </button>
              </div>

              <p className="border-t border-white/10 px-5 py-4 text-xs leading-5 text-slate-400">
                Conceptual interaction only. Nodes do not represent verified
                physical locations, actual travel routes, or validated cultural affinities.
              </p>
            </section>
          )}

          {/* P5.2 — Interactive Sequence */}
          {experiment.action.verb === "sequence" && (
            <section
              aria-label="Interactive cultural sequence demonstration"
              className="overflow-hidden rounded-2xl border border-cyan-400/30 bg-[#090e20]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                    Interactive creative experience
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-white">
                    Cultural narrative · Sequence
                  </h3>
                </div>
                <span className="rounded-full border border-cyan-400/30 px-3 py-1 text-xs text-cyan-200">
                  Synthetic visual prototype
                </span>
              </div>

              {(() => {
                const order = optionIndex === 0
                  ? ["music", "film"]
                  : ["film", "music"];

                const current = order[sequenceStep];
                const isMusic = current === "music";

                return (
                  <>
                    <div className="grid grid-cols-2 gap-3 px-5 pt-5">
                      {order.map((item, index) => (
                        <div
                          key={`${item}-${index}`}
                          className={`rounded-xl border px-4 py-3 text-sm transition ${
                            sequenceStep === index
                              ? "border-cyan-400 bg-cyan-400/10 text-white"
                              : "border-white/10 bg-white/5 text-slate-400"
                          }`}
                        >
                          <span className="block text-xs uppercase tracking-wider text-cyan-300">
                            Scene {index + 1}
                          </span>
                          <span className="mt-1 block font-semibold capitalize">
                            {item === "music" ? "♫ Music" : "▣ Film"}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div
                      key={`${optionIndex}-${sequenceStep}`}
                      className={`relative mx-5 my-5 flex min-h-[320px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 p-8 text-center sm:min-h-[390px] ${
                        isMusic
                          ? "bg-gradient-to-br from-violet-950 via-fuchsia-900/70 to-slate-950"
                          : "bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-950"
                      }`}
                    >
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 opacity-25"
                        style={{
                          backgroundImage:
                            "linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)",
                          backgroundSize: "40px 40px",
                        }}
                      />

                      {isMusic ? (
                        <div
                          aria-hidden="true"
                          className="relative mb-6 flex h-40 items-end justify-center gap-2"
                        >
                          {[45, 85, 125, 70, 150, 105, 60, 115, 75].map(
                            (height, index) => (
                              <div
                                key={index}
                                className="w-3 rounded-full bg-gradient-to-t from-fuchsia-500 to-cyan-300 shadow-[0_0_20px_rgba(217,70,239,.35)]"
                                style={{ height }}
                              />
                            ),
                          )}
                        </div>
                      ) : (
                        <div
                          aria-hidden="true"
                          className="relative mb-6 flex h-40 w-64 items-center justify-center overflow-hidden rounded-xl border-4 border-white/30 bg-gradient-to-br from-cyan-400/30 via-blue-700/40 to-violet-900/60 shadow-[0_0_45px_rgba(34,211,238,.2)]"
                        >
                          <div className="absolute left-5 top-5 h-16 w-16 rounded-full bg-amber-300/70 blur-sm" />
                          <div className="absolute -bottom-12 left-10 h-32 w-32 rotate-45 bg-cyan-400/40" />
                          <div className="absolute -bottom-16 right-4 h-40 w-40 rotate-45 bg-violet-400/50" />
                          <span className="relative text-5xl text-white/90">▶</span>
                        </div>
                      )}

                      <p className="relative text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">
                        Scene {sequenceStep + 1} of 2
                      </p>
                      <h4 className="relative mt-3 text-3xl font-bold text-white">
                        {isMusic ? "The Sound" : "The Visual Story"}
                      </h4>
                      <p className="relative mt-3 max-w-md text-sm leading-6 text-slate-200">
                        {isMusic
                          ? "Explore the musical reference as a simulated creative scene."
                          : "Explore the cinematic reference as a simulated visual scene."}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-5">
                      <p aria-live="polite" className="text-sm text-slate-300">
                        Path {optionIndex === 0 ? "A" : "B"} ·{" "}
                        {order.join(" → ")} · Scene {sequenceStep + 1}/2
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={sequenceStep === 0}
                          onClick={() => setSequenceStep(0)}
                          className="rounded-lg border border-white/20 px-xt-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          disabled={sequenceStep === 1}
                          onClick={() => setSequenceStep(1)}
                          className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          Next scene →
                        </button>
                      </div>
                    </div>
                  </>
                );
              })()}
            </section>
          )}

          {/* P5.1 — Interactive Visual Reveal */}
          {experiment.action.verb === "reveal" && (
            <section
              aria-label="Interactive visual reveal demonstration"
              className="overflow-hidden rounded-2xl border border-violet-400/30 bg-[#090e20]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
                    Interactive creative experience
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-white">
                    Cultural artifact · Visual reveal
                  </h3>
                </div>
                <span className="rounded-full border border-violet-400/30 px-3 py-1 text-xs text-violet-200">
                  Synthetic visual prototype
                </span>
              </div>

              <div className="relative flex min-h-[320px] items-center justify-center overflow-hidden bg-gradient-to-br from-[#101b39] via-[#17102e] to-[#071a27] p-6 sm:min-h-[390px]">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 opacity-30"
                  style={{
                    backgroundImage:
                      "linear-gradient(rgba(125,211,252,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(125,211,252,.12) 1px, transparent 1px)",
                    backgroundSize: "36px 36px",
                  }}
                />

                <div
                  className={`relative w-full max-w-sm transition-all duration-700 ${
                    optionIndex === 0 && !artworkUnlocked
                      ? "scale-95 blur-md opacity-35"
                      : "scale-100 blur-0 opacity-100"
                  }`}
                >
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-cyan-300/40 bg-gradient-to-br from-fuchsia-600 via-violet-700 to-cyan-700 shadow-[0_0_70px_rgba(103,232,249,.15)]">
                    <div className="absolute -left-12 top-5 h-56 w-56 rounded-full border-[30px] border-cyan-200/60" />
                    <div className="absolute -right-10 bottom-0 h-64 w-64 rotate-45 border-[36px] border-fuchsia-200/50" />
                    <div className="absolute left-1/3 top-1/4 h-40 w-40 rotate-12 rounded-3xl bg-amber-300/70 mix-blend-screen" />
                    <div className="absolute inset-x-5 bottom-5 rounded-xl border border-white/20 bg-slate-950/70 p-4 backdrop-blur-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-200">
                        Cultural Fusion Lab
                      </p>
                      <p className="mt-1 text-lg font-bold text-white">
                        {experiment.observations.map(item => item.signal).join(" × ")}
                      </p>
                      <p className="mt-1 text-xs text-slate-200">
                        Conceptual artwork · Not a verified cultural asset
                      </p>
                    </div>
                  </div>
                </div>

                {optionIndex === 0 && !artworkUnlocked && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/45 px-5 text-center backdrop-blur-[2px]">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-cyan-300/50 bg-slate-900/90 text-3xl shadow-[0_0_35px_rgba(34,211,238,.25)]">
                      🔒
                    </div>
                    <p className="text-xl font-bold text-white">
                      Artifact locked
                    </p>
                    <p className="mt-2 max-w-xs text-sm text-slate-200">
                      Complete the simulated spatial interaction to reveal the artwork.
                    </p>
                    <button
                      type="button"
                      onClick={() => setArtworkUnlocked(true)}
                      className="mt-5 rounded-xl bg-cyan-400 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                    >
                      Unlock artwork
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <p aria-live="polite" className="text-sm text-slate-200">
                  {optionIndex === 0
                    ? artworkUnlocked
                      ? "Path A · Interaction completed — artwork revealed"
                      : "Path A · Waiting for simulated interaction"
                    : "Path B · Direct access — artwork visible"}
                </p>
                {optionIndex === 0 && artworkUnlocked && (
                  <button
                    type="button"
                    onClick={() => setArtworkUnlocked(false)}
                    className="rounded-lg border border-white/20 px-3 py-2 text-xs text-slate-200 hover:bg-white/10"
                  >
                    Reset interaction
                  </button>
                )}
              </div>
            </section>
          )}

          <div
            aria-live="polite"
            className={`rounded-2xl border p-6 ${
              result.accepted
                ? "border-emerald-400/40 bg-emerald-400/10"
                : "border-amber-400/40 bg-amber-400/10"
            }`}
          >
            <p className="text-xs uppercase tracking-widest text-slate-300">
              Simulated outcome
            </p>
            <p className="mt-2 text-3xl font-bold capitalize">{result.state}</p>
            <p className="mt-2 text-sm text-slate-200">{result.explanation}</p>
            <p className="mt-3 text-xs text-slate-400">
              Opportunity: {experiment.opportunityId}
            </p>
          </div>
        </section>


        {/* P6.3 — Decision & Evaluation Summary */}
        <section
          aria-label="Decision and evaluation summary"
          className="rounded-2xl border border-cyan-500/25 bg-[#0b1325] p-6 sm:p-8"
        >
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
                Decision & Evaluation
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white">
                From creative decision to testable pilot
              </h2>
            </div>
            <span className="rounded-full border border-amber-400/30 px-3 py-1 text-xs text-amber-200">
              Simulation only
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.035] p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">
                01 · Selected decision
              </p>
              <p className="mt-3 text-lg font-semibold text-white">
                {selectedOption}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                {experiment.decision.consequencesByOption[selectedOption] ??
                  "No consequence specified for this option."}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.035] p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">
                02 · Simulated result
              </p>
              <p className="mt-3 text-lg font-semibold capitalize text-white">
                {result.state}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                {result.explanation}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.035] p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">
                03 · Proposed pilot
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-200">
                {experiment.pilotExperiment}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.035] p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">
                04 · Evidence boundary
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-200">
                {experiment.evidenceBoundary}
              </p>
            </div>
          </div>

          <p className="mt-5 border-t border-white/10 pt-4 text-xs leading-relaxed text-slate-400">
            The selected path and its outcome are simulated. The proposed pilot
            describes a possible future validation step; no real participant
            behavior, consumer preference, or commercial performance has been measured.
          </p>
        </section>

        <footer className="text-sm text-slate-400">
          <p className="mt-2">
            Synthetic fixture · Creative hypotheses are not validated market findings.
          </p>
          <a
            href="/"
            className="mt-5 inline-block text-cyan-300 underline underline-offset-4"
          >
            Return to Cultural Fusion Lab
          </a>
        </footer>
      </div>
    </main>
  );
}
