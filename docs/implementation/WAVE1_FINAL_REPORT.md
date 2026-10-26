# Welle 1 – Abschlussbericht (Epic #1972)

Stand: 26.10.2026, Agent 00 (Orchestrator). Welle 1 war rein lesend; Welle 2, Phase 0, Merges und Deployments sind **gesperrt**.

**Prüfbasis aller Befunde:** `main` = `b4f8a2ffc5e46aebfbd9d7264ac84a00756ba523` (23.10.2026). Code-Belege `Datei:Zeile` beziehen sich auf diesen Commit.
Auf `main` liegen seither 2 weitere Commits (`aee92b7` #1986, `af41ee7` #1990; HEAD `af41ee7917f9c762eec004bca04b02aef274d303`). `.github/workflows/` ist unverändert (`git diff --stat b4f8a2f origin/main -- .github/workflows/` leer). Die übrigen Befunde wurden gegen den neuen Stand nicht erneut geprüft.

**Quellen:** Die sechs Originalberichte unter `docs/implementation/reports/` (Commit `9563c3d`, prüfbar mit `SHA256SUMS`). Zitierform: `A03 › C.2` = `reports/agent-03-governance.md`, Abschnitt C.2.

| Kürzel | Datei |
|---|---|
| A01 | `reports/agent-01-audit.md` |
| A02 | `reports/agent-02-backend.md` |
| A03 | `reports/agent-03-governance.md` |
| A08 | `reports/agent-08-billing.md` |
| A11 | `reports/agent-11-qa.md` |
| A12 | `reports/agent-12-devops.md` |

**Statusmarken** (aus den Berichten übernommen):
- **V:** verifiziert
- **A:** abgeleitet
- **B:** blockiert bzw. nicht verifiziert

---

## 1. Kernaussage

1. **`main` ist grün:** CI, E2E, CodeQL und Merge Hygiene auf `b4f8a2f` (A11 › B.1).
2. **Der Produktionsschutz reicht für eine Multi-Agent-Umsetzung nicht aus** (Abschnitt 4):
   - Jeder Merge mit Änderungen unter `supabase/` wird sofort in der Produktion angewendet.
   - PR-Workflows führen PR-Code mit Produktions-Zugangsdaten aus.
   - Alle Agenten arbeiten mit dem einzigen Admin-Account.
   - Es gibt keine Staging-Umgebung.
   - **Produktionssicherheit ist nicht abschließend bestätigt.**
3. **Es gibt Sicherheitslücken auf `main`:**
   - IDOR in `audit-report-pdf` und `audit-claim`.
   - Funktionen ohne Auth-Prüfung, die Mandantengrenzen überschreiten (`webhook-deliver`, `webhook-dispatcher`, `calculate-seo-metrics` u. a.).
   - WhatsApp- und Telegram-Webhooks sind fail-open.
4. **Die Akzeptanzszenarien des Epics sind überwiegend nicht erfüllt:**
   - Es gibt keine 72-h-Testphase.
   - Es gibt keine Kalenderintegration und keinen Doppelbuchungsschutz.
   - Policies laufen per Default nur im Modus `shadow`.
   - Starter verspricht Bot-Antworten, hat aber nicht das Recht dazu.

## 2. Befunde Agent 03 – Governance / Evidence / DSGVO (vollständig)

| # | Befund | Beleg (Datei:Zeile @ `b4f8a2f`) | Quelle | Status |
|---|---|---|---|---|
| G-01 | Mindestens 7 Policy-Engines mit unterschiedlichem Datenmodell (Inventar im Bericht, Nr. 1–8, dazu Python-Client und Mock-Agent) | `_shared/policy-engine.ts`, `_shared/policyEngine.ts`, `_shared/pdp/*`, `apps/agent-runtime/src/policy-engine.ts`, `apps/agent-runtime/src/voice-policy.ts`, `workers/govard-gateway/src/policy/engine.ts`, `src/core/realsync-os/policyEngine.ts`, `packages/siteos-core/src/publish/gate.ts` | A03 › A.1 | V |
| G-02 | Die Engines konkurrieren: Legacy-Engines mit unterschiedlicher Match-Semantik; der PDP portiert sie 1:1, ohne sie zu vereinheitlichen. GOVARD ist ein separater Stack mit eigenem `org`-Modell, ohne Bezug zu `tenants`, RLS oder `ai_evidence_events`. | `pdp/core.ts:20-26`; `workers/govard-gateway/README.md:30-90` | A03 › A.1 | V |
| G-03 | Der PDP v2 läuft in allen Durchsetzungspunkten per Default im Modus `shadow` und sperrt dann nichts: `AI_GATEWAY_ENFORCEMENT`, `BOT_PDP_ENFORCEMENT`, `SITEOS_PUBLISH_PDP`, `AGENT_PDP_ENFORCEMENT` | `pdp/botmessage.ts:65`; `siteos/handlers/publish-gate.ts:745`; `apps/agent-runtime/src/pdp-client.ts:33`; `ai-gateway/index.ts:67-69` | A03 › A.3 | V (Repo-Default); Prod-ENV B |
| G-04 | Der ai-gateway-PEP ist bei einem PDP-Ausfall fail-open und prüft nur globale Policies (`tenant_id: null`) | `ai-gateway/index.ts:102,129` | A03 › A.3 | V |
| G-05 | Aufrufkette bot-chat: PEP vor Persistenz (#1966); bei Sperre `safe_reply`, keine Persistenz, **kein Evidence-Eintrag** | `bot-chat/index.ts:64,68,76-82,86,95-104` | A03 › A.2(a), A.4 Nr. 3 | V |
| G-06 | `/run-agent` der Agent-Runtime führt nichts aus und antwortet nur `accepted`. Das Audit geht nur nach stdout. `tenantId` kommt aus dem Body, der PDP-Key ist an einen Tenant gebunden. | `apps/agent-runtime/src/gateway.ts:148-158,280-298`; `audit-log.ts:45`; `governance-decide/index.ts:60-68,109-113` | A03 › A.2(b), A.4 Nr. 6 | V / A |
| G-07 | Die Voice-Runtime hat das einzige vollständige Modell aus Entscheidung, Ausführung und Evidence mit DB-Triggern (fail-closed, Hash-Kette) | `supabase/migrations/20260928130000_voice_runtime_foundation.sql:252-320`; `apps/agent-runtime/src/voice/tool-executors.ts` | A03 › A.2(c) | V |
| G-08 | Szenario 5 ist nur teilweise erfüllt. Riskante Bot-Aktionen laufen ohne PDP: `bot_orders` INSERT, `appointment-book` (öffentlich, ohne Rate-Limit, Captcha und Audit) und `social-publisher-worker` (Außenversand, 0 PDP-Treffer) | `_shared/restaurant-conversation.ts:209`; `config.toml:441-442`; `social-publisher-worker` | A03 › A.4 Nr. 2 | V / A |
| G-09 | WhatsApp und Voice speichern vor dem PEP: `consumeUsage`, `upsertConversation` und `insertMessage` laufen vor `enforceBotMessage` | `whatsapp-webhook/index.ts:160,184,194` vor `:206`; `bot-voice-webhook/index.ts:92` vor `:108` | A03 › A.4 Nr. 4 | V |
| G-10 | `require_approval` wirkt in synchronen Bot-Kanälen wie `block`; es gibt keinen asynchronen Freigabepfad (Voice ausgenommen) | `pdp/botmessage.ts:282-292` | A03 › A.4 Nr. 5 | V |
| G-11 | Der Twilio-Pfad und die Voice-Runtime sind getrennte Welten. Live erreichbar ist der Twilio-Pfad ohne Disclosure, Consent und `voice_evidence`. | `bot-voice-webhook/index.ts` | A03 › A.4 Nr. 7 | V |
| G-12 | Race beim Legacy-Approve (TOCTOU): Das UPDATE prüft nicht auf `pending`, beide Requests schreiben Evidence | `governance-approvals/index.ts:132,140-148` | A03 › B.2 | V |
| G-13 | Gates-Approve: Auch wer das Rennen verloren hat, schreibt „Freigabe erteilt“ in `ai_evidence_events`, weil die Zeilenzahl nicht geprüft wird | `governance-approvals/index.ts:251,255ff.` | A03 › B.2 | V |
| G-14 | Kein Zustandsautomat in der DB für `governance_approvals`/`pdp_approval_gates`; keine Vier-Augen-Regel, keine AAL2-Pflicht beim Freigeben | Migration `20260824120000…:205-240` (keine Trigger); `governance-approvals` ohne `requireAal2` | A03 › B.2 | V / A |
| G-15 | Nur SiteOS-Publish und browser-execute warten tatsächlich auf eine Freigabe; bei Bots folgt auf eine Freigabe keine Ausführung | `browser-execute/index.ts:44-95` | A03 › B.2, A.4 | V |
| G-16 | Evidence liegt in mindestens 10 Speichern. Append-only sind nur `ai_evidence_events`, `evidence_anchors`, `evidence_snapshots` und `voice_evidence`. | `20260901090000_evidence_append_only_anchors.sql:79-106,360-369` | A03 › C.1 | V |
| G-17 | `governance_evidence` ist auf main nicht append-only (behebt #1908). `governance-approvals` schreibt direkt mit `content_hash: null` an der Kette vorbei. `evidence_items` ist ungeschützt. | `governance-approvals/index.ts:152-168`; `20260928140100_gate2_evidence_append_rpc.sql` | A03 › C.1, C.3 | V |
| G-18 | Ein Prüfpfad pro Mandant ist über die verteilten Speicher nicht zusammenhängend abfragbar; GOVARD trennt nur auf Repository-Ebene (D1 ohne RLS) | – | A03 › C.1 | A |
| G-19 | Die Aussage „Jeder AI-Call wird geloggt“ (CLAUDE.md) ist falsch. Direkte Provider-Aufrufe ohne `ai_tool_runs`, Residency und PDP: ai-act-classify, legal-embed, legal-retrieve, website-maintenance-agent, website-operations-agent, governance-agent | `ai-act-classify/index.ts:360,397`; `legal-embed/index.ts:81`; `legal-retrieve/index.ts:80`; `website-maintenance-agent/index.ts:443`; `website-operations-agent/index.ts:311`; `governance-agent/index.ts:31,449` | A03 › C.2 | V |
| G-20 | governance-agent: Das Body-Flag `acknowledge_us_routing=true` schaltet US-Routing frei | `governance-agent/index.ts:406` | A03 › C.2, D.3 | V |
| G-21 | Fehler beim Buchen der Nutzung im ai-gateway werden nur geloggt, nicht blockiert | `ai-gateway/index.ts:186-187`; `handler.ts:280-296` | A03 › C.2 | V |
| G-22 | #1908 wird gebraucht. Nach dem Merge scheitert hartes Löschen von Assets oder Events mit verknüpfter Evidence. Die Migrations-Zeitstempel kollidieren nicht mit #1970. | Migration `20261023223000_governance_evidence_append_only.sql` (PR) | A03 › C.3 | V |
| G-23 | #1970 ist inhaltlich solide (Draft). Workspaces mit append-only-Evidence landen in `WORKSPACE_RETAINED`; der manuelle Prozess dafür fehlt. | PR #1970 | A03 › D.1 | V / A |
| G-24 | #1926: Consent-Gate fail-closed, kein Mailversand an frei wählbare Adressen, keine Überlappung mit anderen PRs | PR #1926 | A03 › D.2 | V |
| G-25 | #1961 ist identisch mit dem gemergten #1966 (`4df1fde`, 9 Dateien, +267/−69) und kann geschlossen werden | `git show --stat 4df1fde` | A03 › D.3 | V |
| G-26 | Weiter offene P0-Reste aus #1961/#1966: WhatsApp und Voice speichern vor dem PEP; US-Pfad des governance-agent; ai-gateway mit `tenant_id:null`; `resolve_ai_residency` liefert für API-Key- und anonyme Aufrufe unter `user_choice` den Wert `cloud` | `docs/security/ai-residency-fail-closed-release-gates-2026-10-21.md` | A03 › D.3 | V |
| G-27 | `eu_local` ist fail-closed in `runAiTool` und im governance-router, **nicht** in den Direktaufrufen aus G-19. Die Aussage „ohne externe AI-Aufrufe“ stimmt nur, wenn `eu_local` erzwungen ist. | `_shared/ai.ts:258-268`; `governanceRouterCatalog.ts:140,217`; `governance-router/index.ts:271-273` | A03 › D.3 | V / A |
| G-28 | #1869: `audit-claim` über die RPC `claim_gdpr_audit`, Auth vor `audit-report-pdf`; der Claim-Nachweis läuft nur über `audit()`, nicht über eine Hash-Kette | PR #1869 | A03 › D.4 | V / A |
| G-29 | Die WhatsApp-Signaturprüfung ist fail-open; Voice ist fail-closed | `whatsapp-webhook/index.ts:64`; `bot-voice-webhook/index.ts:53-58,189-198` | A03 › D.5 | V |
| G-30 | bot-chat ist öffentlich, ohne Rate-Limit und ohne Origin-Allowlist | `bot-chat/index.ts` | A03 › D.5 | V |
| G-31 | Art. 50: Die eigenen Bots erzwingen keinen KI-Hinweis. `public.bots` hat keine Disclosure-Spalte. Twilio begrüßt mit „Hallo, hier ist ${bot.name}“. `voice_bot_configs.disclosure_text` liest keine Edge Function. | `20260628120000_bots_foundation.sql:30-33`; `bot-voice-webhook/index.ts:238,283`; `src/features/bots/BotBuilderView.tsx:377` | A03 › E | V |
| G-32 | Es gibt keine Risikoklasse je Bot bzw. Use-Case und keinen Verweis auf `ai_act_risk_inventory` | `src/features/bots`, `_shared/bots.ts` | A03 › E | V |
| G-33 | Prompt-Injection, positiv: An den PDP gehen nur Signalnamen und Argument-Namen; Allowlists bestehen; Restaurant-Preise sind deterministisch; Voice-Vorschläge des LLM sind nicht bindend | `pdp/toolcall.ts:1-22`; `pdp/botmessage.ts:12-30`; `restaurant-turn.ts:42-54,75-81` | A03 › F | V |
| G-34 | `src/runtime/validator.ts` ist kein Laufzeitschutz (validiert nur Manifeste in CI und Tests) | `validator.ts:1-15` | A03 › F | V |
| G-35 | Tool-Argumente werden zur Laufzeit nicht gegen ein Schema geprüft (`/run-agent`, `dispatchTool`, Voice-Executor) | `gateway.ts:153`; `_shared/agent-tools.ts:227-238` | A03 › F | V |
| G-36 | Der Bot-Prompt verkettet Nutzertext ohne Rollentrennung; es gibt keinen Output-PEP | `_shared/bots.ts:256-282` | A03 › F | V / A |

**Offene Fragen aus A03** (Blocker 1–7):
1. Werte der Prod-ENV und von `WHATSAPP_APP_SECRET`.
2. #1961 schließen?
3. Kanonische Engine: PDP v2 oder GOVARD?
4. Ist Twilio mit Kundennummern live?
5. Darf `acknowledge_us_routing` weiter US-Routing freischalten?
6. Art. 17 bei Workspaces mit Evidence.
7. Sollen Bot-Freigaben asynchron ausgeführt werden?

## 3. Befunde Agent 11 – QA- und Security-Baseline (vollständig)

| # | Befund | Beleg | Quelle | Status |
|---|---|---|---|---|
| Q-01 | `main` ist grün: CI 39975271505, E2E 39975271543, CodeQL 39975271523, Merge Hygiene 40024932273; die je 5 Vorläufe ebenfalls grün | GitHub-Runs | A11 › B.1 | V |
| Q-02 | Vitest führt nur `test/**` aus: 662 Dateien, rund 6.901 Fälle. 8 Testdateien unter `src/` und 2 unter `packages/sdk` laufen nie. | `vitest.config.ts:22-28` | A11 › A.1 | V |
| Q-03 | Playwright: `tests/e2e` (9 Specs, 38 Tests) läuft in CI. `e2e/` (41 Specs, ~442 Tests) läuft nicht, außer einer Spec über `siteos-production-e2e.yml:56`. | `playwright.catalog.config.ts`; `playwright.config.ts` | A11 › A.2 | V |
| Q-04 | Die CI-E2E läuft gegen `vite preview` ohne Backend. Bedingte Skips u. a. beim Checkout, daher belegt grüne E2E keinen Checkout. | `tests/e2e/checkout.spec.ts:54,62,66` | A11 › A.2 | V / A |
| Q-05 | 0 Deno-Tests in `supabase/functions` (197 Function-Verzeichnisse) | `find` | A11 › A.3 | V |
| Q-06 | Nicht in CI: `apps/mcp-server` (8 Tests), `platform/` (23 Python-Tests), `packages/sdk` (2). `services/` und `workers/` haben 0 Tests. | `backend-services-ci.yml:26-33` | A11 › A.4 | V |
| Q-07 | `main` ist geschützt; das Ruleset ist nicht lesbar. Laut Doku required: `build`, `Migration validation` und zwei Merge-Hygiene-Checks; **E2E und CodeQL nicht** | `docs/MERGE_CONFLICT_CONCEPT.md:52-58` | A11 › B.2 | V / A / B |
| Q-08 | `conflict-state` wird in der Merge Queue übersprungen; ein übersprungener Required Check gilt als bestanden | `merge-hygiene.yml` | A11 › B.2 | A |
| Q-09 | Bei Draft-PRs laufen `gates/unit/spa/build/db` nicht; 9 von 14 offenen PRs sind Drafts und haben damit kein CI-Signal | `ci.yml:34,88` | A11 › B.2 | V |
| Q-10 | Veralteter Kommentar `codeql.yml:8-12` („main nicht geschützt“) | `codeql.yml:8-12` | A11 › B.2 | V |
| Q-11 | Lokale Checks: 9 mit Exit 0, `check-fabricated-results.mjs` mit **Exit 1** (`heroEuropeNetwork3D.ts`, 3 Fundstellen, seit #1871/`419bf34`) | Ausgaben im Bericht | A11 › C | V |
| Q-12 | Der Fabrication-Ratchet-Test ist vermutlich vakuös grün: ROOT `new URL('..', import.meta.url)` zeigt unter Vitest auf `/@fs`, `walk()` schluckt ENOENT. `check:fabrication` steht in keinem Workflow. | `scripts/check-fabricated-results.mjs:49,78-84`; `test/ci/fabricated-results-ratchet.test.ts:42-49`; Vergleich `check-dashboard-actions.mjs:45-58` | A11 › C.1 | A (starke Belege) |
| Q-13 | Gute Basis für Tenant-Tests: 53 DB-Tests gegen das voll migrierte Schema, `REQUIRE_DB_TESTS=1`, Invariante „keine neue Tabelle ohne RLS“ | `ci.yml:296-307,483-487`; `security-regressions.db.test.ts:438-444` | A11 › D.1 | V |
| Q-14 | Keine Cross-Tenant-Tests für `bots`, `bot_conversations`, `bot_messages`, `bot_appointments`, `bot_orders` | grep `test/runtime/db` | A11 › D.1 | V |
| Q-15 | Policies auf `bots` prüfen nur die Mitgliedschaft, keine Rolle; jeder Viewer kann Bots ändern oder löschen | `20260628121531_bots_foundation.sql:143-146` | A11 › D.1 | A |
| Q-16 | 8 Tabellen ohne RLS (bekannte Schuld), u. a. `provenance_records`, `subscription_addons` | `security-regressions.db.test.ts:410-419` | A11 › D.1 | V |
| Q-17 | `bots_foundation` existiert dreifach als Migration (Drift-Risiko, #1650) | `20260628120000`, `…121531`, `…193744` | A11 › D.1 | V |
| Q-18 | Stripe-Webhook: Signatur und Insert-first-Idempotenz sind korrekt; Tests bilden die Logik nur nach, kein Test mit signierter Nutzlast | `stripe-webhook/index.ts:79-81,88,97-115,194-195`; `test/billing/stripe-webhook-plan.test.ts:104-125` | A11 › D.2 | V |
| Q-19 | WhatsApp ist fail-open, die Dedupe läuft nicht atomar, ein Signaturtest fehlt | `whatsapp-webhook/index.ts:64,147-156` | A11 › D.2 | V |
| Q-20 | Twilio ist fail-closed, hat aber keinen Replay-Schutz: `completed` bucht Minuten bei jeder Zustellung, `hangup` beliebig oft | `_shared/twilio-signature.ts:39-51`; `bot-voice-webhook/index.ts:215-218,258-262` | A11 › D.2 | V |
| Q-21 | Telegram ist fail-open, der Vergleich läuft nicht in konstanter Zeit | `telegram-webhook/index.ts:372,374` | A11 › D.2 | V |
| Q-22 | Shopify ist fail-closed | `shopify-webhooks:19,22-24` | A11 › D.2 | V |
| Q-23 | `bot-chat`, `appointment-book` und `order-intake` sind öffentlich; in den letzten beiden gibt es kein Rate-Limit, kein Captcha und keine Quota | `supabase/config.toml:432-454` | A11 › D.2 | V / A |
| Q-24 | Prompt-Injection, positiv: Der PDP bewertet keinen Freitext; das ist getestet | `pdp/toolcall.ts:4-13`; `test/governance/pdp-botmessage.test.ts:89-115` | A11 › D.3 | V |
| Q-25 | `buildBotPrompt` setzt Nutzertext ohne Escaping in die Sektionsmarker. Es fehlen Tests für Marker-Spoofing und indirekte Injection sowie ein Output-Guard gegen die Behauptung „gebucht“. | `_shared/bots.ts:242,256-283` | A11 › D.3 | A |
| Q-26 | `consumeUsage` ist nicht atomar (Check-then-Insert); die Bot-Anzahl ist dagegen per Trigger atomar | `_shared/usage.ts:113-160`; `bots-quota.db.test.ts:225` | A11 › D.4 | A / V |
| Q-27 | Stripe: Bei Absturz nach dem Insert gilt das Event als verarbeitet; der Retry wird als `duplicate` quittiert, und das Entitlement fehlt | `stripe-webhook/index.ts:97-115` | A11 › D.4 | A |
| Q-28 | `bot_appointments` hat keine UNIQUE- oder EXCLUDE-Constraint, und es gibt keine Kalenderintegration | `20260628121531_bots_foundation.sql:86-106`; `appointment-book/index.ts:44-89` | A11 › D.4 | V |
| Q-29 | `order-intake` übernimmt im Legacy-Pfad Preis und Summe vom Client; der Restaurant-Pfad rechnet serverseitig | `order-intake/index.ts:22-30,100-128,145-146` | A11 › D.4 | V |
| Q-30 | Kein Secret-Wert in `src/`. Der Service-Role-Key steht in Worker-Code unter `src/workers/`, den der Browser nicht importiert (irreführender Ablageort). | `src/workers/index.ts:69,147,172,193` u. a. | A11 › D.5 | V |
| Q-31 | `IntegrationsView` erzeugt Signing-Secrets per `Math.random()`; BYOK-Keys liegen im `localStorage` (XSS-Exfiltrationsrisiko) | `src/features/governance/IntegrationsView.tsx:58,105`; `src/features/settings/SettingsView.tsx` | A11 › D.5 | V |
| Q-32 | CodeQL ist aktiv und grün; die Alerts sind nicht lesbar. Dependabot ist nicht konfiguriert. `run_secret_scanning` wurde bewusst nicht ausgeführt. | `codeql.yml`; keine `dependabot.yml` | A11 › D.6 | V / B |
| Q-33 | Akzeptanzmatrix: Für die Szenarien 1, 2, 4 und 8 gibt es kaum Tests, teils fehlt die Implementierung (72 h fehlt, Starter hat 14 Tage; kein Kalender) | `shared/pricing.ts:662`; `stripe-checkout/index.ts:245` | A11 › E | V |
| Q-34 | Regressionsrisiko: Bot-Kanäle ohne direkten Test (`whatsapp-webhook`, `appointment-book`, `order-intake`); Edge Functions mit vielen Änderungen und wenig Tests (`kodee` 9/1, `audit-monitor-cron` 8/1 u. a.); shallow Clone (Zeitraum ~2 Wochen) | git log | A11 › F | V |

**Offene Fragen aus A11** (Blocker 1–8):
1. Required Checks; sollen E2E und CodeQL dazukommen?
2. Alert-Zahlen und Dependabot.
3. Sind die Webhook-Secrets in Prod gesetzt?
4. 72 h oder 14 Tage?
5. Was passiert mit der `e2e/`-Suite?
6. Sind `platform/` und `apps/mcp-server` noch produktiv?
7. Darf der Ratchet-Fix sofort rein, obwohl CI dadurch rot wird?
8. #1961 schließen?

## 4. Produktionssicherheit (Agent 12, dazu Gegenprüfung durch Agent 00 am 24. und 26.10.2026)

### 4.1 `deploy-cloudflare-pages.yml`: Wann läuft der Produktions-Deploy?

Gemeint ist der Step `pages deploy dist --project-name=realsyncdynamics-ai --branch=main` (`.github/workflows/deploy-cloudflare-pages.yml:217`).

Die Zeilennummern hat Agent 00 am 26.10.2026 per `git show origin/main:<datei>` gegengeprüft. Sie stimmen mit A12 › 0.2 überein. Die Datei ist zwischen `b4f8a2f` und `af41ee7` unverändert.

| Bedingung | Beleg | Status |
|---|---|---|
| Trigger `push` auf `main` mit Pfadfilter (src, platform, public, scripts, index.html, package*.json, vite.config.ts, tsconfig.json, wrangler.toml, `_redirects`, `_headers`, Workflow-Datei) | `:3-19` | V |
| Trigger `pull_request` ohne Branch- und Draft-Filter, gleiche Pfade ohne `_redirects`/`_headers` | `:20-32` | V |
| Trigger `workflow_dispatch` ohne Eingaben und ohne Ref-Prüfung, also **von jedem Branch auslösbar** | `:33` | V |
| Der Job `deploy` braucht `build` (`needs: build`) | `:201` | V |
| Job-Bedingung: `github.event_name != 'pull_request' && needs.build.outputs.cf_ready == 'true'` | `:203` | V |
| Herkunft von `cf_ready`: Output `steps.cfcheck.outputs.ready` | `:60` | V |
| `ready=true` nur, wenn `CLOUDFLARE_API_TOKEN` **und** `CLOUDFLARE_ACCOUNT_ID` nicht leer sind | `:66-67` (Env), `:86-87` | V |
| Ist `vars.CLOUDFLARE_ACTIONS_DEPLOY == 'true'` gesetzt und fehlen die Secrets, scheitert `build` mit Exit 1 (kein Deploy) | `:68`, `:91-98` | V |
| Sonst `ready=false` mit dem Hinweis, dass die Cloudflare-Git-Integration ausliefert | `:99-118` | V |
| Benötigte Secrets im Deploy-Step: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | `:215-216` | V |
| `--branch=main` ist fest eingetragen, ohne Abhängigkeit vom auslösenden Ref | `:217` | V |
| Kein `environment:` in keinem Job, also kein Reviewer-Haltepunkt | ganze Datei | V (A12 › 0.2) |

**Wege, auf denen der Step laufen kann:**

| # | Weg | Voraussetzungen | Wirkung | Status |
|---|---|---|---|---|
| P1 | Push oder Merge auf `main` mit Pfadtreffer | Secrets gesetzt | Deploy auf den Pages-Branch `main` (bestimmungsgemäß) | V (Logik) |
| P2 | `workflow_dispatch` von **beliebigem Branch** | Secrets gesetzt; eine Person oder ein Token mit Actions-Schreibrecht. Die Agenten-Sessions laufen als `realsyncdynamics-spec` (admin), und `actions_run_trigger` ist im Tool-Set. | Code des gewählten Branches geht nach `--branch=main` | V (Logik); Wirkung siehe P5 |
| P3 | Same-Repo-PR, der die Workflow-Datei ändert (z. B. `:203` entfernt) | Secrets gesetzt | Bei `pull_request` läuft die Workflow-Fassung aus dem PR mit Repository-Secrets, also ist ein Deploy aus dem PR möglich | A (GitHub-Semantik) |
| P4 | PR aus einem Fork | – | Fork-PRs erhalten keine Secrets, daher `cf_ready=false` und kein Deploy | A (GitHub-Semantik); Fork-Freigabe-Einstellung B |
| P5 | Ist-Zustand | Auf `main` wird `deploy` übersprungen (`cf_ready=false`, Run 39972134885, Job 120478227375 `skipped`), die Secrets sind dort also leer oder fehlen | P1 bis P3 sind **heute vermutlich nicht wirksam**; sie werden es, sobald die Secrets gesetzt sind | V (Run, 23.10.); Secret-Belegung B |
| P6 | Cloudflare-Git-Integration, außerhalb von GitHub Actions | Konfiguration im Cloudflare-Dashboard | Ausliefern von `main`; Previews für jeden Branch und PR, die gegen Prod-Supabase sprechen (`functions/api/fn/[[name]].ts:8`; `src/lib/supabaseUrl.ts:12-37`) | V (Check-Run 120699269847 auf #1971); Production-Branch im Dashboard B |

Nicht verifiziert ist der Production-Branch des Pages-Projekts. `wrangler.toml:45-47` nennt keinen; ob `--branch=main` Produktion bedeutet, hängt am Dashboard (B).

**Ergebnis: Produktionssicherheit nicht abschließend bestätigt.** Für einen normalen PR ohne Workflow-Änderung ist der Actions-Deploy durch `:203` gesperrt; dann entsteht nur ein Preview über die Git-Integration. Drei Punkte sind aber nicht belegt: die Belegung der Cloudflare-Secrets, der Production-Branch im Dashboard und die Fork-Einstellung. P2 und P3 sind technisch offen, sobald die Secrets existieren.

### 4.2 `auto-merge.yml`

Gegengeprüft am 26.10.2026 per `git show origin/main:.github/workflows/auto-merge.yml`; stimmt mit A12 › 0.1 überein.

| Stelle | Inhalt | Status |
|---|---|---|
| `:24-27` | Trigger nur `pull_request` mit Basis `main` und den Typen `labeled, unlabeled, synchronize, ready_for_review, reopened`; kein `opened`, kein `pull_request_target` | V |
| `:29-30` | Workflow-Token nur `contents: read` | V |
| `:38-42` | Job nur, wenn `draft == false` **und** der Head im selben Repo liegt (kein Fork) **und** (Label `automerge` gesetzt **oder** gerade entfernt). **Draft-PRs sind ausgeschlossen.** Keine Einschränkung nach Autor. | V |
| `:45-52` | Token aus der GitHub App (`vars.AUTOMERGE_APP_ID`, `secrets.AUTOMERGE_APP_PRIVATE_KEY`) | V |
| `:64-82` | Liest das Label live; ohne Label wird ein aktives Auto-Merge abgeschaltet | V |
| `:86-97` | Fail-closed ab 3000 Dateien oder bei nicht lesbarer Dateiliste | V |
| `:98-104` | Ändert der PR `supabase/migrations/**` (auch per Umbenennung), gibt es kein Auto-Merge, und ein aktives wird abgeschaltet | V |
| `:106-111` | Sonst `gh pr merge --squash --auto`. GitHub mergt erst, wenn die Pflicht-Checks grün sind. | V |
| Ist-Zustand | Es fehlt `AUTOMERGE_APP_ID`: `[@octokit/auth-app] appId option is required` (Run 39965410516, Job 120453862377). In den letzten 100 Läufen 0 × success. | V (A12 › 0.1) |

**Risiken bei Auto-Merge:**
- **Falle:** Ein Draft mit Label `automerge` wird mit „Ready for review“ (`ready_for_review`, `:26`) sofort scharf, sobald die App konfiguriert ist.
- **Schutz nur durch Disziplin:** Unabhängig von diesem Workflow kann der Owner-Account natives Auto-Merge setzen oder direkt mergen (A12 › 0.1 Punkt 3; A12 › R3).
- **Nicht durch `:98-104` gesperrt:** PRs, die `supabase/functions/**` oder `config.toml` ändern. Ihr Merge deployt über `deploy.yml` sofort nach Prod (A12 › R1).

### 4.3 Risiken vor Welle 2 (A12 › „Risiken vor Welle 2“)

| # | Schwere | Risiko | Beleg | Quelle |
|---|---|---|---|---|
| R1 | kritisch | Merge mit Änderungen unter `supabase/migrations/**`, `supabase/functions/**` oder `config.toml` wird ohne Gate in der Produktion angewendet (`db push --include-all`, Functions-Deploy) | `deploy.yml:3-11,24-38,80-93,95-173`; Runs 39967830851, 39975271469 | A12 › R1 |
| R2 | kritisch | PR-getriggerte Drift-Workflows starten PR-Code mit Prod-Zugangsdaten für Supabase (beliebiges SQL über die Management-API), auch bei Drafts | `migration-drift.yml:9-15,46-65`; `edge-function-drift.yml:40-47`; `entitlement-drift.yml:28-40`; `function-acl-drift.yml:28-34`; `cron-health.yml:46-52` | A12 › R2 |
| R3 | hoch | Agenten arbeiten mit dem einzigen Admin-Account; PR #1860 wurde ohne Approval gemergt | `get_me`; CODEOWNERS; PR #1860 | A12 › R3 |
| R4 | hoch | `migration-reconciliation.yml` führt auch im Dry-Run `repair` gegen Prod aus; ohne Branch-Wächter | `:3-10,28-35,51-82` | A12 › R4 |
| R5 | hoch | Gefährliche Dispatch-Workflows ohne Environment und Branch-Wächter | `delete-edge-function`, `enable-leaked-password-protection`, `provision-govard-gateway:38-66`, `siteos-production-e2e:32-35` u. a. | A12 › R5 |
| R6 | hoch | Keine isolierte Staging-Umgebung; Previews und Fallback zeigen auf Prod-Supabase | `functions/api/fn/[[name]].ts:8`; `src/lib/supabaseUrl.ts:12-37`; `deploy/deploy-to-staging.sh:28` | A12 › R6 |
| R7 | mittel | Merge Queue nicht im Betrieb (0 `merge_group`-Läufe); Review-Pflicht unklar | `docs/MERGE_CONFLICT_CONCEPT.md:52-60` | A12 › R7 |
| R8 | mittel | Cloudflare baut jeden Branch und PR als öffentlichen Preview | Check-Run 120699269847 | A12 › R8 |
| R9 | mittel | 20 Workflows ohne `permissions`-Block | Tabelle C | A12 › R9 |
| R10 | mittel | Rollback-Runbook veraltet; Migrationen nur fix-forward; PITR unbestätigt | `docs/runbooks/rollback.md:1-8,31-56,85-100` | A12 › R10 |
| R11 | niedrig | `docker-deploy.yml` mit nicht gepinnten Actions; `supabase/setup-cli` mit `latest` | `docker-deploy.yml:21…220` | A12 › R11 |
| R12 | niedrig | `tracker-db-update.yml` pusht direkt auf `main` und scheitert am Ruleset | Run 39766702607 | A12 › R12 |
| R13 | niedrig | Vercel-Apps laut Doku weiter angebunden | `DEPLOYMENT.md:66-128` | A12 › R13 |

**Freigabefähiger Rahmen für Agenten** (A12 › F):
- Erlaubt: Branches `claude/*` und `agent/*`; Draft-PRs nur mit `docs/**` oder `src/**` (ohne `src/lib/preview-sandbox.ts`).
- Tabu: `.github/**`, `scripts/**`, `package*.json`, `supabase/**`, `functions/**`, `workers/**`, `wrangler*.toml`, `deploy/**`, `apps/agent-runtime/**`, `services/realsync-runtime-core/**`.
- Außerdem: kein `automerge`, kein Ready-Schalten, kein Merge, kein Dispatch.

### 4.4 Ergänzende Befunde Agent 00 (lesend, 24.10.2026, GitHub-API)

| # | Befund | Beleg | Status |
|---|---|---|---|
| E-1 | GitHub hat 52 Workflows registriert, alle `active`; im Verzeichnis auf `main` liegen 38 | `actions_list list_workflows` | V |
| E-2 | 11 registrierte Workflow-Dateien liegen nicht auf `main` (u. a. `configure-branch-protection.yml`, `claude.yml`, `claude-code-review.yml`) | `git cat-file -e origin/main:…` | V |
| E-3 | `configure-branch-protection.yml` lief per Push von Feature-Branches, zuletzt am 03.08.2026 auf `claude/delete-old-prs-k461h4` mit Erfolg. Die Branches existieren nicht mehr. Was gesetzt wurde: B. | Runs 30808516566, 30029252719 | V / B |
| E-4 | `claude.yml` auf Branch `ci/claude-code-action` (`6a90627`) hat `contents/pull-requests/issues: write` und prüft nicht, wer „@claude“ kommentiert. Heute inaktiv (nicht auf `main`); riskant, falls er gemergt wird. | `get_file_contents`; Run 36421144434 | V / A |
| E-5 | Der Workflow `pages-build-deployment` (GitHub Pages) ist registriert, letzter Lauf 06.05.2026; den Branch `gh-pages` gibt es nicht mehr. Ob GitHub Pages aktiv ist: B. | Workflow-ID 271608520 | V / B |
| E-6 | Copilot cloud agent und Copilot-Reviewer sind aktiv | Workflow-IDs 269345182, 355340426 | V |
| E-7 | Einziger Collaborator ist `realsyncdynamics-spec` mit Rolle `admin` | `list_repository_collaborators` | V |
| E-8 | `delete-edge-function.yml` lief einmal (11.08.2026); `migration-reconciliation.yml` hat 0 Läufe | Run 31478605378 | V |

## 5. Befunde Agenten 01, 02, 08 (Kernbefunde; Volltext in den Originalberichten)

### 5.1 Agent 01 – Audit (A01)

| # | Befund | Beleg | Quelle | Status |
|---|---|---|---|---|
| D-01 | PR-Matrix der 14 offenen PRs: Draft-Status, CI, Hotspot, Security, Überlappung, Empfehlung | GitHub-API | A01 › B | V |
| D-02 | Gemeinsam geänderte Dateien und inhaltlicher Konflikt #1887 ↔ #1918 (Ziel von „Audit starten“) | Dateilisten | A01 › B (Überlappungsliste) | V |
| D-03 | Konto-Selbstlöschung ist defekt (409 bei alleinigen Ownern); `docs/runtime-status-matrix.md:108` meldet trotzdem „produktiv“ | `gdpr-delete/index.ts` | A01 › A1 | V |
| D-04 | Zwei Mitgliedschaftstabellen: `memberships` und `tenant_memberships` | Migrationen `20260430160000`, `20260602100000` | A01 › A1, E4 | V |
| D-05 | Bot Studio: Wizard nur UI, keine Wissensbasis, kein Sandbox-Chat, kein Handoff, kein Web-Widget; nur das Vertical „Restaurant“ | `src/features/bots/types.ts:5`; `ChatbotStartPage.tsx` | A01 › A2, A4 | V |
| D-06 | Voice-Code existiert, ist aber nicht angebunden (`coming-soon`); kein Vapi | `implementation-status.ts:272` | A01 › A3 | V |
| D-07 | `appointment-book` gibt DB-Fehlertexte an anonyme Aufrufer zurück | `appointment-book/index.ts` | A01 › A5 | V |
| D-08 | Es gibt keine 72-h-Testphase (`trialDays: 14`) | `shared/pricing.ts:662,758` | A01 › A7 | V |
| D-09 | Hotspot-Liste (Untergrenze): `src/App.tsx` 27 Commits, `seo.ts` 14, `implementation-status.ts` 13 u. a. | GitHub-API `list_commits` | A01 › C | V (Untergrenze) |
| D-10 | WP8A-Branches nicht auffindbar, nie ein PR | `git ls-remote` (2.038 Refs) | A01 › D | V |
| D-11 | 17 Doppelimplementierungen (Bot-Schema 3×, AI-Gateways, Evidence, Checkout, Pricing-Quellen, Landing, Onboarding u. a.) | Dateiliste | A01 › E | V / A |
| D-12 | Widersprüchliche Statusquellen (Policy Engine „live“ vs. „roadmap“) | `implementation-status.ts:319`; `runtime-status-matrix.md:81-82` | A01 › A6, E17 | V |

### 5.2 Agent 02 – Backend/Supabase (A02)

| # | Befund | Beleg | Quelle | Status |
|---|---|---|---|---|
| S-01 | Zwei Schema-Linien für Bots: A ist genutzt, B ist toter Bestand in Prod; B hat Schreib-Policies auf Tabellen von A ergänzt | `20260628193744_bots_foundation.sql:9-23,175-188` | A02 › Kurzfassung 1, A.3 | V |
| S-02 | Für die Szenarien 2 und 3 fehlen Slots, Kalender, Doppelbuchungsschutz, Idempotenz, Katalog-Schema, Bot-Wissensbasis und Handoff | – | A02 › Kurzfassung 2, A.3 | V |
| S-03 | Functions mit Service-Role ohne Auth- oder Membership-Prüfung: `webhook-deliver`, `webhook-dispatcher`, `calculate-seo-metrics` (hoch); `nis2-deadline-calculator`, `dashboard-digest-generate` (mittel–hoch); `hostinger-agent-brief`, `audit-determinism-verify`, `train-forecast-models`, `sync-stripe-metrics`, `cookie-scan-deep` (mittel) | `webhook-deliver/index.ts:7,95-170`; `webhook-dispatcher/index.ts:37-50`; `calculate-seo-metrics/index.ts:55-151`; `nis2-deadline-calculator/index.ts:4,25-58` | A02 › B.5 | V |
| S-04 | IDOR auf main: `audit-report-pdf` (ohne Token genügt `audit_id`) und `audit-claim` (abweichende E-Mail wird nur protokolliert); behebt #1869 | `audit-report-pdf/index.ts:97-111`; `_shared/audit-claim.ts:116-119` | A02 › B.5 | V |
| S-05 | 8 Tabellen ohne RLS, bewertet niedrig bis mittel; Abweichungen in Prod: B | `security-regressions.db.test.ts:410-419` | A02 › B.1 | V / B |
| S-06 | `sub_processor_subscriptions`: anonymes INSERT mit `WITH CHECK (true)` | `20260507140000_sub_processor_changes.sql:88-92` | A02 › B.2 | V |
| S-07 | 17 SECURITY-DEFINER-Funktionen ohne `search_path`, meist auf service_role begrenzt; `legal_retrieve_chunks_hybrid` für PUBLIC ausführbar | `20260903044500:66-127`; `20260625200001:11-36` | A02 › B.3 | V / A |
| S-08 | `tenant_memberships` wird seit dem 02.06. nicht mehr gepflegt, steuert aber 17 Policies plus `runtime_events`; Risiko veralteter Rechte | `20260602100000:91-104` | A02 › B.4 | V / A |
| S-09 | `viewer_auditor` darf `bots` inkl. Preise ändern | `20260628121531:139-146` | A02 › B.5 | V |
| S-10 | 196 Edge Functions, die Liste ist synchron; 71 mit `verify_jwt=false` | `src/config/production-edge-functions.ts:92-95` | A02 › C.1 | V |
| S-11 | Migrationen: 390 Dateien, keine Kollision; Drift-Guard ist ohne Secrets ein Skip mit Exit 0; #1650 offen; seit 01.09. kein DROP | `scripts/check-migration-drift.mjs:40-55` | A02 › D | V / B |

### 5.3 Agent 08 – Billing / Unit Economics (A08)

| # | Befund | Beleg | Quelle | Status |
|---|---|---|---|---|
| B-01 | Auf main gilt die Regelbesteuerung (`EU_STANDARD`, Stripe Tax an, PR #1950); `.github/PR_TRIAGE_POLICY.md:54` verlangt weiter den § 19-Hinweis | `shared/pricing.ts:3012`; `_shared/checkout-tax.ts:103` | A08 › Kurzfazit 1, Konflikt (a) | V |
| B-02 | Die Epic-Preise 79/249/699 € entsprechen den bestehenden Plänen; Enterprise 1.249 € bleibt die höchste Stufe | `shared/pricing.ts:593,673,772` | A08 › A.3 | V |
| B-03 | Starter wirbt mit „1 Bot mit 500 Antworten“, `ai.tool.bot_reply` fehlt aber, also 403 | `shared/pricing.ts:657` vs. `:1977ff`; `20260927112804…:391-417` | A08 › Kurzfazit 3 | V / A |
| B-04 | Harte Stopps fehlen: Voice-Minuten erst nach dem Anruf; `limit.ai_cost_monthly_cents` wird nicht durchgesetzt; USD-Deckel plan-unabhängig 250 USD; Reservierungen werden nicht gezählt; `consumeUsage` fail-open | `bot-voice-webhook/index.ts:168-171`; `_shared/ai.ts:330,389` | A08 › Kurzfazit 4, F | V |
| B-05 | Testphase: 14 Tage plus offene Beta (Growth gratis bis 31.01.2027); für 72 h fehlen eine Stunden-Einheit, Trial-Caps und eine Sperre je Person | `beta-enroll/logic.ts:17-20`; `src/config/beta.ts:29` | A08 › Kurzfazit 5, C | V |
| B-06 | Webhook-Lücken: nicht retry-sicher, keine Reihenfolgesicherung, kein `async_payment_succeeded`, Erstattung ohne Rechteentzug | `stripe-webhook/index.ts` | A08 › Kurzfazit 6, B.2 | V |
| B-07 | Nur ein `STRIPE_SECRET_KEY` und ein Supabase-Projekt, daher braucht der Testmodus Staging (#1819 geschlossen) | – | A08 › Kurzfazit 7 | V |
| B-08 | Unit Economics: Web-Chat-Marge 85–89 % am Kontingent-Limit (Variante netto zzgl. USt); WhatsApp drückt Agency auf 14–27 %; dazu kommen Voice ohne Stopp, die Gratis-Beta und Worst-Case-Prompts | Modell E.1–E.4 | A08 › E | A |
| B-09 | Top-10-Margenrisiken mit Gegenmaßnahmen | – | A08 › F | V / A |
| B-10 | Enterprise: 1.249 € (Policy, SSoT) widerspricht `priceOnRequest`/„nur per Vertrag“; dazu `README.md:200` „ab 1.500 €“ und `shared/model-prices.ts:7` „Enterprise+ €1.999“ | `shared/pricing.ts:852-877` | A08 › Konflikt (b) | V |

## 6. Konflikte zur Entscheidung durch Dominik (nur dokumentiert)

| # | Konflikt | Quellen |
|---|---|---|
| K1 | Branchen-Scope: Restaurant steckt im Kern-`bot-chat`/`order-intake`, dazu über 20 Branchen-Landingpages, gegen die Policy „kein branchenfremder Scope im Kernprodukt“; „Metzgerei“ hat keinen Treffer | A01 › Konflikte (a) |
| K2 | Enterprise 1.249 € gegen „auf Anfrage/Vertrag“, README 1.500 €, Enterprise+ 1.999 € | A01 › Konflikte (c); A08 › Konflikt (b) |
| K3 | § 19 UStG in der Policy gegen USt-Pflicht auf main; 4 verwaiste § 19-Branches; fehlende USt-IdNr.; Preise netto oder brutto? | A08 › Konflikt (a) |
| K4 | Landing V4 (AGENTS.md, Policy) gegen tatsächlich V6 (`src/App.tsx:499`); weitere veraltete Dokumente | A01 › Konflikte (b) |

## 7. Abhängigkeiten

- **Offene PRs:** Reihenfolge und Überlappungen siehe `CONTRACTS.md` D.3 (Quelle A01 › B).
- **Issues:**
  - #1650: Schema-Drift (S-01, Q-17)
  - #1646: Usage-Attribution (G-19)
  - #1938: Stripe Tax (B-01)
  - #1039 und #923: Webhook und Entitlements (B-06)
  - #1153: Voice-Pricing (B-04)
  - #1381: Dashboard (Q-11, check-dashboard-actions: 1 BROKEN)
  - #1865: Audit-Claim (S-04)
- **Phase 0 vor allem, was `supabase/**` ändert:** R1 und R2 sind kritisch. Ohne Environment-Gate wäre jeder Security-Fix in Edge Functions beim Merge sofort live.

## 8. Empfehlungen (alle nicht freigegeben)

1. **Phase 0 (Produktionsschutz), zuerst, mit Einzel-Freigaben:**
   - gefährliche Dispatch-Workflows deaktivieren (R4, R5, E-3)
   - Einstellungen ablesen (Ruleset, Actions, Environments, Pages)
   - Environment `production` mit Reviewer an allen Prod-Jobs (R1)
   - Drift-Guards ohne Prod-Zugangsdaten auf PRs (R2)
   - eigener Agenten-Account (R3)
   - Webhook-Secrets prüfen (G-29, Q-19, Q-21)
   - Staging aufsetzen (R6, B-07)
2. **Phase 1 (Security, Vorrang laut Triage-Policy):**
   - #1869 → #1926 → #1961 schließen → #1970 → #1908
   - neue Security-PRs für S-03 sowie WhatsApp und Telegram fail-closed
3. **Fixes und Dashboard:** in der Reihenfolge von A01 › B.
4. **Welle 2 (Module), erst nach Phase 0 und den Produktentscheidungen K1–K4:**
   - Contract-Tests zuerst (`CONTRACTS.md` C)
   - Vertrag `bot-action/v1` (`CONTRACTS.md` B)
   - Arbeitspakete G1–G8 (A03) und QA-1–QA-8 (A11)
   - Reihenfolge G1 → G2 → G5 → G4 → G3 → G6 → G7
5. **Doku bereinigen:** veraltete Landing-Angaben (K4), den CLAUDE.md-Satz zum AI-Logging (G-19), widersprüchliche Statusquellen (D-12). Die Policy-Datei braucht dafür eine Einzel-Freigabe.

## 9. Offene Punkte

- Nicht verifiziert:
  - Rulesets, Environments, Actions- und Repository-Einstellungen
  - Belegung der Secrets (GitHub, Supabase), Cloudflare-Dashboard (Production-Branch, Previews), GitHub Pages
  - Prod-ENV der PDP-Modi, Prod-Schema (#1650), PITR
- WP8A-Branches nicht auffindbar (D-10).
- Lokale Tests (Vitest, DB, Playwright, tsc) nicht ausgeführt, weil `node_modules` fehlt.
- Seit der Prüfbasis gibt es auf `main` 2 Commits (#1986, #1990). Bis auf die Workflow-Dateien sind sie gegen die Befunde nicht nachgeprüft.
- **Doku-Budget überschritten** (`node scripts/check-context-budget.mjs`, Exit 1, Grenze 2.700 KB Markdown unter `docs/`):
  - Basis `b4f8a2f`: 2.484 KB (219 Dateien).
  - Sicherungs-Commit `9563c3d`: 2.750 KB.
  - Mit diesen drei Dateien: 2.810 KB.
  - Beim Push läuft kein Workflow; der CI-Job `gates` würde in einem PR, der aus dem Draft-Status geholt wird, rot werden.
  - Vor jedem PR oder Merge dieses Branches ist zu entscheiden, wie gekürzt oder ausgelagert wird. Laut CLAUDE.md wird das Budget nicht angehoben.
