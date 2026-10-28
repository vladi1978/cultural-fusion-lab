# Cultural Fusion Lab

Entry for the **Qloo Agentic Hackathon (October 2026)**. Cultural Fusion Lab turns a creative brief ("design a bicycle ride and live jazz evening in Louisville") into an operating concept, and asks one question most demos skip: **did the Qloo evidence actually change a design decision?**

It answers with checks that can fail, not with a score. The honest result of the live runs so far is below.

## What it does

1. **Frame and plan.** An LLM frames the brief and plans a few Qloo lookups. Planned searches are not evidence until collected.
2. **Collect from Qloo.** Documented endpoints only: `GET /v2/tags`, `GET /v2/insights` (hard `filter.tags` for places, soft `signal.interests.tags` for brands) and `GET /search`. Every entity keeps its Qloo id, how it was retrieved and, for places, Qloo's city, region and address.
3. **Relevance gate and eligibility.** Off-topic entities are dropped. An entity may ground a decision only if it passes geography (a place's Qloo city/region must match the brief; missing facts count as unverifiable) and topic (a term from the brief in its name or tags; a lone mention in a description is not enough).
4. **Evidence to decision.** The model may propose operating decisions that cite eligible entities by id. Code, not the model, keeps a decision only if it changes something operational (a stop, an order, a duration, a count, an activity or a rule), is visible in the mechanics or journey, and, for a location, cites a validated place. **Zero decisions is a valid result**, and "insufficient evidence" is reported explicitly. Nothing is invented to look grounded.
5. **Controlled comparison.** Four generations (control, evidence, control, evidence) with an identical prompt and settings; only the Qloo evidence differs, and no new Qloo calls are made. The verdict is `detectable` only if a specific term from a cited entity shows up in the decisions of every evidence run and in no control run. Otherwise it says **"Qloo influence not demonstrated"**. Text similarity is shown for information only.

## Live results so far (honest)

| Run | Evidence kept | Decisions grounded | Comparison verdict |
| --- | --- | --- | --- |
| 1 (2026-10-22) | 4 of 4 | 2, both citing artists with no verifiable local link; the one verified local place was unused | Not demonstrated |
| 2 (2026-10-22, after stricter eligibility and operational-decision rules) | 3 of 4 | 0 (two proposals discarded: one not visible in the design, one only a "reference") | Not demonstrated |

For this brief, the base model already produces a well-built jazz-and-ride concept without Qloo, and Qloo returned only one verified local place. These runs show the pipeline refusing to overclaim, not that Qloo changed the design. Actual counts: run 1 used 6 Qloo requests and 7 model calls (about $0.14); run 2 used 5 Qloo requests and 7 model calls (about $0.14). Run 1 ran with the shared validation budget enforcing limits of 6 and 10. Run 2 ran **without** it (the server log said `validation session NOT ACTIVE`); only the dollar cap and the per-run Qloo request cap were enforced, and the counts stayed within the same limits. A transcription of both runs, with what it does and does not show, is in [`docs/live-runs-2026-10-22.md`](./docs/live-runs-2026-10-22.md). These runs do not show that Qloo improved concept quality.

## Safeguards

- **Spend guard:** a hard dollar cap (default $5) with a local ledger, worst-case pre-checks and a per-run call limit.
- **Validation session budget:** with `CFL_VALIDATION_SESSION=true`, a shared server-side budget caps Qloo HTTP requests (6), logical model calls (10) and model HTTP attempts (20), rejects duplicate runs and fails closed if its state is unreadable. Start the server with the flag and check the log line `validation session ACTIVE`.
- **Provenance labels** distinguish verified Qloo data, agent hypotheses and demo data.
- **Demo Mode** uses fictional deterministic data and makes no external calls.

## Quick start

```bash
npm install
cp .env.example .env.local   # Demo Mode needs no keys
npm run dev
```

Open http://localhost:3000. Keys stay on the server and are never committed. Requires Node.js 20.9 or newer (Next.js 16).

### Live Mode environment (all server-side, in `.env.local`)

Live Mode is **closed unless the server explicitly enables it**: a `?live=1` URL parameter never turns it on, and the public demo has none of these variables set. Variables that are absent, empty or not exactly `true` keep Live closed.

| Purpose | Variables | Notes |
| --- | --- | --- |
| Live Qloo exploration | `QLOO_API_KEY`, `QLOO_LIVE_ENABLED=true` | Optional: `QLOO_BASE_URL`, `QLOO_REQUEST_TIMEOUT_MS`. Without the creative model below, Live uses the original 3-request Qloo source. |
| Full pipeline (plan-driven discovery, evidence decisions) | `ANTHROPIC_API_KEY`, `CFL_CREATIVE_LLM_ENABLED=true`, `CFL_CREATIVE_PRICE_IN_USD_PER_MTOK`, `CFL_CREATIVE_PRICE_OUT_USD_PER_MTOK` | Set the two prices to the model's published prices. No price is assumed, and the spend guard refuses any paid call without them. |
| Spend limits | `CFL_CREATIVE_TOTAL_CAP_USD` (default 5), `CFL_CREATIVE_MAX_CALLS` (default 6 per process) | The cap is checked before every call against a local ledger (`.cfl-spend-ledger.json`, git-ignored). |
| Controlled comparison | `CFL_ABLATION_ENABLED=true` plus the full-pipeline variables above | Optional: `CFL_ABLATION_MAX_RUNS`. |
| Shared validation budget (recommended for paid runs) | `CFL_VALIDATION_SESSION=true` | Caps 6 Qloo requests, 10 model calls and 20 model HTTP attempts per session and rejects duplicate runs. Check the server log for `validation session ACTIVE`. |

Running Live spends real money on your own keys; start with the spend limits above.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run typecheck` | TypeScript `--noEmit` |
| `npm test` | Offline tests; no network and no paid calls |
| `npm run eval` | Offline evaluation harness |

## How to verify Qloo integration without API keys

You can check that this project talks to the real Qloo API without a key and without any paid request:

1. **Recorded real responses.** `src/lib/qloo/fixtures/live-probe-*.json` hold real Qloo hackathon API responses (trimmed), recorded on 2026-10-21 and 2026-10-22 from `GET /v2/tags`, `GET /v2/insights` and `GET /search`. They contain no credentials. Their `note` and `recordedAt` fields say how each was captured. `mock-responses.ts` in the same folder is separate and labeled as mock.
2. **Offline tests that replay them.** `npm test` runs everything with no network. Tests such as `src/lib/qloo/schemas.test.ts`, `src/lib/agent/sources/qloo-discovery.test.ts`, `src/lib/agent/sources/qloo-plan-source.test.ts` and `src/lib/agent/evidence/eligibility.test.ts` parse those real responses, run discovery against them and check eligibility on real entities (for example, a pet shop and a fast-food chain returned for a cycling query are rejected).
3. **The probe scripts.** `scripts/qloo-*-probe.mjs` are the one-off scripts that captured the fixtures. Each makes at most a handful of requests, reads `QLOO_API_KEY` from `.env.local` without printing it, and refuses to run twice. With your own key you can re-run them to compare against the fixtures.
4. **The endpoints and headers.** `src/lib/qloo/client.ts` (auth header `X-Api-Key`, timeout, rate limiting) and `src/lib/qloo/endpoints.ts` (`/search`, `/v2/tags`, `/v2/insights`) show exactly which documented endpoints are called.
5. **What the live runs showed.** See [`docs/live-runs-2026-10-22.md`](./docs/live-runs-2026-10-22.md): two live runs, honest results, no claim that Qloo improved concept quality.

## Tests

All tests run offline. Qloo responses used in tests are recorded real responses (`src/lib/qloo/fixtures/live-probe-*.json`) plus labeled mocks, so discovery and eligibility are checked against what Qloo actually returned. Adversarial tests cover irrelevant evidence, invented ids, rejected places named in the design, reference-only decisions, evidence removed or changed, and budget exhaustion.

## Layout

```
src/lib/qloo/            Qloo client, endpoints, mapper, schemas, fixtures
src/lib/agent/sources/   Qloo discovery and plan-driven collection
src/lib/agent/evidence/  Geography and topic eligibility
src/lib/agent/creative/  Frame, operational design, compose, evidence decisions, spend guard
src/lib/agent/ablation/  Controlled comparison
src/lib/validation-session.ts  Shared validation-session budget
```

## Limitations

- Qloo evidence works as a loose proxy. It does not verify demand, audience or that a venue accepts the proposed format.
- Results depend on the brief; the live evidence is two runs on one brief with two generations per arm.
- Fit and similarity scores are heuristics, not Taste Graph forecasts.
- Place search quality varies: Qloo's soft tag signal is largely ignored for places, so discovery uses hard filters and may return few places for a small city.
- The Causal Decision Lab page is an experimental deterministic demo and is not backed by Qloo.

## License

MIT, see [LICENSE](./LICENSE).
