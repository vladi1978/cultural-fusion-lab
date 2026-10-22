/**
 * Live availability, decided ONLY by server environment (explicit flags + credentials that exist).
 *
 * Pure and secret-free: it reports booleans and fixed public reasons, never a key, and makes no network call.
 * Nothing a client sends (a ?live=1 URL parameter, a request body "mode", a header) can make Live available.
 * Fail closed: anything not explicitly enabled is unavailable.
 */
export type Env = Record<string, string | undefined>;

export interface LiveCapability {
  available: boolean;
  /** Fixed, public-safe explanation; null when available. */
  reason: string | null;
}

export interface LiveAvailability {
  /** Live exploration against Qloo: QLOO_LIVE_ENABLED=true and QLOO_API_KEY present. */
  exploration: LiveCapability;
  /** Controlled comparison: CFL_ABLATION_ENABLED=true, CFL_CREATIVE_LLM_ENABLED=true and ANTHROPIC_API_KEY present. */
  comparison: LiveCapability;
}

const isTrue = (v: string | undefined): boolean => v?.trim().toLowerCase() === "true";
const present = (v: string | undefined): boolean => Boolean(v?.trim());

export function getLiveAvailability(env: Env = process.env): LiveAvailability {
  const exploration: LiveCapability = !isTrue(env.QLOO_LIVE_ENABLED)
    ? { available: false, reason: "Live Mode is not enabled on this server." }
    : !present(env.QLOO_API_KEY)
      ? { available: false, reason: "Live Mode credentials are not configured on this server." }
      : { available: true, reason: null };

  // The comparison's model gate is stricter by design: the flag must be exactly "true".
  const comparison: LiveCapability = !isTrue(env.CFL_ABLATION_ENABLED)
    ? { available: false, reason: "The controlled comparison is not enabled on this server." }
    : env.CFL_CREATIVE_LLM_ENABLED !== "true" || !present(env.ANTHROPIC_API_KEY)
      ? { available: false, reason: "The controlled comparison's model is not configured on this server." }
      : { available: true, reason: null };

  return { exploration, comparison };
}

export type LiveUiState = "demo" | "checking" | "live" | "unavailable";

/**
 * What the page may do. The URL parameter only EXPRESSES a wish to see Live; the server's report decides.
 * While the report is unknown, or if it could not be read, Live is not active (fail closed).
 */
export function resolveLiveUi(
  urlLiveParam: string | null,
  report: LiveAvailability | "pending" | "error",
): { state: LiveUiState; liveActive: boolean; reason: string | null } {
  if (urlLiveParam !== "1") return { state: "demo", liveActive: false, reason: null };
  if (report === "pending") return { state: "checking", liveActive: false, reason: null };
  if (report === "error") return { state: "unavailable", liveActive: false, reason: "Live Mode availability could not be confirmed with the server." };
  if (report.exploration.available === true) return { state: "live", liveActive: true, reason: null };
  return { state: "unavailable", liveActive: false, reason: report.exploration.reason ?? "Live Mode is not available on this server." };
}

/** Defensive parse of the status payload: anything unexpected is "error" (unavailable). */
export function parseLiveAvailability(raw: unknown): LiveAvailability | "error" {
  if (!raw || typeof raw !== "object") return "error";
  const o = raw as Record<string, unknown>;
  const cap = (v: unknown): LiveCapability | null => {
    if (!v || typeof v !== "object") return null;
    const c = v as Record<string, unknown>;
    if (typeof c.available !== "boolean") return null;
    return { available: c.available, reason: typeof c.reason === "string" ? c.reason : null };
  };
  const exploration = cap(o.exploration);
  const comparison = cap(o.comparison);
  return exploration && comparison ? { exploration, comparison } : "error";
}
