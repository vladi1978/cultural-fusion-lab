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

For this brief, the base model already produces a well-built jazz-and-ride concept without Qloo, and Qloo returned only one verified local place. These runs show the pipeline refusing to overclaim, not that Qloo changed the design. Each live run costs about $0.14 and was limited to at most 6 Qloo requests and 10 model calls.

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

Open http://localhost:3000. For Live Mode set `QLOO_API_KEY`, `QLOO_LIVE_ENABLED=true`, `ANTHROPIC_API_KEY` and `CFL_CREATIVE_LLM_ENABLED=true` in `.env.local`. Keys stay on the server and are never committed.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run typecheck` | TypeScript `--noEmit` |
| `npm test` | Offline tests; no network and no paid calls |
| `npm run eval` | Offline evaluation harness |

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
