import { describe, expect, it } from "vitest";

import {
  httpStatusToQlooError,
  parseRetryAfter,
  toApiErrorPayload,
} from "./errors";

describe("Qloo error mapping", () => {
  it("maps auth and rate-limit statuses to safe codes", () => {
    expect(httpStatusToQlooError(401).code).toBe("UNAUTHORIZED");
    expect(httpStatusToQlooError(403).code).toBe("FORBIDDEN");
    expect(httpStatusToQlooError(429, "15").retryAfterSeconds).toBe(15);
    expect(parseRetryAfter("0")).toBe(0);
  });

  it("never includes credential-looking details in API payloads", () => {
    const payload = toApiErrorPayload(httpStatusToQlooError(401));
    expect(payload.error.toLowerCase()).not.toContain("bearer");
    expect(payload.code).toBe("QLOO_UNAUTHORIZED");
    expect(JSON.stringify(payload)).not.toMatch(/sk-|api[_-]?key\s*[:=]/i);
  });
});
