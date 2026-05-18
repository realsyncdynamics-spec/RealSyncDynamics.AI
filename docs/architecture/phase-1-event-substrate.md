# Phase 1 — Event-Substrate: Ist-Stand und Spec-Abgleich

**Status:** Living document
**Datum:** 2026-05-18
**Bezug:** [`docs/architecture/agent-os.md`](./agent-os.md) §3.1–§3.5 · [ADR-001](../adr/ADR-001-event-backbone.md) · ADR-0003

> Ground-Truth-Snapshot des bestehenden Event-Substrats, ergänzt um den Abgleich gegen die im Conversation-Spec (18.05.2026, „Phase 1 — Datenmodell & Event-System") formulierten Ziele. Dient als Entscheidungsgrundlage für die Folge-Iteration.

---

## 1. Was bereits steht (verifiziert gegen `supabase/migrations/`)

### 1.1 Tenant- und Member-Modell

| Tabelle | Quelle | Spalten (Auszug) |
|---|---|---|
| `public.tenants` | `00001_initial_schema.sql` (urspr. `organizations`, umbenannt in `20260430160000`) | `id uuid`, `name text`, `created_at` |
| `public.memberships` | `00001_initial_schema.sql` (urspr. `organization_members`, umbenannt in `20260430160000`) | `tenant_id`, `user_id`, `role`, Unique `(tenant_id, user_id)` |
| `public.tenant_invites` | `20260430300000_tenant_invites.sql` | Onboarding-Tokens |
| Helper `public.is_tenant_member(uuid)` | `20260430180000_tenant_rls_and_webhook_events.sql:26` | `SECURITY DEFINER` SQL-Funktion, prüft `memberships.user_id = auth.uid()` |

**Rolle:** Spec-Vorgabe `role text check (role in ('admin','analyst','viewer'))` liegt **nicht** auf einer separaten `users`-Tabelle, sondern als Spalte auf `memberships`. Das ist semantisch korrekter (Cross-Tenant-Membership für den Agency-Use-Case), weicht aber von der Spec ab.

### 1.2 AI-System-Registry

| Tabelle | Quelle | Spalten (Auszug) |
|---|---|---|
| `public.ai_systems` | `20260510_ai_governance_core.sql` | `id`, `tenant_id`, `name`, `vendor`, `model_name`, `department`, `owner_email`, `purpose`, `data_types text[]`, `ai_act_class`, `risk_score`, `status`, Timestamps |

**Vorhanden:** governance-orientierte Felder (`ai_act_class`, `risk_score`).
**Fehlt vs. Spec:** `type text` (api/website/agent/model) und `endpoint text`.

### 1.3 Core Event Store

| Tabelle | Quelle | Charakteristik |
|---|---|---|
| `public.runtime_events` | `20260516300000_runtime_core.sql` | `bigserial id`, `tenant_id`, `execution_id`, `agent_id`, `skill_id`, `name`, `payload jsonb`, `occurred_at`. **Append-only:** `revoke update, delete on public.runtime_events from public`. RLS via `is_tenant_member`. |
| `public.ai_runtime_events` | `20260510_ai_governance_core.sql` | AI-spezifische Telemetrie: `vendor`, `model`, `event_type ∈ {prompt_sent, response_received, agent_action, ...}`, `risk_level`, `policy_status`, `prompt_tokens`, `response_tokens`, `latency_ms` |
| `public.governance_events` | `20260512000000_governance_events.sql` | Governance-Bus (Phase 1.2), siehe ADR-0003 |
| `public.runtime_executions` | `20260516300000_runtime_core.sql` | Skill-Lauf-Header mit `status`, `input_hash`, `output_hash`, `idempotency_key` |
| `public.runtime_approval_gates` | `20260516300000_runtime_core.sql` | Human-in-the-Loop |

**Spec-Mapping `runtime_events`:**

| Spec | Vorhanden | Differenz |
|---|---|---|
| `id uuid` | `id bigserial` | UUID vs Bigint — bestehende Wahl bewusst (Sequenz garantiert Ordering bei replay) |
| `tenant_id uuid` | ✅ | — |
| `system_id uuid references ai_systems(id)` | ❌ | Fehlt; aktuell nur indirekt über `payload`-Inhalt rekonstruierbar |
| `type text` | `name text` | Identische Semantik, unterschiedlicher Spaltenname |
| `payload jsonb` | ✅ | — |
| `severity text` | ❌ | Nicht modelliert; AI-spezifisch in `ai_runtime_events.risk_level` |
| `hash text` | ❌ auf `runtime_events`, ✅ auf `ai_evidence_events` | Hash-Kette nur im Evidence-Vault |
| `created_at` | `occurred_at` | Anderer Spaltenname |

### 1.4 Policy-Engine

| Tabelle | Quelle | Anmerkung |
|---|---|---|
| `public.ai_policies` | `20260510_ai_governance_core.sql` | `rule_type ∈ {data_transfer, model_usage, human_review, logging_required, vendor_restriction}`, `condition jsonb`, `action ∈ {allow, warn, block, require_approval}`, `severity`, `enabled` |

Drei Global-Demo-Policies seedet die Migration. Bewertungs-Endpoint heute via Edge Function `governance-risk-score`.

### 1.5 Evidence-Vault

| Tabelle | Quelle | Anmerkung |
|---|---|---|
| `public.ai_evidence_events` | `20260510_ai_governance_core.sql` | Append-only mit Trigger `tg_evidence_event_chain` → SHA-256 Hash-Kette via `prev_hash` + `chain_index`, `pg_advisory_xact_lock` pro Tenant |
| `public.ai_evidence_retention` | `20260510_ai_governance_core.sql` | `retention_days` default 2555 (7 Jahre), `hard_delete_after_days` default 3650 |

### 1.6 RLS-Pattern

- **Helper:** `public.is_tenant_member(uuid)` (siehe 1.1).
- **Verwendung:** Alle obigen Tabellen haben RLS aktiviert; SELECT/INSERT-Policies nutzen `using (public.is_tenant_member(tenant_id))`.
- **Spec-Diskrepanz:** Spec verwendet `auth.jwt() ->> 'tenant_id'`. Repo-Pattern ist robuster, weil ein User mehreren Tenants angehören kann (Membership-Tabelle statt JWT-Claim).

### 1.7 Edge Functions (Ingest- und Konsumenten-Layer)

| Funktion | Zweck |
|---|---|
| `telemetry-ai-event` | Schreibt in `ai_runtime_events` (Browser-Extension + SDK) |
| `governance-ingest` | Schreibt in `governance_events` (externer Ingest mit `governance-keys`) |
| `governance-risk-score` | Bewertet Events |
| `governance-approvals` | Human-in-the-Loop |
| `governance-webhooks` | Outbound-Fan-out |
| `audit-monitor-cron` | Sweeper für audit-jobs |
| `business-metrics-cron` | KPI-Aggregation |
| `agent-os-runner` | Skill-Executor (in `agent_os_substrate`-Migration) |

### 1.8 Runtime-Code (`src/core/runtime/`)

| Datei | Rolle |
|---|---|
| `governanceEvents.ts` | Eingefrorenes Event-Schema (TypeScript-Types) |
| `evidence.ts` | Canonical-JSON + SHA-256 |
| `types.ts` + `registry.ts` | Agent-Contracts |
| `remediation.ts` | Typisierter Remediation-Layer (Skelett) |
| `approvals.ts` · `executor.ts` · `memory.ts` | Runtime-Mechanik |

---

## 2. Spec-Abgleich (Conversation, 18.05.2026)

| Spec-Anforderung | Ist | Lücke |
|---|---|---|
| Tabelle `tenants(id, name, created_at)` | ✅ | — |
| `users(id, tenant_id, role)` | ⚠️ Auf `memberships` abgebildet | Spec-Modell konzeptionell schwächer (kein Cross-Tenant) — Empfehlung: bei `memberships`-Pattern bleiben |
| `ai_systems(id, tenant_id, name, type, endpoint)` | ⚠️ Tabelle existiert, ohne `type` und `endpoint` | **Additiv:** zwei Spalten via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` |
| `runtime_events(id, tenant_id, system_id, type, payload, severity, hash, created_at)` | ⚠️ Existiert mit anderen Spalten | **Additiv:** `system_id uuid`, `severity text` ergänzen; `name`↔`type` und `occurred_at`↔`created_at` als View aliasen oder akzeptieren |
| `policies(id, tenant_id, name, rule, active)` | ✅ Reicher modelliert als `ai_policies` | — |
| RLS via `auth.jwt() ->> 'tenant_id'` | ⚠️ Repo-Pattern ist `is_tenant_member` | **Spec-Spalte ignorieren**, Repo-Pattern beibehalten |
| Event-Vokabular `scan.executed`, `risk.assessed`, `policy.violation`, … | ⚠️ `runtime_events.name` ist Freitext | **Neu:** TypeScript-Konstanten + optional DB-`CHECK` |
| Event-Payload-Standard (`source`, `target`, `data`, `meta.version`, `meta.region`) | ⚠️ Heute uneinheitlich | **Neu:** Zod-Schema + Validator-Helper |

---

## 3. Was „Done Phase 1" laut Spec bedeutet — Status

| Spec-Kriterium | Bewertung |
|---|---|
| Scanner schreibt Events | ✅ Worker (`worker/src/index.ts`) + Edge Functions schreiben in `audit_jobs` und `runtime_events` |
| Events landen in Supabase | ✅ |
| UI kann Events anzeigen | ✅ `BusinessDashboard.tsx` + `AiGovernancePage.tsx` (zuletzt PR #326) |
| Multi-Tenant-Isolation funktioniert | ✅ RLS aktiv, durch `is_tenant_member` getestet (siehe `test/contracts/`) |

**Phase 1 ist faktisch erreicht — mit drei dokumentierten Differenzen zur Spec** (siehe §2).

---

## 4. Empfohlene Folge-Schritte (klein, additiv)

1. **`ALTER TABLE ai_systems ADD COLUMN IF NOT EXISTS type text, ADD COLUMN IF NOT EXISTS endpoint text`** — entkoppelt Registry- von Target-Identität.
2. **`ALTER TABLE runtime_events ADD COLUMN IF NOT EXISTS system_id uuid REFERENCES ai_systems(id), ADD COLUMN IF NOT EXISTS severity text`** — bringt Spec-Form näher, ohne `name`/`occurred_at` zu brechen.
3. **`src/core/runtime/eventTypes.ts`** — TypeScript-Konstanten für das gesamte Event-Vokabular (`scan.executed`, `ai.endpoint.used`, `risk.assessed`, `policy.violation`, `drift.detected`, `evidence.created`). Single Source of Truth, in Edge Functions und SPA importiert.
4. **`src/core/runtime/eventPayload.ts`** — Zod-Schema `{ source, target, data, meta: { version, region } }`, mit `validateEventPayload(payload, type)` Helper. Optional als DB-`CHECK` auf `runtime_events.payload`.
5. **Vitest-Smoke-Test** in `test/runtime/tenant-isolation.spec.ts`, der mit zwei Test-Tenants einen `runtime_events`-INSERT und einen Cross-Tenant-SELECT versucht und auf Policy-Block prüft.

Keiner dieser Schritte bricht existierenden Code. Reihenfolge: 3 → 4 → 1 → 2 → 5.

---

## 5. Was bewusst **nicht** in dieser Iteration ist

- Keine Umbenennung `name` → `type` auf `runtime_events` (würde alle Edge Functions und Konsumenten brechen).
- Keine UUID-Umstellung der `id`-Spalte (Bigserial bleibt — Ordering-Garantien beim Replay sind wichtiger).
- Keine separate Hash-Spalte auf `runtime_events` — Hashing bleibt auf der Evidence-Schicht (`ai_evidence_events.event_hash`), wo es semantisch hingehört.

---

**Nächster Schritt für Dominik:** Dokument durchgehen, Folge-Schritt-Reihenfolge in §4 bestätigen (oder ändern), dann eine kleine Migration + die zwei TypeScript-Dateien (Empfehlungen 1–3) als nächste PR.
