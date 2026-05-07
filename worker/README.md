# RealSync Audit Worker (Phase 8 Scaffold)

**Status:** Scaffold — noch nicht aktiviert.
Aktivierung erfolgt bei Bedarf (siehe ADR 0001 Migration-Trigger).

## Was tut dieser Worker

Asynchroner Audit-Worker mit Playwright. Hört auf Postgres-LISTEN/NOTIFY-Channel
`audit_job_queued`, claimed Jobs aus `public.audit_jobs`, führt Real-Browser-Crawl
durch, evaluiert Compliance-Rules aus `src/rules/`, schreibt Findings + Evidence
zurück nach Postgres + Supabase Storage.

## Warum nicht heute aktivieren

Heutige Audits laufen synchron in der Supabase Edge Function `audit`. Das ist
ausreichend für statische HTTP-Header-Analyse + Subpages-Scan. Real-Browser-Render
mit Playwright braucht:

1. Hosting-Umgebung mit Docker (Edge Functions erlauben kein Playwright)
2. Persistenter Worker-Container (kein Cold-Start)
3. Storage-Bucket für Screenshots/DOM-Snapshots

Bevor diese 3 Voraussetzungen erfüllt sind und Trigger nach ADR 0001 reichen,
lohnt sich Aktivierung nicht.

## Aktivierungs-Schritte (when ready)

### 1. Hosting

VPS oder Coolify-Instance mit Docker. Beispiel-Config liegt in
`worker/docker-compose.yml`. Empfohlen: Hetzner CX22 (€15/M).

### 2. Environment

```bash
cp worker/.env.example worker/.env
# Fülle aus:
# SUPABASE_URL=https://<project>.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=<service-role-key aus Supabase-Dashboard>
# WORKER_ID=worker-1
# PLAYWRIGHT_TIMEOUT_MS=30000
```

### 3. Storage Bucket

In Supabase Dashboard: Storage → New Bucket → `audit-evidence` → Private.
Wird automatisch von Migration `20260507100000_audit_evidence.sql` angelegt.

### 4. Migrations applied

```bash
supabase db push
# ODER manuell:
# 20260507100000_audit_evidence.sql
# 20260507110000_audit_jobs_queue.sql
```

### 5. Start worker

```bash
cd worker
docker-compose up -d
```

### 6. Frontend-Anpassung

In `src/pages/AuditLanding.tsx`: Audit-Trigger auf `INSERT INTO audit_jobs`
umbiegen statt sync-Edge-Function-Call. UI erhält `job_id`, polled
`audit_jobs.status` per Server-Sent-Events oder Supabase Realtime.

## Testing locally

```bash
docker-compose up -d
# In another terminal:
psql $DATABASE_URL -c "INSERT INTO audit_jobs (tenant_id, domain) VALUES ('00000000-0000-0000-0000-000000000001', 'example.com');"
# Worker logs sollten Job-Pickup zeigen
docker-compose logs -f worker
```

## Files

- `Dockerfile` — Node.js 20 + Playwright Chromium
- `package.json` — pg + @supabase/supabase-js + playwright
- `src/index.ts` — main loop: LISTEN → claim → crawl → evaluate → complete
- `src/crawler.ts` — Playwright-basierter Site-Crawler
- `src/detectors/` — Tracker / Consent / AI-Widget Detektoren
- `src/storage.ts` — Supabase Storage Upload für Screenshots
- `docker-compose.yml` — local-dev Setup

## Architektur-Bezug

Siehe `docs/ARCHITECTURE.md` Section "Audit-Pipeline als Queue-System" und
`docs/adr/0001-stay-on-supabase-gh-pages-for-v1.md` (Phase 8 Scaffold).
