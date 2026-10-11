# Cultural Fusion Lab

A visually driven Next.js MVP for the **Qloo Agentic Hackathon (October 2026)** — a creative intelligence laboratory for cultural discovery, fusion concepting, and influence mutation.

> **Demo Mode is the supported path today.** All cultural entities, affinities, and concepts in Demo Mode are **fictional, deterministic sample data**. They are **not** Qloo Taste Graph insights.

## Features

1. **Landing / workspace** — Cultural Fusion Lab identity + Start Exploration CTA  
2. **Exploration input** — creative objective, cultural interest, optional location, output category  
3. **Cultural Discovery** — SVG cultural network + entities grouped by music, film, brands, and more  
4. **Fusion Concepts** — three concept cards with positioning, influences, and evidence links  
5. **Mutation Studio** — swap one cultural influence to generate a conceptual variant  
6. **Evidence panel** — clearly labels *verified API data*, *agent-generated hypotheses*, and *mock demo data*

## Tech stack

- Next.js App Router, TypeScript, Tailwind CSS v4  
- `lucide-react` icons  
- Browser `localStorage` for optional draft / result persistence  
- Server-only Qloo adapter scaffold (`server-only`)  
- Zero-cost local MVP: no Supabase, auth, payments, or paid LLM calls

## Quick start

```bash
npm install
cp .env.example .env.local   # optional; Demo Mode needs no keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript `--noEmit` |
| `npm test` | Unit tests (Vitest + labeled mock Qloo fixtures) |
| `npm run eval` | Offline evaluation harness + markdown report (`eval-reports/`) |

## Architecture

```
src/
  app/
    page.tsx                 # Lab workspace entry
    api/explore/route.ts     # Exploration API (demo + gated live)
    api/mutate/route.ts      # Mutation API (demo + gated live)
    api/qloo/status/route.ts # Live readiness status (no secrets)
  components/                # UI: hero, form, discovery, concepts, mutation, evidence, agent trace
  lib/
    types.ts                 # Domain interfaces
    demo-data.ts             # Deterministic fictional demo engine
    storage.ts               # localStorage helpers
    agent/                   # Deterministic orchestration (no paid LLM)
      orchestrator.ts        # interpret → plan → collect → affinities → concepts → evaluate → mutate
      sources/               # demo + gated Qloo evidence sources
      fixtures/              # Labeled mock fixtures for offline tests
    qloo/
      schemas.ts             # Documented request/response types + parsers
      client.ts              # Server-only HTTP (X-Api-Key, timeout, rate-limit)
      endpoints.ts           # GET /search, GET /v2/tags, GET /v2/insights
      mapper.ts              # Qloo entities → Cultural Fusion Lab domain
      live-gate.ts           # Live Mode lock until auth succeeds
      adapter.ts             # exploreWithQloo / mutateWithQloo
      fixtures/              # Labeled mock responses for unit tests
```

### Modes

| Mode | Behavior |
| --- | --- |
| **Demo** (default) | Interactive end-to-end walkthrough using labeled fictional sample data. No external API calls. |
| **Live** | Locked closed until `QLOO_API_KEY` is set, `QLOO_LIVE_ENABLED=true`, and a server-side auth probe succeeds. Not claimed working until tested with a real key. |

### Environment

See [`.env.example`](./.env.example):

- `QLOO_API_KEY` — server only; never hardcode or expose to the client  
- `QLOO_BASE_URL` — defaults to `https://hackathon.api.qloo.com`  
- `QLOO_LIVE_ENABLED` — must be `true` to unlock Live Mode after auth succeeds  
- `QLOO_REQUEST_TIMEOUT_MS` — optional HTTP timeout (default `12000`)

### Documented Qloo endpoints used by the integration layer

Verified from official sources (not invented):

| Endpoint | Method | Auth | Source |
| --- | --- | --- | --- |
| `/search?query=&type=` | GET | `X-Api-Key` | Qloo Hackathon Devpost notice |
| `/v2/tags` | GET | `X-Api-Key` | docs.qloo.com Tags OpenAPI |
| `/v2/insights` | GET | `X-Api-Key` | docs.qloo.com Insights OpenAPI / API Onboarding |

Auth header name confirmed as **`X-Api-Key`** (not Bearer) via docs.qloo.com API Onboarding and the hackathon notice.

## Design notes

- Near-black / navy base with cyan, electric violet, and restrained gold accents  
- Display: Syne · Body: Outfit · Mono: JetBrains Mono  
- Lightweight SVG/CSS cultural network (no heavy chart libs)  
- Loading, empty, and error states included  
- Respects `prefers-reduced-motion`

## Limitations (intentional)

- No database, auth, or multi-user sync  
- No paid LLM API usage  
- Live Qloo calls are **implemented but unverified** against a real hackathon key (key still pending)  
- Demo affinities and concepts are **not** predictive purchase intent, virality scores, or scientific consumer simulation  
- Free hosting deployment is subject to provider eligibility and terms

## Qloo integration status

**Implemented (unit-tested with labeled mocks):**

1. `X-Api-Key` auth, timeouts, rate-limit (`429` + `Retry-After`), safe error mapping  
2. Typed `searchEntities`, `searchTags`, `getInsights`  
3. `exploreWithQloo` / `mutateWithQloo` adapters with evidence provenance  
4. Live Mode gate (`QLOO_LIVE_ENABLED` + in-process auth probe)  
5. `GET /api/qloo/status` readiness endpoint (no secrets)  
6. Deterministic agent orchestrator (interpret → plan → collect → affinities → concepts → evaluate → mutate) with claim→evidence tracing and no paid LLM  
7. Offline evaluation harness (`src/lib/eval`) with 17 synthetic scenarios, objective validators, subjective heuristics (separated), and markdown reporting

**Blocked until a real API key arrives:**

1. Successful auth probe against `https://hackathon.api.qloo.com`  
2. Enabling `QLOO_LIVE_ENABLED=true` on the server  
3. End-to-end live exploration/mutation verification  
4. Confirming hackathon entitlement coverage for `/search`, `/v2/tags`, and `/v2/insights`

## Deployment

Ready for a free hosting tier that supports Next.js (e.g. Vercel Hobby), subject to provider eligibility and terms. Set `QLOO_API_KEY` as a **server** environment variable only when live integration is ready. Demo Mode deploys with no secrets.

## License

MIT — see [LICENSE](./LICENSE).

## Hackathon note

This repository is a local MVP scaffold. It has **not** been submitted to Devpost by this project setup.
