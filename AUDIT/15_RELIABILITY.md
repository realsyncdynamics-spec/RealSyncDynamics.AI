# 15 — Reliability

## 1. Fehlerszenarien

| Szenario | Erwartetes Verhalten | Befund |
|---|---|---|
| Datenbank nicht erreichbar | sauberer 5xx, kein Datenverlust | ⚠️ meist `jsonError(500, 'INTERNAL', e.message)` — DB-Fehler leckt zum Client |
| Stripe nicht erreichbar | Retry durch Stripe | ✅ Idempotenz-Rollback vorhanden — vorbildlich |
| KI-Provider nicht erreichbar | Fallback auf Ollama | ✅ im `ai-gateway`-Design vorgesehen |
| E-Mail-Provider aus | Queue/Retry | ⚠️ `welcome-email`, `invoice-email` (404) — kein DLQ nachweisbar |
| Scanner-Timeout | Job als `timeout` markieren | ✅ Status `timeout` im Schema vorgesehen |
| Worker-Neustart mittendrin | Job wird erneut aufgenommen | ⚠️ kein Lease/Heartbeat gefunden — Jobs können hängen bleiben |
| Doppelter Job | Idempotenz | ⚠️ nur `workflow_runs`/`automation_runs` via `ALREADY_FINISHED` (409); Scans nicht |
| Doppelter Webhook | No-op | ✅ Stripe |
| Teiltransaktion | Rollback | ⚠️ Edge Functions führen mehrere `.insert()` **ohne umschließende Transaktion** aus — z. B. `automation-callback`: Run-Update, Event-Insert, Outputs-Insert nacheinander; ein Fehler in der Mitte hinterlässt inkonsistenten Zustand |
| Externe API fällt aus | Circuit Breaker | `_circuit_breakers`-Tabelle existiert, **nicht in Produktion**, keine Nutzung im Code gefunden |

---

## 2. Scheduler / Automation

| Komponente | Prod |
|---|---|
| `scheduler`, `scheduler-dispatch`, `agent-scheduler`, `schedule-data-syncs` | ❌ **alle 404** |
| `webhook-retry-cron`, `webhook-deliver`, `webhook-dispatcher` | ❌ **alle 404** |
| `audit-monitor-cron`, `audit-recheck-weekly`, `audit-drip-cron` | ✅ deployt |
| `memory-decay-worker` (stündlich) | ❌ 404 — RFC-003-Decay läuft nicht |
| `governance-erasure-sweeper` | ✅ deployt |
| `pg_cron`-Registrierung | nicht von außen verifizierbar — **GRAU** |

**Konsequenz:** Retry-Queue, Dead-Letter-Handling und Webhook-Zustellung existieren
in Produktion nicht. Ein fehlgeschlagener Webhook wird nicht erneut zugestellt.

---

## 3. Observability

| Ebene | Zustand |
|---|---|
| Frontend-Fehler | ✅ Sentry (EU), Release-Tracking |
| Edge-Function-Logs | ⚠️ `console.log`/`console.error`, überwiegend unstrukturiert |
| Request-Tracing | ⚠️ `_shared/middleware.ts` bietet `generateRequestId` — kaum genutzt |
| Metriken | `_operation_metrics` **nicht in Prod** |
| Alerts | `governance_alerts`, `compliance-alert-trigger` (**404**) |
| Health-Check | ✅ `/functions/v1/health` deployt und öffentlich (bewusst) |

**Kritisch unbeobachtet** (sollte laut Auftrag beobachtbar sein):
Authentifizierungsfehler · RLS-Verletzungen · Billing-Fehler · Webhook-Fehler ·
Evidenz-Fehler · Scanner-Fehler · Worker-Fehler.

Für keinen dieser Fälle existiert ein Alarmpfad in Produktion — was erklärt, warum
die 83 nicht deployten Functions und die fehlenden Tabellen über Monate unbemerkt
blieben.

---

## 4. Bewertung

**Reliability: 45/100.**

| ID | Sev | Kurz |
|---|---|---|
| F-R1 | P1 | Retry-/DLQ-/Webhook-Zustellung in Produktion nicht vorhanden |
| F-R2 | P2 | Mehrschritt-Schreibvorgänge ohne Transaktionsklammer → inkonsistente Zustände |
| F-R3 | P2 | Kein Alarmpfad für Auth-, Billing-, Evidenz- oder Worker-Fehler |
| F-R4 | P2 | Kein Lease/Heartbeat für langlaufende Jobs |
| F-R5 | P3 | DB-Fehlermeldungen werden an Clients durchgereicht |
