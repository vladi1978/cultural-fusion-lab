/**
 * Server-only Qloo HTTP client.
 *
 * Auth (verified):
 * - Header name: X-Api-Key (docs.qloo.com API Onboarding + Hackathon Devpost notice)
 * - Hackathon host default: https://hackathon.api.qloo.com
 *
 * Do not import from client components. Never log or return the API key.
 */

import "server-only";

import { getValidationBudget } from "../validation-session";
import { httpStatusToQlooError, QlooError } from "./errors";

export interface QlooClientConfig {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
}

export type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export function getQlooConfig(): QlooClientConfig | null {
  const apiKey = process.env.QLOO_API_KEY?.trim();
  if (!apiKey) return null;

  const baseUrl =
    process.env.QLOO_BASE_URL?.trim() || "https://hackathon.api.qloo.com";
  const timeoutRaw = Number.parseInt(
    process.env.QLOO_REQUEST_TIMEOUT_MS ?? "12000",
    10,
  );
  const timeoutMs =
    Number.isFinite(timeoutRaw) && timeoutRaw >= 1000 ? timeoutRaw : 12000;

  return { apiKey, baseUrl: stripTrailingSlash(baseUrl), timeoutMs };
}

export function isQlooConfigured(): boolean {
  return getQlooConfig() !== null;
}

export interface QlooRequestOptions {
  path: string;
  query?: Record<string, string>;
  method?: "GET" | "POST";
  body?: unknown;
  /** Injected for unit tests */
  fetchImpl?: FetchLike;
  config?: QlooClientConfig;
  signal?: AbortSignal;
}

/**
 * Perform an authenticated Qloo request with timeout + rate-limit handling.
 */
export async function qlooRequest<T = unknown>(
  options: QlooRequestOptions,
): Promise<T> {
  const config = options.config ?? getQlooConfig();
  if (!config) {
    throw new QlooError(
      "NOT_CONFIGURED",
      "QLOO_API_KEY is not configured on the server. Use Demo Mode until a key is available.",
    );
  }

  // Shared validation-session budget: reserve BEFORE sending (fail-closed; no-op unless a session is active).
  getValidationBudget()?.reserve("qlooHttp");

  const url = buildUrl(config.baseUrl, options.path, options.query);
  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set("X-Api-Key", config.apiKey);

  const method = options.method ?? "GET";
  let body: string | undefined;
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  const onAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onAbort);

  try {
    const response = await fetchImpl(url, {
      method,
      headers,
      body,
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw httpStatusToQlooError(
        response.status,
        response.headers.get("retry-after"),
      );
    }

    const text = await response.text();
    if (!text) return {} as T;

    try {
      return JSON.parse(text) as T;
    } catch (cause) {
      throw new QlooError("PARSE", "Qloo returned a non-JSON response.", {
        cause,
      });
    }
  } catch (err) {
    if (err instanceof QlooError) throw err;
    if (isAbortError(err)) {
      throw new QlooError(
        "TIMEOUT",
        `Qloo request timed out after ${config.timeoutMs}ms.`,
        { cause: err },
      );
    }
    throw new QlooError(
      "NETWORK",
      "Unable to reach the Qloo API. Check network connectivity and QLOO_BASE_URL.",
      { cause: err },
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", onAbort);
  }
}

/** @deprecated Prefer qlooRequest — retained for compatibility. */
export async function qlooFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const config = getQlooConfig();
  if (!config) {
    throw new QlooError(
      "NOT_CONFIGURED",
      "QLOO_API_KEY is not configured. Use Demo Mode or set the server environment variable.",
    );
  }

  getValidationBudget()?.reserve("qlooHttp");

  const url = buildUrl(config.baseUrl, path);
  const headers = new Headers(init.headers);
  headers.set("X-Api-Key", config.apiKey);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(url, {
    ...init,
    headers,
    cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(config.timeoutMs),
  });
}

export function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, string>,
): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(normalizedPath, `${stripTrailingSlash(baseUrl)}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof Error && err.name === "AbortError") ||
    (typeof DOMException !== "undefined" &&
      err instanceof DOMException &&
      err.name === "AbortError")
  );
}
