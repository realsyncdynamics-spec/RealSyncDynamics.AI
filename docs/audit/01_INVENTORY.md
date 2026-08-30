# 01 — INVENTORY (Phase 1, Auftrag 1)

**Auftrag:** `docs/audit/AUFTRAG_1.md` · **Modus:** Read-only
**Datum:** 2026-08-24 · **Stand:** Branch `claude/claims-runtime-audit-quney6`, Basis `main@1657e23`
**Methode:** Vollständige Repository-Prüfung (Code, Migrationen, Tests, CI-Workflows, Deploy-Configs). Keine Doku-Aussage wurde als Beleg gewertet. Historische Audit-Dateien (`AUDIT/`, Stand 2026-08-10) wurden gemäß Spec §18 **nicht** als Quelle verwendet.
**Produktionszustände** (Live-DB, Stripe-Live-Konfiguration, deployte Functions, pg_cron-Registrierung) sind aus dieser Session nicht messbar → durchgängig `UNKNOWN` mit ausführbarem CHECK (siehe Abschnitt „Produktions-Unknowns").

Statusmodell und Enforcement-Definitionen: Spec §3–§5. Kurzform:
`VERIFIED` = Implementierung mit Datei:Zeile belegt · `PARTIAL` = vorhanden, aber unvollständig gegenüber dem Bereichsanspruch · `NOT_FOUND` = nach vollständiger Repo-Suche keine Implementierung · `UNKNOWN` = nur in Produktion feststellbar.
`HARD` = Backend verweigert **und** automatisierter Test in CI bestätigt · `SOFT` = Backend prüft, aber kein ausreichender Regressionstest · `DISPLAY_ONLY` = Limit existiert nur als Anzeige-/Katalogdatum.

---

## A. Bereichsinventar

### A.1 Multi-Tenant

```text
STATUS: VERIFIED (Grundstruktur) / NOT_FOUND (Parent-Child-Hierarchie)
EVIDENCE:
- tenants: supabase/migrations/20260406000000_entitlements_schema.sql:8-14 (als organizations),
  Rename: supabase/migrations/20260430160000_rename_organizations_to_tenants.sql:6-23
- memberships: 20260406000000:17-24; Rollen-CHECK aktuell:
  20260622000000_fix_memberships_role_check_name.sql:16-20 (owner/admin/dpo/editor/viewer_auditor)
- ZWEITE, parallele Membership-Tabelle tenant_memberships:
  20260602100000_runtime_events_backbone.sql:75-80 (Rollen owner/admin/member/viewer),
  einmaliger Backfill :89-101, KEIN Sync-Trigger → Drift nach Migration
- Auto-Tenant bei Signup: 20260501000000_auto_tenant_on_signup.sql:11-46
- profiles OHNE tenant_id-FK: 00001_initial_schema.sql:14-23 (organization_name ist Freitext)
- Reseller-Verknüpfung (kein Tenant-Baum): tenants.partner_id →
  20260705210000_partner_provisioning.sql:53,76,80
TEST: keiner für Tenant-Struktur selbst; Isolation siehe A.2
ENFORCEMENT: Tenant-Anzahl pro Plan: DISPLAY_ONLY (siehe Enforcement-Tabelle Z. T-07)
NOT_FOUND REASON (Parent/Child): Suche über *.sql/*.ts/*.tsx (ohne node_modules) nach
  parent_tenant, parent_org, sub_tenant, child_tenant, tenant_hierarchy, parent_id → 0 Treffer
```

### A.2 Tenant Isolation / RLS

```text
STATUS: PARTIAL
EVIDENCE:
- Kanonisches Pattern: is_tenant_member():
  supabase/migrations/20260430180000_tenant_rls_and_webhook_events.sql:26-38;
  Beispiel-Policies :62-65 (member-read), :67-80 (owner-update), :127-131 (tenant-rw),
  :16-21 (deny-all für service-role-only)
- Zweiter Helper has_tenant_membership() auf tenant_memberships:
  20260602100000_runtime_events_backbone.sql:120-134
- Umfang: 364× ENABLE ROW LEVEL SECURITY (~306 Tabellen), 690× CREATE POLICY in supabase/migrations/
- ACL-Reparatur nach Vorfall: 20260826000001_restore_client_function_grants.sql:11,84
TEST: test/runtime/db/rls.db.test.ts — describe 'SPEC-001 / RLS tenant isolation (DB)' (:17),
  u.a. it 'cross-tenant SELECT returns 0 rows' (:22), 'unauthenticated session sees nothing' (:52).
  ⚠️ Läuft NICHT in CI: Skip-Guard :14-15 (describe.skip ohne TEST_DB_URL);
  TEST_DB_URL wird nur von npm run test:db gesetzt (package.json:26); kein Workflow ruft test:db
  (.github/workflows/** durchsucht → 0 Treffer). ci.yml-Job "db" (:29-113) wendet nur Migrationen an.
ENFORCEMENT: HARD auf DB-Ebene (RLS-Policies), aber Testabsicherung nur lokal → in CI ungeprüft
UNKNOWN: RLS-Zustand der Live-DB (Policies/Grants können abweichen) → CHECK-01, CHECK-02
```

### A.3 Authentication

```text
STATUS: VERIFIED
EVIDENCE:
- Supabase Auth Context: src/features/supabase/SupabaseAuthContext.tsx:40,42,59,83,101-104,123-126,134-137,173-179
- OAuth: src/features/auth/OAuthProviderButtons.tsx:54,169,185 (google/azure/linkedin_oidc/github)
- AAL2/MFA Frontend (blockierend): src/core/access/RequireAal2.tsx:23-76;
  Policy: src/core/access/aal2-policy.ts:13,23-27,59-66; Routen z.B. src/App.tsx:807,836,943
- AAL2 SERVERSEITIG NUR OBSERVE-ONLY: supabase/functions/_shared/requireAal2.ts:1-11
  ("BLOCKT NIE"), :59+ (observeAal2 loggt nur, kein 403)
TEST: test/core/aal2-policy.test.ts (describe 'AAL2 enforcement policy (P0c, ADR 0006)' :6, in CI);
  test/edge/requireAal2.test.ts (:12, in CI); RequireAal2.tsx selbst ohne Rendering-Test;
  e2e/tenant-admin.spec.ts:17 'ist auth-gated' NICHT in CI
ENFORCEMENT: Frontend HARD (Route-Guard), Backend-AAL2 DISPLAY_ONLY-äquivalent (observe-only)
```

### A.4 Authorization

```text
STATUS: PARTIAL
EVIDENCE:
- DREI inkompatible Rollenvokabulare parallel:
  (1) owner/admin/dpo/editor/viewer_auditor — src/features/tenants/memberGuards.ts:5,
      Migration 20260622000000:16-20, supabase/functions/tenant-members/index.ts:33
  (2) owner/admin/member/viewer — 20260602100000_runtime_events_backbone.sql:78-79,
      Policy 20260811020558_..._reconcile_20260624000002.sql:140
  (3) owner/editor/viewer/approver — 20260710030000_phase6_3_exports_role_editing.sql:52-53,
      supabase/functions/update-member-role/index.ts:5,47,97
- Frontend-Guards: memberGuards.ts:32-62 (checkSetRole/checkRemove: FORBIDDEN, LAST_OWNER, SELF_DEMOTE)
- Edge-Beispiel: tenant-members/index.ts:80 (getUser), :103-107 (callerRole), :156-157 (403),
  :160-161 (owner-only), :168-169 (409 LAST_OWNER), :117-120 (governance_admin_log)
- RLS-Rollen-Enforcement: 20260506210000_api_keys_per_tenant.sql:31-49
TEST: test/core/memberGuards.test.ts (describe 'tenant member guards (P0b, ADR 0005)' :6, in CI).
  Für die Edge Functions tenant-members / tenant-invite / update-member-role: kein Test gefunden
  (test/, tests/, e2e/ nach den drei Namen durchsucht → 0 Treffer).
ENFORCEMENT: SOFT (Backend prüft; Tests decken nur den TS-Spiegel der Guards ab)
```

### A.5 Policy Engine

```text
STATUS: PARTIAL
EVIDENCE:
- Tabelle ai_policies: supabase/migrations/20260510_ai_governance_core.sql:35-47; RLS
  20260601100000:68-115; Seeds :77-118 (3 globale Policies)
- Tabelle governance_controls: NOT_FOUND (nur als Kommentar 20260703000100:7 und TODO
  apps/mcp-server/src/tools/governance.ts:16,39; reale Control-Tabelle heißt framework_controls:
  20260512000000_governance_events.sql:143, 20260705050000_governance_frameworks.sql:26)
- ZWEI produktive Engines: (A) _shared/policy-engine.ts:174-279 (Aufrufer
  telemetry-ai-event/index.ts:161-188,203); (B) _shared/policyEngine.ts:126-186
  (Aufrufer governance-ingest/index.ts:36; strictest-action-wins :18)
- Toter Code: src/governance/PolicyEvaluationService.ts:25-358 (keine Konsumstelle);
  dritte Parallel-Implementierung src/lib/enterprise-ai-os/policy-engine.ts (173 Z.)
- Violations: kein policy_violations-Table; Verletzung = policy_status ∈ {warned,blocked,
  requires_approval} → Auto-Evidence telemetry-ai-event/index.ts:220-241
TEST: test/policy-engine.test.ts (17 Cases, nur Engine A, in CI — u.a. 'picks the strictest
  action when multiple policies match' :175). Engine B und PolicyEvaluationService: kein Test.
ENFORCEMENT: SOFT (Engine A getestet; Engine B produktiv ohne Test)
```

### A.6 Policy Packs

```text
STATUS: VERIFIED
EVIDENCE:
- Alle sechs Rahmenwerke als SQL-Seed: supabase/migrations/20260701150000_policy_packs.sql —
  GDPR :21-26, EU_AI_ACT :27-32, NIS2 :33-35, DORA :36-39, ISO_27001 :40-43, TISAX :44-46;
  Vollkataloge (+18 GDPR, +12 AI-Act, +12 NIS2, +16 DORA, +93 ISO, +5 TISAX):
  20260702120000_policy_pack_full_catalogs.sql
- Struktur: policy_pack_catalog :49-56 → policy_pack_controls :58-62 (N:M auf
  framework_controls) → policy_pack_activations :89-96 (pro Tenant)
- Gate: supabase/functions/policy-packs/index.ts:49-54 (gateFeature 'policy.packs', 402);
  Entitlement-Seed 20260701150000:118-126
- Branchen-Empfehlung: src/lib/policy-packs/recommend.ts:56-61,111-190 (deterministisch);
  Einschränkung: Tenant-Industry heute meist null (recommend.ts:11; policyPacksApi.ts:36
  lädt kein Tenant-Industry-Feld)
TEST: test/policy-packs/catalog-integrity.test.ts:52,57; recommend.test.ts (17 Cases, :35,:50,:92);
  coverage.test.ts:32 — alle in CI. Für das 402-Gate selbst: kein Test.
ENFORCEMENT: SOFT (Feature-Gate 402 vorhanden, ungetestet); Hinweis: Policy Packs sind ein
  Feature-Gate, kein Mengenlimit (ein solches existiert im Modell nicht)
```

### A.7 Evidence Vault

```text
STATUS: PARTIAL
EVIDENCE:
- Ingestion: telemetry-ai-event/index.ts:220-241 (Auto-Evidence), governance-ingest/index.ts:15-26,
  governance-evidence-handler/index.ts:1-30, evidence-vault/index.ts:47-130 (op 'snapshot')
- Legal Hold: 20260701140000_evidence_vault_advanced.sql:53-82 (evidence_legal_holds),
  Sperrwirkung evidence_purgeable() :107-120, Immutability-Trigger :39-51
- Retention: 20260510_ai_governance_core.sql:251-274
- Export JSON: evidence-vault-export/index.ts:213-262 (Bundle mit Verifier-Block, PII-Redaction)
- Export "PDF": KEIN echtes PDF — audit-report-pdf/index.ts:151 ('HTML print-optimiert.
  Echtes PDF via Playwright-Microservice in Phase 2.'); Client-Pendant
  src/features/evidence-vault/exportReportHtml.ts:1-12
- Signatur im Vault: NUR HMAC-SHA256, kein Ed25519 — evidence-vault/index.ts:39-45,
  evidence-vault-export/index.ts:176-179,236-238
TEST: test/evidence/verifyChain.test.ts (11 Cases, in CI); test/evidence/retention.test.ts (in CI);
  DB-Ebene siehe A.8; E2E e2e/evidence-vault-export.spec.ts NICHT in CI
ENFORCEMENT: Feature-Gates SOFT — evidence-vault/index.ts:79 (gateFeature 'evidence.advanced'),
  evidence-vault-export/index.ts:47 (hasPermission 'auditExport' — einziges SSoT-basiertes
  Server-Gate im Repo); Storage-Limit DISPLAY_ONLY (siehe T-08)
```

### A.8 Hash Chain

```text
STATUS: VERIFIED (Implementierung) — Testabsicherung der DB-Ebene läuft nicht in CI
EVIDENCE:
- DB-Trigger-Chain (Evidence): 20260510_ai_governance_core.sql:204-243 —
  payload := prev_hash||id||created_at||event_type||event_summary||evidence (:230-236),
  digest(payload,'sha256') (:238), Advisory-Lock je Tenant (:219-220), Trigger :245-249
- Zweite Chain (runtime_events): 20260602100000_runtime_events_backbone.sql:332-380
  (canonical bytes), :392-460 (alloc_seq_and_chain, digest :437-438), Immutability :526
- Dritte (Snapshots): evidence-vault/index.ts:36-38
- Verifier-RPC: 20260602100000:463-518 (runtime_events_verify_chain), Grants :682-684
- TS-Verifier: src/lib/evidence/verifyChain.ts:81-135 (4 Issue-Typen)
TEST: in CI: test/evidence/verifyChain.test.ts (hash_mismatch :55, broken_link :63, Genesis :83);
  test/runtime/spec-001/hash-chain-verification.test.ts (:38,:44,:64).
  NICHT in CI (describe.skip ohne TEST_DB_URL): test/runtime/db/hash-chain.db.test.ts:43,63;
  hash-chain-corruption.db.test.ts:30,70 — d.h. Trigger/RPC-Ebene in der Pipeline ungeprüft.
ENFORCEMENT: HARD auf DB-Ebene (Trigger + Immutability), CI-Nachweis nur für TS-Schicht
```

### A.9 AI Gateway

```text
STATUS: PARTIAL
EVIDENCE — zwei unabhängige Aufrufpfade:
- Schicht A ("ai-gateway", LM Studio primär): supabase/functions/ai-gateway/index.ts
  (op-API :103-148, OpenAI-kompatibel :95-100,152-178; Vault/Env-Keys :191-230; IP-Rate-Limit
  :41-85); Routing: _shared/aiGateway/router.ts:23-29 (PROVIDER_BY_PROFILE; cloud-fallback →
  anthropic), Fallback-Kette LM Studio → Anthropic → OpenAI :51-62,113-134; embed ohne
  Cloud-Fallback :82-84
- Schicht B (DB-konfigurierte Tools): _shared/providers.ts:123-132 (Dispatch), Anthropic :135-175,
  Google :178-204, Ollama :217-273, OpenAI :276-307; dynamische Konfiguration: ai_tools-Tabelle
  (_shared/ai.ts:91-97), Residency-RPC resolve_ai_residency (:61-75; eu_local → Ollama-Zwang
  :137-153), Env+Vault (providers.ts:31-65)
- Logging ai_tool_runs: _shared/ai.ts:207-219 (Erfolg), :272-282 (Fehler); log-tool-run:67-69
- DIVERGENZ: Frontend-Spiegel src/core/ai-gateway/config.ts routet 'cloud-fallback' → openai,
  Edge-Router _shared/aiGateway/router.ts:28 → anthropic
- Doppelzählung: ai-invoke/index.ts:57-71 bucht limit.ai_tokens_monthly zusätzlich zu ai.ts:226
- Cloudflare AI Gateway: NOT_FOUND (gateway.ai.cloudflare, CLOUDFLARE_AI_GATEWAY → 0 Treffer)
- Dritter Pfad (platform/): builder_orchestrator/app/services/llm.py:322-346 (Anthropic → Ollama → Stub)
TEST: test/edge/llm-quota.test.ts (in CI, fail-closed :93,:104); _shared/ai.ts und Router ohne
  direkten Test
ENFORCEMENT: AI-Calls/Tokens/Kosten siehe Enforcement-Tabelle T-13/T-14/T-15
```

### A.10 REST API

```text
STATUS: PARTIAL
EVIDENCE:
- Kunden-Doku-Seite: src/pages/ApiDocs.tsx:13-91 (12 Endpunkte), Auth :142-156,
  Rate-Angaben :152, Beta-Disclaimer :210-219; Basis-URL = Supabase-Projekt-URL (:138)
- Router-Function: supabase/functions/api-gateway/index.ts — API-Key via RPC verify_api_key
  :42-51, IP-Whitelist :59-72, Scopes :86-92, Rate-Limit :94-111, Routing mit GENAU 3 Endpunkten
  (/api/v1/gaps :135, /reports :158, /agents :169), POST-Envelope statt REST :22-27,76
- 4 dokumentierte Endpunkte OHNE Implementierung: src/config/production-edge-functions.ts:270-273
  (audit, avv-generator, dsfa, sub-processors als UNBACKED_CALLERS; UI zeigt "Noch nicht
  verfügbar" ApiDocs.tsx:169-173)
- OpenAPI/Swagger-Spec als Datei: NOT_FOUND (Dateinamen- + Inhaltssuche über Repo → 0 Treffer);
  platform/-FastAPI liefert OpenAPI als Framework-Default (platform/governance_backend/app/
  main.py:99-104, builder_orchestrator/app/main.py:62-67), kein eingechecktes Artefakt
TEST: e2e/api-*.spec.ts (7 Dateien) NICHT in CI; kein Unit-Test für api-gateway
ENFORCEMENT: API-Zugriff/Calls siehe T-06; Feature-Gate 'api'-Permission serverseitig
  nirgends geprüft außer implizit über API-Key-Vergabe
```

### A.11 TypeScript SDK

```text
STATUS: PARTIAL (Code vorhanden; Publikation nicht nachweisbar)
EVIDENCE:
- packages/sdk/src/index.ts:1-2; Klasse RealSyncDynamicsSDK packages/sdk/src/client.ts:21
  (22 Methoden, :71-218); CJS+ESM+Types: packages/sdk/package.json:5-14 + tsconfig.cjs/esm.json
- npm-Publikation: UNKNOWN — publishConfig vorhanden, aber kein Publish-Workflow
  (grep npm publish/NPM_TOKEN/packages/sdk über .github/workflows → 0), kein Root-Workspace,
  repository.url zeigt auf fremdes Repo (github.com/realsyncdynamics/sdk-ts)
TEST: packages/sdk/test/client.test.ts (9 Suites, u.a. 'should handle API errors gracefully' :62)
  — läuft NICHT im Root-npm-test (vitest.config.ts:29 include nur test/**) und in keinem Workflow
ENFORCEMENT: —
UNKNOWN REASON: npm-Registry-Zustand aus dem Repo nicht feststellbar → CHECK-08
```

### A.12 Go SDK

```text
STATUS: NOT_FOUND
Search: find . -name "*.go" / go.mod / go.sum (gesamtes Repo ohne node_modules/.git) → 0 Treffer.
No implementation found.
```

### A.13 Terraform Provider

```text
STATUS: NOT_FOUND (eigener Provider) / VERIFIED (Terraform-NUTZUNG als Konsument)
EVIDENCE (Nutzung): deploy/cloudflare/main.tf:27-39 (required_providers cloudflare ~>4.40),
  variables.tf, outputs.tf — ausdrücklich nicht automatisch angewendet (main.tf:21-23),
  in keinem Workflow referenziert
NOT_FOUND REASON (eigener Provider): *.tf nur in deploy/cloudflare/; kein terraform-provider-*-
  Verzeichnis, kein Go-Code (A.12) → ein eigener Provider ist technisch ausgeschlossen
```

### A.14 Bots / Channels

```text
STATUS: PARTIAL
EVIDENCE — 4 Kanäle (Typ-Union _shared/bots.ts:51: chat|voice|telegram|whatsapp;
  DB-CHECK 20260628120000_bots_foundation.sql:26,49):
- Web-Chat: bot-chat/index.ts — Input-Cap 4000 :35,56-58; gateFeature 'bots.enabled' :67;
  consumeUsage 'limit.bot_messages_monthly' → 402 :75-81
- WhatsApp: whatsapp-webhook/index.ts — Meta-Handshake :228-236; HMAC-Signaturprüfung :61-78
  (⚠️ fail-open ohne APP_SECRET :62); Dedupe :147-154; Quota VOR AI-Call :157-171;
  gateFeature 'bots.whatsapp' :282; Konversations-Zählung (nur recordUsage) :185-190
- Telegram: telegram-webhook/index.ts — Secret-Check :357-359 (⚠️ fail-open ohne
  TELEGRAM_WEBHOOK_SECRET :23,357); KEINERLEI Quota/Feature-Gate (grep usage|quota|entitle|
  gateFeature über die Datei → 0 Treffer)
- Voice: bot-voice-webhook/index.ts — gateFeature 'bots.voice' :128,174; Minuten nur
  recordUsage :89 (kein Block)
- Inkonsistente dritte Foundation-Migration: 20260628193744_bots_foundation.sql:67
  (channel in web/telegram/voice — abweichende Menge)
- Slack/Teams/E-Mail/Discord als BOT-Kanal: NOT_FOUND (Slack nur Alert-Ziel:
  compliance-alert-trigger/index.ts:118-139; Connector-Katalog seed-integrations/index.ts:17-20)
- Einbettbares Chat-Widget für Kundenseiten: NOT_FOUND (public/sdk/ enthält nur
  cookie-consent.js; *widget*-Suche liefert nur interne React-Komponenten)
TEST: test/bots/whatsapp-parse.test.ts (u.a. 'kürzt Antworten über 4000 Zeichen' :96, in CI);
  test/telegram-webhook.test.ts (Token/Command/Zugriff, in CI). Quota-Pfade ungetestet.
ENFORCEMENT: je Kanal unterschiedlich — siehe T-02/T-03/T-04/T-05
```

### A.15 Governance Runtime

```text
STATUS: PARTIAL
EVIDENCE:
- Sentinel-Loop: _shared/agents/deadlineSentinel.ts:1-152 (deterministisch, dedupeKey :22) +
  Runner deadlineSentinelRunner.ts; Einstieg agent-os-runner/index.ts:80-135 (Tenant-Schleife :87)
- SLO-Tracking: _shared/agents/monitoringSlo.ts:1-99 + Runner; Aufruf agent-os-runner:94-98
- Auto-Mapping Asset→Control: _shared/autoMap.ts:83-147 (nur EU_AI_ACT/GDPR/HEALTHCARE;
  manual nie überschrieben :143); ISO/NIS2/DORA/TISAX ohne Ableitungsregel (Test bestätigt:
  test/governance/autoMap.test.ts:63)
- Incident-Dispatch → n8n: governance-risk-escalate/index.ts:51-101
  (N8N_GOVERNANCE_INCIDENT_WEBHOOK, non-blocking); workflow_runs-Pfad getrennt
  (workflow-trigger/index.ts:36,104-143; keine Verbindung zu governance_incidents)
- runtime_events: 20260602100000:166-237 (partitioniert), 6 Edge-Schreiber (u.a.
  governance-memory:108, governance-dsr:336, memory-decay-worker:61)
- ⚠️ agent-os-runner hat KEINEN cron.schedule-Eintrag (Migrationen durchsucht);
  registriert ist nur governance-monitoring-scheduler (20260624000003:13-42)
- ⚠️ governance-incidents/index.ts ist ein 55-Zeilen-Stub: Insert ohne tenant_id :31-38,
  kein Auth-Check
TEST: in CI: test/agents/deadlineSentinel|monitoringSlo|governanceBrief.test.ts,
  test/governance/autoMap.test.ts (idempotent :110). Kein Test für governance-incidents,
  governance-risk-escalate.
ENFORCEMENT: —
UNKNOWN: ob agent-os-runner in Produktion durch externen Scheduler getriggert wird → CHECK-05
```

### A.16 Audit-Modul

```text
STATUS: PARTIAL
EVIDENCE:
- Regel-Engine: gdpr-audit/index.ts:12-17 (evaluateAll, RULE_ENGINE_VERSION); public per
  verify_jwt=false (supabase/config.toml:102-103)
- Scanner-Service: services/playwright-scanner/src/scanner.ts (506 Z.; scan() :116,
  Tracker-Patterns :28-92, Score :463-485); Anbindung cookie-scan-deep/index.ts:362-383
- Recheck-Cron: audit-recheck-weekly/index.ts:34-35 (Drift −10, 7 Tage);
  Schedule 20260506290000_audit_recheck_cron.sql:10-19 — ⚠️ Job heißt 'audit-recheck-daily'
  (0 7 * * *), Function 'weekly', Migrations-Kommentar nennt Schwelle >5, Code −10
- Share-Token: DB-Spalte vorhanden (20260506150000:15, 20260506230000:11), aber KEIN
  Konsumpfad (grep share_token über supabase/functions+src → nur share-dashboard/index.ts:132,
  anderes Feature)
- audit_jobs: erst per Reconciliation angelegt (20260822000000_reconcile_missing_frontend_
  tables.sql:43-67; Kommentar :6-9: Ledger-Eintrag existierte, Tabelle fehlte);
  Worker-RPC-Lockdown 20260827000000:28-31; Consumer worker/src/index.ts:39,60,75
- audit_evidence: kein CREATE TABLE im Repo; defensive Behandlung 20260723000001:252-274
  ('audit_evidence fehlt — Policy-Refactoring uebersprungen')
TEST: test/audit/telemetryHelpers.test.ts, test/gate-2-determinism-api.test.ts (in CI).
  Kein Test für scanner.ts, audit-recheck-weekly, worker/ (CI nur Typecheck:
  backend-services-ci.yml:25-32).
ENFORCEMENT: Scan-Limits siehe T-16
UNKNOWN: ob audit_evidence in der Live-DB existiert → CHECK-02
```

### A.17 Entitlements

```text
STATUS: PARTIAL — zwei parallele Wahrheitsachsen ohne Kopplungstest
EVIDENCE:
- Achse 1 (SSoT): shared/pricing.ts — hasPermission :1582, hasModule :1592, hasChannel :1602,
  limitOf :1615, withinLimit :1625, resolvePlan :1636; Deno-Zwilling
  supabase/functions/_shared/pricing.generated.ts (byte-identisch verifiziert; Generator
  scripts/sync-shared-pricing.mjs:58,80). Serverseitige Nutzung des Zwillings: nur
  evidence-vault-export/index.ts:27,47 und plans/index.ts:54.
- Achse 2 (DB-Entitlements): RPC tenant_entitlements —
  20260808120000_tenant_entitlements_with_grants.sql:46-90 (subscriptions :53-59, 4-stufiger
  Produkt-Fallback :62-69, UNION entitlement_grants :73-79, MAX/-1-Regel :88);
  Edge-Loader _shared/entitlements.ts:38
- Primitive: gateFeature/requireFeature _shared/entitlements.ts:56,83 (FORBIDDEN);
  consumeUsage _shared/usage.ts:113-154 (Plan-Limit :129-135, globaler Cap :139-145,
  QUOTA_EXCEEDED); recordUsage :96-110 (zählt nur). ⚠️ requireQuota (:67) ist toter Code
  (0 Aufrufer). ⚠️ Race dokumentiert: usage.ts:17-22 (check-then-insert ohne Lock).
- Werte-Divergenz zwischen den Achsen, Beispiel Seats: SSoT starter=1
  (shared/pricing.ts:487[490]) vs. DB-Entitlement starter=3
  (20260618000000_pricing_tier_alignment.sql:76). Kein Test koppelt PlanLimits an limit.*-Keys.
TEST: test/config/pricing-ssot.test.ts (in CI; Zwilling-Drift :371-377, Katalog-SQL :388,
  Monotonie :142-185); test/runtime/db/entitlement-grants.db.test.ts (9 Cases inkl.
  Stripe-Idempotenz :207-219) — NICHT in CI (describe.skip). gateFeature/consumeUsage:
  KEIN direkter Unit-Test.
ENFORCEMENT: siehe Enforcement-Tabelle (Kern des Audits)
```

### A.18 Subscription System

```text
STATUS: VERIFIED (Repo) / UNKNOWN (Produktions-Constraint)
EVIDENCE:
- subscriptions: 20260406000000_entitlements_schema.sql; trial_ends_at:
  20260720000000_add_trial_ends_at_to_subscriptions.sql
- Genau-ein-Abo-Constraint: 20260711000001_subscription_tenant_unique.sql:11-13
  (UNIQUE(tenant_id)); ⚠️ DB-Test bildet Produktion ausdrücklich OHNE dieses Constraint ab
  (test/runtime/db/entitlement-grants.db.test.ts:38-40)
- entitlement_grants: 20260808100000_entitlement_grants.sql:44-65 (source-CHECK :57,
  purchase_reference :65, revoked statt Delete)
- Trial: shared/pricing.ts trialDays (starter/growth/agency/enterprise = 14);
  supabase/functions/create-trial-subscription/index.ts — ⚠️ nur Growth zugelassen (:6-7,:68
  TRIAL_NOT_AVAILABLE), 14 Tage hartcodiert (:105) statt plan.trialDays; Doppel-Trial-Schutz
  :122-141; Audit trial_audit_logs :160
TEST: entitlement-grants.db.test.ts (NICHT in CI); test/core/billing/trial.test.ts (in CI);
  test/automation-trigger-trial-webhook.test.ts (in CI)
ENFORCEMENT: HARD auf DB-Ebene (UNIQUE) laut Repo; Live-Zustand UNKNOWN → CHECK-02
```

### A.19 Stripe / Checkout / Webhooks (eingehend)

```text
STATUS: VERIFIED
EVIDENCE:
- stripe-webhook/index.ts: Events subscription.created/updated/deleted :110-117,
  trial_will_end :121, invoice.paid/finalized/created/payment_failed :125-133, charge.failed/
  refunded :148-149, checkout.session.completed (One-Time → entitlement_grants) :152-160,298;
  Idempotenz per Event-Insert :92
- stripe-checkout/index.ts: Price-Auflösung aus public.products.default_for_plan_key :117-120,
  Sentinel-Filter internal_default_* :123-126, Vault-first Secrets :44-53, Metadata :151-192
- stripe-portal/index.ts:71-82; Metered: stripe-meter-sync/index.ts:65-132
  (usage_totals → Stripe, billing_mode='metered')
- Preis-IDs: NICHT im Code — DB public.products.stripe_price_id; Abgleich
  scripts/sync-stripe-catalog.ts (npm run stripe:diff/stripe:sync, in keinem Workflow)
TEST (in CI): test/billing/stripe-webhook-plan.test.ts (Idempotenz :105, Fallbacks :21-36);
  test/stripe-checkout.test.ts (Sentinel-Ablehnung :26,:85)
ENFORCEMENT: —
UNKNOWN: Live-Stripe-Produkte/-Preise/-Webhook-Konfiguration → CHECK-06
```

### A.20 Webhooks (ausgehend)

```text
STATUS: PARTIAL
EVIDENCE:
- Verwaltung: governance-webhooks/index.ts:73-119 (create/list/toggle/revoke; Secret
  rsd_whsec_* nur als Hash gespeichert :102-104; HTTPS-Pflicht :93; Owner/Admin-Gate :98-100)
- Dispatch: governance-ingest/index.ts:328,406-491 — ⚠️ HMAC-Schlüssel ist der GESPEICHERTE
  secret_hash, nicht das Klartext-Secret (:449; Header X-RSD-Signature :461); für Empfänger
  nirgends dokumentiert (ApiDocs.tsx:206 sagt nur "per Webhook-Secret")
- VIER parallele Zusteller-Implementierungen: governance-ingest, webhook-dispatcher/index.ts
  :144-182, api-webhook-deliver/index.ts:122-139,225-238, webhook-deliver/index.ts:31-74
  (+ webhook-retry-cron)
- n8n: workflow-trigger/index.ts:37,104-143 (Callback-Secret im Body :113-116);
  workflow-callback/index.ts:27-33 (Bearer-Vergleich, nicht zeitkonstant), Idempotenz :63-65
- ⚠️ governance-connectors/index.ts ist ein Stub (37 Z.): keine Persistenz, keine Auth,
  antwortet pauschal success (:28-32); Lesepfade gehen direkt an integration_connectors
  (src/features/governance/connectorsApi.ts:46)
TEST: kein Test für Dispatch-Pfade gefunden; e2e/api-webhook-management.spec.ts NICHT in CI
ENFORCEMENT: webhooks-Permission serverseitig nicht geprüft (Gate nur über Owner/Admin-Rolle)
```

### A.21 Dashboard

```text
STATUS: PARTIAL
EVIDENCE:
- 42 Feature-Module unter src/features/; 129 /app/*-Routen in src/App.tsx (~:634-850)
- ⚠️ Nur 9/129 Routen direkt in <AppGate>; 120 Routen ohne Route-Level-Guard —
  per Design (App.tsx:715-717: 'Auth Guards bleiben in den View-Komponenten');
  GovernanceBrowserShell prüft keine Auth (src/components/governance-os/
  GovernanceBrowserShell.tsx, importiert nur useNavigate :7)
- Der faktische Produkt-Guard liegt in src/features/kodee/connections/AuthGate.tsx und wird
  von 111 Feature-Dateien importiert
- AppGate: src/features/auth/AppGate.tsx:20,31-34 (Redirect /welcome)
- Kein Onboarding-Zwang: App.tsx:718-719 ('Kein Onboarding-Zwang (kein Hard-Lockout)');
  OnboardingTour.tsx:63-84 ist reiner Tour-Zustand
TEST: kein Routing-Guard-Test in CI; e2e/tenant-admin.spec.ts NICHT in CI
ENFORCEMENT: Auth-Gating SOFT (verteilt auf Views, ohne Test der Vollständigkeit)
```

### A.22 Pricing (SSoT & Seite)

```text
STATUS: VERIFIED
EVIDENCE:
- SSoT: shared/pricing.ts (7 Pläne :414-910, PLAN_ORDER :1420, Add-ons :937-1028,
  BOOKABLE_MODULES :1157-1319 mit MODULE_PRICING_STATUS='provisional' :1142,
  formatPriceEur de-DE :1781-1788)
- Projektion: src/config/pricing.ts:42 (export * from '@/shared/pricing')
- Seite: Route src/App.tsx:873 → src/features/billing/PricingPage.tsx (Imports :8-12);
  Vergleichsmatrix: src/components/pricing/PlanFeatureGroups.tsx (PlanComparisonMatrix),
  GovernanceModuleMatrix.tsx
TEST (in CI): test/config/pricing-ssot.test.ts (Zwilling :371, Katalog-SQL :388, Monotonie,
  'Limits sinken nie' :171); pricing.test.ts, pricing-links.test.ts,
  pricing-no-legacy-names.test.ts, test/content/pricingContent.test.ts
- ⚠️ npm run check:pricing (package.json:23) läuft in KEINEM Workflow; die Drift-Prüfung
  greift nur implizit über den Vitest in npm test
ENFORCEMENT: Preisdaten selbst: n/a; Limit-Enforcement siehe Tabelle
```

### A.23 Feature Flags

```text
STATUS: NOT_FOUND
Search: feature_flags, featureFlags, FEATURE_FLAG, launchdarkly, unleash, flagsmith,
  is_enabled, toggles, Glob **/*flag* über src/**, supabase/**, shared/**, services/** → 0
  relevante Treffer. Gating erfolgt ausschließlich über Plan-Entitlements; zeitlich begrenzte
  Grants wären über entitlement_grants (source='promotion', expires_at;
  20260808100000:57) abbildbar.
```

### A.24 Usage Limits (Infrastruktur)

```text
STATUS: VERIFIED (Infrastruktur) — Verdrahtung lückenhaft (siehe Tabelle)
EVIDENCE: 20260430220000_usage_tracking.sql — usage_events :12, usage_totals :35,
  usage_limits_config :48 (hard/soft_limit, billing_mode), Trigger-Sync :60-102;
  Zählstellen: _shared/ai.ts:225-227, bot-chat:75, whatsapp-webhook:158,187,
  bot-voice-webhook:89, automation-callback:129, workflow-callback:85,
  enterprise-ai-os-agents-run:132, ai-invoke:59, bulk-scan:134, usage-increment:68;
  Kostenspur tenant_cost_ledger (20260603100000:23)
TEST: test/core/usage/usage-service.test.ts (in CI, nur Client);
  test/runtime/db/cost-caps.db.test.ts (Throttle :100, T0-Event :118) — NICHT in CI
ENFORCEMENT: siehe Tabelle
```

### A.25 API Authorization (Edge-Ebene)

```text
STATUS: PARTIAL
EVIDENCE:
- Shared-Helper: _shared/auth.ts:33-127 (requireUser :33-68, requireTenantMembership :75-96,
  requireAuthAndTenant :103-127) — von nur 3/178 Functions importiert
  (governance-agents-list, governance-risk-score, enterprise-ai-os-discovery-pending)
- Handgerollt: 68 Functions mit auth.getUser(), 59 mit memberships-Query;
  113/178 Functions ohne beides (per Iteration über supabase/functions/*/index.ts)
- verify_jwt: supabase/config.toml — 64 [functions.*]-Blöcke, 60× verify_jwt=false
  (Zeilen 71-321), 3 explizit true (:202-203,:235-236,:244-245); ~115 Functions ohne Eintrag
  (Plattform-Default true). Darunter Tenant-Datenflächen mit false: governance-keys/-resources/
  -approvals/-dpias/-incidents/-connectors/-dsr/-vendors (:223-265)
- API-Keys: api_keys 20260506210000:4-15, api_key_validate :51-68 (SECURITY DEFINER, sha256);
  einziger Konsument api-audit/index.ts:60-63; governance_api_keys 20260705110000:6-24
  (⚠️ INSERT für jedes Member erlaubt :38-39, nicht owner/admin);
  Partner-Keys 20260705210000:16-17 + partner-provision-tenant/index.ts:84-101
TEST: test/workers/verify-jwt.test.ts (in CI — testet den NICHT deployten src/workers-Worker);
  _shared/auth.ts und api_key_validate: kein Test
ENFORCEMENT: SOFT bis fehlend, funktionsabhängig
```

### A.26 Tests

```text
STATUS: PARTIAL
EVIDENCE (Zählung per Glob):
- 280 Vitest-Dateien unter test/ (davon 17 DB-Tests test/runtime/db/), 7 unter src/**
  (von vitest.config.ts:29 NICHT erfasst), 2 in packages/sdk (kein Workflow)
- 47 Playwright-Specs: 9 in tests/e2e/ (in CI), 38 in e2e/ (in KEINEM Workflow;
  playwright.config.ts:16 verweist auf nicht existente e2e-tests.yml)
- In CI (ci.yml): lint :21, check:edge-syntax :23, npm test :25, build :27;
  Migrations-Apply-Job :29-113 (ohne RLS-Assertions, ohne test:db)
- NICHT in CI: test:db, e2e (38 Specs), test:pricing, check:pricing, check:production,
  smoke:production, qa:* (grep über .github/workflows → 0 Treffer)
TEST: — (dieser Abschnitt IST die Testlage)
ENFORCEMENT: —
```

### A.27 E2E Tests

```text
STATUS: PARTIAL
EVIDENCE: tests/e2e/ (9 Specs — ai-act, audit, checkout, consent, error-handling, legal,
  navigation, pricing-flow, public-routes) via e2e.yml:93 gegen vite preview :4173 in CI;
  e2e/ (38 Specs — u.a. checkout, pricing-flow, tenant-admin, evidence-vault-export,
  provenance-external-verification, api-*) in keinem Workflow
ENFORCEMENT: —
```

### A.28 Deployment Configuration / Cloudflare

```text
STATUS: VERIFIED (aktive Pfade) + verwaiste Artefakte
EVIDENCE:
- Pages: wrangler.toml:45-47 (dist); deploy-cloudflare-pages.yml (build:full :119,
  Deploy :151-156, Smoke :170-181); public/_headers (CSP/HSTS/Caching), public/_redirects
  (SPA-Fallback :17); Prerender scripts/prerender.mjs (Status-Datei :260-271)
- Deployte Worker: workers/siteos-preview (deploy-siteos-preview.yml:76);
  services/realsync-runtime-core (Containers + DO, Cron */5, deploy-backend-cloudflare.yml:66)
- ⚠️ VERWAIST: wrangler-workers.toml (KV/R2/Canary-Routen, Platzhalter-IDs) + src/workers/**
  — in keinem Workflow gebaut/deployt; nur in docs/ referenziert
- Supabase-Deploy: deploy.yml — db-push mit Repair-Liste von 12 Versionen :33-73,
  db push --include-all :77; functions-deploy nur geänderte Verzeichnisse :113-146,
  deploy_all bei config.toml/_shared-Änderung :115-122
TEST: —
ENFORCEMENT: —
UNKNOWN: tatsächliche Pages-/Worker-Konfiguration im Cloudflare-Account → CHECK-07
```

### A.29 Supabase (Konfiguration & Bestand)

```text
STATUS: VERIFIED (Repo-Bestand) / UNKNOWN (Produktionsbestand)
EVIDENCE: supabase/config.toml (project_id :7, db major_version=15 :16-19 — Live laut
  Doku PG17, nur lokale Dev-Config; auth site_url=localhost :39); 179 Function-Verzeichnisse
  (178 mit index.ts + _shared); 289 Migrationsdateien; Registry-Snapshot
  src/config/production-edge-functions.ts:44-53 (178 Slugs, MEASURED_AT 2026-08-23 —
  Momentaufnahme, kein Live-Beweis); Drift-Guards: edge-function-drift.yml:34 (cron 06:00),
  function-acl-drift.yml:34 (cron 06:30; ⚠️ PR-Trigger nur bei Skript-/Workflow-Änderung
  :13-16), migration-drift.yml:51 (cron 06:00)
- 13 verwaiste .<timestamp>_*.sql.bak im Repo-Root (außerhalb jedes Deploy-Pfads)
TEST: —
UNKNOWN REASON: deployte Functions, Migrations-Ledger, ACLs der Live-DB → CHECK-01…CHECK-04
```

### A.30 Agents

```text
STATUS: PARTIAL
EVIDENCE:
- apps/agent-runtime: Express-Gateway (src/gateway.ts:14-45, Bearer-Pflicht mit
  deny-by-default :30-36) — ⚠️ KEIN Agent-Ausführungs-Loop (nur Registry/43-Zeilen-
  policy-engine/audit-log); package.json:12 deklariert Test-Script, test/ existiert nicht;
  CI nur Typecheck (backend-services-ci.yml:27)
- services/openclaw-agent: echter Tool-Loop — src/agent.ts:41 (runAgent), :64
  (for iter < MAX_TOOL_ITERATIONS), Tool-Dispatch :100-109; cost-cap.ts, rate-limit.ts;
  keine Tests, kein test-Script
- enterprise_agent_runs: ⚠️ doppelt migriert (20260513400000:7-32 UND 20260720110000:4-40,
  divergente Indexnamen); Schreiber enterprise-ai-os-agents-run/index.ts:104
- Governance-Agenten (deterministisch): siehe A.15
TEST: test/agents.test.ts, test/governance/agentRegistry.test.ts, test/features/governance/
  agentsApi|countRunsThisMonth|runRowToResult.test.ts (in CI)
ENFORCEMENT: Agent-Anzahl: NOT_FOUND (Suche max_agents, agent_limit, agents.max, bots.max
  über *.ts/*.sql → nur Marketing-Strings); Agent-Runs: Metering ohne Block (T-12)
```

---

## B. Produktions-Unknowns (mit ausführbarem CHECK)

Diese Zustände sind aus dem Repository prinzipiell nicht verifizierbar. `UNKNOWN` gemäß Spec §3 — nicht mit `NOT_FOUND` zu verwechseln.

```text
CHECK-01  Deployte Edge Functions (Live vs. 178 im Repo)
  CHECK: supabase functions list --project-ref ebljyceifhnlzhjfyxup
         (Vergleich gegen src/config/production-edge-functions.ts)

CHECK-02  Live-DB-Schema: RLS-Policies, Funktions-ACLs, UNIQUE(subscriptions.tenant_id),
          Existenz von audit_evidence / audit_jobs, Migrations-Ledger
  CHECK: supabase db pull  bzw.  SELECT version FROM supabase_migrations.schema_migrations;
         SELECT conname FROM pg_constraint WHERE conname='subscriptions_tenant_id_key';
         SELECT to_regclass('public.audit_evidence');
         npm run check:function-acls

CHECK-03  pg_cron-Registrierung (audit-recheck-daily, memory-decay-hourly,
          governance-monitoring, KEIN Eintrag für agent-os-runner erwartet)
  CHECK: SELECT jobname, schedule FROM cron.job;

CHECK-04  usage_limits_config-Inhalt in Produktion (hard_limits, billing_mode je Key)
  CHECK: SELECT entitlement_key, hard_limit, soft_limit, billing_mode FROM usage_limits_config;

CHECK-05  Trigger-Quelle für agent-os-runner in Produktion (externer Scheduler? n8n?)
  CHECK: Supabase Dashboard → Functions → agent-os-runner → Invocations/Logs

CHECK-06  Stripe-Live-Konfiguration (Products/Prices je plan_key, Webhook-Endpunkte,
          Metered-Items)
  CHECK: npm run stripe:diff  (scripts/sync-stripe-catalog.ts) mit Live-Key;
         Stripe Dashboard → Developers → Webhooks

CHECK-07  Cloudflare: Pages-Build-Command (liegt laut wrangler.toml:9-17 im Dashboard),
          deployte Worker (siteos-preview, runtime-core), KEIN Deployment von
          wrangler-workers.toml erwartet
  CHECK: npx wrangler pages project list / npx wrangler deployments list

CHECK-08  npm-Publikation @realsyncdynamics/sdk
  CHECK: npm view @realsyncdynamics/sdk version

CHECK-09  Secrets-Belegung, die fail-open-Pfade schließen (WHATSAPP_APP_SECRET,
          TELEGRAM_WEBHOOK_SECRET — beide Kanäle akzeptieren ohne Secret JEDE Anfrage:
          whatsapp-webhook/index.ts:62, telegram-webhook/index.ts:23,357)
  CHECK: supabase secrets list --project-ref ebljyceifhnlzhjfyxup

CHECK-10  Provider-Erreichbarkeit des EU-lokal-Stacks (Ollama/LM Studio auf VPS)
  CHECK: curl -s $OLLAMA_URL/api/tags  bzw.  Aufruf ai-gateway op:'health'
```

---

## C. Enforcement-Tabelle über alle Kontingente (Kern der Phase 1)

**Lesehilfe.** Werte-Quelle Achse 1: `shared/pricing.ts` (`PlanLimits`, Zeilen je Plan: free :429-442 · starter :481-494 · growth :545-558 · agency :610-623 · enterprise :688-701 · partner :771-784 · governance_launch :864-882). `-1` = unbegrenzt. Achse 2: DB-Entitlement-Keys (`limit.*`). **Kein Test koppelt die beiden Achsen; Werte divergieren teilweise** (Beispiel Seats: SSoT starter=1 vs. DB starter=3, `20260618000000:76`).
Enforcement-Verdikte nach Spec §5: `HARD` nur bei Backend-Ablehnung **plus** bestätigendem Test in CI. Ein Limit, das nur gezählt/angezeigt wird, ist nicht enforced.

| # | Capability | Plan-Werte (SSoT free→partner / launch) | Enforcement | Evidence | Test |
|---|---|---|---|---|---|
| T-01 | **Bots (Anzahl)** | 0·1·2·10·20·50 / 1 | **DISPLAY_ONLY** | `limit.bots` definiert (`20260628121551_bots_entitlements.sql:12-56`); keine Prüfung bei Bot-Erstellung (Suche `limit.bots` in `supabase/functions/**` → 0 Enforcement-Treffer) | keiner |
| T-02 | **Bot-Antworten/Monat — Web-Chat** | 0·500·2000·25000·50000·100000 / 1000 | **SOFT** | `bot-chat/index.ts:75-81` — `consumeUsage('limit.bot_messages_monthly')` → **402** vor AI-Call; Gate `bots.enabled` :67 | keiner (weder `consumeUsage` noch Function getestet) |
| T-03 | **Bot-Antworten/Monat — WhatsApp** | wie T-02 | **SOFT** | `whatsapp-webhook/index.ts:157-171` (Quota vor AI-Call, Nutzerhinweis statt HTTP-Fehler), Gate `bots.whatsapp` :282; Konversationen nur gezählt :185-190 | nur Parsing (`test/bots/whatsapp-parse.test.ts`) |
| T-04 | **Bot-Antworten/Monat — Telegram** | wie T-02 | **DISPLAY_ONLY** | `telegram-webhook/index.ts` enthält **kein** `consumeUsage`/`gateFeature` (grep über Datei → 0) — einziger Kanal ohne jedes Kontingent | Token/Command-Tests decken kein Quota ab |
| T-05 | **Voice-Minuten/Monat** | (nur DB-Key `limit.bot_voice_minutes_monthly`) | **DISPLAY_ONLY** (Feature-Gate SOFT) | Gate `bots.voice`: `bot-voice-webhook/index.ts:128,174`; Minuten nur `recordUsage` :89 — **kein Block** | keiner |
| T-06 | **API-Aufrufe/Monat** | 0·0·0·50000·250000·1000000 / 0 | **SOFT — mit Werte-Widerspruch** | `api-gateway/index.ts:94-111` (Stunden-Rate je Key, Default 100 :56 → 429); `api-audit/index.ts:98-119` — **hartcodiert** `{agency:1000, scale:10000, enterprise:100000, free:0}` gegen `tenants.subscription_tier` (403/429 :117,:138-150). Beide Pfade ignorieren die SSoT-Werte; `api-audit` widerspricht ihnen (agency 1.000 statt 50.000) und nutzt den verbotenen Legacy-Namen `scale` | keiner |
| T-07 | **Mandanten (tenants)** | 1·1·1·1·5·50 / 1 | **DISPLAY_ONLY** (Plan-Achse) | Konsumenten nur UI (`UnifiedPlanCard.tsx:205-208`, `EnterpriseAccessSection.tsx:115`); Tenant-Erstellung ungeprüft (Signup-Trigger `20260501000000:11-46`); einzige Mengenbremse ist die **Partner**-Monatsquote `partner-provision-tenant/index.ts:104-120` (429, gegen `partners.max_tenants_per_month`, kein Plan-Entitlement) — SOFT | keiner |
| T-08 | **Nachweisspeicher (GB)** | 0.5·2·10·50·200·500 / 5 | **DISPLAY_ONLY** | `limit.evidence_storage_gb` nur definiert (`20260808110000:39,72`); kein Byte-Zähler, kein Upload-Gate (Suche `evidence_storage`, `storage_gb`, `bytes_used` → 0 Enforcement) | nur Entitlement-Auflösung (DB-Test, nicht in CI) |
| T-09 | **Seats/Benutzer** | 1·1·5·15·50·100 / 3 | **DISPLAY_ONLY** | Invite-Flow prüft nichts: `tenant-invite/index.ts:89-117` (create), `:155-186` (accept → Insert ohne Seat-Check); Migrations-Kommentar behauptet Prüfung („checked at invitation time", `20260430220000:135`) — **existiert nicht**; `requireQuota` toter Code (`_shared/entitlements.ts:67`, 0 Aufrufer) | keiner |
| T-10 | **Automationsläufe/Monat** | 0·25·100·500·2000·10000 / 10 | **SOFT** | `automation-trigger/index.ts:74-91` (Gate + Limit-Vergleich → **402**); Workflow-Zwilling `workflow-trigger/index.ts:74-91`; Zählung erst bei Erfolg (`automation-callback:129`, `workflow-callback:85`) | keiner |
| T-11 | **Bulk Jobs/Monat** | 0·0·0·100·500·−1 / 0 | **SOFT** | `bulk-scan/index.ts:113` (Gate `bulk.jobs`), `:134-136` (`consumeUsage` → **429**) | nur E2E `e2e/feature-bulk-operations.spec.ts` — nicht in CI |
| T-12 | **Agent-Runs/Monat** | DB-Werte `20260721000000:31-38` (free 0 … enterprise −1) | **DISPLAY_ONLY + Metering** | `enterprise-ai-os-agents-run/index.ts:132` nutzt `recordUsage` (zählen/abrechnen), **nicht** `consumeUsage` (blocken) — auch free mit Kontingent 0 wird nicht blockiert; `billing_mode='metered'` (`20260721000000:25`) macht das als Overage-Design erkennbar, ein Block-Pfad fehlt dennoch | `test/edge/agent-runs-metering.test.ts` (in CI — testet Metering, kein Block) |
| T-13 | **AI-Calls + AI-Tokens/Monat** | DB-Keys `limit.ai_calls_monthly`, `limit.ai_tokens_monthly` | **SOFT** | `_shared/ai.ts:102` (Gate), `:117-135` (Pre-Check → **402**), `:225-227` (Zählung); ⚠️ Doppelzählung Tokens in `ai-invoke/index.ts:57-71` | kein direkter Test für `_shared/ai.ts` |
| T-14 | **LLM-Queries (governance-agent)** | DB-gestützter Cap | **HARD** | `_shared/llm-quota.ts:71,96` → `governance-agent/index.ts:212-232` (**429**; RPC-Fehler → **503 fail-closed**) | `test/edge/llm-quota.test.ts` in CI (Cap-Grenze :144, fail-closed :93,:104) |
| T-15 | **Kosten-Cap (LLM-Budget)** | `reserve_llm_budget` (DB) | **SOFT**¹ | `20260604000000_economic_intelligence.sql:168-244` (throttle ohne Reservierung, T0-Event :219-226); Client `_shared/cost-cap.ts:66,119` | `test/runtime/db/cost-caps.db.test.ts:100,118` — **nicht in CI** (¹ HARD nach Spec erst mit CI-Test) |
| T-16 | **Audit-Berichte / Scans/Monat** | 1·2·12·50·200·500 / 5 | **DISPLAY_ONLY** | Free-Scan-Limit nur clientseitig: `src/core/billing/useScanLimits.ts` (zählt im Client) — serverseitig keine Prüfung, umgehbar; anonymes IP-Rate-Limit (`_shared/anonRateLimit.ts`) ist kein Plan-Limit | `test/core/billing/useScanLimits.test.ts` (Client-Logik, in CI) |
| T-17 | **Domains** | 1·1·3·10·25·100 / 1 | **DISPLAY_ONLY** | `limit.domains` definiert (`20260618000000:34-161`), nirgends serverseitig geprüft (Suche `limit.domains`, `maxWebsites`, `count.*domains` → 0 Enforcement) | keiner |
| T-18 | **Behebungspläne (remediationPlans)** | 0·5·20·100·500·−1 / 0 | **DISPLAY_ONLY** | nur Katalogdatum (`pricing.generated.ts:261,450-890`); kein Enforcement-Code (grep `remediation.*limit` über `supabase/**` → 0) | keiner |
| T-19 | **API-Schlüssel (apiKeys)** | 0·0·0·10·50·−1 / 0 | **DISPLAY_ONLY** | nur Katalogdatum (`pricing.generated.ts:265,452-892`); Key-Anlage ohne Mengenprüfung (`20260506210000:31-38` regelt nur Rollen) | keiner |
| T-20 | **Compliance-Exporte/Monat** | DB-Key `limit.compliance_exports_monthly` | **DISPLAY_ONLY** | definiert `20260618000000:77-165`, nur Anzeige `UsageView.tsx:144`; kein Zähl-/Sperrcode | keiner |
| T-21 | **Aktive Assets / Registrierungen** | DB-Keys `limit.active_assets`, `limit.monthly_registrations` | **DISPLAY_ONLY** | nur Anzeige `UsageView.tsx:141-142`; 0 Treffer in `supabase/functions/**` | keiner |
| T-22 | **Policy Packs (Feature)** | ab Agency (`20260701150000:118-126`) | **SOFT** | `policy-packs/index.ts:49-54` → **402** | Gate ungetestet |
| T-23 | **Evidence-Export (Feature)** | Permission `auditExport` | **SOFT** | `evidence-vault-export/index.ts:47` (einziges SSoT-Gate serverseitig) | E2E nicht in CI |
| T-24 | **Scheduler / Provenance (Feature)** | ab Agency | **SOFT** | `scheduler/index.ts:93`, `provenance/index.ts:218` (gateFeature) | keiner |
| T-25 | **Generischer Zähl-Endpunkt** | beliebiger `limit.*`-Key | **SOFT** | `usage-increment/index.ts:54-85` (Membership-Check + `consumeUsage` → **402**) | keiner |

**Querbefunde zur Tabelle**
1. **Kein einziges Mengen-Limit erreicht nach Spec-Definition `HARD`** außer T-14 (LLM-Queries). Alles andere ist entweder ungetestet (SOFT) oder gar nicht erzwungen (DISPLAY_ONLY).
2. **Von 12 verkauften SSoT-Limit-Typen sind 7 reine Anzeige** (Bots-Anzahl, Tenants, Storage, Seats, Audit-Berichte, Domains, Behebungspläne, API-Schlüssel — T-01, T-07, T-08, T-09, T-16, T-17, T-18, T-19).
3. **Statuscode-Inkonsistenz** bei Überschreitung: 402 (`bot-chat`, `automation-trigger`, `usage-increment`, `_shared/ai.ts`), 429 (`bulk-scan`, `governance-agent`, `api-audit`, `api-gateway`), 403 (`api-audit` Free) — quer über `supabase/functions/**`.
4. **Race-Condition ist dokumentierter Ist-Zustand**: `_shared/usage.ts:17-22` (check-then-insert ohne Lock, „brief over-shoot … acceptable").
5. **Die Enforcement-Primitive selbst (`consumeUsage`, `gateFeature`) haben null direkte Unit-Tests**, tragen aber 10+ Functions.

---

**ENDE PHASE 1.** Keine Claims-Matrix, keine Pricing-Analyse, keine Verbesserungsvorschläge, keine Implementierung. Phase 2 nur nach expliziter Freigabe (`AUFTRAG_1.md`, §6/§20).
