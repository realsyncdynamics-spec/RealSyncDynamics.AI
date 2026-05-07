# ADR 0002 — Future: Full Monorepo Migration to Fastify + Coolify

**Status:** Deferred (waiting for trigger from ADR 0001)
**Date:** 2026-05-07 (deferred)
**Author:** Dominik Steiner

## Context

Bei Erfüllung eines Migrations-Triggers aus
[ADR 0001](./0001-stay-on-supabase-gh-pages-for-v1.md) wird dieser ADR aktiviert.

## Target Architecture

```
realsyncdynamicsai/
├── apps/
│   ├── web/         # Next.js (App Router)
│   ├── api/         # Fastify HTTP layer
│   ├── worker/      # Playwright + queue-consumer
│   └── docs-renderer/  # PDF/HTML block-renderer
├── packages/
│   ├── database/         # Prisma + Postgres
│   ├── shared/           # Types, schemas, utils
│   ├── compliance-rules/ # JSON Rule Engine (already extracted in v1)
│   ├── audit-engine/     # Crawler + detectors + evidence
│   └── ui/               # Shared components
└── infrastructure/
    ├── docker/
    ├── coolify/
    └── nginx/
```

## Migration-Plan (when triggered)

### Phase 9.1 — Foundation (Week 1)

- pnpm workspace + Turborepo bootstrap
- `packages/compliance-rules/` aus `src/rules/` umziehen (Code ist bereits portable)
- `packages/database/` mit Prisma-Schema generiert aus Supabase-Migration-State
- Docker-Compose: Postgres + Redis + MinIO (S3-compatible)

### Phase 9.2 — API Migration (Week 2)

- Fastify Routes pro Domain (Identity / Systems / Audit / Compliance / Documents / AI Runtime)
- Edge Functions one-by-one nach `apps/api/src/routes/` umziehen
- Auth Layer: Auth.js oder Keycloak (ADR-Entscheidung zur Migrations-Zeit)
- DB-Migration parallel: Supabase → self-hosted Postgres + RLS-Policies importiert

### Phase 9.3 — Worker (Week 3)

- `apps/worker/` mit BullMQ + Playwright
- Async-Audit-Pipeline: HTTP-API → Queue → Worker → DB
- Evidence-Layer: Screenshots + Network-Logs in S3

### Phase 9.4 — Frontend Cutover (Week 4)

- `apps/web/` Next.js parallel zum bestehenden Vite-Build
- Vite-Bundle bleibt verfügbar als Fallback während Cutover
- DNS-Switch nach Smoketest-Phase

### Phase 9.5 — Cleanup (Week 5–6)

- Decommission Supabase Edge Functions
- Decommission GitHub Pages Frontend
- Stripe-Webhook auf neue Endpoint umbiegen
- DSGVO-Dokumentation (Sub-Processors-Liste, AVV) aktualisieren

## Sub-Processor Changes (kommunikationspflichtig)

Bei Migration ändert sich die Sub-Processor-Liste:

**Removed:**
- Supabase Inc.
- GitHub Inc.

**Added:**
- Hosting-Provider Coolify-on-Hetzner / Coolify-on-Hostinger (zu entscheiden)
- Backup-Provider (S3-kompatibel, EU-Region)

→ Pflicht: 30 Tage Vorab-Notification an alle Tenants nach Art. 28 Abs. 2 DSGVO.

## Rollback-Plan

Bis zum DNS-Switch (Phase 9.4): Old-Stack komplett funktional, kein Rollback-Risiko.

Nach DNS-Switch: Rollback via DNS-TTL (60s) zurück auf GitHub Pages — solange
Frontend-Code-Compatibility bewahrt wird (= API-Calls auf gleiche Endpoints).
Daher: API-Pfade bleiben kompatibel zur alten Edge-Function-URL-Struktur.

## Cost Estimate (when triggered)

| Item | Monthly | Notes |
|---|---|---|
| Coolify-Hosted VPS (Hetzner CX22) | €15 | 4 vCPU, 8GB RAM, 80GB SSD — initial |
| Postgres (managed oder self) | €25 | Hetzner managed PG oder self-hosted |
| Redis (managed oder self) | €10 | Self-hosted in Coolify-VPS möglich |
| S3-compat Storage | €5 | MinIO selfhost oder Hetzner Object Storage |
| Backups + DNS + monitoring | €10 | |
| **Total** | **~€65/Monat** | für ersten Skalierungs-Schritt |

Bei 50 zahlenden Kunden à €29 (Bronze) = €1450 MRR. Hosting-Kosten <5%. Tragbar.

## Open Questions (decide when triggering)

- **Auth-Layer:** Auth.js (mehr Flexibilität) vs. Keycloak (mehr Enterprise-Features)?
- **PDF-Rendering:** React-PDF (declarative) vs. Puppeteer-via-Worker (HTML/CSS-fidelity)?
- **Realtime:** Server-Sent Events (simpler) vs. WebSocket (bidirektional)?
- **Monorepo-Tool:** Turborepo vs. Nx?

Diese Fragen sind beim Triggern dieses ADRs final zu entscheiden — bis dahin
nur in dieser Liste tracked.
