import { FlaskConical } from "lucide-react";

export function DemoBanner() {
  return (
    <div
      className="flex items-start gap-3 rounded-2xl border border-[rgba(212,168,83,0.35)] bg-[rgba(212,168,83,0.1)] px-4 py-3 text-sm text-[#fde68a]"
      role="status"
    >
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>
        <span className="font-semibold tracking-wide">DEMO MODE</span>
        {" — "}
        Sample data is fictional and deterministic for product walkthroughs. It
        is <strong className="font-semibold">not</strong> Qloo Taste Graph
        output.
      </p>
    </div>
  );
}
