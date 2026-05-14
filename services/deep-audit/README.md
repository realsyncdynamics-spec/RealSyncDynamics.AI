# Deep Audit Platform

Playwright-based browser scanner + queue worker + Fastify API + Postgres +
Redis. Lives next to the parent platform (React/Vite + Supabase Edge
Functions) and handles the **long-running, deep-scan** workloads that
don't fit a 1-minute Edge Function:

| | Parent platform (`/audit`) | Deep audit (this folder) |
|---|---|---|
| Stack       | Supabase Edge Function (Deno) | Docker (Node + Playwright) |
| Scanner     | `fetch()` + HTML heuristics  | Headless Chromium |
| Latency     | < 10 s | 15 – 60 s |
| Output      | Inline JSON to caller        | Async via job-id; screenshot + report bundle |
| Use-case    | Free Audit / quick checks    | Pre/Post-consent traffic split, full-page screenshot, dynamic-injection detection |

## Layout

```
services/deep-audit/
├── docker-compose.yml          # 4 services: api · worker (×5) · redis · postgres
├── .env.example                # secrets (POSTGRES_PASSWORD, OPENAI_API_KEY, …)
├── api/                        # Fastify API: POST /scan · GET /scan/:id · POST /score
│   ├── src/
│   │   ├── server.ts
│   │   └── risk-engine/rules.ts
│   ├── Dockerfile
│   └── package.json
├── worker/                     # Playwright + BullMQ worker
│   ├── src/
│   │   ├── main.ts             # BullMQ worker entry
│   │   ├── scanner/scan.ts     # Playwright scan logic
│   │   └── consent/detect.ts   # CMP detection (OneTrust, Cookiebot, Usercentrics, Borlabs, Iubenda, generic)
│   ├── Dockerfile
│   └── package.json
├── postgres/init/001_schema.sql  # deep_audits + deep_findings tables
├── reports/                    # gitignored, written by worker
└── screenshots/                # gitignored, written by worker
```

## Quickstart (local dev)

```bash
cd services/deep-audit
cp .env.example .env             # fill in passwords
docker compose up -d --build
curl http://localhost:3000/health
```

Queue a scan:

```bash
curl -X POST http://localhost:3000/scan \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com"}'
# { "success": true, "job_id": "1" }
```

Poll the result:

```bash
curl http://localhost:3000/scan/1
```

## Deploy

The compose file is self-contained and runs on any Docker host. Recommended
VPS profile: 4 vCPU / 8 GB RAM / 40 GB SSD (Hetzner CX32 / Fly.io shared
VM). The Playwright base image is ~1.5 GB so first pull is slow.

## Relationship to the parent platform

This service is **not** auto-deployed by `.github/workflows/deploy.yml`
(which only watches `supabase/**` and `src/**`). It deploys via its own
pipeline (TBD).

## Roadmap (in spec order)

1. CMP auto-reject (test the "Reject all" path, not just accept).
2. Multi-state scanning (cookies-cleared, consent-rejected, consent-accepted).
3. PDF reports via Playwright print-to-PDF.
4. Postgres persistence (currently file-only in `reports/`).
5. AI risk narratives — delegate to the parent platform's AI Gateway
   (`/functions/v1/ai-gateway`) so the same prompt-registry + provider
   policy governs the language.
6. Dashboard UI — re-uses the parent platform's React app (no separate
   frontend) and renders deep-audit reports under `/deep-audit/:id`.
7. Auth + SaaS billing — relies on the parent platform's Supabase auth.
8. Domain monitoring (scheduled re-scans via BullMQ repeatable jobs).
9. Screenshot diffing.
10. CI/CD privacy tests.
