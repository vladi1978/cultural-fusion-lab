import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assertLiveModeAllowed,
  getAuthProbeState,
  isLiveModeAllowed,
  resetAuthProbeStateForTests,
} from "./live-gate";
import { QlooError } from "./errors";

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
});
