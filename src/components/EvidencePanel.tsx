import { BookOpenCheck, FlaskConical, Sparkles } from "lucide-react";

import type { EvidenceItem, EvidenceSource } from "@/lib/types";
import { EVIDENCE_SOURCE_LABELS } from "@/lib/types";

const SOURCE_META: Record<
  EvidenceSource,
  { className: string; icon: typeof FlaskConical }
> = {
  mock_demo: { className: "badge-mock", icon: FlaskConical },
  agent_hypothesis: { className: "badge-hypothesis", icon: Sparkles },
  verified_api: { className: "badge-verified", icon: BookOpenCheck },
};

export function EvidencePanel({
  items,
  highlightIds,
}: {
  items: EvidenceItem[];
  highlightIds?: string[];
}) {
  const ordered = [...items].sort((a, b) => {
    const aHi = highlightIds?.includes(a.id) ? 1 : 0;
    const bHi = highlightIds?.includes(b.id) ? 1 : 0;
    return bHi - aHi;
  });

  if (ordered.length === 0) {
    return (
      <aside className="panel p-5">
        <h3 className="font-display text-lg text-white">Evidence</h3>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Evidence appears here after an exploration. Sources are labeled as
          verified API data, agent hypotheses, or mock demo data.
        </p>
      </aside>
    );
  }

  return (
    <aside className="panel p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-display text-lg text-white">Evidence</h3>
        <span className="badge badge-cyan">{ordered.length} items</span>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-[var(--text-dim)]">
        Provenance is explicit. Mock demo data is never presented as Qloo
        insights. Agent hypotheses are creative synthesis, not forecasts.
      </p>
      <ul className="space-y-3">
        {ordered.map((item) => {
          const meta = SOURCE_META[item.source];
          const Icon = meta.icon;
          const highlighted = highlightIds?.includes(item.id);
          return (
            <li
              key={item.id}
              className={`rounded-2xl border px-3.5 py-3 transition ${
                highlighted
                  ? "border-[rgba(34,211,238,0.45)] bg-[rgba(34,211,238,0.08)]"
                  : "border-[var(--line)] bg-[rgba(5,8,16,0.35)]"
              }`}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className={`badge ${meta.className}`}>
                  <Icon className="h-3 w-3" aria-hidden />
                  {EVIDENCE_SOURCE_LABELS[item.source]}
                </span>
              </div>
              <p className="text-sm font-medium text-white">{item.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                {item.detail}
              </p>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
