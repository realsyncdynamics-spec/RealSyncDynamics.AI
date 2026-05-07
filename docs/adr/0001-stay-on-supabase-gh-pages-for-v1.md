# ADR 0001 — Stay on Supabase + GitHub Pages for v1

**Status:** Accepted
**Date:** 2026-05-07
**Author:** Dominik Steiner

## Context

Wir bauen eine SaaS-Compliance-Plattform für DACH (RealSync Dynamics). Eine externe
Architektur-Review schlägt eine Migration zu einer Monorepo-Architektur vor:

- `apps/web` — Next.js Frontend
- `apps/api` — Fastify HTTP-Layer
- `apps/worker` — Playwright + BullMQ + Redis
- `packages/database` — Prisma + Postgres
- `packages/compliance-rules` — versionierte JSON Rule Engine
- Hosting via Coolify oder K8s

Die Architektur ist **konzeptionell richtig** (Continuous-Compliance-OS statt
Tool-Sammlung). Die Frage ist nicht *ob*, sondern *wann* migriert wird.

## Decision

**Wir bleiben für v1 auf dem aktuellen Stack:**

- Frontend: Vite + React, Hosted via GitHub Pages mit Apex-Custom-Domain
- Backend: Supabase (Postgres + Auth + Edge Functions + Storage + Vault)
- Edge Functions in Deno (funktional equivalent zu Fastify-Routes)
- Multi-Tenant via Postgres RLS (= dasselbe Schutzmodell wie Prisma + tenant_id)

**Begründung:**

1. **Das vorgeschlagene System haben wir größtenteils bereits.**
   Postgres ✅, RLS ✅, Auth ✅, multi-tenant ✅, Storage ✅, API-Layer ✅.
   Was fehlt sind hauptsächlich (a) Rule Engine als versionierte JSON-Regeln,
   (b) Evidence Layer, (c) Async-Audit-Pipeline mit Playwright. Diese drei
   können *innerhalb des aktuellen Stacks* entwickelt werden.

2. **Migration kostet 4–6 Wochen Frozen-Shipping.**
   Aktuelle Velocity (≥1 PR/Tag mit User-facing Wert) ist unser kompetitiver
   Hebel gegen langsame Enterprise-Beratungs-Anbieter (DataGuard, Proliance).
   Frozen-Shipping = strategischer Schaden.

3. **GitHub Pages + Supabase ist €0 bis ~50 Kunden.**
   Coolify/K8s Hosting + Redis + dedicated Worker = ab Tag 1 fixe Kosten.
   Vor Product-Market-Fit (PMF) ist das umsonst-Burn.

4. **Refactoring-Kosten bei Migration sind überschätzt.**
   Wenn wir Rule Engine + Evidence + Async-Pipeline jetzt sauber entwickeln
   (= portable Patterns, nicht Supabase-spezifische Hacks), ist der spätere
   Lift-and-Shift zu Fastify hauptsächlich Adapter-Code.

## Migration Triggers (when to revisit)

Wir reaktivieren ADR 0002 (full monorepo migration) wenn **mindestens einer**
der folgenden Trigger eintritt:

| Trigger | Schwellwert | Begründung |
|---|---|---|
| Paying-Customer-Count | ≥ 50 | Revenue rechtfertigt Hosting-Kosten + DevOps-Aufwand |
| Edge-Function-Timeout-Failures | ≥ 5 % der Audit-Runs | Synchrone Edge Functions skalieren nicht für Real-Crawling |
| Playwright-Bedarf | „Real Browser-Audit" wird Sales-Blocker | Static-HTTP-Audit reicht nicht mehr für Enterprise-Procurement |
| Multi-Region-Pflicht | EU-Kunde verlangt Frankfurt + Dublin | Supabase ist Single-Region |
| Real-Time-Alerts | Pflicht-Feature für Enterprise-Tier | Edge Functions können nicht persistente WebSockets/SSE halten |

## Consequences

### Positive

- **Kein Frozen-Shipping** — wir bauen weiter Tool-Doorways, Trust-Pages,
  Rule-Engine-Refactoring inkrementell.
- **€0 Infrastructure-Burn** bis PMF.
- **Kunden-Feedback steuert Migration** — wir wissen *was* gebraucht wird,
  bevor wir es bauen.

### Negative

- **Static-HTTP-Audit-Limitation** — Server-Side-Tracking, dynamisch
  geladene Skripte, nested iframes werden nicht erkannt.
  → Mitigation: in `/legal/methodology` und `/grenzen` explizit dokumentiert,
    ConfidenceScore in Audit-Reports macht das Limit transparent.

- **Single-Region Supabase Frankfurt** — kein DR ohne Backup-Restore
  in andere Region.
  → Mitigation: Supabase macht automatische Backups, RTO ist akzeptabel
    für SaaS-Compliance-Tooling (nicht latency-kritisch).

- **Sync-Edge-Function-Audits** können bei großen Sites timeouten.
  → Mitigation: Subpages-Scan limitiert auf 3 (Datenschutz, Impressum, Home).
    Async-Queue via Postgres-LISTEN/NOTIFY als nächster Schritt
    (siehe Phase 8 in dieser PR).

## Action Items (this PR)

1. ✅ Dieser ADR commit
2. ⏭ Rule Engine extraktieren — `src/rules/` mit JSON-Regeln (Phase 7.2)
3. ⏭ Evidence-Layer-Schema — Migration `audit_evidence` (Phase 7.3)
4. ⏭ Async-Audit-Worker-Scaffold — Docker-Compose + Playwright-Stub
   bereit zur Aktivierung (Phase 8)

## Related

- ADR 0002 (Future): Full Monorepo Migration to Fastify + Coolify — wird
  aktiviert bei Trigger-Erfüllung (siehe Tabelle oben).
