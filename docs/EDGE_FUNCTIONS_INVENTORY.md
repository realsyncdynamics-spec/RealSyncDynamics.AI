# Edge-Function-Inventar

> Stand: Juni 2026 · Grundlage für die Konsolidierung (Block A #15/#16, `docs/PLAN_100.md`).
>
> **Zweck:** Überblick, welche der ~84 Edge Functions aktiv sind, welche Architektur-Fragen offen sind und welche überhaupt Deprecation-Kandidaten wären. **In diesem Schritt wird nichts gelöscht** — Deprecation erfordert pro Function eine eigene Verifikation.

## Methodik & wichtiger Hinweis

Eine frühere Bestandsaufnahme stufte 25 Functions als „verwaist" ein, weil sie nur nach `supabase.functions.invoke('<name>')` suchte. Eine fetch-bewusste Nachprüfung (zusätzlich `fetch(.../functions/v1/<name>)`, `ApiDocs.tsx`-Pfade, `config.toml`, pg_cron in Migrationen, Function-zu-Function-Calls) zeigt: **fast alle sind referenziert.** Beispiele, die fälschlich als tot galten:

- `gdpr-export`, `gdpr-delete` → aktiv via `fetch()` in `src/features/settings/AccountSettings.tsx`
- `evidence-vault-export` → aktiv via `fetch()` in `src/features/governance/EvidenceVaultView.tsx`

**Konsequenz:** Vor jeder Deprecation immer fetch- *und* invoke-bewusst prüfen. Aktuell ist **keine** Function als eindeutig tot verifiziert.

## Statusübersicht

| Status | Anzahl | Bedeutung |
|---|---|---|
| AKTIV | ~79 | Referenziert via Frontend (invoke/fetch), Cron, Webhook, `config.toml` oder Function-Call |
| ADMIN/MANUAL | 1 | Existiert, kein Code-Caller, bewusst out-of-band genutzt (`mfa-admin-reset`) |
| BEHOBEN | 2 | Waren kaputt (Frontend rief nicht-existente Function) — in diesem PR implementiert |
| DEPRECATION-KANDIDAT | 0 | Eindeutig tot — derzeit keiner |

## Behoben in diesem PR

| Function | Frontend-Caller | Status |
|---|---|---|
| `governance-dsr` | `src/features/governance/dsrApi.ts` (`createDsr`/`updateDsr`) | ✅ implementiert (op create/update, owner/admin-gated, Tabelle `dsr_requests`) |
| `governance-vendors` | `src/features/governance/vendorsApi.ts` (`createVendor`/`updateVendor`/`deleteVendor`) | ✅ implementiert (op create/update/delete, owner/admin-gated, Tabelle `vendors`) |

Beide Tabellen existierten bereits (`20260515200000_dsr_tracker.sql`, `20260515500000_vendors.sql`) — keine neue Migration nötig.

> **Sicherheits-Befund + Fix:** Beide Functions liefen bereits manuell deployt in Prod, aber mit `verify_jwt=false` (am Gateway ohne JWT-Prüfung erreichbar) und ohne Quelle im Repo. Das ist genau die Art Drift, die der Drift-Guard fängt. Behoben: Quelle ins Repo committet **und** beide Functions mit dem sicheren Default `verify_jwt=true` neu deployt (Projekt `RealSyncDynamicsLive`, je v12). Live-Stand und Repo stimmen nun überein.

## Aktive Functions nach Auslöser

**Frontend (invoke/fetch):** ai-act-risk-inventory, ai-gateway, ai-invoke, classify-document, cookie-scan, evidence-export, evidence-vault-export, gdpr-audit, gdpr-export, gdpr-delete, governance-agent, governance-analytics-export, governance-approvals, governance-connectors, governance-dpias, governance-dsr, governance-incidents, governance-keys, governance-remediate, governance-resources, governance-risk-score, governance-vendors, governance-webhooks, kodee, kodee-advise, kodee-diagnose, kodee-onboard, mfa-recovery-redeem, remediation-agent, stripe-checkout, stripe-portal, tenant-invite, tenant-members, usage-increment

**pg_cron (Migrationen):** agent-os-runner, audit-drip-cron, audit-monitor-cron, audit-recheck-weekly, business-metrics-cron, daily-digest, governance-ingest, governance-monitoring-scheduler, market-scanner, stripe-meter-sync, sub-processor-notify

**Webhooks / öffentlich (`config.toml` verify_jwt=false):** ai-act-classify, automation-callback, gdpr-audit, health, newsletter-confirm, newsletter-subscribe, sales-lead, shopify-callback, shopify-install, shopify-webhooks, stripe-webhook, telegram-webhook, welcome-email, track-pageview, marketing-event, telemetry-ai-event, cookie-scan, cookie-scan-deep, audit-report-pdf, audit-report-email

**PDF/Report & Sonstige (referenziert via Script/Function-Call):** ceo-brief-pdf, pitch-deck-pdf, generate-document, workflow-callback, workflow-trigger, telegram-channels

## Offene Architektur-Fragen (für Block C — Konsolidierung)

Diese sind *nicht* tot, aber Kandidaten für Vereinheitlichung „ein Agent / ein Workflow-System" (`docs/PLAN_100.md` #33/#35):

1. **`enterprise-ai-os-*`-Cluster (8 Functions):** agent-runs-list, agents-list, agents-run, discovery-intake, discovery-pending, evaluate, feedback, founding-access. Eigene Agent-/Onboarding-Welt parallel zu `governance-agent`/`agent-os-runner`. → Eine Agent-Architektur festlegen, Rest deprecaten oder zusammenführen.
2. **`automation-trigger` vs. `workflow-trigger`** (+ `automation-callback`/`workflow-callback`): mögliche Duplikate. → Auf ein Workflow-Modell vereinheitlichen.
3. **`governance-analytics-aggregator`:** kein aktivierter Cron gefunden, obwohl als Aggregator gedacht. → Aktivieren oder entfernen.
4. **`rebuild-website` / `checkout-website-rebuild` / `shopify-scan` / `tenant-audit` / `generate-document`:** referenziert, aber Aufrufpfad teils indirekt — Nutzung im Zuge der Remediation-/Scanner-Konsolidierung (Block D/E) bestätigen.
5. **`mfa-admin-reset`:** Admin-/Out-of-band-Tool ohne Code-Caller (nur in Security-Docs). → Bewusst behalten und als manuelles Admin-Tool dokumentieren, nicht als „tot" behandeln.

## Nicht Teil dieses Schritts

- Keine Löschung/Deprecation (nur Dokumentation und Behebung der zwei kaputten Functions).
- Architektur-Konsolidierung der obigen Cluster folgt in Block C.
