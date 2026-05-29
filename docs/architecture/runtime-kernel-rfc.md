# RFC: Operational Governance Kernel v0

**Status:** Proposed
**Owner:** Governance Runtime
**Created:** 2026-05-21
**Companion to:** [`runtime-event-standard.md`](./runtime-event-standard.md), [`evidence-graph-rfc.md`](./evidence-graph-rfc.md), [`evidence-bundle-builder.md`](./evidence-bundle-builder.md), [`runtime-event-shadow-validation-rfc.md`](./runtime-event-shadow-validation-rfc.md)
**Scope:** Documentation only — kein Code, keine Migrations-Datei, kein DB-Eingriff. Schema-Diffs und Code-Stubs sind Drafts. Implementation folgt in separaten PRs.

---

## 0. Architekturrichtung (verbindlich)

Wir bauen **nicht** „ein DSGVO-Tool". Wir bauen:

> **event-governed governance runtime infrastructure**

Bedeutet konkret — diese Eigenschaften haben Priorität:

- deterministische Event-Chains
- replayability
- governance telemetry
- economic telemetry
- evidence lineage
- runtime observability

**Nicht priorisiert** bis dieser Kernel steht: neue UI-Animationen, Dashboard-Polish, Landingpages.

---

## 1. Status quo

Bereits auf main:

| Surface | Form | Lücke ggü. Kernel-Spec |
|---|---|---|
| `public.runtime_events` (`20260516300000_runtime_core.sql`) | 8 Spalten: id, tenant_id, execution_id, agent_id, skill_id, name, payload, occurred_at | kein event_tier, kein subject_ref, kein trace/correlation/causation, kein cost_snapshot, kein retention_class, kein replayable-Flag |
| `public.ai_runtime_events` (`20260510_ai_governance_core.sql`) | KI-spezifisch (vendor, risk_level, data_class) | Parallele Tabelle — wird nicht als kanonischer Event-Kernel betrachtet |
| `RuntimeEvent` Type (`src/types/runtime-event.ts`) | TypeScript-Envelope v0 mit spec_version, 18 event types, 8 sources | Browser-Side only. DB-Schema deckt das nicht ab. |
| `_shared/governanceEvent.ts` | Edge-Function-Schema, **frozen** | breaking change verboten ohne Schema-Bridge-ADR |
| `runtime_executions` + `runtime_approval_gates` | Skill-Execution-Tracking | OK, bleibt — wird Cost-Snapshot-Quelle für `runtime_events.cost_snapshot_json` |

**Kein** `tenant_cost_ledger`, kein Replay-Mode, keine Memory-Decay-Tabellen — alles zu bauen.

---

## P0 — `runtime_events` Foundation

### P0.1 Schema-Erweiterung (additive Migration)

Statt eine **neue** Tabelle anzulegen, erweitert die nächste Migration die bestehende `public.runtime_events` **additiv**. Bestehende Reader brechen nicht.

**Draft-Migration:** `supabase/migrations/{TIMESTAMP}_runtime_events_kernel_v1.sql`

```sql
-- Phase 1: extend runtime_events to the Kernel-v1 envelope.
-- Additive. No drop, no rename. Existing rows get NULL for new columns
-- (acceptable — they predate the kernel-v1 contract).

alter table public.runtime_events
  add column if not exists event_type        text,
  add column if not exists event_tier        text,
  add column if not exists subject_ref       text,
  add column if not exists agent_ref         text,
  add column if not exists trace_id          uuid,
  add column if not exists correlation_id    uuid,
  add column if not exists causation_id      uuid,
  add column if not exists cost_snapshot_json jsonb,
  add column if not exists retention_class   text,
  add column if not exists replayable        boolean not null default true,
  add column if not exists spec_version      text not null default '0.1';

-- event_tier constraint — T0..T3 wie in §P0.2 definiert.
alter table public.runtime_events
  drop constraint if exists runtime_events_event_tier_check;
alter table public.runtime_events
  add constraint runtime_events_event_tier_check
  check (event_tier is null or event_tier in ('T0','T1','T2','T3'));

-- retention_class constraint — siehe §P0.4
alter table public.runtime_events
  drop constraint if exists runtime_events_retention_class_check;
alter table public.runtime_events
  add constraint runtime_events_retention_class_check
  check (retention_class is null or retention_class in
    ('forever','7y','3y','1y','90d','30d','7d','ephemeral'));

create index if not exists runtime_events_trace_idx
  on public.runtime_events (trace_id)
  where trace_id is not null;

create index if not exists runtime_events_correlation_idx
  on public.runtime_events (correlation_id)
  where correlation_id is not null;

create index if not exists runtime_events_tier_idx
  on public.runtime_events (tenant_id, event_tier, occurred_at desc);

-- T0/T1 sind retention-pflichtig — wir indexieren explizit für Export/Replay.
create index if not exists runtime_events_replayable_idx
  on public.runtime_events (tenant_id, occurred_at desc)
  where replayable = true and event_tier in ('T0','T1');

comment on column public.runtime_events.event_tier is
  'T0=audit-critical, T1=replay-relevant, T2=operational, T3=ephemeral. See runtime-kernel-rfc.md §P0.2.';

comment on column public.runtime_events.replayable is
  'If false: event is informational only and MUST NOT be replayed (idempotency violation).';
```

### P0.2 Event-Tier-Taxonomie

| Tier | Bedeutung | Persistierung | Replayable | Retention default |
|---|---|---|---|---|
| **T0** — audit-critical | Beweis-relevante Governance-Entscheidung. `policy.violation_detected`, `evidence.created`, `consent.banner_detected`, `incident.opened/closed`, AI-Risk-Klassifikation | Pflicht, append-only, hash-chained | ja | `7y` (DSGVO Aufbewahrungspflicht) |
| **T1** — replay-relevant | Operations, die für Drift-Detection / Bundle-Build nachvollziehbar sein müssen. `scan.started/completed/failed`, `tracker.*`, `vendor.*`, `ai.endpoint_found`, `remediation.suggested` | Pflicht | ja | `3y` |
| **T2** — operational | Service-Health, Latenzen, Cache-Hits, Retry-Counter. Lokale Aussagekraft, nicht beweis-relevant | optional, sample-bar | nein (`replayable=false`) | `90d` |
| **T3** — ephemeral/debug | WebSocket-Reconnects, Trace-Spans, Debug-Logs unter Feature-Flag | nur unter Debug-Flag in DB, sonst Edge-Function-Logs | nein | `7d` oder `ephemeral` |

**Hard-Regel:** Ein Event darf **niemals** ohne `event_tier` in `runtime_events` landen. CI-Test prüft per `NOT NULL` ab Phase 2 (siehe Rollout §6).

### P0.3 Governance vs. Operational — saubere Trennung

| Kategorie | Beispiele | Tier | `payload_json` |
|---|---|---|---|
| **Governance** | risk classification, consent change, evidence generated, policy execution, remediation accepted | T0 oder T1 | strukturiert, schema-validiert (Shadow Validation Phase 2 → strict Phase 3) |
| **Operational** | retries, websocket reconnects, cache misses, internal latency, queue depth | T2 oder T3 | frei, kein Schema-Vertrag |

**Read-Pfade trennen sich an `event_tier`:**

```ts
// Beispiel-Query Governance-Audit
.from('runtime_events').select('*').eq('tenant_id', t).in('event_tier', ['T0','T1']).order('occurred_at', { ascending: true })

// Beispiel-Query Operational-Dashboard
.from('runtime_events').select('id, name, payload, occurred_at').eq('tenant_id', t).eq('event_tier', 'T2').order('occurred_at', { ascending: false }).limit(100)
```

### P0.4 Retention-Classes

| `retention_class` | Lebensdauer | Auto-Pruge | Use-Case |
|---|---|---|---|
| `forever` | unendlich | nein | nur für Evidence-Vault-Anchor-Roots |
| `7y` | 7 Jahre | quartalsweise Cron | DSGVO-Standard T0 |
| `3y` | 3 Jahre | quartalsweise Cron | T1, Drift-Baseline |
| `1y` | 1 Jahr | monatlich | Operations-History |
| `90d` | 90 Tage | wöchentlich | T2 default |
| `30d` | 30 Tage | täglich | Validation-Misses (siehe Shadow-RFC) |
| `7d` | 7 Tage | täglich | T3 Debug |
| `ephemeral` | wird nicht persistiert | n/a | nur via Edge-Function-Log |

**Migrations-Cron-Stub** (separater PR):

```sql
-- Pseudo-cron — Implementation in supabase/functions/runtime-prune/index.ts
delete from public.runtime_events
where retention_class = '90d' and occurred_at < now() - interval '90 days';
-- ... analog für 30d / 7d
```

### P0.5 Trace-/Correlation-/Causation-Modell

```text
trace_id        — End-to-end-Trace (alle Events eines User-Flows oder Agent-Runs)
correlation_id  — Per-Operation (z. B. ein Scan-Run hat eine correlation_id, alle scan.* + evidence.* mit dieser ID)
causation_id    — Vorgänger-Event (welches Event hat dieses ausgelöst). Bildet DAG.
```

**Erwartung:**
- `trace_id` ist global eindeutig pro User/Agent-Flow, kann viele `correlation_id`s enthalten.
- `correlation_id` ist eindeutig pro logischer Operation.
- `causation_id` zeigt auf `runtime_events.id` (das auslösende Event) — erlaubt Walk-Back wie im Evidence-Graph (`triggered_by`).

**Beispiel-Chain:**

```text
User klickt "Scan starten"
  → scan.started (trace=A, corr=B, causation=null)
    → tracker.pre_consent_detected (trace=A, corr=B, causation=scan.started.id)
    → consent.banner_detected (trace=A, corr=B, causation=scan.started.id)
  → scan.completed (trace=A, corr=B, causation=scan.started.id)
  → evidence.created (trace=A, corr=C [neue Operation], causation=scan.completed.id)
  → incident.opened (trace=A, corr=D, causation=evidence.created.id)
```

---

## P1 — Replay Isolation

### P1.1 Problem

Replay darf **niemals**:
- neue Kosten erzeugen (LLM-Inferenz, Storage)
- Notifications triggern (E-Mail, Slack, Webhook)
- externe APIs mutieren (Stripe, Anthropic, Resend)
- neue Governance-Decisions persistieren

Standard-Implementierung würde alle Side-Effects mit Replay-Events erneut auslösen. Wir brauchen einen expliziten Mode.

### P1.2 Shadow Replay Mode — Architektur

```ts
// src/core/runtime/replay-mode.ts (planned)
export type ReplayMode = 'live' | 'shadow';

export interface ReplayContext {
  mode: ReplayMode;
  /** Trace-ID, gegen die ge-replayt wird. */
  trace_id: string;
  /** Wenn shadow: Side-Effects werden in einen Mock-Sink geschrieben. */
  side_effect_sink: SideEffectSink;
  /** Wenn shadow: Cost-Counter zählt simulierte Kosten, schreibt aber nichts ins Ledger. */
  cost_counter: { input_tokens: number; output_tokens: number; usd: number };
}

// Jeder Side-Effect-Handler (sendEmail, callAnthropic, writeEvidence)
// MUSS den ReplayContext lesen und auf shadow=true:
//   - sendEmail → no-op + log to sink
//   - callAnthropic → Mock-Response aus dem Original-Event-Payload (kein API-Call)
//   - writeEvidence → no-op + diff-Log
//   - writeRuntimeEvent → write to shadow_runtime_events table, NICHT zu runtime_events
```

### P1.3 Guards (Hard-Constraints im Code)

| Guard | Wo erzwungen | Verletzung |
|---|---|---|
| **No DB write in shadow** | Wrapper um alle Supabase-Inserts: `if (ctx.mode === 'shadow') return; ` | `throw new ReplayIsolationError('write attempted in shadow mode')` |
| **No external HTTP in shadow** | `fetch()`-Wrapper in `_shared/replay-guarded-fetch.ts` | dito |
| **No cost in tenant_cost_ledger** | Cost-Writer prüft `ctx.mode`, schreibt nur bei `live` | dito |
| **`replayable=false`-Events** | Replay-Engine skipped solche Events vollständig (kein Re-Execution-Versuch) | log + skip |
| **Replay-Output landet in eigener Tabelle** | `shadow_runtime_events` (siehe §P1.4) | RLS verhindert Vermischung |

### P1.4 Schema — `shadow_runtime_events`

```sql
create table if not exists public.shadow_runtime_events (
  id              bigserial primary key,
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  original_id     bigint references public.runtime_events(id) on delete cascade,
  -- mirror of runtime_events kernel-v1 envelope:
  event_type      text,
  event_tier      text,
  subject_ref     text,
  agent_ref       text,
  trace_id        uuid,
  correlation_id  uuid,
  causation_id    uuid,
  payload         jsonb not null default '{}'::jsonb,
  cost_snapshot_json jsonb,
  -- replay metadata:
  replay_run_id   uuid not null,
  replayed_at     timestamptz not null default now(),
  diff_vs_original jsonb  -- {payload_changed, cost_delta, side_effects_skipped[]}
);

create index if not exists shadow_runtime_events_run_idx
  on public.shadow_runtime_events (replay_run_id);
create index if not exists shadow_runtime_events_original_idx
  on public.shadow_runtime_events (original_id);

alter table public.shadow_runtime_events enable row level security;
-- Default-deny — nur service-role darf schreiben/lesen.
drop policy if exists "shadow_runtime_events service-role only" on public.shadow_runtime_events;
create policy "shadow_runtime_events service-role only"
  on public.shadow_runtime_events for all using (false) with check (false);
```

### P1.5 Replay-Run-API

```ts
// src/core/runtime/replay.ts (planned)
export async function shadowReplay(opts: {
  trace_id: string;
  tenant_id: string;
  through_event_id?: bigint;  // replay nur bis hier
}): Promise<ShadowReplayResult> {
  const ctx: ReplayContext = {
    mode: 'shadow',
    trace_id: opts.trace_id,
    side_effect_sink: new InMemorySideEffectSink(),
    cost_counter: { input_tokens: 0, output_tokens: 0, usd: 0 },
  };
  // 1. Load original events for trace_id, occurred_at order
  // 2. For each: dispatch handler with ctx (handler reads ctx.mode)
  // 3. Collect diffs, write to shadow_runtime_events
  // 4. Return { events_replayed, diffs, simulated_cost_usd, side_effects_skipped }
}
```

---

## P2 — `subject_ref` Lifecycle Hardening

### P2.1 Status quo

Subject-Referenzen sind aktuell **nicht** durchgängig HMAC-gehasht. In Edge-Functions vereinzelt (`sha256Hex(ip)` für Anon-Rate-Limit), aber kein zentraler Helper, keine Key-Rotation, keine Lifecycle-Semantik.

### P2.2 Schema — `subject_ref_keys` + `subject_ref_mappings`

```sql
-- Aktive HMAC-Keys pro Tenant. Rotation = neuer Eintrag, alter bleibt
-- für Backward-Verify-Pfad.
create table if not exists public.subject_ref_keys (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  key_version     int  not null,                       -- monoton steigend pro Tenant
  algorithm       text not null default 'HMAC-SHA-256',
  -- Key-Material liegt im Supabase Vault (get_app_secret), nicht hier.
  vault_secret_name text not null,
  status          text not null
                    check (status in ('active','rotating','retired')),
  activated_at    timestamptz not null default now(),
  retired_at      timestamptz,
  unique (tenant_id, key_version)
);

create index if not exists subject_ref_keys_active_idx
  on public.subject_ref_keys (tenant_id, status, key_version desc);

-- Optional: explizites Mapping subject_ref → subject-Klartext (verschlüsselt),
-- nur für DSGVO-Auskunfts-/Löschanfragen. NICHT für Runtime.
create table if not exists public.subject_ref_mappings (
  subject_ref     text primary key,                    -- der HMAC-Output
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  key_version     int  not null,
  subject_kind    text not null,                       -- 'email' | 'ip' | 'user_id' | 'session'
  encrypted_value bytea,                               -- pgsodium / pg_extension - der Klartext, verschluesselt
  created_at      timestamptz not null default now(),
  retention_class text not null default '3y',
  deletion_requested_at timestamptz,
  deleted_at      timestamptz
);

alter table public.subject_ref_keys     enable row level security;
alter table public.subject_ref_mappings enable row level security;
drop policy if exists "subject_ref_keys service-role only" on public.subject_ref_keys;
create policy "subject_ref_keys service-role only"
  on public.subject_ref_keys for all using (false) with check (false);
drop policy if exists "subject_ref_mappings service-role only" on public.subject_ref_mappings;
create policy "subject_ref_mappings service-role only"
  on public.subject_ref_mappings for all using (false) with check (false);
```

### P2.3 Lifecycle-States

| State | Bedeutung | Reads | Writes |
|---|---|---|---|
| `active` | Aktueller Key. Neue HMAC-Berechnungen nutzen diesen | ja | ja |
| `rotating` | Neuer Key ist `active`, alter `rotating` für Backward-Verify | ja | nein |
| `retired` | Key zurückgezogen. `subject_ref`s mit diesem Key sind technisch noch verifizierbar, aber nicht mehr neu schreibbar | nur via Audit-Endpoint | nein |

### P2.4 Key-Rotation-Procedure

1. Cron oder manueller Trigger: `rotate_subject_ref_key(tenant_id)`.
2. Neuer Eintrag in `subject_ref_keys` mit `key_version+1`, `status='active'`.
3. Alter Eintrag wechselt zu `status='rotating'`.
4. Nach Dual-Read-Window (z. B. 30 Tage): alter Eintrag → `status='retired'`.
5. Optional: subject_ref-Migration (re-HMAC) für kritische Datensätze — separate Operation.

### P2.5 Deletion-Semantik (DSGVO Art. 17)

| Anfrage | Aktion |
|---|---|
| User fordert Löschung seiner Daten | 1. `subject_ref_mappings.deletion_requested_at = now()` setzen. 2. Encrypted-Value-Spalte NULLen. 3. `subject_ref` selbst bleibt in `runtime_events.subject_ref` (für Audit-Trail-Konsistenz), wird aber nicht mehr deanonymisierbar. |
| Tenant löscht (Tenant-Delete) | Cascade via FK auf `subject_ref_keys` + `subject_ref_mappings`. `runtime_events`-Zeilen bleiben tenant-cascade-gelöscht. |
| Retention-Cron läuft | für jeden `runtime_events`-Eintrag mit `retention_class < ablauf`: löschen. Mapping bleibt unabhängig. |

### P2.6 Export-Verhalten

`runtime_events`-Exports (Bundle-Builder, Audit-Pakete) enthalten **`subject_ref` immer**, **`encrypted_value` niemals**. Wer den Klartext braucht, muss separat über die DSR-API (DSGVO-Art-15-Pfad) gehen, RBAC-geschützt.

---

## P3 — Governance Memory Decay

### P3.1 Problem

Agent-Memory (Konversations-History, Tool-Outputs, Klassifikationen) wächst linear. Ohne Decay:
- Memory-Inflation → höhere LLM-Kosten pro Turn (Token-Multiplikator)
- Hallucination-Carryover (alte falsche Klassifikationen werden re-zitiert)
- Compliance-Last (alte irrelevante PII liegt herum)
- Kostenexplosion bei Multi-Tenant-Skala

### P3.2 Memory-State-Machine

```text
┌────────────┐  freshness < 0.5    ┌──────────┐
│   active   │ ──────────────────▶ │ cooling  │
│ (in-prompt)│                     │(LRU-evict)│
└────────────┘                     └──────────┘
                                         │
                                         │ relevance < 0.2
                                         ▼
                                   ┌────────────┐
                                   │  archived  │  (out-of-prompt, on-demand load)
                                   └────────────┘
                                         │
                                         │ retention reached
                                         ▼
                                   ┌────────────┐
                                   │  expired   │ (read-only marker)
                                   └────────────┘
                                         │
                                         │ purge-cron
                                         ▼
                                   ┌────────────┐
                                   │  purged    │ (row deleted; subject_ref bleibt im event-log)
                                   └────────────┘
```

### P3.3 Schema-Erweiterung `agent_memory`

```sql
-- Existiert vermutlich bereits in irgendeiner Form (memory.ts referenziert).
-- Wenn nicht: full create. Wenn ja: alter add.
alter table public.agent_memory
  add column if not exists state             text not null default 'active'
                                              check (state in ('active','cooling','archived','expired','purged')),
  add column if not exists relevance_score   numeric(4,3)  -- 0.000 .. 1.000
                                              check (relevance_score is null or (relevance_score >= 0 and relevance_score <= 1)),
  add column if not exists confidence_score  numeric(4,3)
                                              check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)),
  add column if not exists freshness_score   numeric(4,3)
                                              check (freshness_score is null or (freshness_score >= 0 and freshness_score <= 1)),
  add column if not exists compliance_weight numeric(4,3)
                                              check (compliance_weight is null or (compliance_weight >= 0 and compliance_weight <= 1)),
  add column if not exists state_transitioned_at timestamptz;

create index if not exists agent_memory_state_idx
  on public.agent_memory (tenant_id, state, state_transitioned_at desc);
```

### P3.4 Score-Definitionen

| Score | Berechnung (Vorschlag) | Range |
|---|---|---|
| `relevance_score` | Cosine-Similarity zum aktuellen Topic ODER Domain-Klassifikator-Output | 0..1 |
| `confidence_score` | LLM-self-rated oder Heuristik aus tool-call success-rate | 0..1 |
| `freshness_score` | `exp(-age_days / half_life_days)` mit half_life_days=14 | 0..1 |
| `compliance_weight` | Manuell oder per Regel: PII-Memory bekommt höheren weight → härter purgen | 0..1 |

### P3.5 Decay-Cron

```ts
// supabase/functions/memory-decay/index.ts (planned)
async function applyDecay(tenant_id: string): Promise<void> {
  // 1. active → cooling, wenn freshness < 0.5
  // 2. cooling → archived, wenn relevance < 0.2
  // 3. archived → expired, wenn age > retention_class
  // 4. expired → purged (DELETE), nach Grace-Window 7d
  // 5. compliance_weight ≥ 0.8 (PII) → schneller archivieren (× 0.5 Faktor)
}
```

**Hard-Caps:**

| Limit | Wert | Aktion bei Überschreitung |
|---|---|---|
| Memory-Rows pro Tenant | 50.000 | LRU-evict ältester `active`-Eintrag |
| Memory-Bytes pro Konversation | 100.000 | Prompt-Truncation + warn-event |
| Konsekutive cooling-States | 30 Tage | force-archive |

---

## P4 — Economic Telemetry (`tenant_cost_ledger`)

### P4.1 Was es NICHT ist

**Nicht** Stripe-Billing. **Nicht** Invoice-Generation. **Nicht** öffentliches Cost-Dashboard.

Es ist: **runtime-financial observability** — interne Sicht darauf wer was kostet, attribuiert pro Agent / Flow / Tenant.

### P4.2 Schema — `tenant_cost_ledger`

```sql
create table if not exists public.tenant_cost_ledger (
  id              bigserial primary key,
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  occurred_at     timestamptz not null default now(),
  -- Attribution
  agent_ref       text,                    -- which agent caused the cost
  flow_ref        text,                    -- z. B. 'scan.run' / 'evidence.bundle.export'
  trace_id        uuid,                    -- joinbar zu runtime_events.trace_id
  correlation_id  uuid,
  -- Cost-Dimension
  cost_kind       text not null
                    check (cost_kind in (
                      'llm_input', 'llm_output', 'storage_gb_hour',
                      'edge_invocation', 'webhook_egress', 'replay_simulation'
                    )),
  units           numeric(18,6) not null,  -- tokens, GB-hours, request-count
  unit_price_usd  numeric(12,8) not null,  -- snapshot zum Zeitpunkt
  amount_usd      numeric(14,6) not null generated always as (units * unit_price_usd) stored,
  vendor          text,                    -- 'anthropic' | 'openai' | 'supabase' | 'self'
  model_ref       text,                    -- 'claude-opus-4-7' usw.
  -- Replay-Guard
  is_simulated    boolean not null default false,
  replay_run_id   uuid,                    -- gesetzt iff is_simulated=true
  raw_metadata    jsonb default '{}'::jsonb
);

create index if not exists tenant_cost_ledger_tenant_time_idx
  on public.tenant_cost_ledger (tenant_id, occurred_at desc);
create index if not exists tenant_cost_ledger_trace_idx
  on public.tenant_cost_ledger (trace_id) where trace_id is not null;
create index if not exists tenant_cost_ledger_agent_idx
  on public.tenant_cost_ledger (tenant_id, agent_ref, occurred_at desc);
create index if not exists tenant_cost_ledger_simulated_idx
  on public.tenant_cost_ledger (replay_run_id) where is_simulated = true;

alter table public.tenant_cost_ledger enable row level security;
-- Tenant-Read-only, Service-Role-Write
drop policy if exists "tenant_cost_ledger tenant-read" on public.tenant_cost_ledger;
create policy "tenant_cost_ledger tenant-read"
  on public.tenant_cost_ledger for select
  using (public.is_tenant_member(tenant_id));
drop policy if exists "tenant_cost_ledger service-role-write" on public.tenant_cost_ledger;
create policy "tenant_cost_ledger service-role-write"
  on public.tenant_cost_ledger for insert with check (false);
-- service-role bypasses RLS, andere Rollen blockiert
```

### P4.3 Hard-Caps (Cost-Stops)

Pro Tenant, monatlich rollend:

| Limit | Default | Aktion bei Überschreitung |
|---|---|---|
| LLM-Tokens (Input+Output) | 5.000.000 | neue LLM-Calls reject mit `429 COST_LIMIT_EXCEEDED` |
| Replay-Simulationen | 100 / Monat | reject mit `429 REPLAY_LIMIT_EXCEEDED` |
| Storage GB-Hours | 1.000 | warn + dashboard-alert |
| Edge-Invocations | 1.000.000 | warn |

Hardcaps liegen in einer separaten Tabelle `tenant_cost_limits` (Schema-Draft optional, in eigenem RFC) — diese RFC definiert nur das Konzept.

### P4.4 Cost-Snapshot in `runtime_events`

Jedes T0/T1-Event, das Kosten verursacht, schreibt einen `cost_snapshot_json` in das Event und parallel eine Zeile in `tenant_cost_ledger`. Das doppelte Schreiben ist gewollt:

- Event-Snapshot: für Replay-Diff (was hat das Original gekostet?)
- Ledger-Zeile: für Aggregations-Queries und Cap-Enforcement

Beispiel-Snapshot:

```json
{
  "model_ref": "claude-opus-4-7",
  "input_tokens": 1240,
  "output_tokens": 312,
  "input_usd": 0.0186,
  "output_usd": 0.0234,
  "total_usd": 0.0420
}
```

### P4.5 Replay-Isolation × Cost

| Mode | `is_simulated` | Schreibt in `tenant_cost_ledger`? | Schreibt `cost_snapshot_json` in event? |
|---|---|---|---|
| `live` | `false` | ja | ja |
| `shadow` | `true` (mit `replay_run_id`) | ja, aber `is_simulated=true` → NICHT in Cap-Aggregaten | nein (in `shadow_runtime_events.cost_snapshot_json`) |

Damit zählt Replay nicht in die Quote, ist aber für Cost-Analyse-Vergleiche separat aggregierbar.

---

## 5. Sicherheitsgrenzen (cross-cutting)

| Grenze | Wie erzwungen |
|---|---|
| Kein Plain-Text-`subject` in `runtime_events` | Pre-Insert-Hook im `governance-event` Edge-Function-Handler, wirft bei Klartext-E-Mail-Pattern |
| Kein Cross-Tenant-Event-Insert | RLS + Server-Side `auth.uid()` → Tenant-Membership-Check |
| Kein `replayable=true` für T2/T3 | DB-Trigger validiert: `if event_tier in ('T2','T3') and replayable = true: error` |
| Kein Cost-Ledger-Insert ohne `trace_id` für T0/T1-Cost | App-Layer-Enforcement im Cost-Writer |
| Kein Replay ohne explizites `shadow_replay`-Privileg | RPC `start_shadow_replay(trace_id)` mit `SECURITY DEFINER` und Membership-Check |
| Kein `subject_ref_mappings.encrypted_value` Read ohne DSR-Endpoint | RLS deny-by-default, separater `dsr-export` Edge-Function-Pfad |

---

## 6. Rollout-Phasen

| Phase | Was | PR-Größe | Voraussetzung |
|---|---|---|---|
| **P0-impl-1** | `runtime_events` Schema-Erweiterung (Migration §P0.1) + Tier-Constraint | M | RFC accepted |
| **P0-impl-2** | TypeScript-Envelope-Update in `src/types/runtime-event.ts`: `event_tier`, `subject_ref`, `trace_id`, `correlation_id`, `causation_id`, `cost_snapshot`, `retention_class`, `replayable` als optional Fields → in v0.2 spec_version-Bump | M | impl-1 merged |
| **P0-impl-3** | Edge-Function-`governance-event` Insert-Logik: setzt `event_tier` zwingend, validiert gegen Tier-Whitelist | M | impl-2 |
| **P1-impl-1** | `shadow_runtime_events` Schema + RLS | S | P0-impl-1 |
| **P1-impl-2** | `ReplayContext` + Guarded-Fetch + Side-Effect-Sink in `src/core/runtime/` | L | P1-impl-1 |
| **P1-impl-3** | `shadowReplay()` API + RPC | M | P1-impl-2 |
| **P2-impl-1** | `subject_ref_keys` + `subject_ref_mappings` Schema | S | P0-impl-1 |
| **P2-impl-2** | HMAC-Helper `_shared/subject-ref.ts` mit Key-Lookup + Rotation-Aware | M | P2-impl-1 |
| **P2-impl-3** | DSR-Export Edge-Function (RBAC-geschützt) | M | P2-impl-2 |
| **P3-impl-1** | `agent_memory` State-Spalten + Indexe | S | P0-impl-1 |
| **P3-impl-2** | Score-Computation-Cron | M | P3-impl-1 |
| **P3-impl-3** | Decay-Cron + Hard-Caps | M | P3-impl-2 |
| **P4-impl-1** | `tenant_cost_ledger` Schema + RLS | S | — |
| **P4-impl-2** | Cost-Writer in LLM-Provider-Wrappern | M | P4-impl-1 |
| **P4-impl-3** | Cap-Enforcement-Middleware vor Edge-Function-Inferenz-Calls | M | P4-impl-2 |

**Order-Empfehlung:**

1. P0-impl-1 (Foundation, ~30 Zeilen SQL, additive)
2. P4-impl-1 (Cost-Ledger Schema — parallel möglich)
3. P2-impl-1 (subject_ref Schema)
4. P0-impl-2 + P0-impl-3 (Type + Writer Tier-Disziplin)
5. P1-impl-1 + P1-impl-2 (Replay-Guards — sobald Replay-Bedarf entsteht)
6. P3-impl-1 ... (Memory-Decay — sobald `agent_memory` Volumen erreicht das es spürbar wird)

---

## 7. Tradeoffs (explizit)

| Entscheidung | Pro | Contra |
|---|---|---|
| Additive Migration statt neue Tabelle | Bestehende Reader brechen nicht. RuntimeEvent-Type v0 ist schon weit verteilt | Alte Rows haben NULL in neuen Spalten — Replay/Bundle-Builder muss damit umgehen |
| `event_tier` als TEXT-CHECK statt ENUM | Migrationsfreundlich, einfach zu erweitern | Keine Type-Safety in der DB ohne ALTER |
| `subject_ref` als TEXT in `runtime_events` (nicht FK) | Erlaubt subject_ref vor Mapping-Existenz | Risiko: dangling refs. Mapping ist Soft-Constraint |
| Cost-Snapshot doppelt (Event + Ledger) | Replay-Diff + Aggregations-Query getrennt optimiert | Doppelter Storage, Konsistenz-Risiko |
| Shadow-Replay-Tabelle separat | Klare Trennung, eigene RLS, kein Vermischungs-Risiko | Joins über Original ↔ Shadow brauchen explizite FK |
| Memory-Scores als 0..1 numeric | Composable (Multiplikation), Vergleichbar | Computation-Cost — Cron-Window muss klein bleiben |
| `replayable` Default=true | Sicher (keine implizite Drop-on-replay) | T2/T3 müssen explizit auf false gesetzt werden — Vergessen-Risiko, daher CI-Test in §6 |
| Kein expliziter `bundle_hash` in event | Bundle-Hash ist Bundle-Verantwortung (siehe `evidence-bundle-builder.md` §5) | Hash-Walk muss zur Read-Zeit gemacht werden |

---

## 8. Was NICHT in dieser RFC ist (explizit)

- ❌ Migration-File wird **nicht** in diesem PR angelegt (RFC nur Draft-SQL)
- ❌ Keine Edge-Function-Änderung
- ❌ Kein Code-Change in `src/core/runtime/`
- ❌ Kein Touch an `governanceEvents.ts` (frozen Phase A)
- ❌ Kein Touch an `ai_runtime_events` (parallele Tabelle — Konvergenz braucht eigene ADR)
- ❌ Kein RFC für `tenant_cost_limits` Schema (separater PR)
- ❌ Kein DSR-Endpoint-Vertrag (separater PR, RBAC-Layer)
- ❌ Keine Stripe-Billing-Integration (nicht in scope)
- ❌ Keine Anon-Pfad-Änderungen (STOP-Constraint)

---

## 9. Open Questions

1. **`governanceEvents.ts` Konvergenz** — Wann lösen wir die Phase-A-Frozen-Sperre? Eigene ADR + Schema-Bridge nötig. Vorerst: das Edge-Function-Schema läuft parallel, neue Surface schreiben gegen das v0.2-Envelope direkt.

2. **`ai_runtime_events` vs. `runtime_events`** — Konsolidierung wann? Variante A: `ai_runtime_events` als `event_tier='T1'` in `runtime_events` umlenken. Variante B: zwei Tabellen behalten, View darüber. Vorschlag: B kurzfristig, A in eigener Migration nach P0-impl-3.

3. **Cost-Source-of-Truth** — vendor-Pricing-Tabellen pflegen wir wo? Hardcoded in `src/lib/pricing-tables/`? Oder DB-Tabelle `vendor_pricing` mit zeitabhängigen `effective_from / effective_to`?

4. **Subject-Ref Klartext-Speicher** — pgsodium vs. extern (KMS)? Performance vs. Compliance.

5. **Replay-Window-Latenz** — wenn ein Replay 10.000 Events durchläuft mit Mock-LLM, ist das CPU-bound. Cap auf 1.000 Events / Replay-Run? Background-Job mit Progress-Endpoint?

6. **Memory-Decay-Frequenz** — Cron jede Stunde? Pro Tenant? Pro Konversation on-write?

---

## 10. Acceptance Criteria

- [ ] Schema-Diffs für `runtime_events`, `shadow_runtime_events`, `subject_ref_keys`, `subject_ref_mappings`, `agent_memory`-Extension, `tenant_cost_ledger` als Draft-SQL dokumentiert
- [ ] Event-Tier-Taxonomie T0/T1/T2/T3 mit Retention + Replay-Default-Mapping definiert
- [ ] Replay-Isolation-Guards (4 Constraints) explizit gelistet
- [ ] Subject-Ref-Lifecycle-States (active → rotating → retired) + Deletion-Semantik definiert
- [ ] Memory-State-Machine (active → cooling → archived → expired → purged) + 4 Score-Definitionen
- [ ] Cost-Ledger-Schema mit Attribution (agent_ref / flow_ref / trace_id) + Hard-Cap-Tabelle
- [ ] Sicherheitsgrenzen (6 cross-cutting Constraints) gelistet
- [ ] Rollout-Phasen-Tabelle mit PR-Größe + Dependencies
- [ ] Tradeoffs explizit dokumentiert
- [ ] Open Questions (6) gelistet
- [ ] **Keine Code-Änderungen** in diesem PR
- [ ] `npm run lint` + `npm test` + `npm run build` grün
