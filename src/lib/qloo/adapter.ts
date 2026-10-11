/**
 * Qloo Taste Graph service adapter (scaffold).
 *
 * Integration functions are intentionally unimplemented until
 * Qloo hackathon documentation and API access are validated.
 * Do not invent endpoint parameter schemas.
 */

import "server-only";

import type {
  ExplorationRequest,
  ExplorationResult,
  MutationRequest,
  MutationResult,
} from "../types";
import { getQlooConfig } from "./client";

export class QlooNotConfiguredError extends Error {
  constructor(message = "Qloo API is not configured.") {
    super(message);
    this.name = "QlooNotConfiguredError";
  }
}

export class QlooNotImplementedError extends Error {
  constructor(feature: string) {
    super(
      `${feature} is scaffolded but not implemented. Validate Qloo docs/API access, then replace the TODO stubs.`,
    );
    this.name = "QlooNotImplementedError";
  }
}

export function isQlooConfigured(): boolean {
  return getQlooConfig() !== null;
}

/**
 * TODO(qloo): Implement cultural entity discovery against the Taste Graph.
 *
 * Expected future flow (subject to official docs):
 * 1. Map ExplorationRequest fields to documented Qloo query parameters.
 * 2. Call the appropriate hackathon endpoint via qlooFetch.
 * 3. Normalize the response into CulturalEntity / CulturalCluster shapes.
 * 4. Mark EvidenceItem.source as "verified_api" only for fields returned by Qloo.
 * 5. Keep agent-written concept copy clearly labeled as agent_hypothesis.
 *
 * Until then, live mode must fail closed — never fabricate Qloo insights.
 */
export async function exploreWithQloo(
  request: ExplorationRequest,
): Promise<ExplorationResult> {
  if (!isQlooConfigured()) {
    throw new QlooNotConfiguredError();
  }

  void request;
  // TODO(qloo): Replace with validated endpoint integration.
  throw new QlooNotImplementedError("exploreWithQloo");
}

/**
 * TODO(qloo): Implement mutation / adjacent-entity lookup.
 *
 * Future notes:
 * - Resolve replacement candidates from Taste Graph neighbors when available.
 * - Preserve evidence provenance (verified_api vs agent_hypothesis).
 * - Never present mutated demo text as Qloo-verified output.
 */
export async function mutateWithQloo(
  request: MutationRequest,
): Promise<MutationResult> {
  if (!isQlooConfigured()) {
    throw new QlooNotConfiguredError();
  }

  void request;
  // TODO(qloo): Replace with validated endpoint integration.
  throw new QlooNotImplementedError("mutateWithQloo");
}
