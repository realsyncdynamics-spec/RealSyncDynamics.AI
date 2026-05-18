# ADR-001 — Event-Backbone: Supabase-Lean statt Hyperscale-Stack

**Status:** Accepted
**Date:** 2026-05-18
**Author:** Dominik Steiner (Solo-Founder, RealSync Dynamics)
**Related:** [`docs/adr/0001-stay-on-supabase-gh-pages-for-v1.md`](./0001-stay-on-supabase-gh-pages-for-v1.md) (Hosting-Entscheidung) · [`docs/adr/0003-governance-bus-postgres-outbox.md`](./0003-governance-bus-postgres-outbox.md) (Outbox-Mechanik im Detail)

> Diese ADR dokumentiert die Stack-Wahl für die **AI-Governance-Runtime** insgesamt — Event-Backbone, Graph-Layer, Tenant-Isolierung. ADR-0001 begründete *Hosting* (Supabase + GitHub Pages), ADR-0003 löste die *Outbox-vs-Topic*-Frage. ADR-001 macht die Migrations-Trigger numerisch verbindlich.

---

## Context

Zwei unabhängige externe Architektur-Reviews haben die Plattform als **„AI Governance Runtime mit Event-Feed + Evidence-Layer"** kategorisiert (nicht als DSGVO-Banner-Tool). Damit ist die Daten-Plane das Produkt — Events, Risiko-Bewertung, Drift, Policy-Gates, Evidence-Bundles. Jede Architektur-Entscheidung in der Daten-Plane ist deshalb produktkritisch.

Die naheliegende „Lehrbuch-Architektur" für eine Governance-Runtime wäre:

| Funktion | Lehrbuch-Stack |
|---|---|
| Event-Bus | Apache Kafka / Redpanda / NATS JetStream |
| Graph-Queries (Asset/Policy/Evidence-Beziehungen) | Neo4j / Apache AGE als dedizierter Cluster |
| Tenant-Isolation bei Hochskalierung | Schema-per-Tenant oder Database-per-Tenant |
| Worker-Orchestrierung | Kubernetes + Argo Workflows |
| Observability | Prometheus + Loki + Tempo |

**Ist-Stack heute (verifiziert gegen `package.json`, `supabase/`, `deploy/`):**

- **Frontend:** Vite 6 + React 19 + TypeScript + Tailwind 4 (SPA, GitHub-Pages-deployt)
- **Backend:** Supabase (Postgres + RLS + Edge Functions Deno + Storage), Region eu-central-1 (Frankfurt)
- **Event-Layer:** `runtime_events` (append-only), `ai_runtime_events`, `governance_events` — Postgres-Tabellen mit `pg_notify` für niedrigvolumigen Trigger-Fan-out (`supabase/migrations/20260507110000_audit_jobs_queue.sql`)
- **Worker:** `worker/` (Node-Prozess) + Edge-Function-Cron (`supabase/functions/*-cron`) + VPS `srv1622293` für Playwright-Browser-Fleet
- **Graph-Queries:** Heute reines relationales JOIN-Schema (keine `apache-age`-Extension installiert)
- **Tenant-Isolation:** Shared-Schema mit RLS via `public.is_tenant_member(uuid)`
- **Multi-Tenancy:** 1 Postgres, alle Tenants in denselben Tabellen, isoliert per RLS

Solo-Founder-Realität: 1 Person, GmbH pending, kein Ops-Team. Jede Komponente, die nicht zwingend nötig ist, ist ein Liability — nicht ein Asset.

---

## Decision

**Wir bleiben auf dem Supabase-Lean-Stack, bis ein quantitativer Migrations-Trigger feuert.**

Konkret:

1. **Event-Bus = Postgres-Outbox + LISTEN/NOTIFY**, nicht NATS/Kafka. Outbox-Mechanik gemäß [ADR-0003](./0003-governance-bus-postgres-outbox.md).
2. **Graph-Queries = relationales SQL** über `ai_systems` / `ai_policies` / `runtime_events` / `ai_evidence_events` mit gezielten Indices und Materialized Views. Keine separate Graph-DB, keine `apache-age`-Extension.
3. **Tenant-Isolation = Shared-Schema + RLS**, nicht Schema-per-Tenant. Cross-Tenant-Membership (Agency-Use-Case) wird durch `tenant_members(role)` abgebildet.
4. **Worker = Node-Prozess (`worker/`) + Edge-Function-Cron + 1 VPS** für Browser-Fleet, kein Kubernetes.
5. **Observability = Sentry + Supabase-Logs + selbst-gebauter `business-metrics-cron`**, kein Prometheus/Loki/Tempo.

Diese Entscheidung wird in 90 Tagen (2026-08-18) und danach quartalsweise gegen die unten genannten Trigger geprüft.

---

## Consequences

### Positiv

- **Wartungsaufwand für 1 Person leistbar:** Eine Datenbank, ein Hosting-Anbieter, ein Authentifizierungsmodell. Kein Cluster-Ops.
- **EU-Datenraum garantiert:** Supabase Frankfurt + Hostinger DACH-VPS — Sub-Processor-Liste bleibt einseitig.
- **Auditierbarkeit out-of-the-box:** `runtime_events` ist via `revoke update, delete` append-only (siehe `supabase/migrations/20260516300000_runtime_core.sql`). SHA-256-Hash-Kette auf `ai_evidence_events` (Trigger `tg_evidence_event_chain`) liefert die Evidence-Chain ohne externe Komponente.
- **RLS = einheitliches Auth-Modell:** Edge Functions, SPA-Direktzugriff und Worker nutzen dasselbe `is_tenant_member`-Prädikat. Keine Doppelimplementierung.
- **Compliance-Story einfach erzählbar:** „Alles in einer EU-Postgres-Instanz mit RLS" ist ein verständlicher Satz für DAX-Procurement; „Kafka-Cluster über drei AZs mit Schema-Registry" nicht.

### Negativ / Akzeptierte Risiken

- **Postgres-Throughput-Decke:** `pg_notify` skaliert nicht auf > 10⁴ Events/sec sustained. LISTEN-Clients sehen Latenz-Spikes bei großem Fan-out.
- **Relationaler Graph ist umständlich:** Mehrhop-Queries (z. B. „welche Policies blocken welche AI-Systeme, deren Evidence-Hash in den letzten 7 Tagen wechselte") werden mit Tiefe stetig teurer.
- **Single-DB-Failure-Domain:** Ein langer Postgres-Lock kann gleichzeitig SPA, Edge Functions und Worker treffen.
- **Noisy-Neighbor bei großen Tenants:** Shared-Schema mit RLS bedeutet, dass ein Enterprise-Tenant mit 10⁷ Events Query-Pläne für alle Tenants beeinflussen kann.

Diese Risiken sind **bewusst akzeptiert**, weil die Migrations-Trigger unten sie quantifizieren und auslösen, *bevor* sie produktionsrelevant werden.

---

## Migration Triggers

Jeder Trigger besteht aus: **Metrik · Schwellwert · Messquelle · Auslöse-Aktion**. Schwellwert gilt als gerissen, wenn er **14 Kalendertage in Folge** überschritten wird (Schutz gegen Lastspitzen).

### Trigger A — Event-Bus: Postgres-Outbox + LISTEN/NOTIFY → NATS JetStream

| Item | Wert |
|---|---|
| **Metrik 1** | Sustained Insert-Rate in `runtime_events` + `ai_runtime_events` + `governance_events`, gemessen als 1-Minuten-Mittelwert über die letzten 14 Tage |
| **Schwellwert 1** | **> 500 Events/sec** (entspricht **~43 Mio Events/Tag**) |
| **Metrik 2** | p95-Latenz zwischen `INSERT INTO runtime_events` und Delivery an Subscriber (Edge Function / Worker) |
| **Schwellwert 2** | **> 2.000 ms** über 14 Tage |
| **Metrik 3** | Anzahl `pg_notify`-Slow-Consumer-Drops pro 24h (sichtbar in Supabase-Logs) |
| **Schwellwert 3** | **> 50 Drops/Tag** |
| **Messquelle** | `business_metrics`-Tabelle, ergänzt durch neue View `event_backbone_health` (siehe Folge-PR) |
| **Auslöse-Aktion** | Migration auf NATS JetStream als Transport-Layer. Subscriber-Code unverändert (Outbox bleibt SoT, NATS ist nur Fan-out). Migration laut ADR-0003 §Migration-Path. |

**Begründung der Zahlen:** Supabase Postgres (db.m5.large-Klasse) liefert ~1.000–2.000 INSERTs/sec auf gut indizierte Tabellen. 500 events/sec lässt 2× Headroom für Spitzen. 43 Mio Events/Tag korrespondieren mit ~10.000 aktiven Domains × 100 Tracker-Loads/Tag × 43 Events/Load — also DACH-Marktposition mit ~10k zahlenden Customer-Sites.

### Trigger B — Graph-Queries: Relationales SQL → Apache AGE (in-DB) oder Neo4j

| Item | Wert |
|---|---|
| **Metrik 1** | p95-Latenz der drei kritischen Governance-Graph-Queries: (i) Asset → Policy → Violation in 7d, (ii) Evidence-Chain-Tip-Traversal pro Tenant, (iii) Drift-Cascade across AI-Systems |
| **Schwellwert 1** | **> 800 ms p95** bei Result-Sets mit > 1.000 Knoten |
| **Metrik 2** | Anzahl Joins in den heißesten 5 Governance-Queries (statisch gemessen) |
| **Schwellwert 2** | **> 6 Joins** in einer Query, die häufiger als 100×/Stunde ausgeführt wird |
| **Messquelle** | `pg_stat_statements` + neuer Cron-Job `governance-query-profile-cron` (Folge-PR) |
| **Auslöse-Aktion** | **Stufe 1:** `CREATE EXTENSION age` in derselben Supabase-Instanz, Migration der drei Hot-Queries auf Cypher-via-AGE. **Stufe 2 (nur falls AGE-Latenz ebenfalls > 800ms):** Neo4j-Aura in Frankfurt, async-Replikation aus Postgres-Outbox |

**Begründung der Zahlen:** 800ms p95 ist die Wahrnehmungsgrenze für „interaktiv langsam" in einem Governance-Dashboard. 6 Joins ist die Schwelle, bei der EXPLAIN-Pläne in Supabase-Postgres typischerweise auf Hash-Join+Materialize umschalten und die Cache-Lokalität verlieren.

### Trigger C — Tenant-Isolation: Shared-Schema + RLS → Schema-per-Tenant

| Item | Wert |
|---|---|
| **Metrik 1** | Anzahl aktive Tenants (≥ 1 Event in den letzten 30 Tagen) |
| **Schwellwert 1** | **> 500 aktive Tenants** |
| **Metrik 2** | p95-Latenz von `is_tenant_member()`-RLS-Check unter Concurrent-Load |
| **Schwellwert 2** | **> 50 ms p95** auf den drei größten Tabellen (`runtime_events`, `ai_runtime_events`, `ai_evidence_events`) |
| **Metrik 3** | Datenvolumen des größten Einzel-Tenant |
| **Schwellwert 3** | **> 50 GB** in `runtime_events` + `ai_runtime_events` |
| **Messquelle** | `business_metrics`-Tabelle (`tenant_active_30d`-Counter) + `pg_stat_user_tables` |
| **Auslöse-Aktion** | Migration der Top-20-Enterprise-Tenants auf eigene Schemas (`tenant_<uuid>.runtime_events`). Long-Tail bleibt im Shared-Schema. RLS-Helper wird zu Schema-Resolver erweitert. Migration läuft tenantweise mit Online-Backfill (logical replication slot). |

**Begründung der Zahlen:** 500 aktive Tenants × ~5 Mio Events/Tenant/Jahr = ~2,5 Mrd Events in einer Tabelle — der Punkt, an dem partial Indices und Partitionierung an Wirkung verlieren. 50ms p95 für einen RLS-Check ist die Schwelle, ab der zusammengesetzte Queries (mehrere RLS-geschützte Joins) > 200ms überschreiten. 50 GB pro Tenant entspricht der Größe, ab der Tenant-isolierte Backup-/Wartungs-Fenster operativ verlangt werden.

---

## Nicht-Trigger (bewusst kein Migrationsgrund)

- **„Externer Sales-Investor fragt nach Kafka in der Architektur"** — Trigger ist Last, nicht Optik. Antwort: ADR-001 zeigen.
- **„Konkurrent X nutzt Neo4j"** — Konkurrent-Stack ist kein Migrations-Argument. Wettbewerbsvorteil entsteht aus Geschwindigkeit, nicht Lehrbuch-Architektur.
- **„Wir könnten irgendwann mehr Tenants haben"** — Hypothetik ist kein Trigger. Erst messen.

---

## Re-Evaluierung

- **Erste Re-Evaluierung:** 2026-08-18 (90 Tage nach Accept).
- **Danach:** quartalsweise (mit Quarterly-Review-Doku in `docs/runbooks/`).
- **Außer-der-Reihe:** sofort, wenn ein Schwellwert > 70 % erreicht ist (Frühwarnung).

---

**Nächster Schritt für Dominik:** ADR review (5 min lesen, Trigger-Zahlen gegen Bauchgefühl prüfen), dann `git checkout claude/review-project-status-umBWS` und PR mergen, sobald CI grün ist.
