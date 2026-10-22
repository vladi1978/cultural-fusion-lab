/**
 * Shared validation-session budget for ONE paid live validation (exploration + controlled comparison).
 *
 * Opt-in: active only when CFL_VALIDATION_SESSION=true. When active it is FAIL-CLOSED:
 *  - every Qloo HTTP request (including the auth probe), every Anthropic logical call and every Anthropic HTTP
 *    attempt (including truncation retries) must RESERVE budget BEFORE it is sent;
 *  - counters live in a file, so restarting the dev server cannot reset them (delete the file on purpose to start over);
 *  - if the file cannot be read, parsed, locked or written, the request is refused;
 *  - environment variables may LOWER the limits, never raise them above the hard ceilings below;
 *  - each run kind ("explore", "ablation") may be started once per session; duplicates are rejected.
 * The $5 monetary guard (creative/model.ts) is separate and unchanged. No secret is stored here.
 */
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const HARD_LIMITS = { qlooHttp: 6, anthropicLogical: 10, anthropicHttp: 20 } as const;

export type BudgetKind = "qlooHttp" | "anthropicLogical" | "anthropicHttp";
export type RunKind = "explore" | "ablation";

export interface SessionState {
  version: 1;
  createdAt: string;
  limits: Record<BudgetKind, number>;
  used: Record<BudgetKind, number>;
  runs: Partial<Record<RunKind, { startedAt: string }>>;
}

export class ValidationBudgetError extends Error {
  constructor(
    readonly code: "BUDGET_EXHAUSTED" | "DUPLICATE_RUN" | "RUN_IN_FLIGHT" | "STATE_UNSAFE",
    message: string,
  ) {
    super(message);
    this.name = "ValidationBudgetError";
  }
}

export interface ValidationBudget {
  /** Reserve `n` units before the corresponding request is sent. Throws ValidationBudgetError. */
  reserve(kind: BudgetKind, n?: number): void;
  /** Start a run kind once. Throws on a duplicate or while one is in flight. Call finishRun in `finally`. */
  startRun(kind: RunKind): void;
  finishRun(kind: RunKind): void;
  snapshot(): SessionState;
}

const KINDS: BudgetKind[] = ["qlooHttp", "anthropicLogical", "anthropicHttp"];
const isCount = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;

function effectiveLimits(env: Record<string, string | undefined>): Record<BudgetKind, number> {
  const lower = (name: string, hard: number) => {
    const raw = env[name];
    if (raw === undefined || raw.trim() === "") return hard;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? Math.min(n, hard) : 0; // unparseable -> fail closed (0)
  };
  return {
    qlooHttp: lower("CFL_SESSION_MAX_QLOO_HTTP", HARD_LIMITS.qlooHttp),
    anthropicLogical: lower("CFL_SESSION_MAX_ANTHROPIC_LOGICAL", HARD_LIMITS.anthropicLogical),
    anthropicHttp: lower("CFL_SESSION_MAX_ANTHROPIC_HTTP", HARD_LIMITS.anthropicHttp),
  };
}

function validate(raw: unknown): SessionState {
  const s = raw as Partial<SessionState> | null;
  if (!s || typeof s !== "object" || s.version !== 1 || !s.limits || !s.used || typeof s.runs !== "object" || s.runs === null) {
    throw new ValidationBudgetError("STATE_UNSAFE", "Validation-session state is malformed; refusing to proceed.");
  }
  for (const k of KINDS) {
    if (!isCount(s.used[k]) || !isCount(s.limits[k]) || s.limits[k] > HARD_LIMITS[k]) {
      throw new ValidationBudgetError("STATE_UNSAFE", "Validation-session counters are invalid; refusing to proceed.");
    }
  }
  return s as SessionState;
}

function applyReserve(state: SessionState, kind: BudgetKind, n: number): void {
  if (!Number.isInteger(n) || n < 1) throw new ValidationBudgetError("STATE_UNSAFE", "Invalid reservation size.");
  if (state.used[kind] + n > state.limits[kind]) {
    throw new ValidationBudgetError("BUDGET_EXHAUSTED", `Validation session budget exhausted for ${kind}: ${state.used[kind]} of ${state.limits[kind]} used.`);
  }
  state.used[kind] += n;
}

function applyStartRun(state: SessionState, kind: RunKind): void {
  if (state.runs[kind]) {
    throw new ValidationBudgetError("DUPLICATE_RUN", `The ${kind} step was already started in this validation session. It is never repeated automatically; delete the session file on purpose to start a new one.`);
  }
  state.runs[kind] = { startedAt: new Date().toISOString() };
}

function build(mutate: <T>(fn: (s: SessionState) => T) => T, read: () => SessionState): ValidationBudget {
  const inFlight = new Set<RunKind>();
  return {
    reserve: (kind, n = 1) => mutate((s) => applyReserve(s, kind, n)),
    startRun(kind) {
      if (inFlight.has(kind)) throw new ValidationBudgetError("RUN_IN_FLIGHT", `A ${kind} run is already in progress; duplicate submission rejected.`);
      mutate((s) => applyStartRun(s, kind)); // throws on a repeat; the flag is only set once persistence succeeded
      inFlight.add(kind);
    },
    finishRun: (kind) => { inFlight.delete(kind); },
    snapshot: read,
  };
}

export function createMemoryValidationBudget(limits: Record<BudgetKind, number> = { ...HARD_LIMITS }): ValidationBudget {
  const state: SessionState = {
    version: 1, createdAt: new Date().toISOString(),
    limits: { ...limits }, used: { qlooHttp: 0, anthropicLogical: 0, anthropicHttp: 0 }, runs: {},
  };
  return build((fn) => { const copy = structuredClone(state); const out = fn(copy); Object.assign(state, copy); return out; }, () => structuredClone(state));
}

/** File-backed budget. The critical section is synchronous and guarded by an exclusive lock file. */
export function createFileValidationBudget(path: string, limits: Record<BudgetKind, number> = effectiveLimits({})): ValidationBudget {
  const lockPath = `${path}.lock`;
  const readState = (): SessionState => {
    if (!existsSync(path)) {
      return { version: 1, createdAt: new Date().toISOString(), limits: { ...limits }, used: { qlooHttp: 0, anthropicLogical: 0, anthropicHttp: 0 }, runs: {} };
    }
    return validate(JSON.parse(readFileSync(path, "utf8")));
  };
  const mutate = <T>(fn: (s: SessionState) => T): T => {
    let fd: number;
    try {
      mkdirSync(dirname(path), { recursive: true });
      fd = openSync(lockPath, "wx");
    } catch {
      throw new ValidationBudgetError("STATE_UNSAFE", "Could not lock the validation-session file (another process holds it, or it is not writable); refusing to proceed.");
    }
    try {
      const state = readState();
      const out = fn(state);
      const tmp = `${path}.tmp`;
      writeFileSync(tmp, JSON.stringify(state), "utf8");
      renameSync(tmp, path);
      return out;
    } catch (err) {
      if (err instanceof ValidationBudgetError) throw err;
      throw new ValidationBudgetError("STATE_UNSAFE", "Validation-session state could not be read or updated safely; refusing to proceed.");
    } finally {
      try { closeSync(fd); } catch { /* ignore */ }
      try { unlinkSync(lockPath); } catch { /* ignore */ }
    }
  };
  const read = (): SessionState => {
    try { return readState(); }
    catch (err) { throw err instanceof ValidationBudgetError ? err : new ValidationBudgetError("STATE_UNSAFE", "Validation-session state could not be read; refusing to proceed."); }
  };
  return build(mutate, read);
}

let cached: { key: string; budget: ValidationBudget } | null = null;

/** The active shared budget, or null when CFL_VALIDATION_SESSION is not "true" (normal development). */
export function getValidationBudget(env: Record<string, string | undefined> = process.env): ValidationBudget | null {
  if (env.CFL_VALIDATION_SESSION?.trim().toLowerCase() !== "true") return null;
  const path = env.CFL_VALIDATION_SESSION_FILE?.trim() || ".cfl-validation-session.json";
  if (cached?.key === path) return cached.budget;
  const budget = createFileValidationBudget(path, effectiveLimits(env));
  cached = { key: path, budget };
  return budget;
}

/** Test helper. */
export function resetValidationBudgetCacheForTests(): void { cached = null; }
