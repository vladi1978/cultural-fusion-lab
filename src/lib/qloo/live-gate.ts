/**
 * Live Mode remains disabled until:
 * 1. QLOO_API_KEY is present on the server
 * 2. QLOO_LIVE_ENABLED=true (explicit opt-in)
 * 3. A successful authentication probe has been recorded
 *
 * Until a real key is issued and verified, Demo Mode is the only supported path.
 */

import "server-only";

import { isQlooConfigured } from "./client";
import { probeAuthentication } from "./endpoints";
import { QlooError } from "./errors";

export interface AuthProbeState {
  verified: boolean;
  checkedAt: string | null;
  lastErrorCode: string | null;
}

let authState: AuthProbeState = {
  verified: false,
  checkedAt: null,
  lastErrorCode: null,
};

export function getAuthProbeState(): AuthProbeState {
  return { ...authState };
}

/** Test helper — reset in-memory auth cache. */
export function resetAuthProbeStateForTests(): void {
  authState = {
    verified: false,
    checkedAt: null,
    lastErrorCode: null,
  };
}

export function isLiveOptInEnabled(): boolean {
  return process.env.QLOO_LIVE_ENABLED?.trim().toLowerCase() === "true";
}

/**
 * Live Mode is locked closed by default.
 * Never silently fall back to mock data when live is requested.
 */
export function isLiveModeAllowed(): boolean {
  return (
    isLiveOptInEnabled() && isQlooConfigured() && authState.verified === true
  );
}

export function assertLiveModeAllowed(): void {
  if (!isQlooConfigured()) {
    throw new QlooError(
      "NOT_CONFIGURED",
      "Live Mode requires QLOO_API_KEY on the server. Demo Mode remains available.",
    );
  }
  if (!isLiveOptInEnabled()) {
    throw new QlooError(
      "LIVE_DISABLED",
      "Live Mode is disabled until QLOO_LIVE_ENABLED=true and Qloo authentication succeeds. Use Demo Mode.",
    );
  }
  if (!authState.verified) {
    throw new QlooError(
      "LIVE_DISABLED",
      "Live Mode is locked until Qloo authentication succeeds. Run a server-side auth probe after setting QLOO_API_KEY.",
      {
        safeDetails: authState.lastErrorCode
          ? `Last probe error: ${authState.lastErrorCode}`
          : "No successful authentication probe has been recorded in this process.",
      },
    );
  }
}

/**
 * Attempt authentication against Qloo. Call only on the server after a key is set.
 * Does not enable Live Mode by itself — QLOO_LIVE_ENABLED must also be true.
 */
export async function verifyQlooAuthentication(): Promise<AuthProbeState> {
  if (!isQlooConfigured()) {
    authState = {
      verified: false,
      checkedAt: new Date().toISOString(),
      lastErrorCode: "NOT_CONFIGURED",
    };
    return getAuthProbeState();
  }

  const result = await probeAuthentication();
  if (result.ok) {
    authState = {
      verified: true,
      checkedAt: new Date().toISOString(),
      lastErrorCode: null,
    };
  } else {
    authState = {
      verified: false,
      checkedAt: new Date().toISOString(),
      lastErrorCode: result.error.code,
    };
  }
  return getAuthProbeState();
}
