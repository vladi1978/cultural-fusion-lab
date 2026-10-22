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

export function LiveBanner() {
  return (
    <div
      className="flex items-start gap-3 rounded-2xl border border-[rgba(52,211,153,0.35)] bg-[rgba(52,211,153,0.08)] px-4 py-3 text-sm text-emerald-200"
      role="status"
    >
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>
        <span className="font-semibold tracking-wide">LIVE MODE</span>
        {" — "}
        Entities come from real Qloo API responses. The concept built from them
        is still a <strong className="font-semibold">hypothesis</strong>, not a
        validated market finding.
      </p>
    </div>
  );
}

export function LiveUnavailableBanner({ state, reason }: { state: "checking" | "unavailable"; reason: string | null }) {
  return (
    <div
      className="flex items-start gap-3 rounded-2xl border border-[rgba(248,113,113,0.4)] bg-[rgba(248,113,113,0.08)] px-4 py-3 text-sm text-red-200"
      role="status"
    >
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>
        {state === "checking" ? (
          <>
            <span className="font-semibold tracking-wide">CHECKING LIVE MODE</span>
            {" — "}
            Asking the server whether Live Mode is available. Nothing runs until it answers.
          </>
        ) : (
          <>
            <span className="font-semibold tracking-wide">LIVE MODE UNAVAILABLE</span>
            {" — "}
            {reason ?? "Live Mode is not available on this server."} Live cannot be switched on from the
            address bar. <strong className="font-semibold">Demo Mode</strong> (fictional sample data, not Qloo
            output) is available instead.
          </>
        )}
      </p>
    </div>
  );
}
