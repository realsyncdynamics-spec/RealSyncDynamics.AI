# Agent 11 – Unabhängige QA- und Security-Baseline (Welle 1, Issue #1972)

Stand: 23.10.2026, Repo-HEAD `b4f8a2ffc5e46aebfbd9d7264ac84a00756ba523` (== origin/main). Strikt lesend gearbeitet; einzige geschriebene Datei ist dieser Bericht. `git status --porcelain` nach allen lokalen Läufen: 0 Zeilen (VERIFIZIERT).

Status-Legende: **VERIFIZIERT** (selbst gelesen/ausgeführt/per API abgefragt) · **ABGELEITET** (Schluss aus Belegen, nicht ausgeführt) · **BLOCKIERT** (mit Grund).

---

## Kurzfazit (Top-Befunde)

1. **main ist grün** auf HEAD b4f8a2f: CI #39975271505, E2E #39975271543, CodeQL #39975271523 – alle `success` (VERIFIZIERT).
2. **Große Teile der Testsuite laufen in keiner CI**: `e2e/` (41 Specs, ~442 `test()`) – nur 1 Spec läuft (siteos-production-e2e); 8 Testdateien unter `src/`, 2 unter `packages/sdk`, 8 unter `apps/mcp-server`, 23 Python-Tests unter `platform/` werden nie ausgeführt (VERIFIZIERT über Configs/Workflow-Grep).
3. **Wahrscheinlich vakuös grüner Ratchet-Test**: `test/ci/fabricated-results-ratchet.test.ts` importiert `scripts/check-fabricated-results.mjs`, dessen ROOT unter Vitest mit `/@fs`-Präfix ins Leere zeigt → findet nie etwas. Lokal per Node meldet das Skript **Exit 1** (neue Fundstelle `src/components/landing/v5/heroEuropeNetwork3D.ts`), CI-Unit-Job ist trotzdem grün (ABGELEITET, starke Belege).
4. **Webhook-Sicherheit uneinheitlich**: Stripe/Shopify/Twilio fail-closed; **WhatsApp und Telegram fail-open**, wenn das Secret fehlt (`whatsapp-webhook/index.ts:64`, `telegram-webhook/index.ts:372`). Für WhatsApp-Signaturprüfung gibt es **keinen** Test.
5. **Concurrency/Idempotenz-Lücken**: `consumeUsage` ist Check-then-Insert (TOCTOU, Quota überschreitbar); WhatsApp-Dedupe ist Check-then-Act; Twilio-Status-Callback hat keinen Replay/Dedupe-Schutz (Minuten doppelt buchbar); `bot_appointments` hat **keine** Slot-Eindeutigkeit/EXCLUDE-Constraint; `order-intake` Legacy-Pfad übernimmt **clientseitige Preise/Total**.
6. **Tenant-Grenzen**: starke DB-Testbasis (53 `*.db.test.ts`, CI-Job mit echten Migrationen, RLS-Invariante „keine neue Tabelle ohne RLS“), aber **keine Cross-Tenant-Tests für `bots`, `bot_conversations`, `bot_messages`, `bot_appointments`, `bot_orders`**; 8 Tabellen ohne RLS als bekannte Schuld (u. a. `subscription_addons`, `provenance_records`).
7. **Stripe-Webhook-Tests sind überwiegend Spiegel-/Quelltext-Tests** (Logik im Test nachgebaut), kein Test ruft den Handler mit signierter Test-Nutzlast auf.
8. **Akzeptanzszenarien 1, 2, 4, 8** sind heute weitgehend ungetestet bzw. fachlich nicht implementiert (72-h-Trial existiert nicht – Starter hat 14 Tage; keine Kalenderintegration).

---

## A) Test-Inventar

### A.1 Vitest (Root)
- Config `vitest.config.ts:22-28`: `environment: jsdom`, `include: ['test/**/*.{test,spec}.{ts,tsx}']` (VERIFIZIERT). **Nur `test/` wird ausgeführt.**
- `test/`: **662 Testdateien**, ca. **6.901** `it(`/`test(`-Zeilen (VERIFIZIERT, `grep -c`, Näherung).
- Verteilung nach Unterordner (Top): features 88, edge 68, runtime 63 (davon `runtime/db` 53 DB-Integrationstests), governance 53, core 53, siteos 38, landing 30, billing 22, security 21, lib 20, components 15, config 13, … bots 5, voice 1, ai-gateway 2, evidence 2, contracts 6, ci 7 (VERIFIZIERT).
- Domänen-Abdeckung (VERIFIZIERT per Dateinamen):
  - Billing/Stripe: `test/billing/*` (22), `test/stripe-checkout*.test.ts` (3), `test/billing.test.ts`.
  - Edge Functions (Vitest gegen Deno-Code, rein/importfrei): `test/edge/*` (68) – Auth, Quota, Audit, GDPR, Kosten.
  - Security: `test/security/*` (21) – JWT-Gate, Service-Role-Auth, CSP, OAuth-State, Preview-Sandbox.
  - Bots: `test/bots/*` (5) – Prompt-Builder, Restaurant-Order/-Conversation, Twilio-Signatur, WhatsApp-Parser.
  - Governance/PDP: `test/governance/*` (53) inkl. `pdp-botmessage`, `pdp-toolcall`, `bot-pep-wiring`, `bot-chat-privacy-order`.
  - DB/RLS: `test/runtime/db/*.db.test.ts` (53) + `test/db/*` (4).
- Nicht ausgeführt (außerhalb `include`): `src/**` 8 Testdateien (`src/features/seo-marketing-dashboard/__tests__/*` 6, `src/features/ui-lab/impact.test.ts`, `src/lib/__tests__/auditLogger.test.ts`), `packages/sdk/test/*` 2 (VERIFIZIERT: Pfad nicht in `include`, kein anderer Runner in Workflows gefunden).

### A.2 Playwright
| Config | testDir | Specs | `test()` | In CI? |
|---|---|---|---|---|
| `playwright.catalog.config.ts` | `tests/e2e` | 9 | 38 | Ja – `npm run test:e2e` in `e2e.yml` (VERIFIZIERT `package.json:26`, `e2e.yml`) |
| `playwright.config.ts` | `e2e` | 41 | ~442 | **Nein**, außer `e2e/siteos-production-publish.spec.ts` via `siteos-production-e2e.yml:56` (VERIFIZIERT) |

- E2E-CI läuft gegen `vite preview` ohne Supabase-Backend (`e2e.yml` setzt nur GA4/Meta-Dummy-Env) → nur statische/Katalog-Flows (ABGELEITET).
- Bedingte Skips: `tests/e2e/checkout.spec.ts:54,62,66` (Stripe-Checkout-Abschluss nur manuell bzw. übersprungen), `consent.spec.ts:27,47,97,111`, `ai-act.spec.ts:25`, `legal.spec.ts:17` (VERIFIZIERT) → ein grüner E2E-Lauf belegt keinen Checkout.
- `playwright.config.ts:26` ignoriert in CI `governance/inspector-panel.spec.ts` (irrelevant, da Suite ohnehin nicht in CI).

### A.3 Deno-Tests in `supabase/functions`
- **0** Dateien `*_test.ts`/`*.test.ts` (VERIFIZIERT `find`). Edge-Function-Logik wird ausschließlich per Vitest über reine `_shared`-Module bzw. Quelltext-Verträge getestet. 197 Function-Verzeichnisse, 390 Migrationen (VERIFIZIERT `ls | wc -l`).

### A.4 services/ apps/ workers/ platform/
| Bereich | Testdateien | CI |
|---|---|---|
| `services/` | 0 | nur Typecheck/Install-Smoke (`backend-services-ci.yml:26-33`) |
| `apps/agent-runtime/test` | 6 (session-runtime, voice-policy, grok-provider, voice-session-endpoint, session-persistence, tool-gateway) | Ja, `npm test` in `backend-services-ci.yml:28` (path-gefiltert) |
| `apps/mcp-server/test` | 8 (key-hash, rate-limit, mcp-protocol, chain-hash, api-keys, scopes, governance-controls, quota) | **Nein** (nicht in Matrix) |
| `workers/`, `worker/` | 0 | `worker` nur `tsc --noEmit` |
| `platform/` (Python) | 23 (`governance_backend` 9, `builder_orchestrator` 13, `traefik` 1) | **Nein** – kein `pytest` in `.github/workflows` (VERIFIZIERT grep), nur CodeQL-Python-Analyse |
| `packages/sdk/test` | 2 | **Nein** |

---

## B) CI-Baseline

### B.1 Letzte Läufe auf `main` (VERIFIZIERT via `mcp__github__actions_list`)
| Workflow | Run-ID | Commit | Ergebnis | Zeit (UTC) |
|---|---|---|---|---|
| CI (`ci.yml`) | 39975271505 | b4f8a2f (#1860) | success | 2026-10-23 15:05–15:12 |
| CI | 39972134817 | 42dd11f (#1930) | success | 14:43–14:50 |
| CI | 39971355433 | e3125d9 (#1841) | success | 14:38–14:45 |
| CI | 39969818139 | 2ea4b02 (#1856) | success | 14:27–14:34 |
| CI | 39967831356 | b2a6529 (#1950) | success | 14:13–14:24 |
| CI | 39965686017 | abdf0e9 (#1965) | success | 13:58–14:15 |
| E2E (`e2e.yml`) | 39975271543 | b4f8a2f | success | 15:05–15:07 |
| E2E | 39972134875 / 39971355393 / 39969818337 / 39967831165 / 39965686002 | s. o. | alle success | |
| CodeQL (`codeql.yml`) | 39975271523 | b4f8a2f | success | 15:05–15:09 |
| CodeQL | 39972134928 / 39971355365 / 39969818174 / 39967831044 / 39965686079 | s. o. | alle success | |
| Merge Hygiene (schedule) | 40024932273 | b4f8a2f | success | 21:11–21:14 |

- Jobs CI #39975271505 (VERIFIZIERT `list_workflow_jobs`): `gates` success (Kontext-Budget, Typecheck, Edge-Syntax, Edge-Refs, Pricing-, Modellpreis-, Kontingent-Kanonizität, Angebots-Sicherheit), `unit` success (6:12 min), `spa` success, `build` success, `Migration validation` success (alle Migrationen angewendet, DB-Integrationstests 15:06:30–15:07:28; Append-only-Schritt auf push erwartungsgemäß `skipped`).
- Fehlgeschlagene Läufe in den betrachteten Fenstern: keine → keine Job-Logs nötig.
- **main ist aktuell grün** (VERIFIZIERT für CI, E2E, CodeQL, Merge Hygiene).

### B.2 Required Checks / Schutz
- `main` ist `protected: true` (VERIFIZIERT `mcp__github__list_branches`).
- Ruleset-Inhalt per verfügbarer API nicht lesbar → **BLOCKIERT** (kein Branch-Protection-/Ruleset-Read-Tool). Laut Doku `docs/MERGE_CONFLICT_CONCEPT.md:52-58` Required: `build`, `Migration validation`, `Merge Hygiene / conflict-state`, `Merge Hygiene / hygiene`, Merge Queue, 1 Review (ABGELEITET). **E2E und CodeQL sind demnach nicht required.**
- `ci.yml:28-30,118-124` bestätigt, dass `build` als Required-Check-Sammelknoten mit `!cancelled()` gebaut ist (gegen „skipped = passed“).
- Veralteter Kommentar `codeql.yml:8-12` („main nicht geschützt“, Stand 22.08.) widerspricht dem heutigen API-Befund (VERIFIZIERT).
- Risiko: `merge-hygiene.yml` `conflict-state` hat `if: github.event_name != 'merge_group'` → in der Merge Queue übersprungen; ein übersprungener Required Check gilt als bestanden (ABGELEITET; laut Konzept bewusst, da Konflikte in der Queue anders gelöst werden).
- Drafts: `gates/unit/spa/build/db` laufen bei Draft-PRs nicht (`ci.yml:34,88,…`). 9 der 14 offenen PRs sind Drafts (VERIFIZIERT `list_pull_requests`) → für sie existiert **kein** CI-Signal.

---

## C) Lokal ausführbare Checks (Node v22.22.0, ohne node_modules)

Vor Ausführung gelesen; Schreibpfade nur hinter `--update` bzw. ohne `--check`; kein Netzwerk. Nicht ausgeführt: `check-migration-collisions.mjs` (`fetch`, `:221`), `check-edge-function-drift.mjs` (`fetch` api.supabase.com, `:89`), `check-function-acl-drift.mjs` (`fetch`, `:153`), `check-cron-health.mjs` (`fetch`, `:371`), `check-edge-function-syntax/refs.mjs` (benötigen `typescript` aus node_modules), `check:pricing` 2. Hälfte / `check:limits` / `check:entitlements` (benötigen `tsx`) → **BLOCKIERT: node_modules fehlt, npm install verboten**.

| Befehl | Exit | Kernausgabe | Status |
|---|---|---|---|
| `node scripts/check-landing-claims.mjs` | 0 | „✓ Landing claims OK (7 forbidden phrases, 27 non-live items checked).“ | VERIFIZIERT |
| `node scripts/check-fabricated-results.mjs` | **1** | „✗ Neue `Math.random()`-Fundstellen in einer Oberfläche: src/components/landing/v5/heroEuropeNetwork3D.ts (3)“ | VERIFIZIERT |
| `node scripts/check-dashboard-actions.mjs` | 0 | „✓ Inventar deckt sich mit dem Code. 7 Aktionen — PARTIAL: 5 · BROKEN: 1 · CLIENT_ONLY: 1“ | VERIFIZIERT |
| `node scripts/check-context-budget.mjs` | 0 | „8 Markdown-Dateien (Grenze 8) … 57 KB (Grenze 60) … Budget eingehalten.“ | VERIFIZIERT |
| `node scripts/check-sitemap-routes.mjs` | 0 | „✓ 109 Sitemap-URLs, alle mit Route.“ | VERIFIZIERT |
| `node scripts/check-offer-prices.mjs` | 0 | „Fundstellen: 0 … ✓ Kein öffentlicher Betrag ohne einlösbaren Kaufpfad.“ | VERIFIZIERT |
| `node scripts/check-plan-name-gates.mjs` | 0 | „22 gefunden, 15 in der Grundlinie … Keine neuen Plan-Namen-Gates.“ | VERIFIZIERT |
| `node scripts/sync-shared-pricing.mjs --check` | 0 | „✓ pricing.generated.ts ist synchron“ | VERIFIZIERT |
| `node scripts/sync-model-prices.mjs --check` | 0 | „✓ modelPrices.generated.ts ist synchron“ | VERIFIZIERT |
| `node scripts/check-dead-code.mjs` | 0 | „Dateien unter src/ 1381, erreichbar 1177, ohne Importeur 204“ (informativ) | VERIFIZIERT |

### C.1 Befund: Fabrication-Ratsche in CI vermutlich wirkungslos
- Skript-ROOT: `scripts/check-fabricated-results.mjs:49` `new URL('..', import.meta.url).pathname`.
- `scripts/check-dashboard-actions.mjs:45-58` dokumentiert genau dieses Problem: unter Vitest trägt `import.meta.url` ein `/@fs`-Präfix; dort wird es korrigiert (`projektWurzelAus`), im Fabrication-Skript nicht.
- `walk()` (`:78-84`) fängt `readdirSync`-Fehler und liefert `[]`; `loadBaseline()` fängt ebenfalls → `compare()` liefert leer → `test/ci/fabricated-results-ratchet.test.ts:42-49` ist immer grün.
- Lokal nachgestellt: `readdirSync('/@fs<repo>/src')` → `ENOENT` (VERIFIZIERT). Gleichzeitig meldet das Skript per Node Exit 1, während CI-Unit grün ist (VERIFIZIERT) → **ABGELEITET: Fake-Green**. Fundstelle seit #1871 (Commit 419bf34, 13.10.2026). `check:fabrication` steht in keinem Workflow (VERIFIZIERT grep).
- Gleiche Gefahr prüfen bei allen Tests, die `scripts/*.mjs` mit `new URL(…, import.meta.url)` importieren (Welle-2-Aufgabe).

---

## D) Security-Baseline

### D.1 Tenant-Grenzen / RLS
- CI-DB-Job wendet **alle** Migrationen auf pgvector/pg15 an, Supabase-äquivalente Rollen, `auth.uid()` liest echte JWT-Claims (`ci.yml:296-307`), `REQUIRE_DB_TESTS=1` (`ci.yml:483-487`) → keine stillen Skips (VERIFIZIERT Workflow-Text + Run).
- Cross-Tenant-Tests vorhanden (VERIFIZIERT): `rls.db.test.ts:22,39,52,64`, `gate0-rls-hardening.db.test.ts` (Viewer/Editor/fremde Mandanten, Evidence, Memberships), `siteos-rls`, `mcp-api-keys-rls`, `ai-act-risk-inventory-rls`, `websites-signals-writer-rls`, `profiles-privilege-boundary`, `storage-open-policy`, `security-regressions` (Invariante „keine neue Tabelle ohne RLS“, `:438-444`).
- **Lücken** (VERIFIZIERT grep in `test/runtime/db`): keine RLS-/Cross-Tenant-Tests für `bots`, `bot_conversations`, `bot_messages`, `bot_appointments`, `bot_orders` (nur Entitlement-Keys erwähnt). Policies `bots tenant-insert/update/delete` prüfen nur `is_tenant_member` ohne Rolle (`20260628121531_bots_foundation.sql:143-146`) → jeder Viewer kann Bots ändern/löschen (ABGELEITET; spätere Migration `20260920130000_bots_quota_enforcement.sql` fasst `bots` an – Rollencheck dort nicht geprüft).
- Bekannte RLS-Schuld: 8 Tabellen ohne RLS (`security-regressions.db.test.ts:410-419`): `_circuit_breakers`, `_operation_metrics`, `_rate_limits`, `memory_retention_policies`, `provenance_records` („SENSIBEL“), `seo_marketing_audit_log`, `social_publishing_metrics_hourly`, `subscription_addons` – laut Kommentar `:390-391` „anonym erreichbar“ sofern kein REVOKE (ABGELEITET).
- Doppelte Migrationen `bots_foundation` (`20260628120000_…`, `20260628121531_…`, `20260628193744_…`) – idempotent geschrieben, aber Schema-Drift-Risiko (#1650) (VERIFIZIERT Dateinamen).

### D.2 Webhook-Sicherheit
| Endpoint | Signatur | Fehlendes Secret | Replay/Idempotenz | Tests |
|---|---|---|---|---|
| `stripe-webhook` | `constructEventAsync` (`index.ts:88`), Toleranz-Default 300 s | fail-closed 500 (`:79-81`) | `webhook_events` PK = event.id, Insert-first (`:97-115`), Rollback bei Handler-Fehler (`:194-195`) | nur Spiegel-/Quelltexttests (`test/billing/stripe-webhook-plan.test.ts:2-13,104-125` baut Logik nach), kein signierter Handler-Test |
| `whatsapp-webhook` | HMAC-SHA256, konstante Zeit (`:63-79`) | **fail-open** `if (!APP_SECRET) return true` (`:64`) | Dedupe per `bot_messages.metadata.wa_message_id` select-then-act (`:147-156`) – nicht atomar | **keiner** (nur Parser `test/bots/whatsapp-parse.test.ts`) |
| `bot-voice-webhook` (Twilio) | HMAC-SHA1 fail-closed (`_shared/twilio-signature.ts:39-51`) | fail-closed 403 | **kein** Replay-/Dedupe-Schutz: `completed`-Callback bucht Minuten bei jeder Zustellung (`index.ts:215-218`); JSON-Modus `hangup` beliebig oft (`:258-262`) | `test/bots/voiceWebhookSecurity.test.ts` (Signatur, unabh. Referenz) |
| `telegram-webhook` | Secret-Token-Header | **fail-open** (`:372` nur „falls konfiguriert“), nicht-konstanter Vergleich (`:374`) | – | nur indirekt (`test/edge/ai-gateway-auth.test.ts`) |
| `shopify-webhooks` | HMAC (`:22-24`) | fail-closed 503 (`:19`) | – | – |

- Öffentliche Endpunkte ohne JWT (`supabase/config.toml:432-454`): `bot-chat`, `appointment-book`, `order-intake` – Zugriff nur über `(tenant_id, bot_id)`; in `appointment-book`/`order-intake` kein Rate-Limit/Captcha/Quota (VERIFIZIERT grep) → Spam-/Kosten-/Datenmüll-Risiko (ABGELEITET).
- Zur Laufzeit ist unbekannt, ob `WHATSAPP_APP_SECRET`/`TELEGRAM_WEBHOOK_SECRET` gesetzt sind → **BLOCKIERT** (keine Produktions-/Supabase-Calls erlaubt).

### D.3 Prompt Injection
- Vorhanden (VERIFIZIERT): PDP bewertet nur strukturierte Fakten, nie Freitext (`_shared/pdp/toolcall.ts:4-13`, `governance-decide/index.ts:13`); Tests `test/governance/pdp-botmessage.test.ts:89-115` (kein Nachrichtentext/IBAN in Entscheidungsanfrage), `pdp-toolcall.test.ts:74` (`sanitizeToolCall`), `apps/agent-runtime/test/tool-gateway.test.ts`, `test/security/InputValidator|OutputSanitizer.test.ts`.
- Lücken: `buildBotPrompt` (`_shared/bots.ts:256-283`) setzt Nutzer-, Verlaufs- und Persona-Text ohne Escaping in eine Sektions-Syntax (`[Neue Nachricht]`, `[Branchenprofil]`) → Nutzer kann Sektionsmarker fälschen (ABGELEITET). Kein Test für Marker-Spoofing, kein Test für indirekte Injection über KB/Persona, kein Output-Guard gegen „Termin gebucht“-Behauptungen ohne Backend-Bestätigung (nur Prompt-Regel `bots.ts:242`).

### D.4 Concurrency / Idempotenz
- `consumeUsage` (`_shared/usage.ts:113-160`): liest Total, prüft Limit, insertet – **nicht atomar** → parallele Requests überschreiten Plan-/Hard-Limit (ABGELEITET). Bot-Anzahl dagegen per DB-Trigger atomar (`bots-quota.db.test.ts:225` Bulk-Insert).
- Stripe: Insert-first-Idempotenz korrekt gegen Doppelzustellung; Risiko: Timeout/Crash nach Insert und vor Abschluss → Event gilt als verarbeitet, Stripe-Retry wird als `duplicate` quittiert → Entitlement fehlt (ABGELEITET).
- Doppelbuchung: `bot_appointments` ohne UNIQUE/EXCLUDE auf (bot_id, requested_at) (`20260628121531_bots_foundation.sql:86-106`), `appointment-book` prüft keine Überschneidung (`index.ts:44-89`); **keine Kalenderintegration** im Repo (grep `calendar|caldav|freebusy` in Functions ohne Treffer außer generierter Datei) (VERIFIZIERT).
- `order-intake` Legacy-Pfad: `total_amount` und `price` vom Client (`index.ts:22-30,145-146`); Restaurant-Pfad serverseitig (`:100-128`, Tests `test/bots/restaurantOrder.test.ts:25-68`) (VERIFIZIERT).

### D.5 Secrets im Browser (`src/`, nur Fundstelle + Name)
- Keine echten Secret-Werte gefunden; keine `import.meta.env.VITE_*(SECRET|SERVICE|PRIVATE|TOKEN|API_KEY)` (VERIFIZIERT).
- `SUPABASE_SERVICE_ROLE_KEY` in `src/workers/index.ts:69,147,172,193`, `src/workers/kv-cache/index.ts:39,97-98`, `src/workers/r2-evidence/index.ts:62,164-165` – Cloudflare-Worker-Env (serverseitig), von keinem Browser-Modul importiert (VERIFIZIERT grep); `check-dead-code` listet sie als „ohne Importeur“. Ablage unter `src/` ist irreführend.
- Mock-/Platzhalter-Keys: `src/features/admin/pages/AdminAPIKeysPage.tsx:25,33` (maskierte `sk_live`/`sk_test`-Platzhalter), `src/features/governance/IntegrationsView.tsx:58,105` („signingSecret“ per `Math.random()` erzeugt – erfundenes Secret in UI).
- BYOK: `src/features/settings/SettingsView.tsx` speichert OpenAI/Anthropic/Gemini-Keys in `localStorage` (XSS-Exfiltrationsrisiko; bewusstes Design laut UI-Text).

### D.6 CodeQL / Dependabot / Secret Scanning
- CodeQL: `security-extended`, JS/TS + Python, auf push/PR/wöchentlich (`codeql.yml`), letzte Läufe grün (VERIFIZIERT). Alert-Liste: **BLOCKIERT** – kein Code-Scanning-Alert-Tool verfügbar.
- Dependabot: keine `.github/dependabot.yml(.yaml)` (VERIFIZIERT `ls`); Alert-Status **BLOCKIERT** (kein Tool).
- Secret Scanning: `mcp__github__run_secret_scanning` überträgt Dateiinhalte an einen Scan-Dienst (Schema gelesen) → im Sinne „im Zweifel nicht“ **nicht ausgeführt, BLOCKIERT**. Repo-Alerts nicht lesbar.

---

## E) Akzeptanz-Testmatrix (Issue #1972, 8 Szenarien)

| # | Szenario | Vorhandene Tests (Beleg) | Lücken | Vorgeschlagene Tests | Fixtures/Sandbox |
|---|---|---|---|---|---|
| 1 | Bot anlegen, Sandbox testen, **exakt 72-h-Trial** mit durchsetzbaren Limits | `bots-quota.db.test.ts:139-261` (Bot-Anzahl je Plan), `trial-expiry.db.test.ts:95-118`, `test/TrialCountdownBanner.test.tsx` | 72-h-Trial existiert nicht (Starter `trialDays: 14`, `shared/pricing.ts:662`; Checkout `stripe-checkout/index.ts:245`); kein Bot-Sandbox-Test; kein E2E Bot-Wizard | Contract: Trial-Dauer = 72 h als SSoT; DB: Trial-Ende sperrt Konsum exakt nach 72 h (`now()` injizierbar); E2E: Wizard → Sandbox-Antwort → Trial-Banner | Stripe Test Mode (Test-Clock), Seed-Tenant |
| 2 | Web-Chat beantwortet KB, erzeugt **echte** Terminanfrage, keine Buchungsbehauptung ohne Kalender | `buildBotPrompt.test.ts`, `bot-chat-privacy-order.test.ts`, `pdp-botmessage.test.ts` | kein KB-Retrieval-Test für Bots; keine Kalenderintegration; keine Slot-Constraint; kein Output-Guard | Unit: Antwort-Guard verbietet „bestätigt/gebucht“ ohne `status=confirmed`; DB: EXCLUDE/UNIQUE gegen Doppelbuchung + Parallel-Insert-Test; Integration: `appointment-book` → `requested`, nie `confirmed` ohne Kalender-ACK | Kalender-Sandbox (z. B. Google/CalDAV-Testkonto) oder Fake-Provider |
| 3 | Bestellung mit validiertem Katalog/Preis, persistiert | `restaurantOrder.test.ts:25-68`, `restaurantConversation.test.ts` | Legacy-Pfad übernimmt Client-Preise; keine Idempotenz (Doppel-Submit); keine Cross-Tenant-Tests `bot_orders` | Contract: jeder Pfad lehnt Client-`price/total_amount` ab; DB: Idempotency-Key; Integration `order-intake` mit fremder `bot_id` → 404 | Katalog-Fixture je Vertical |
| 4 | WhatsApp/Telefonie offiziell in Sandbox; unkonfigurierte Kanäle **explizit BLOCKED** | `voiceWebhookSecurity.test.ts`, `whatsapp-parse.test.ts`, `voiceProvider.test.ts`, `voice-runtime.db.test.ts`, `apps/agent-runtime/test/voice-*.test.ts` | WhatsApp-Signatur ungetestet und fail-open; Telegram fail-open; kein Replay-/Dedupe-Test; kein „blocked“-Status-Test | Contract: fehlendes Secret ⇒ 503/blocked (nie verarbeitet); Signatur-Tests mit unabhängiger HMAC-Referenz; Doppelzustellung derselben `wa_message_id`/`CallSid` ⇒ genau 1 Nachricht/1 Minutenbuchung (parallel) | Meta WhatsApp Cloud API Test-Nummer, Twilio Test-Credentials/Magic Numbers |
| 5 | Policy blockiert/gated riskante Bot-Aktionen **vor** Ausführung, Evidence geloggt | `pdp-botmessage.test.ts`, `bot-pep-wiring.test.ts`, `bot-chat-privacy-order.test.ts`, `pdp-toolcall.test.ts`, `evidence-integrity`/`hash-chain*.db.test.ts`, `append-only.db.test.ts` | Voice/WhatsApp-Pfade nicht im selben Vertrag geprüft; kein Test „Evidence-Zeile je Deny“ end-to-end | Integration je Kanal: Deny ⇒ keine Persistenz, kein Provider-Call, 1 Evidence-Eintrag; Contract-Parity-Test alle Bot-Eingänge rufen PEP vor Quota/Insert | PDP-Snapshot-Fixture |
| 6 | Verifiziertes Stripe-Event → korrekte Starter-Entitlements; retry-sicher; abgelaufene Trials keine bezahlte Nutzung | `addon-entitlements.db.test.ts`, `tenant-entitlements-callers.db.test.ts`, `trial-expiry.db.test.ts`, `stripe-webhook-subscription-conflict.test.ts`, `grace-period.test.ts`, `stripe-invoice-subscription.test.ts` | kein Handler-Test mit signierter Nutzlast; Idempotenz nur gespiegelt; kein Test Crash-zwischen-Insert-und-Verarbeitung | Contract: Handler mit `stripe.webhooks.generateTestHeaderString` – falsche Signatur 400, gleiches Event 2× ⇒ 1 Wirkung, Fehler ⇒ Retry möglich; DB: Event → Entitlements Starter-Satz | Stripe Test Mode, Event-Fixtures (dahlia + 2024-06-20) |
| 7 | Zwei Organisationen sehen keine fremden Daten | `rls.db.test.ts`, `gate0-rls-hardening.db.test.ts`, `security-regressions.db.test.ts`, `siteos-rls`, `mcp-api-keys-rls` u. a. | Bot-Tabellen, `subscription_addons`, `provenance_records` ohne RLS bzw. ohne Test; Edge-Pfade mit `(tenant_id, bot_id)` ohne Fremd-Tenant-Test | Generischer DB-Test: für jede Tabelle mit `tenant_id` Fremd-SELECT/UPDATE/DELETE = 0; Edge-Contract: fremde `bot_id` bei fremdem `tenant_id` ⇒ 404 | 2-Tenant-Seed |
| 8 | Gemessene Unit Economics, Per-Tenant-Caps, Stop-Schwellen | `cost-caps`, `cost-ledger`, `cost-propagation.db.test.ts`, `test/edge/cost-cap.test.ts`, `llm-quota.test.ts`, `provider-cost.test.ts` | `consumeUsage` nicht atomar; Voice-Minuten-Replay; keine Kosten-Messung pro Bot-Nachricht/Minute gegen Marge | DB-Concurrency: 20 parallele `consume` an Limit-1 ⇒ genau 1 Erfolg; Contract: jede Provider-Antwort schreibt Kostenzeile; Stop-Schwelle ⇒ 429 vor Provider-Call | Fake-Provider mit Token-Zählern |

---

## F) Regressionsrisiken (hohe Änderungsfrequenz, wenig Tests)

Einschränkung: lokaler Clone ist **shallow** (50 Commits, ab 10.10.2026; VERIFIZIERT `git rev-parse --is-shallow-repository` = true). Zahlen daher nur für ~2 Wochen.
- Edge Functions (Änderungen / Tests mit Pfadreferenz `functions/<name>/`, VERIFIZIERT): `kodee` 9/1, `audit-monitor-cron` 8/1, `stripe-checkout` 6/3, `stripe-webhook` 4/4 (Spiegeltests), `social-publisher-worker` 3/0, `ai-invoke` 3/0, `usage-increment` 2/0, `stripe-meter-sync` 2/0, `share-dashboard` 2/0, `optimize-execute` 2/0, `website-maintenance-daily-cron` 2/0.
- Bot-Kanäle ohne direkten Test: `whatsapp-webhook`, `appointment-book`, `order-intake` (VERIFIZIERT grep).
- Frontend-Hotspots: `LandingV6View.tsx` 8 Änderungen, `useLandingV6.ts` 6, `App.tsx` 5, `production-edge-functions.ts` 5 (VERIFIZIERT git log); Landing ist über `test/landing/*` (30) abgedeckt; `src/features/governance/GovernanceApiKeysView.tsx` 3 Änderungen / 0 Testreferenzen; `PostRegisterOnboardingPage.tsx` 3/1.

---

## Abhängigkeiten zu offenen PRs/Issues

- **#1961** (Draft, Head 93c2ace) – inhaltsgleicher Titel wie bereits gemergtes **#1966** (Commit 4df1fde auf main) → vermutlich überholt (ABGELEITET); vor Welle 2 schließen/abgleichen.
- **#1908** Evidence append-only → betrifft Szenario 5; Tests `append-only.db.test.ts`/`gate2-evidence-append` mitführen.
- **#1907** Billing seats (`limit.team_seats`) → Szenario 6/8; Concurrency-Test für Seat-Limit ergänzen (gleiches TOCTOU-Muster prüfen).
- **#1869** Audit-Claim-Security / **#1865** → Tenant-Grenzen (Szenario 7).
- **#1970** GDPR Delete → Cross-Tenant-Lösch-Tests.
- **#1926** Leads/Consent, **#1918** Onboarding, **#1967** Beta-Dashboard, **#1969** Beta/404 → E2E-Flows; nur `tests/e2e` läuft in CI.
- Issues: **#1039/#923** (Checkout-Webhooks-Entitlements → Szenario 6), **#1646** (AI-Gateway usage attribution → Szenario 8), **#1650** (Schema Drift; dreifache `bots_foundation`-Migration), **#1153** (Voice/Storage Pricing → Minuten-Metering), **#1938** (Stripe Tax), **#1381** (Dashboard Actionability; `check-dashboard-actions`: 1 BROKEN, 5 PARTIAL).
- 9/14 offenen PRs sind Drafts → ohne CI-Signal.

## Vorschläge für Welle 2

### Contract-Test-Liste (vor jeder Implementierung, rot zuerst)
1. **CT-WH-1** Jeder Webhook-Receiver ist fail-closed: fehlendes Secret ⇒ 503, kein DB-Write, kein Provider-Call (Stripe, WhatsApp, Telegram, Twilio, Shopify). Erwartet heute rot für WhatsApp/Telegram.
2. **CT-WH-2** Signaturprüfung gegen unabhängige Referenz-HMAC (node:crypto) inkl. manipuliertem Body/Header/Länge – für WhatsApp und Telegram (konstante Zeit).
3. **CT-WH-3** Doppelzustellung (sequentiell + parallel) derselben Event-ID (`event.id`, `wa_message_id`, `CallSid`+Status) ⇒ genau eine Wirkung (Nachricht, Minutenbuchung, Entitlement).
4. **CT-WH-4** Stripe-Handler mit signierter Test-Nutzlast (`generateTestHeaderString`): 400 bei falscher Signatur, Entitlement Starter korrekt, Fehler im Handler ⇒ Idempotenz-Zeile entfernt.
5. **CT-Q-1** `consumeUsage` atomar: N parallele Aufrufe bei Rest-Kontingent 1 ⇒ genau 1 Erfolg (DB-Test, RPC mit Row-Lock/`UPDATE … WHERE total+delta<=limit`).
6. **CT-T-1** 72-h-Trial: SSoT-Wert, Checkout setzt ihn, nach Ablauf `consume` ⇒ `QUOTA_EXCEEDED`/`TRIAL_EXPIRED` (Test-Clock).
7. **CT-RLS-1** Generischer Cross-Tenant-Test für alle `public`-Tabellen mit `tenant_id` (SELECT/UPDATE/DELETE als fremdes Mitglied = 0 Zeilen) inkl. `bot_*`.
8. **CT-RLS-2** Rollen-Test `bots`: viewer darf nicht anlegen/ändern/löschen.
9. **CT-BK-1** `bot_appointments`: zwei überlappende Anfragen für denselben Slot ⇒ zweite abgelehnt (EXCLUDE-Constraint, additive Migration).
10. **CT-BK-2** Bot-Antwort darf „gebucht/bestätigt“ nur bei `status='confirmed'` mit Kalender-ACK enthalten (Output-Guard).
11. **CT-ORD-1** `order-intake`: Client-Preise/`total_amount` in **allen** Pfaden abgelehnt; Idempotency-Key gegen Doppel-Submit.
12. **CT-PI-1** Prompt-Marker-Spoofing: Nutzertext mit `[Neue Nachricht]`/`[Branchenprofil]` wird neutralisiert; indirekte Injection über KB/Persona ändert keine PDP-Entscheidung.
13. **CT-PEP-1** Parity: Jeder Bot-Eingang (bot-chat, whatsapp, voice, telegram) ruft PEP vor Quota und vor Persistenz.
14. **CT-CI-1** Ratchet-Tests, die `scripts/*.mjs` importieren, müssen eine Positivprobe enthalten (mindestens 1 bekannte Datei wird gescannt) – verhindert vakuös grüne Ratschen.

### Arbeitspakete
| WP | Ziel | Dateien/Verzeichnisse (Ownership) | Bestehender PR? | Risiko | Tests |
|---|---|---|---|---|---|
| QA-1 Ratchet-Fix | ROOT-Auflösung wie `projektWurzelAus`, Positivprobe; Baseline für `heroEuropeNetwork3D.ts` begründen oder Code ändern | `scripts/check-fabricated-results.mjs`, `scripts/fabricated-results-baseline.json`, `test/ci/fabricated-results-ratchet.test.ts` | neu (klein, isoliert) | niedrig; macht CI evtl. sofort rot (gewollt) | CT-CI-1 |
| QA-2 Webhook fail-closed | WhatsApp/Telegram fail-closed + Signatur-/Dedupe-Tests | `supabase/functions/whatsapp-webhook/`, `supabase/functions/telegram-webhook/`, `test/bots/` | neu; Owner Agent 06 | mittel (Produktion bricht, falls Secret fehlt → vorher Secret-Inventar Agent 12) | CT-WH-1/2/3 |
| QA-3 Stripe-Handler-Contract | Signierte Event-Fixtures, echte Handler-Ausführung mit Fake-Admin | `test/billing/`, ggf. Extraktion reiner Handler in `supabase/functions/_shared/` | an #1907/#923/#1039 anlehnen | mittel | CT-WH-4 |
| QA-4 Atomare Quota | RPC/Constraint statt Check-then-Insert | `supabase/functions/_shared/usage.ts`, neue additive Migration, `test/runtime/db/` | neu; Owner Agent 02/08 | mittel (Migration, Hotspot) | CT-Q-1 |
| QA-5 Bot-RLS & Rollen | Cross-Tenant- und Rollen-Tests `bot_*`, Policies nachschärfen | `test/runtime/db/bots-rls.db.test.ts` (neu), additive Migration | neu; Owner Agent 02 | niedrig (Tests) / mittel (Policy) | CT-RLS-1/2 |
| QA-6 Booking/Order-Integrität | EXCLUDE-Constraint, Output-Guard, Client-Preis-Verbot | `supabase/functions/appointment-book/`, `order-intake/`, `_shared/bots.ts`, Migration | neu; Owner Agent 07 | mittel | CT-BK-1/2, CT-ORD-1 |
| QA-7 CI-Abdeckung | `apps/mcp-server` + `packages/sdk` + `platform/` pytest in CI; `src/**/__tests__` in Vitest-Include oder verschieben; Entscheidung zur `e2e/`-Suite (aufnehmen oder löschen) | `.github/workflows/backend-services-ci.yml`, `vitest.config.ts` (Hotspot, CI-relevant) | neu; Owner Agent 12 | mittel (neue rote Tests möglich) | Läufe selbst |
| QA-8 Prompt-Injection | Marker-Escaping + Tests | `supabase/functions/_shared/bots.ts`, `test/bots/buildBotPrompt.test.ts` | neu; Owner Agent 04 | niedrig | CT-PI-1, CT-PEP-1 |

## Blocker / offene Fragen an Dominik

1. **Ruleset/Required Checks** nicht per API lesbar (BLOCKIERT). Bitte bestätigen: sind `build`, `Migration validation`, `Merge Hygiene / conflict-state`, `Merge Hygiene / hygiene` required? Sollen **E2E** und **CodeQL** required werden?
2. **Code-Scanning-, Dependabot- und Secret-Scanning-Alerts** nicht lesbar (BLOCKIERT, kein Tool; `run_secret_scanning` bewusst nicht ausgeführt). Bitte Alert-Zählstände aus dem Security-Tab liefern oder Freigabe für `run_secret_scanning`. Dependabot ist nicht konfiguriert – gewünscht?
3. Sind `WHATSAPP_APP_SECRET` und `TELEGRAM_WEBHOOK_SECRET` in Produktion gesetzt? Falls nein, sind beide Webhooks derzeit spoofbar.
4. **72-h-Trial vs. Starter 14 Tage** (`shared/pricing.ts:662`, E-F6): Welche Regel gilt für Bots? Nur Bot-Modul oder alle Pläne?
5. `e2e/`-Suite (41 Specs) läuft nicht in CI – aufnehmen (Aufwand: Backend-Fixtures) oder archivieren?
6. Python-Dienste (`platform/`, 23 Tests) und `apps/mcp-server` (8 Tests): noch produktiv? Dann in CI aufnehmen.
7. Darf QA-1 (Ratchet-Fix) sofort umgesetzt werden, obwohl `main` danach voraussichtlich rot wird, bis die `heroEuropeNetwork3D.ts`-Fundstelle eingeordnet ist?
8. Ist #1961 durch #1966 erledigt (Schließen)?
