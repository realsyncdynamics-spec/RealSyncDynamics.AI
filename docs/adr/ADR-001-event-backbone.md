# ADR-001: Event-Backbone, Graph-Layer und Tenancy-Modell

- **Status:** Accepted
- **Date:** 2026-05-18
- **Author:** Dominik Steiner
- **Scope:** RealSync Dynamics AI — Governance Runtime (realsyncdynamicsai.de)
- **Repository:** `realsyncdynamics-spec/RealSyncDynamics.AI`
- **Related:** [`0001-stay-on-supabase-gh-pages-for-v1.md`](./0001-stay-on-supabase-gh-pages-for-v1.md) · [`0003-governance-bus-postgres-outbox.md`](./0003-governance-bus-postgres-outbox.md)
- **Supersedes:** —

---

## 1. Context

Zwei unabhängige externe Architektur-Analysen (Reverse-Engineering der öffentlichen
Positionierung von realsyncdynamicsai.de) kategorisieren die Plattform als
"AI Governance Runtime mit Event-Feed + Evidence-Layer".

Eine der beiden Analysen empfiehlt explizit einen Hyperscale-Stack:
Kafka als Event-Backbone, Neo4j als dedizierte Graph-DB, Kubernetes als
Compute-Orchestrierung, Keycloak/Auth0 für Identity.

Realität:
- Solo-Founder-Setup, sole proprietorship, GmbH pending.
- Aktueller Stack: **Vite 6 + React 19 (SPA)** + Supabase (Frankfurt, eu-central-1)
  + GitHub-Pages-Deploy + Supabase Edge Functions (Deno) + Hostinger VPS `srv1622293`
  (PM2 + systemd) + Playwright + Ollama. **Kein Next.js, kein Turborepo.** Eine
  zukünftige Migration auf Fastify/Next-Monorepo + Coolify ist in [ADR-0002](./0002-future-monorepo-migration.md) als Deferred dokumentiert.
- Cash-Lage erlaubt keine permanente Infrastruktur-Ops-Last (Kafka-Cluster,
  Neo4j-Lizenz, K8s-Control-Plane).
- Erste Enterprise-Konversationen laufen, aber Tenant-Anzahl < 50.

Risiko bei voreiliger Hyperscale-Migration: Operative Last frisst Produktentwicklung
auf, Burn-Rate steigt ohne korrelierte Revenue, technische Schulden durch
schlechte K8s-Konfig sind teurer als technische Schulden durch Lean-Stack.

Risiko bei zu langem Verbleib auf Lean-Stack: Event-Konsistenz-Probleme bei
> 100 Tenants, Graph-Query-Latenz tötet UX, RLS-Performance degradiert bei
großen Tenants.

## 2. Decision

### 2.1 Event-Backbone

**Heute:** Postgres `LISTEN` / `NOTIFY` (siehe `supabase/migrations/20260507110000_audit_jobs_queue.sql`) +
Supabase Edge Functions als Worker-Trigger + `worker/` (Node) für Long-Running-Jobs.
Append-only Event-Tabellen `runtime_events`, `ai_runtime_events` und `governance_events`
in Postgres als Source of Truth. Outbox-Mechanik laut [ADR-0003](./0003-governance-bus-postgres-outbox.md).

**Nicht heute:** Kafka, NATS, Redis Streams, RabbitMQ.

**Begründung:** Postgres als Event-Store ist bei < 10.000 Events/Tag pro Tenant
ausreichend, transactional konsistent mit dem Domain-State, und vermeidet
Two-Phase-Commit-Probleme zwischen Event-Bus und Datenbank.

### 2.2 Graph-Layer

**Heute:** Hybrid Graph Model in Postgres — geplante `runtime_edges` Tabelle
(`source_id`, `target_id`, `edge_type`, `tenant_id`, `properties jsonb`),
abgefragt via recursive CTEs. Optional Apache AGE Extension wenn Cypher-Syntax
benötigt wird.

> **Hinweis:** Heute werden Governance-Beziehungen über JOINs zwischen
> `ai_systems`, `ai_policies`, `ai_evidence_events` und `runtime_events`
> abgebildet. Eine dedizierte `runtime_edges`-Tabelle ist Folge-PR.

**Nicht heute:** Neo4j, ArangoDB, JanusGraph.

**Begründung:** Governance-Graph hat in der aktuellen Domäne ≤ 5 Hops
(Agent → Modell → Endpunkt → Tenant → Policy → Evidence). Recursive CTEs auf
indizierten Edges sind bis ~10⁶ Edges performant genug.

### 2.3 Compute & Worker

**Heute:** GitHub Pages für SPA-Hosting + Supabase Edge Functions
für leichte Worker, Hostinger VPS `srv1622293` mit PM2 + systemd für
Long-Running Playwright-Worker (`worker/` Verzeichnis) und Ollama
(`deploy/ollama-traefik`).

**Nicht heute:** Kubernetes, Temporal Cloud, Celery, Airflow.

**Begründung:** Workflow-Orchestrierung läuft heute über Postgres-State-Machines
(`workflow_runs` mit Triggern, `agent_os_substrate`). Temporal lohnt sich erst bei
> 1.000 parallelen Long-Running-Workflows.

### 2.4 Tenancy

**Heute:** Single Postgres + Row-Level Security (RLS) Policies pro Tabelle,
`tenant_id` als verpflichtende Spalte, Helper `public.is_tenant_member(uuid)`
gegen `memberships` (siehe `supabase/migrations/20260430180000_tenant_rls_and_webhook_events.sql`).

**Nicht heute:** Schema-per-Tenant, Database-per-Tenant.

**Begründung:** RLS skaliert linear bis ~500 Tenants bei aktueller Query-Last.
Schema-per-Tenant erhöht Migrations-Komplexität um Faktor N.

### 2.5 Identity

**Heute:** Supabase Auth (Email + OAuth + Magic Link). SAML/SSO via Supabase
Pro-Tier wenn Enterprise-Tenant es anfragt.

**Nicht heute:** Keycloak, Auth0, eigener OIDC-Provider.

## 3. Consequences

### Positiv
- Operative Last bleibt bei einer Person tragbar.
- Burn-Rate für Infrastruktur < €200/Monat (Supabase Pro + Hostinger VPS + Domains;
  GitHub Pages kostet nichts).
- Transactional Konsistenz zwischen Domain-State und Event-Stream — keine
  Race Conditions zwischen Bus und DB.
- Stack ist über `pg_dump` migrierbar — kein Vendor-Lock-in jenseits Postgres.

### Negativ
- Postgres ist Single Point of Failure. Mitigation: Supabase Point-in-Time
  Recovery aktiv, tägliche Off-Site-Backups nach S3-kompatiblem Storage.
- Event-Throughput durch Postgres-Write-Performance begrenzt.
  Bei aktueller Hardware: ~2.000 Events/sec sustained.
- Graph-Queries > 5 Hops werden langsam. Mitigation: Materialized Views für
  häufige Pfade.
- Keine native Stream-Processing-Semantik (Windowing, Watermarks).
  Wird heute nicht benötigt.

## 4. Migration Triggers

Migration wird **automatisch ausgelöst**, sobald **einer** der folgenden
Schwellwerte über 14 aufeinanderfolgende Tage überschritten wird. Messung
über `monitoring.daily_metrics` (Cron, 00:05 UTC) — diese Tabelle wird
in einer Folge-PR ergänzt; bis dahin manuelle Messung gegen Supabase-Logs
und `business_metrics`.

### Trigger A — Event-Backbone: Postgres → NATS (nicht Kafka)

| Metrik | Schwelle | Aktion |
|---|---|---|
| Events/Tag (alle Tenants) | > 5.000.000 | Migration einleiten |
| `pg_stat_activity` waiting queries auf `runtime_events` | > 50 sustained | Migration einleiten |
| p95 LISTEN-Latency | > 500 ms | Migration einleiten |

**Migrationspfad:** NATS JetStream auf `srv1622293` oder dediziertem VPS,
Dual-Write 14 Tage (Postgres + NATS), dann Cutover. Postgres bleibt
Source of Truth für Domain-State, NATS übernimmt Fan-Out.

**Kafka nicht vor:** > 50.000.000 Events/Tag UND > 5 dedizierte Stream-Processing-Use-Cases.

### Trigger B — Graph: Postgres CTEs → Apache AGE → Neo4j

| Metrik | Schwelle | Aktion |
|---|---|---|
| Edges in `runtime_edges` | > 1.000.000 | AGE-Extension aktivieren |
| p95 Graph-Query-Latency (≤ 5 Hops) | > 800 ms | AGE-Extension aktivieren |
| Edges in `runtime_edges` | > 10.000.000 | Neo4j evaluieren |
| Required Hops in Production-Queries | > 7 | Neo4j evaluieren |

**Migrationspfad AGE:** In-Place Extension-Install in Supabase Postgres
(falls Supabase es zulässt — sonst dedizierte Postgres-Instanz auf
`srv1622293`). Cypher-Queries parallel zu CTEs, A/B-Latency-Vergleich
4 Wochen.

**Neo4j nicht vor:** Beide Schwellen oben gleichzeitig erfüllt UND
> €30k MRR (operative Last rechtfertigt zweite DB).

### Trigger C — Tenancy: RLS → Schema-per-Tenant → DB-per-Tenant

| Metrik | Schwelle | Aktion |
|---|---|---|
| Aktive Tenants | > 200 | Schema-per-Tenant evaluieren |
| p95 Query-Latency auf RLS-Tabellen | > 300 ms | Schema-per-Tenant evaluieren |
| Aktive Tenants | > 1.000 | DB-per-Tenant für Enterprise-Tier |
| Enterprise-Kunde fordert vertraglich Datenisolation | sofort | DB-per-Tenant für diesen Kunden |

**Migrationspfad Schema-per-Tenant:** Neue Tenants ab Cutover-Datum erhalten
eigenes Schema. Bestehende Tenants migrieren via `pg_dump --schema` in
geplanten Wartungsfenstern.

### Trigger D — Compute: PM2 → Docker Compose → Kubernetes

| Metrik | Schwelle | Aktion |
|---|---|---|
| Parallele Playwright-Worker auf `srv1622293` | > 8 sustained | Zweiten VPS hinzufügen + Docker Compose |
| VPS-Anzahl im Worker-Pool | > 4 | K8s evaluieren (managed: Hetzner / OVH) |

**K8s nicht vor:** > 4 Worker-VPS UND dedizierter DevOps-Headcount eingestellt.

## 5. Review-Kadenz

Dieser ADR wird **monatlich** gegen die Metriken in `monitoring.daily_metrics`
reviewed. Bei Trigger-Hit wird ein Folge-ADR (`ADR-002-*`) erstellt, der den
konkreten Migrationsplan dokumentiert.

Letztes Review: 2026-05-18 (Initial)
Nächstes Review: 2026-06-18

## 6. References

- Externe Analyse 1: Event-Sourcing-nahe Governance, Supabase als Lean-Infra-Hebel
- Externe Analyse 2: Hyperscale-Stack (Kafka/Neo4j/K8s) als Vision-Architektur
- EU AI Act Annex III (Risk Classification)
- Supabase Realtime Documentation: postgres_changes, broadcast
- Apache AGE: github.com/apache/age

---

**Nächster Schritt für Dominik:** ADR lesen (5 min), Trigger-Schwellen gegen Bauchgefühl prüfen, dann diesen Branch in PR #331 mergen, sobald CI grün ist. Folge-PRs für die heute noch fehlenden Mess-Bausteine: `runtime_edges`-Tabelle, `monitoring.daily_metrics`-View, `tenant_active_30d`-Counter in `business_metrics`.
