# Observability Gap Analysis — RealSyncDynamics.AI

**Erstellt:** 2026-05-26
**Modus:** Read-only Audit. Pruefen: welche Observability-Signale sind im Repo angelegt, welche fehlen oder sind nur partiell instrumentiert. Keine neuen Features designen.

---

## 1. Signal-Matrix

| Signal | Existiert? | Quelle | Risiko | Empfehlung |
|---|---|---|---|---|
| **Edge-Function Latency-Logs** | partial | `supabase/functions/governance-agent/index.ts` (L234, L297), `cookie-scan-deep/index.ts`, `business-metrics-cron/index.ts`, `rebuild-website/index.ts`, `agent-os-runner/index.ts` — `Date.now()` + `duration_ms`-Tracking | Nur ~5 von 60+ Functions sind instrumentiert. Latenz-Auswertung pro Function ohne zentralen Sammler nicht moeglich | Pattern `const t0 = Date.now(); ... duration_ms: Date.now() - t0` als wiederverwendbare Helper-Funktion etablieren; `duration_ms` in `ai_tool_runs` oder einer separaten `latency_events`-Tabelle persistieren |
| **Scan-Failures** | yes | `audit_jobs.error_message`, `gdpr_audits.fetch_error`/`fetched_status`, `ai_tool_runs.error_code`/`error_message`, `workflow_runs.error_code`/`error_message` | Fehler verteilt auf 4 Tabellen, keine einheitliche Auswertung | Cross-Table-Query als View dokumentieren (`failed_scans_v`). Standardisierte Error-Codes pro Scanner-Typ definieren (`SCAN_TIMEOUT`, `SCAN_INVALID_DOMAIN`, `SCAN_BLOCKED_BY_ROBOTS`, etc.) |
| **Quota / Cost-Logging** | yes | `ai_tool_runs.{cost_usd, input_tokens, output_tokens, cached_tokens, duration_ms}`, `workflow_runs.cost_usd`, `tenant_cost_ledger` (trace-id-correlated) | Keine Live-Quota-Alerts. FinanceDashboard im SPA zeigt keine `tenant_cost_ledger`-Live-Abfrage | Postgres-NOTIFY auf Channel `quota_warning` triggern bei Threshold-Ueberschreitung. `tenant_cost_ledger` als Auswertungs-Query im SPA exponieren |
| **Evidence-Integrity / Tamper-Detection** | yes | `runtime_events` mit Hash-Chain (`prev_hash`, `valid`, `chain_ok`) aus `20260602100000_runtime_events_backbone.sql`. `ai_evidence_events` mit `event_hash`/`prev_hash`/`chain_index` (SHA-256-Chain, Append-Only-Trigger) | Hash-Chain existiert, aber kein expliziter Alert bei `chain_ok = false`. Tampering wird theoretisch erkennbar, aber niemand wird benachrichtigt | `NOTIFY integrity_violation` bei `chain_ok = false`. Separate Tabelle `integrity_violations` als materialisierte Sicht fuer schnellen Lookup |
| **Finding-Generation-Errors** | yes | `ai_tool_runs.{status: 'success' \| 'error' \| 'timeout' \| 'quota_exceeded', error_code, error_message}` | Fehler-Tracking pro Run vorhanden, aber keine Fehlerquote pro Tool / pro Tenant berechnet | View `failed_tool_runs_24h` pro Tool/Tenant fuer Operations-Dashboard. Alerting-Threshold: > 5% Failure-Rate in 1h |
| **Report-Export-Failures** | partial | `pii_redaction_log` (append-only, mit `function_name` in `evidence-vault-export`, `audit-report-pdf`, `evidence-export`, `gdpr-export`, plus `hits_total`, `policy_applied`) | Loggt nur erfolgreiche Exports. Fehler landen in `audit_jobs.error_message` mit `function_name`-Korrelation, aber kein expliziter Failure-History-Eintrag | `export_failures`-Tabelle (oder View) mit Cross-Reference `audit_jobs.error_message` + `pii_redaction_log.function_name` |
| **Deploy-Healthchecks** | partial | `.github/workflows/deploy-frontend.yml` Zeile 145-154 (`curl` 5 Retries, 3s Abstand, HTTP 200). `.github/workflows/deploy.yml` Smoke-Test `gdpr-audit` und `cookie-scan` mit erwartetem HTTP 400 | Smoke-Test nur fuer 2 Edge-Functions, ~58 ungetestet. Frontend-Smoke wackelig (siehe `dns-domain-status.md` §5.1) | Smoke-Test-Liste auf alle Public-Functions ausweiten. Post-Deploy-Uptime-Monitor (UptimeRobot / Datadog Synthetic / Sentry Cron) ausserhalb des Repos |
| **Runtime-Error-Tracking (SPA)** | partial | `src/lib/sentry.ts` (conditional `VITE_SENTRY_DSN`), `src/main.tsx` `initSentry()`. `sendDefaultPii = false`, `tracesSampleRate = 0.1`, `beforeSend` strippt PII | Sentry **nur im SPA**. Edge-Functions haben keinen Sentry-Init → Server-Errors sind blind. `tracesSampleRate = 0.1` zu niedrig fuer seltene Errors | Deno-Sentry-SDK in Edge-Functions instrumentieren (mindestens `console.error` → externer Collector). `tracesSampleRate = 1.0` fuer Production erwaegen (Performance-Cost klein bei aktuellem Volume) |
| **Runtime-Error-Tracking (Edge-Functions)** | no | Keine Sentry-Initialisierung in `supabase/functions/*/index.ts` | Server-Side-Fehler sind nur in Supabase-Function-Logs sichtbar — kein langlebiger Verlauf, keine Aggregation, keine Alerts | Mindestens `logtail`-Webhook oder Sentry-Deno. Alternativ: Edge-Function `error-collector` als zentraler Endpoint, der `error_events` in eine Postgres-Tabelle schreibt |
| **Runtime-Error-Tracking (OpenClaw)** | yes | `services/openclaw-agent/src/index.ts` initialisiert Sentry wenn `SENTRY_DSN` gesetzt | Funktional. Aber im Container-Container-Standard ist `SENTRY_DSN` nicht gesetzt — also faktisch off, ausser der Operator setzt es per Env | Default-DSN in `scripts/install-openclaw-vps.sh` als Pflicht-Variable mit Warnung |
| **Async Queue Health / Deadletter** | partial | `audit_jobs` mit `status: queued \| running \| success \| failed \| timeout \| cancelled`, `attempts`, `max_attempts`, `next_retry_at`. NOTIFY auf Channel `audit_job_queued` | Retry-Logik vorhanden, aber kein Deadletter-Tabelle. Failed-Jobs nach `max_attempts` haben keinen separaten Sichtbarkeit-Mechanismus | View `audit_jobs_deadletter` (`status='failed' AND attempts>=max_attempts`). Queue-Depth-Alert via `NOTIFY queue_depth_warning` |
| **RLS-Policy-Denial-Logs** | partial | `governance_admin_log` loggt Admin-Writes (keys, resources, webhooks, approvals). RLS-Denials werden **nicht** geloggt | Wenn ein Tenant versehentlich auf Daten eines anderen zugreifen will, sehen wir das nirgendwo | Optional: Trigger in `public.is_tenant_member()` schreibt nach `rls_access_log` bei Denial. Trade-off: RLS-Denials sind hoch-volume und koennten die Tabelle flooden |
| **Workflow-Step-Timeline** | yes | `workflow_runs` (`status`, `duration_ms`, `error_code`), `runtime_events` (append-only Audit-Trail pro Execution), `runtime_executions` (`skill_id`, `status`, `started_at`, `finished_at`) | Timeline granular bis `runtime_events`. n8n-Step-Level-Details aber nur ueber `n8n_execution_id` cross-referenced | Falls Step-Granularitaet noetig: n8n-Webhook fuer Step-Level-Events abfangen + neue Tabelle `workflow_step_events` |
| **Cron-Job-Heartbeat** | no | `audit-drip-cron`, `audit-monitor-cron`, `audit-recheck-weekly`, `business-metrics-cron`, `daily-digest` — wenn diese silent failen, faellt's nicht auf | Cron faellt aus, Audits werden nicht mehr abgesetzt — und niemand merkt's | Healthchecks.io-Style Heartbeat (kostenloser Dienst). Oder: `cron_heartbeat`-Tabelle mit `last_seen_at` pro Cron, Alert bei > 2 Intervalle Verzug |

---

## 2. Aggregierte Lage

Von 14 betrachteten Signalen:

- **5 yes** (Scan-Failures, Cost-Logging, Evidence-Integrity, Finding-Errors, Workflow-Timeline, OpenClaw-Errors)
- **6 partial** (Edge-Latency, Report-Failures, Deploy-Healthchecks, SPA-Errors, Queue-Deadletter, RLS-Denials)
- **2 no** (Edge-Function-Errors, Cron-Heartbeat)

Die groessten Luecken sind nicht „wir messen es ueberhaupt nicht", sondern „wir messen es, aber niemand sieht's, wenn was schiefgeht":

1. Kein Alerting auf Hash-Chain-Bruch
2. Edge-Function-Errors landen in Supabase-Function-Logs mit ~7-Tage-Retention, kein langer Verlauf, kein Aggregator
3. Cron-Jobs ohne Heartbeat
4. Smoke-Test deckt 2 von ~60 Functions ab

---

## 3. Was diese Analyse NICHT empfiehlt

Im Sinne der Scope-Freeze-Direktive:

- **keine** neuen Scanner-Regeln
- **keine** neuen Edge-Functions als Feature
- **keine** neuen UI-Dashboards

Empfehlungen oben sind ausschliesslich Observability-Instrumentierung — also: schreiben, was schon laeuft, in lesbare Tabellen, plus Alerts. Keine neue Funktionalitaet.

---

## 4. Prioritaeten-Reihenfolge (Empfehlung, nicht Auftrag)

| # | Massnahme | Aufwand | Risiko-Reduktion |
|---|---|---|---|
| 1 | Edge-Function Error-Collector (Webhook in Postgres-Tabelle, alle Functions logging via shared helper) | mittel | hoch — heute komplett blind fuer Server-Errors |
| 2 | Cron-Heartbeat fuer alle `*-cron` Functions | klein | hoch — Cron-Ausfall war historisch eine der haeufigsten Stillen-Ausfaelle |
| 3 | `NOTIFY integrity_violation` auf Hash-Chain-Bruch | klein | mittel — Tampering ist heute *erkennbar*, aber nicht *bemerkbar* |
| 4 | Smoke-Test in `deploy.yml` auf alle Public-Functions (mindestens HEAD oder OPTIONS) ausweiten | mittel | mittel |
| 5 | `audit_jobs_deadletter` View + Queue-Depth-Alert | klein | mittel |
| 6 | Standardisierter `duration_ms`-Helper fuer alle Edge-Functions | mittel | klein |
| 7 | `failed_tool_runs_24h` Operations-View | klein | klein |

---

## 5. Keine Aenderungen aus dieser Analyse

Dieses Dokument ist Read-Only-Audit. Implementierung der Empfehlungen — falls beauftragt — erfolgt in separaten PRs mit klarem Scope pro Massnahme.
