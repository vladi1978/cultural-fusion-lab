/**
 * CreativeModel — the only place the creative engine touches an LLM.
 *
 * Safety defaults (no surprise spend):
 *  - Anthropic adapter is inert unless CFL_CREATIVE_LLM_ENABLED=true AND
 *    ANTHROPIC_API_KEY is set, and it enforces a persistent spend cap (see below).
 *  - Hard per-process call ceiling (CFL_CREATIVE_MAX_CALLS, default 6).
 *  - Tests and the compare harness inject a replay/fake model instead.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { getValidationBudget, type ValidationBudget } from "../../validation-session";

export type CreativeStage = "frame" | "operational_design" | "compose" | "critique";

export interface CreativeModelRequest {
  stage: CreativeStage;
  system: string;
  user: string;
  maxTokens: number;
  /** Collected entity ids. Adapters that support constrained decoding restrict every id field to these. */
  allowedEntityIds?: string[];
  /** Per source domain, the only mechanisms a transfer may cite. Adapters may enforce this while decoding. */
  designConstraints?: Array<{ domain: string; mechanisms: string[] }>;
}

export interface CreativeModel {
  readonly id: string;
  complete(request: CreativeModelRequest): Promise<string>;
}

export class CreativeModelDisabledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreativeModelDisabledError";
  }
}

export function isCreativeLlmEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.CFL_CREATIVE_LLM_ENABLED === "true" && Boolean(env.ANTHROPIC_API_KEY);
}

/** Length guidance appended for hosted models, which are otherwise far more verbose than the local model. */
const HOSTED_BREVITY: Record<string, string> = {
  frame: "keep the whole JSON under about 1,200 tokens",
  operational_design: "keep the whole JSON under about 1,500 tokens",
  compose: "keep the whole JSON under about 4,000 tokens",
  critique: "keep the whole JSON under about 1,500 tokens",
};
const brevityNote = (stage: string): string =>
  `\n\nOUTPUT LENGTH: ${HOSTED_BREVITY[stage] ?? "be concise"}. Each string value is one or two short sentences (about 200 characters at most) unless a rule above asks for more. Do not repeat the same information in several fields. Return the JSON object only, with no text before or after it.`;

/** Minimum output budget per stage for hosted models. */
const HOSTED_STAGE_FLOOR: Record<string, number> = { frame: 4000, operational_design: 4000, compose: 8000, critique: 4000 };

export class CreativeModelTruncatedError extends Error {
  constructor(stage: string, maxTokens: number) {
    super(`The ${stage} output was cut off at ${maxTokens} tokens. Raise the stage budget or shorten the prompt.`);
    this.name = "CreativeModelTruncatedError";
  }
}

/** Persistent spend record so a dev-server restart cannot reset the budget. */
export interface SpendLedger { read(): number; add(usd: number): void }

export function createFileSpendLedger(path: string): SpendLedger {
  return {
    read() {
      try { const v = Number(JSON.parse(readFileSync(path, "utf8")).totalUsd); return Number.isFinite(v) && v >= 0 ? v : 0; }
      catch { return 0; }
    },
    add(usd) {
      const total = this.read() + usd;
      writeFileSync(path, JSON.stringify({ totalUsd: Number(total.toFixed(6)), updatedAt: new Date().toISOString() }), "utf8");
    },
  };
}

export function createMemorySpendLedger(initial = 0): SpendLedger {
  let total = initial;
  return { read: () => total, add: (usd) => { total += usd; } };
}

const positive = (v: string | undefined): number | null => {
  const n = Number(v);
  return v !== undefined && v.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Hosted adapter with a hard, persistent spend cap. Fail-closed:
 *  - requires the caller to state the per-million-token prices (CFL_CREATIVE_PRICE_IN_USD_PER_MTOK /
 *    CFL_CREATIVE_PRICE_OUT_USD_PER_MTOK); no price is assumed, so no spend can be mis-estimated silently;
 *  - refuses any call whose WORST-CASE cost (estimated input + full max_tokens) would pass the cap;
 *  - records actual usage after each call into a ledger that survives process restarts.
 * Cap: CFL_CREATIVE_TOTAL_CAP_USD (default 5; never above the founder's $25 ceiling).
 */
export function createAnthropicCreativeModel(
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
  ledger: SpendLedger = createFileSpendLedger(env.CFL_CREATIVE_SPEND_LEDGER ?? ".cfl-spend-ledger.json"),
  /** Shared validation-session budget (null/undefined = none active). Defaults to the process-wide session. */
  budget: ValidationBudget | null = getValidationBudget(env),
): CreativeModel {
  const model = env.CFL_CREATIVE_MODEL ?? "claude-sonnet-5-5";
  const ceiling = Number(env.CFL_CREATIVE_MAX_CALLS ?? 6);
  const timeoutMs = Math.max(30000, Number(env.CFL_CREATIVE_TIMEOUT_MS ?? 180000) || 180000);
  let calls = 0;

  return {
    id: `anthropic:${model}`,
    async complete(req) {
      if (!isCreativeLlmEnabled(env)) {
        throw new CreativeModelDisabledError(
          "Creative LLM is disabled. Set CFL_CREATIVE_LLM_ENABLED=true and ANTHROPIC_API_KEY to opt in.",
        );
      }
      const priceIn = positive(env.CFL_CREATIVE_PRICE_IN_USD_PER_MTOK);
      const priceOut = positive(env.CFL_CREATIVE_PRICE_OUT_USD_PER_MTOK);
      if (priceIn === null || priceOut === null) {
        throw new CreativeModelDisabledError(
          "Spend guard: set CFL_CREATIVE_PRICE_IN_USD_PER_MTOK and CFL_CREATIVE_PRICE_OUT_USD_PER_MTOK to the model's published prices before any paid call.",
        );
      }
      const requestedCap = positive(env.CFL_CREATIVE_TOTAL_CAP_USD) ?? 5;
      const cap = Math.min(requestedCap, 25);

      // Stage budgets in the request were sized for a small local model. A hosted model writes
      // more per field, and a truncated JSON object is useless, so never go below a stage floor.
      const floor = HOSTED_STAGE_FLOOR[req.stage] ?? 4000;
      let maxTokens = Math.max(req.maxTokens, floor);

      // One LOGICAL call per complete(); each HTTP attempt (including a truncation retry) is reserved separately.
      budget?.reserve("anthropicLogical");

      for (let attempt = 0; attempt < 2; attempt++) {
        if (calls >= ceiling) {
          throw new CreativeModelDisabledError(
            `Creative LLM call ceiling reached (${ceiling}).`,
          );
        }
        const spent = ledger.read();
        // Worst case: input estimated pessimistically (1 token per 3 chars) plus the full output allowance.
        const estIn = Math.ceil((req.system.length + brevityNote(req.stage).length + req.user.length) / 3);
        const worstCase = (estIn * priceIn + maxTokens * priceOut) / 1_000_000;
        if (spent + worstCase > cap) {
          throw new CreativeModelDisabledError(
            `Spend guard: refusing ${req.stage} call. Spent $${spent.toFixed(4)} of $${cap.toFixed(2)} cap; worst case for this call is $${worstCase.toFixed(4)}.`,
          );
        }
        budget?.reserve("anthropicHttp");
        calls += 1;
        const startedAt = Date.now();
        console.log(`[CFL ANTHROPIC] Starting ${req.stage}, maxTokens=${maxTokens}`);
        const res = await fetchImpl("https://api.anthropic.com/v1/messages", {
          method: "POST",
          signal: AbortSignal.timeout(timeoutMs),
          headers: {
            "content-type": "application/json",
            "x-api-key": env.ANTHROPIC_API_KEY as string,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            system: req.system + brevityNote(req.stage),
            messages: [{ role: "user", content: req.user }],
          }),
        });
        if (!res.ok) {
          throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
        }
        const data = (await res.json()) as {
          content?: { type: string; text?: string }[];
          usage?: { input_tokens?: number; output_tokens?: number };
          stop_reason?: string;
        };
        // Record actual usage; if usage is missing, charge the worst case so the cap stays honest.
        const inTok = data.usage?.input_tokens;
        const outTok = data.usage?.output_tokens;
        const actual = typeof inTok === "number" && typeof outTok === "number"
          ? (inTok * priceIn + outTok * priceOut) / 1_000_000
          : worstCase;
        ledger.add(actual);
        console.log(`[CFL ANTHROPIC] ${req.stage} responded in ${((Date.now() - startedAt) / 1000).toFixed(1)}s, ` +
          `tokens in/out=${inTok ?? "?"}/${outTok ?? "?"}, cost $${actual.toFixed(4)}, total $${ledger.read().toFixed(4)} of $${cap.toFixed(2)}`);
        const text = (data.content ?? [])
          .filter((b) => b.type === "text")
          .map((b) => b.text ?? "")
          .join("");
        if (data.stop_reason === "max_tokens") {
          // Truncated output cannot be parsed as JSON. Retry once with double the budget (still guarded).
          if (attempt === 0) { maxTokens *= 2; continue; }
          throw new CreativeModelTruncatedError(req.stage, maxTokens);
        }
        return text;
      }
      throw new CreativeModelTruncatedError(req.stage, maxTokens);
    },
  };
}

/**
 * Local Ollama adapter. No external API calls or paid services.
 * Uses the same CreativeModel interface as Anthropic and replay.
 */
export function createOllamaCreativeModel(
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): CreativeModel {
  const model = env.CFL_OLLAMA_MODEL ?? "qwen3:4b";
  const ceiling = Number(env.CFL_CREATIVE_MAX_CALLS ?? 6);
  const timeoutMs = Math.max(30000, Number(env.CFL_OLLAMA_TIMEOUT_MS ?? 480000) || 480000);
  let calls = 0;

  return {
    id: `ollama:${model}`,
    async complete(req) {
      if (env.CFL_CREATIVE_LLM_ENABLED !== "true") {
        throw new CreativeModelDisabledError(
          "Local creative LLM is disabled. Set CFL_CREATIVE_LLM_ENABLED=true.",
        );
      }
      if (calls >= ceiling) {
        throw new CreativeModelDisabledError(
          `Creative LLM call ceiling reached (${ceiling}).`,
        );
      }
      calls += 1;

      // Constrained decoding: every entity-id field may only emit a collected id.
      const idSchema: Record<string, unknown> = req.allowedEntityIds?.length
        ? { type: "string", enum: req.allowedEntityIds }
        : { type: "string" };
      const plainTransfer = {
        type: "object",
        properties: {
          sourceDomain: { type: "string" },
          sourceMechanism: { type: "string" },
          operatingDecision: { type: "string" },
          participantAction: { type: "string" },
          dependency: { type: "string" },
        },
        required: ["sourceDomain", "sourceMechanism", "operatingDecision", "participantAction", "dependency"],
      };
      // With constraints: one allowed shape per domain (exact domain name + that domain's own mechanisms).
      const transferItems: Record<string, unknown> = req.designConstraints?.length
        ? { anyOf: req.designConstraints.map(d => ({
            ...plainTransfer,
            properties: { ...plainTransfer.properties, sourceDomain: { type: "string", enum: [d.domain] }, sourceMechanism: { type: "string", enum: d.mechanisms } },
          })) }
        : plainTransfer;
      const startedAt = Date.now();
      console.log(`[CFL OLLAMA] Starting ${req.stage}, maxTokens=${req.maxTokens}`);

      let res: Response;
      try {
        res = await fetchImpl("http://127.0.0.1:11434/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          model,
          stream: false,
          think: false,
          format: req.stage === "operational_design" ? {
            type: "object",
            properties: {
              transfers: {
                type: "array",
                minItems: 2,
                items: transferItems,
                ...(req.designConstraints?.length ? { minItems: req.designConstraints.length, maxItems: req.designConstraints.length } : {}),
              },
              crossCulturalDependency: { type: "string" },
              removalConsequences: {
                type: "array",
                items: { type: "string" }
              },
              feasibilityUnknowns: {
                type: "array",
                minItems: 1,
                items: { type: "string" }
              },
              pilotTest: { type: "string" }
            },
            required: [
              "transfers",
              "crossCulturalDependency",
              "removalConsequences",
              "feasibilityUnknowns",
              "pilotTest"
            ]
          } : req.stage === "frame" ? {
            type: "object",
            properties: {
              sourceDomains: {
                type: "array",
                minItems: 2,
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string", minLength: 1 },
                    origin: { type: "string", minLength: 1 },
                    essence: { type: "string", minLength: 1 },
                    coreMechanics: {
                      type: "array",
                      minItems: 2,
                      items: { type: "string", minLength: 1 }
                    }
                  },
                  required: ["name", "origin", "essence", "coreMechanics"]
                }
              },
              experientialGoals: {
                type: "array",
                minItems: 1,
                items: { type: "string", minLength: 1 }
              },
              requirements: {
                type: "array",
                minItems: 1,
                items: { type: "string", minLength: 1 }
              },
              offBrief: {
                type: "array",
                items: { type: "string" }
              },
              evidenceProbes: {
                type: "array",
                minItems: 2,
                items: {
                  type: "object",
                  properties: {
                    query: { type: "string", minLength: 1 },
                    entityType: {
                      type: "string",
                      enum: [
                        "urn:entity:artist",
                        "urn:entity:movie",
                        "urn:entity:brand",
                        "urn:entity:place",
                        "urn:entity:person"
                      ]
                    },
                    why: { type: "string", minLength: 1 }
                  },
                  required: ["query", "entityType", "why"]
                }
              }
            },
            required: [
              "sourceDomains",
              "experientialGoals",
              "requirements",
              "offBrief",
              "evidenceProbes"
            ]
          } : req.stage === "compose" ? {
            type: "object",
            properties: {
              concepts: {
                type: "array",
                minItems: 1,
                maxItems: 1,
                items: {
                  type: "object",
                  properties: {
                    declaredOutputCategory: { type: "string", enum: ["product", "brand", "experience"] },
                    name: { type: "string" },
                    proposition: { type: "string" },
                    audience: { type: "string" },
                    context: { type: "string" },
                    mechanics: { type: "string" },
                    differentiationHypothesis: { type: "string" },
                    pilotExperiment: { type: "string" },
                    evidenceBoundary: { type: "string" },
                    mechanicFingerprint: { type: "string" },
                    mechanismId: { type: "string" },
                    feasibilityAssumptions: {
                      type: "array",
                      maxItems: 3,
                      items: { type: "string" }
                    },
                    risksAndUnknowns: {
                      type: "array",
                      maxItems: 3,
                      items: { type: "string" }
                    },
                    journey: {
                      type: "array",
                      minItems: 3,
                      maxItems: 4,
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          actor: { type: "string" },
                          action: { type: "string" },
                          influenceEntityIds: {
                            type: "array",
                            minItems: 1,
                            items: idSchema
                          }
                        },
                        required: ["id", "actor", "action", "influenceEntityIds"]
                      }
                    },
                    influenceMap: {
                      type: "array",
                      minItems: 2,
                      maxItems: 3,
                      items: {
                        type: "object",
                        properties: {
                          entityId: idSchema,
                          entityName: { type: "string" },
                          category: { type: "string" },
                          role: { type: "string", enum: ["hinge", "texture", "tension", "constraint", "distribution"] },
                          signalsUsed: {
                            type: "array",
                            items: { type: "string" }
                          }
                        },
                        required: ["entityId", "entityName", "category", "role", "signalsUsed"]
                      }
                    },
                    rationales: {
                      type: "array",
                      minItems: 3,
                      maxItems: 5,
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          featureId: { type: "string" },
                          featureDescription: { type: "string" },
                          influenceEntityId: idSchema,
                          attributeOrSignal: { type: "string" },
                          creativeInterpretation: { type: "string" },
                          whyItProducesMechanic: { type: "string" }
                        },
                        required: [
                          "id", "featureId", "featureDescription",
                          "influenceEntityId", "attributeOrSignal",
                          "creativeInterpretation", "whyItProducesMechanic"
                        ]
                      }
                    }
                  },
                  required: [
                    "declaredOutputCategory", "name", "proposition",
                    "audience", "context", "mechanics", "influenceMap",
                    "journey", "differentiationHypothesis",
                    "feasibilityAssumptions", "risksAndUnknowns",
                    "pilotExperiment", "evidenceBoundary",
                    "rationales", "mechanicFingerprint", "mechanismId"
                  ]
                }
              }
            },
            required: ["concepts"]
          } : "json",
          messages: [
            { role: "system", content: req.system },
            { role: "user", content: req.user },
          ],
          options: {
            num_ctx: 16384,
            num_predict: req.maxTokens,
            temperature: 0.65,
          },
        }),
      });

      } catch (error) {
        console.error(
          `[CFL OLLAMA] ${req.stage} failed after ${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
          error instanceof Error ? error.message : String(error),
        );
        throw error;
      }

      console.log(
        `[CFL OLLAMA] ${req.stage} responded in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
      );

      if (!res.ok) {
        throw new Error(
          `Ollama ${res.status}: ${(await res.text()).slice(0, 200)}`,
        );
      }

      const data = (await res.json()) as {
        message?: { content?: string };
      };

      const output = data.message?.content?.trim();
      if (!output) throw new Error("Ollama returned an empty response.");
      return output;
    },
  };
}

/** Deterministic stand-in for tests: returns queued responses in order. */
export function createReplayCreativeModel(responses: string[]): CreativeModel {
  const queue = [...responses];
  return {
    id: "replay",
    async complete() {
      const next = queue.shift();
      if (next === undefined) throw new Error("Replay model exhausted.");
      return next;
    },
  };
}
