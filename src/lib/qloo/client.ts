/**
 * Server-only Qloo HTTP client scaffold.
 *
 * IMPORTANT:
 * - Do not import this module from client components.
 * - Do not invent Qloo endpoint parameter schemas until official docs
 *   and hackathon API access are validated.
 * - API keys must only live in server environment variables.
 */

import "server-only";

export interface QlooClientConfig {
  apiKey: string;
  baseUrl: string;
}

export function getQlooConfig(): QlooClientConfig | null {
  const apiKey = process.env.QLOO_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const baseUrl =
    process.env.QLOO_BASE_URL?.trim() || "https://hackathon.api.qloo.com";

  return { apiKey, baseUrl };
}

/**
 * Low-level fetch helper for future Qloo routes.
 * Not wired to production paths until endpoint contracts are confirmed.
 */
export async function qlooFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const config = getQlooConfig();
  if (!config) {
    throw new Error(
      "QLOO_API_KEY is not configured. Use Demo Mode or set the server environment variable.",
    );
  }

  const url = new URL(path.replace(/^\//, ""), ensureTrailingSlash(config.baseUrl));

  // TODO(qloo): Confirm required auth header name/format from Qloo hackathon docs.
  // Placeholder only — do not assume this is correct for production calls.
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${config.apiKey}`);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(url, {
    ...init,
    headers,
    cache: "no-store",
  });
}

function ensureTrailingSlash(base: string): string {
  return base.endsWith("/") ? base : `${base}/`;
}
