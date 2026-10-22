"use client";

import { useState } from "react";

import type { AblationResult } from "@/lib/agent/ablation/ablation";
import { SIMILARITY_NOTE } from "@/lib/agent/ablation/ablation";
import type { ExplorationRequest, FusionConcept } from "@/lib/types";

const VERDICT_LABEL: Record<AblationResult["verdict"], string> = {
  detectable: "Qloo influence detectable",
  not_demonstrated: "Qloo influence not demonstrated",
};

export function AblationPanel({ concept, request }: { concept: FusionConcept; request: ExplorationRequest }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<AblationResult | null>(null);
  const [message, setMessage] = useState("");

  const run = async () => {
    setState("loading");
    setMessage("");
    try {
      const response = await fetch("/api/ablation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "live", concept, request }),
      });
      const data = (await response.json()) as AblationResult & { error?: string; code?: string };
      if (!response.ok) {
        setMessage(data.code === "ABLATION_DISABLED" ? "The with/without-Qloo test is disabled on this server." : data.error || "The test failed.");
        setState("error");
        return;
      }
      setResult(data);
      setState("done");
    } catch {
      setMessage("The test could not be completed.");
      setState("error");
    }
  };

  const arms = result
    ? [
        ...result.control.map((t, i) => ({ label: `Without Qloo evidence #${i + 1}`, t })),
        ...result.evidence.map((t, i) => ({ label: `With Qloo evidence #${i + 1}`, t })),
      ]
    : [];

  return (
    <section className="panel space-y-4 p-5" aria-label="Controlled Qloo evidence comparison">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-xl text-white">Did the Qloo evidence change a design decision?</h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Four generations with the same prompt, settings and operating design. Only the Qloo evidence is added or left out. No new Qloo calls.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={run} disabled={state === "loading"}>
          {state === "loading" ? "Running 4 generations (about 1–2 min)…" : "Run controlled comparison"}
        </button>
      </div>

      {state === "error" ? <p className="text-sm text-amber-200" role="alert">{message}</p> : null}

      {result ? (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-white">{VERDICT_LABEL[result.verdict]}</p>
          <p className="text-sm text-slate-300">{result.explanation}</p>

          <div>
            <p className="text-[11px] uppercase tracking-wide text-cyan-300">Traceable signals in design decisions</p>
            {result.signals.length ? (
              <ul className="mt-1 space-y-2 text-xs text-slate-300">
                {result.signals.map((s) => (
                  <li key={`${s.entityId}-${s.term}`} className="rounded-lg border border-white/10 bg-black/20 p-2">
                    <span className="text-white">{s.entityName}</span> → “{s.term}” ({s.kind}), in {s.evidenceRuns} of {result.evidence.length} evidence runs, none of the control runs.
                    <span className="mt-1 block text-slate-400">{s.field}: {s.excerpt}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-slate-400">None. No specific term from a cited entity appeared in the decisions without also appearing in the control runs.</p>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {arms.map(({ label, t }) => (
              <div key={label} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-[11px] uppercase tracking-wide text-cyan-300">{label}</p>
                <p className="mt-1 font-semibold text-white">{t.name}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">{t.proposition}</p>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-[var(--text-muted)]">
            Text similarity (descriptive only): control vs control {result.textSimilarity.controlVsControl ?? "n/a"} · evidence vs evidence {result.textSimilarity.evidenceVsEvidence ?? "n/a"} · control vs evidence {result.textSimilarity.controlVsEvidence}. {SIMILARITY_NOTE}
          </p>
          <p className="text-[11px] text-[var(--text-muted)]">
            {result.protocol.modelCalls} model calls · {result.protocol.qlooCalls} Qloo calls · order: {result.protocol.order}.
          </p>
          <p className="text-[11px] text-[var(--text-muted)]">{result.caveat}</p>
        </div>
      ) : null}
    </section>
  );
}
