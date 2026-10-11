/** Typed Qloo integration errors with safe, user-facing messages (no secrets). */

export type QlooErrorCode =
  | "NOT_CONFIGURED"
  | "LIVE_DISABLED"
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "BAD_REQUEST"
  | "UPSTREAM"
  | "NETWORK"
  | "PARSE";

export class QlooError extends Error {
  readonly code: QlooErrorCode;
  readonly status?: number;
  readonly retryAfterSeconds?: number;
  readonly safeDetails?: string;

  constructor(
    code: QlooErrorCode,
    message: string,
    options?: {
      status?: number;
      retryAfterSeconds?: number;
      safeDetails?: string;
      cause?: unknown;
    },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "QlooError";
    this.code = code;
    this.status = options?.status;
    this.retryAfterSeconds = options?.retryAfterSeconds;
    this.safeDetails = options?.safeDetails;
  }
}

export function httpStatusToQlooError(
  status: number,
  retryAfterHeader?: string | null,
): QlooError {
  const retryAfterSeconds = parseRetryAfter(retryAfterHeader);

  if (status === 401) {
    return new QlooError(
      "UNAUTHORIZED",
      "Qloo authentication failed. Check that QLOO_API_KEY is valid.",
      { status },
    );
  }
  if (status === 403) {
    return new QlooError(
      "FORBIDDEN",
      "Qloo rejected the request. The key may lack permission for this endpoint or parameter.",
      { status },
    );
  }
  if (status === 404) {
    return new QlooError(
      "NOT_FOUND",
      "Qloo endpoint was not found. Verify QLOO_BASE_URL and path.",
      { status },
    );
  }
  if (status === 429) {
    return new QlooError(
      "RATE_LIMITED",
      "Qloo rate limit reached. Retry after the suggested wait period.",
      { status, retryAfterSeconds },
    );
  }
  if (status === 400) {
    return new QlooError(
      "BAD_REQUEST",
      "Qloo rejected the request parameters.",
      { status },
    );
  }
  if (status >= 500) {
    return new QlooError(
      "UPSTREAM",
      "Qloo service is temporarily unavailable.",
      { status },
    );
  }
  return new QlooError("UPSTREAM", `Unexpected Qloo HTTP status ${status}.`, {
    status,
  });
}

export function parseRetryAfter(header?: string | null): number | undefined {
  if (!header?.trim()) return undefined;
  const asInt = Number.parseInt(header, 10);
  if (Number.isFinite(asInt) && asInt >= 0) return asInt;
  const when = Date.parse(header);
  if (Number.isFinite(when)) {
    return Math.max(0, Math.ceil((when - Date.now()) / 1000));
  }
  return undefined;
}

/** Map internal errors to API response codes without leaking secrets. */
export function toApiErrorPayload(err: unknown): {
  error: string;
  code: string;
  details?: string;
  status: number;
} {
  if (err instanceof QlooError) {
    const status =
      err.code === "NOT_CONFIGURED" || err.code === "LIVE_DISABLED"
        ? 503
        : err.code === "VALIDATION" || err.code === "BAD_REQUEST"
          ? 400
          : err.code === "UNAUTHORIZED"
            ? 401
            : err.code === "FORBIDDEN"
              ? 403
              : err.code === "NOT_FOUND"
                ? 404
                : err.code === "RATE_LIMITED"
                  ? 429
                  : err.code === "TIMEOUT"
                    ? 504
                    : 502;

    return {
      error: err.message,
      code: `QLOO_${err.code}`,
      details: err.safeDetails,
      status,
    };
  }

  return {
    error: "Unexpected error talking to Qloo.",
    code: "QLOO_INTERNAL",
    status: 500,
  };
}
