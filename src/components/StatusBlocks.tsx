import { AlertTriangle, Loader2, Orbit } from "lucide-react";

export function LoadingState({ label = "Synthesizing cultural signals…" }: { label?: string }) {
  return (
    <div className="panel flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="relative flex h-14 w-14 items-center justify-center">
        <span
          className="absolute inset-0 rounded-full border border-cyan/40"
          style={{ animation: "pulseRing 1.8s ease-in-out infinite" }}
        />
        <Loader2 className="h-7 w-7 animate-spin text-cyan" aria-hidden />
      </div>
      <p className="max-w-sm text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="panel flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <Orbit className="h-8 w-8 text-[var(--text-dim)]" aria-hidden />
      <h3 className="font-display text-xl text-white">{title}</h3>
      <p className="max-w-md text-sm text-[var(--text-muted)]">{description}</p>
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="panel flex flex-col items-start gap-4 border-[rgba(248,113,113,0.35)] px-6 py-8"
      role="alert"
    >
      <div className="flex items-center gap-3 text-[#fecaca]">
        <AlertTriangle className="h-5 w-5" aria-hidden />
        <h3 className="font-display text-lg">{title}</h3>
      </div>
      <p className="text-sm text-[var(--text-muted)]">{message}</p>
      {onRetry ? (
        <button type="button" className="btn btn-ghost" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}
