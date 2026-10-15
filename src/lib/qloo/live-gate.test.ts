import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assertLiveModeAllowed,
  getAuthProbeState,
  isLiveModeAllowed,
  resetAuthProbeStateForTests,
  verifyQlooAuthentication,
} from "./live-gate";
import { QlooError } from "./errors";

vi.mock("./endpoints", () => ({
  probeAuthentication: vi.fn(),
}));

import { probeAuthentication } from "./endpoints";

describe("Live Mode gate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetAuthProbeStateForTests();
  });

  it("keeps Live Mode disabled without key, opt-in, and auth", () => {
    vi.stubEnv("QLOO_API_KEY", "");
    vi.stubEnv("QLOO_LIVE_ENABLED", "false");
    expect(isLiveModeAllowed()).toBe(false);
    expect(() => assertLiveModeAllowed()).toThrow(QlooError);
  });

  it("still disables Live Mode when only a key is present", () => {
    vi.stubEnv("QLOO_API_KEY", "pending-not-verified");
    vi.stubEnv("QLOO_LIVE_ENABLED", "true");
    expect(getAuthProbeState().verified).toBe(false);
    expect(isLiveModeAllowed()).toBe(false);
  });

  it("allows Live after successful authentication and explicit opt-in", async () => {
    vi.stubEnv("QLOO_API_KEY", "test-key");
    vi.stubEnv("QLOO_LIVE_ENABLED", "true");
    vi.mocked(probeAuthentication).mockResolvedValueOnce({ ok: true });

    expect(isLiveModeAllowed()).toBe(false);

    const state = await verifyQlooAuthentication();

    expect(state.verified).toBe(true);
    expect(isLiveModeAllowed()).toBe(true);
    expect(() => assertLiveModeAllowed()).not.toThrow();
  });

  it("keeps Live disabled when authentication fails", async () => {
    vi.stubEnv("QLOO_API_KEY", "test-key");
    vi.stubEnv("QLOO_LIVE_ENABLED", "true");
    vi.mocked(probeAuthentication).mockResolvedValueOnce({
      ok: false,
      error: new QlooError("UNAUTHORIZED", "Authentication rejected."),
    });

    const state = await verifyQlooAuthentication();

    expect(state.verified).toBe(false);
    expect(isLiveModeAllowed()).toBe(false);
  });

});
