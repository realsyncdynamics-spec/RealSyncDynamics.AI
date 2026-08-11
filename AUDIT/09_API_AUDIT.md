# 09 — API / Route Audit

## 1. Frontend-Routen

| Kennzahl | Wert |
|---|---|
| Seiten in `src/pages/` | 119 (1 Datei = 1 Route, eager import) |
| Auth-gated Module in `src/features/` | lazy hinter `ProtectedRoute` / `RequireAal2` |
| Öffentliche Bereiche | `/`, `/pricing`, `/governance/*`, `/<branche>-landing`, `/preview`, `/contact-sales` |
| Geschützt | `/app/*` (Onboarding-Gate), `/flow/*` |

Autorisierung im Frontend ist **ausschließlich UX** — die Durchsetzung liegt bei RLS
und den Edge Functions (Rule 4). Das ist im Repo korrekt so angelegt.

---

## 2. Edge-Function-Inventar

| Kategorie | Anzahl |
|---|---|
| Functions im Repo | 178 |
| **In Produktion deployt** | **95** |
| **Nicht deployt (HTTP 404)** | **83** |
| Mit `SUPABASE_SERVICE_ROLE_KEY` | 170 (96 %) |
| `verify_jwt = false` in `config.toml` | 61 |
| Davon mit korrekter interner Prüfung | 43 |
| **Davon ohne jede Prüfung** | **18** |
| Mit reiner `Bearer `-Präfix-Prüfung | **6** |
| Mit `Access-Control-Allow-Origin: *` | 17 |

---

## 3. Vom Frontend aufgerufen, aber nicht deployt (33)

Diese Aufrufe scheitern für eingeloggte Nutzer **jetzt** mit HTTP 404:

```
add-auditor              auditor-engagement        bulk-scan
calculate-seo-metrics    certification-readiness   evidence-vault
export-audit             generate-certification-report
generate-compliance-report                          governance-memory
iso42001-control-detail  iso42001-controls-library iso42001-evidence-vault
iso42001-gap-analysis    log-tool-run              maintenance-schedule
policy-packs             provenance                remediation-workflow
scheduler                seo-dashboard-data        share-dashboard
siteos-agents            siteos-builder            siteos-runtime-scan
social-orchestrator-persistence                     stripe-checkout-verify
tenant-branding-update   train-forecast-models     update-member-role
website-domain-manager   website-maintenance-agent website-operations-agent
```

Besonders bemerkenswert: **`update-member-role`** — Team-/Rollenverwaltung ist in
Produktion nicht bedienbar. **`log-tool-run`** — die Protokollierung externer
Tool-Aufrufe (EU-AI-Act-relevant, CLAUDE.md §5 „Observability") läuft nicht.

---

## 4. Bewertung der geprüften Endpunkte

Legende: A = Authentifizierung · Z = Autorisierung (Tenant) · V = Input-Validierung ·
RL = Rate-Limit · L = Logging

| Function | Methode | A | Z | V | RL | Prod | Bewertung |
|---|---|---|---|---|---|---|---|
| `stripe-webhook` | POST | HMAC ✅ | metadata ✅ | ✅ | — | ✅ | **GRÜN** |
| `governance-keys` | POST | JWT ✅ | Membership ✅ | ✅ | — | ✅ | **GRÜN** |
| `governance-approvals` | POST | JWT ✅ | Membership ✅ | ✅ | — | ✅ | **GRÜN** |
| `governance-resources` | POST | JWT ✅ | Membership ✅ | Enum-Whitelists ✅ | — | ✅ | **GRÜN** |
| `governance-dsr` | POST | JWT ✅ | Membership ✅ | ✅ | — | ✅ | **GRÜN** |
| `governance-ingest` | POST | API-Key sha256 ✅ | Key→Tenant ✅ | ✅ | ✅ | ✅ | **GRÜN** |
| `governance-erasure-sweeper` | POST | Vault-Token ✅ | n/a (global) | ✅ | — | ✅ | **GRÜN** |
| `workflow-callback` | POST | Shared Secret ✅ | run→tenant ✅ | ✅ | — | ✅ | **GRÜN** |
| `automation-callback` | POST | Shared Secret ✅ | run→tenant ✅ | ✅ | — | ✅ | **GRÜN** |
| `kodee` | POST | JWT ✅ | Connection-Owner ✅ | Action-Allowlist ✅ | — | ✅ | **GRÜN** |
| `api-gateway` | POST | `verify_api_key` RPC ✅ | Key→Tenant ✅ | ✅ | ✅ | ❌ | GRÜN, aber nicht deployt |
| `api-audit` | POST | `api_key_validate` RPC ✅ | ✅ | ✅ | ✅ | ❌ | GRÜN, aber nicht deployt |
| `partner-provision-tenant` | POST | Key-Hash ✅ | Partner-Quota ✅ | ✅ | ✅ | ❌ | GRÜN, aber nicht deployt |
| `plans` | GET | öffentlich (bewusst) | n/a | n/a | Cache 300s | ❌ | GRÜN, aber nicht deployt |
| `evidence-export` | POST | JWT-Präfix + Caller-Client (RLS) | RLS ✅ | ✅ | — | ✅ | **GELB** — AAL2 nur „observe" (F-22) |
| `governance-risk-score` | POST | **Präfix ✅ / Token ❌** | **keine** | teilweise | — | ✅ | **ROT — F-04** |
| `oauth2-apps` | POST | **Präfix ❌** | **keine** | teilweise | — | ❌ | **ROT — F-04** |
| `report-generator` | POST | **Präfix ❌** | **keine** | teilweise | — | ❌ | **ROT — F-04** |
| `governance-score-calculator` | POST | **Präfix ❌** | n/a (alle Tenants) | — | — | ❌ | **ROT — F-04** |
| `governance-deadline-monitor` | POST | **Präfix ❌** | n/a | — | — | ❌ | **ROT — F-04** |
| `automation-trigger-trial-webhook` | POST | **Präfix ❌** | **keine** | teilweise | — | ❌ | **ROT — F-04** |
| `enterprise-ai-os-discovery-pending` | GET | **keine** | **`tenantId` optional → globaler Dump** | — | — | ✅ | **ROT — F-05a** |
| `governance-agents-list` | GET | **keine** | Query-Param + **`.or()`-Injection** | — | — | ❌ | **ROT — F-05b** |
| `governance-incidents` | POST | **keine** | **kein `tenant_id` im Insert** | — | — | ✅ | **ROT — F-11** (Tabelle fehlt → 400) |
| `browser-action-log` | POST | **keine** | `tenantId` aus Body | teilweise | — | ✅ | **ROT — F-05** |
| `cookie-scan-deep` | POST | **keine** | `tenantId` aus Body | URL ungeprüft | — | ✅ | **ROT — F-05 + SSRF** |
| `optimize-execute` | POST | **keine** | `tenantId` + `userId` aus Body | — | — | ❌ | **ROT — F-23** |
| `ai-gateway` | POST/GET | öffentlich (dokumentiert) | n/a | Ops-Whitelist ✅ | ⚠️ pro Instanz | ✅ | **GELB** — Rate-Limit nicht geteilt |

---

## 5. Querschnittsbefunde

| Thema | Befund |
|---|---|
| **CORS** | `_shared/gateway.ts` setzt `Access-Control-Allow-Origin: *` als Default für alle Nutzer. Ohne `Allow-Credentials` begrenzt, aber unnötig weit (F-15) |
| **Input-Validierung** | Uneinheitlich. `zod` ist per CLAUDE.md ausgeschlossen; die guten Functions nutzen Enum-Whitelists (`governance-resources`), die schlechten übernehmen `body` roh |
| **Idempotenz** | Nur Stripe-Webhook und die n8n-Callbacks (`ALREADY_FINISHED`-Guard). Für Scan-/Agent-Jobs nicht vorhanden |
| **Timeouts / Retry** | `kodee` mit `EXEC_TIMEOUT` und Output-Cap ✅. Sonst kaum explizite Timeouts bei externen Calls |
| **Fehler-Leakage** | Weit verbreitet: `jsonError(500, 'INTERNAL', (e as Error).message)` gibt DB-Fehlermeldungen an den Client. Für PostgREST-Fehler bedeutet das Schema-Preisgabe |
| **Logging** | `console.log`/`console.error`; strukturiert nur vereinzelt (`governance-erasure-sweeper` mit JSON-Log). Kein einheitliches Request-ID-Tracing (obwohl `_shared/middleware.ts` `generateRequestId` anbietet) |
