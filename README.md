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

## Architecture

```
src/
  app/
    page.tsx                 # Lab workspace entry
    api/explore/route.ts     # Exploration API (demo + live scaffold)
    api/mutate/route.ts      # Mutation API (demo + live scaffold)
  components/                # UI: hero, form, discovery, concepts, mutation, evidence
  lib/
    types.ts                 # Domain interfaces
    demo-data.ts             # Deterministic fictional demo engine
    storage.ts               # localStorage helpers
    qloo/
      client.ts              # Server-only HTTP helper (auth header placeholder)
      adapter.ts             # exploreWithQloo / mutateWithQloo stubs (TODO)
```

### Modes

| Mode | Behavior |
| --- | --- |
| **Demo** (default) | Interactive end-to-end walkthrough using labeled mock data. No external API calls. |
| **Live** | Requires `QLOO_API_KEY`. Adapter throws `501 Not Implemented` until Qloo docs/endpoints are validated. |

### Environment

See [`.env.example`](./.env.example):

- `QLOO_API_KEY` — server only; never hardcode or expose to the client  
- `QLOO_BASE_URL` — defaults to `https://hackathon.api.qloo.com`

## Design notes

- Near-black / navy base with cyan, electric violet, and restrained gold accents  
- Display: Syne · Body: Outfit · Mono: JetBrains Mono  
- Lightweight SVG/CSS cultural network (no heavy chart libs)  
- Loading, empty, and error states included  
- Respects `prefers-reduced-motion`

## Limitations (intentional)

- No database, auth, or multi-user sync  
- No paid LLM API usage  
- Live Qloo integration is **scaffolded only** — endpoint schemas are not invented  
- Demo affinities and concepts are **not** predictive purchase intent, virality scores, or scientific consumer simulation  
- Free hosting deployment is subject to provider eligibility and terms

## Qloo integration TODOs

1. Obtain hackathon API access and confirm auth header format (current client uses a Bearer placeholder).  
2. Validate Taste Graph discovery endpoints and parameter schemas from official docs.  
3. Implement `exploreWithQloo` in `src/lib/qloo/adapter.ts` — map `ExplorationRequest` → documented query, normalize entities/clusters.  
4. Implement `mutateWithQloo` — adjacent-entity / replacement lookup when available.  
5. Emit `EvidenceItem` with `source: "verified_api"` **only** for fields returned by Qloo; keep concept copy as `agent_hypothesis`.  
6. Add integration tests against sandbox responses once contracts are stable.  
7. Fail closed if the API is unavailable — never substitute mock data silently in live mode.

## Deployment

Ready for a free hosting tier that supports Next.js (e.g. Vercel Hobby), subject to provider eligibility and terms. Set `QLOO_API_KEY` as a **server** environment variable only when live integration is ready. Demo Mode deploys with no secrets.

## License

MIT — see [LICENSE](./LICENSE).

## Hackathon note

This repository is a local MVP scaffold. It has **not** been submitted to Devpost by this project setup.
