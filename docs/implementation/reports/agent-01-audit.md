# Agent 01 – Audit: Feature-, Defekt- und PR-Matrix (Welle 1, Epic #1972)

Stand: 23./24.10.2026 · Repo-Basis `b4f8a2f` (= origin/main) · strikt lesend.
Statusmarken: **VERIFIZIERT** (Code/API gelesen) · **ABGELEITET** (Schluss aus Belegen) · **BLOCKIERT** (Grund genannt).

Methodenhinweise:
- Lokaler Clone ist **shallow** (`git rev-parse --is-shallow-repository` → `true`, 50 Commits, ältester 10.10.2026). Für 30-Tage-Auswertungen wurde deshalb die GitHub-API benutzt (`list_commits` mit `path` + `since=2026-09-23`). `git fetch --deepen` habe ich nicht verwendet, weil Fetch laut Brief gesperrt ist.
- PR-Dateilisten stammen vollständig aus `pull_request_read get_files`. Bei großen Antworten habe ich die gespeicherte JSON-Datei per `jq` vollständig auf `filename`/`status` reduziert. Die Patches selbst habe ich bei #1969, #1967, #1918, #1869 und #1891 nicht gelesen.
- Rohnotizen: `…/scratchpad/a01/` (`<PR>.txt` = Dateilisten, `ci.txt`, `hot.txt`).

---

## B) PR-Matrix: 14 offene PRs (VERIFIZIERT über GitHub-API, 23.10.2026 ca. 23:00 UTC)

CI-Muster (VERIFIZIERT): Bei **Draft-PRs** werden `unit`, `gates`, `spa`, `build` und `Migration validation` **übersprungen**. Grün sind dort nur Build SPA, Playwright E2E, CodeQL, Lighthouse, hygiene/drift/conflict-state und, wo vorhanden, Migration collisions. Ein grüner Draft heißt also **nicht**, dass Unit-, DB- oder Migrationstests gelaufen sind.

| Nr | Titel (kurz) | Draft | mergeable_state | CI (Run-ID) | Dateien (Anz. + Kernpfade) | Hotspot | Security | Epic-Bezug | Überlappung | Duplikationsrisiko | Empfehlung |
|---|---|---|---|---|---|---|---|---|---|---|---|
| #1971 | docs(plan): Zielbild | ja | clean | 13 Checks, keiner rot. unit/gates/MigVal **skipped** (40036145314) | 2: `.claude/os-funnel/ZIELBILD.md` (neu), `PLAN.md` | **ja** (`PLAN.md` 9× in 30 T.) | nein | Agent 00, Maßstab für alle Wellen | keine | gering. ZIELBILD führt Phase 1–3 neben PLAN/OKTOBER-2026 ein; drei Plan-Dokumente parallel | fortführen (Docs, WIP-frei), seriell zu anderen `PLAN.md`-Änderungen |
| #1970 | fix(gdpr-delete): Selbstlöschung (R-03) | ja | clean | 21 Checks, keiner rot. **unit/gates/MigVal skipped** (40032809717); Migration collisions grün | 6: `supabase/functions/gdpr-delete/{index,tenant-cleanup}.ts`, **Migration `20261023120000_account_self_deletion_sole_tenant.sql`**, `AccountSettings.tsx`, 2 Tests | nein | **ja (ABGELEITET, „im Zweifel“)**: Lösch-/Auth-Pfad mit service_role-RPC | 02 Backend / 03 GDPR | logisch mit #1908 (Evidence-Trigger, laut PR-Text verträglich) | gering. Behebt einen Defekt in main: Jede Selbstlöschung endet mit 409 (`gdpr-delete/index.ts` im main: SOLE_OWNER-Block) | **fortführen**, Einzel-Freigabe (Migration + Security). Vorher aus Draft nehmen, damit der DB-Job läuft |
| #1969 | fix: Beta-Konsistenz + Seitentitel + echter 404 | ja | clean | 40 Checks (2 Läufe), keiner rot. unit/gates/MigVal skipped (40035565734) | **85**: `src/App.tsx`, `src/config/seo.ts`, `shared/pricing.ts`, `pricing.generated.ts`, `src/config/beta.ts`, `functions/_middleware.ts`, `scripts/prerender.mjs`, `package.json`, `public/llms.txt`, ~45 `src/pages/*`, `.github/workflows/deploy-cloudflare-pages.yml` | **ja** (App.tsx 27×, seo.ts 14×, implementation-status 13×, handoff.ts 13×, pricing 9×, AuditLanding 8×) | nein | 08 Billing (Preise/Beta), 09 Frontend | **#1888** (`AuditLanding.tsx`), **#1967** (`App.tsx`) | **hoch**: berührt Preise, Legal-Texte, Middleware und Deploy-Workflow in einem PR | Einzel-Freigabe (Preise/Steuer/Claims). Aufteilen in (a) SEO/404, (b) Beta-Preise/Legal, (c) Deploy-Workflow wird empfohlen. Nicht parallel zu #1967 |
| #1967 | feat(beta): Dashboard für Beta-Tester (WP-4) | ja | clean | 23 Checks, keiner rot. unit/gates/MigVal skipped (40035636966) | 17: `src/App.tsx`, `CommandCenterDashboard.tsx`, `CustomerStartPanel.tsx`, **Migration `20261022090000_beta_feedback.sql`** (RLS + SECURITY DEFINER), Edge `beta-sample-data`, Admin-View | **ja** (App.tsx, CommandCenterDashboard 9×) | **ja** (neue RLS-Policies + SECURITY-DEFINER-RPC) | 09 Frontend / Dashboard | **#1969** (App.tsx), **#1891** (CommandCenterDashboard), **#1918/#1963** (CustomerStartPanel) | mittel. Beispieldaten-Mechanik ist neu, `demo*`-Daten existieren bereits an anderer Stelle | fortführen, seriell nach #1969/#1891. Migration einzeln, nach #1970/#1908-Reihenfolge klären |
| #1963 | fix(dashboard): Risiko-Kachel verlinkt korrekt | nein | **behind** (Label needs-rebase) | 32 Checks, **alles grün inkl. unit/gates/spa/MigVal** (40035542455) | 6: `CustomerStartPanel.tsx`, `dashboardSignals.ts`, `startPanelModel.ts`, `src/i18n/handoffApp.ts`, 2 Tests | **ja** (`handoffApp.ts` 9×) | nein | 09 Dashboard (#1381 Actionability) | **#1918** (startPanelModel, handoffApp, Test), **#1967** (CustomerStartPanel) | gering | **fortführen**: `main` einmergen, als Erster der Dashboard-Gruppe mergen (kleinster Diff) |
| #1961 | fix(security): AI-Residency fail-closed + Bot-Chat-Policy | ja | clean (Base = `feat/ai-os-governed-assistant-20261021`) | 20 Checks grün (39679126196, 21.10.) | 9: `_shared/{ai,bots,residencyGuard}.ts`, `bot-chat`, `governance-router`, Tests, Doku | nein | **ja** | 04 Bot Studio / 03 | **identischer Inhalt in main über #1966** (`4df1fde`) | **sehr hoch: Duplikat** | **überholt prüfen → schließen** (Einzel-Freigabe Schließen). Beleg: `supabase/functions/_shared/residencyGuard.ts` existiert in main, `_shared/ai.ts:181` `requireVerifiedAiResidency`, `bot-chat/index.ts:77/86/109` (Lookup → PEP → Quota). Die Base-PR #1959 ist geschlossen (23.10.). Byte-Diff nicht geprüft (ABGELEITET) |
| #1926 | fix(leads): Werbung nur mit Einwilligung, kein fremdes HTML | nein | clean | 18 Checks **alles grün inkl. unit/MigVal** (39977596279) | 6: `audit-drip-cron/{index,consent-gate}.ts`, `sales-lead/index.ts`, `gdpr-audit/index.ts`, Baseline-JSON, Test | **ja** (`gdpr-audit/index.ts` 7×) | **ja** (Mail an frei wählbare Adresse, DB-Fehlertexte an anonyme Aufrufer, Einwilligung) | 03 GDPR, 06 Opt-in-Muster | keine Datei-Überlappung mit offenen PRs | gering. Defekt in main VERIFIZIERT: `sales-lead/index.ts:69` `sendStarterOffer`, `:375` | **fortführen**, Security-Phase, Einzel-Freigabe |
| #1918 | feat(onboarding): „Erstes Audit“-Assistent | ja | clean | 18 Checks, unit/gates/MigVal skipped (40035938683) | 15: `OnboardingView.tsx`, `onboarding/firstAuditModel.ts`, `CustomerStartPanel.tsx`, `startPanelModel.ts`, `BrowserTopBar.tsx`, `WebsiteGovernanceView.tsx`, `EvidenceVaultView.tsx`, `handoffApp.ts`, Tests | **ja** (handoffApp) | nein | 09 Onboarding (Einstieg „Audit“) | **#1887** (BrowserTopBar, WebsiteGovernanceView, chrome-wiring-Test, **inhaltlicher Konflikt: Ziel von „Audit starten“**), **#1963**, **#1967** | mittel: drittes Onboarding neben `SetupAssistant` und `PostRegisterOnboardingPage` | fortführen, aber zuerst Dominik-Entscheidung zum TopBar-Ziel (#1887 vs. #1918). Nach #1963 mergen |
| #1908 | fix(evidence): governance_evidence append-only | ja | clean | 17 Checks, **unit/gates/MigVal skipped** (40035353531) → DB-Test nicht in CI gelaufen | 2: **Migration `20261023223000_governance_evidence_append_only.sql`**, DB-Test | nein | **ja (ABGELEITET)**: REVOKE von Rechten, Trigger mit SECURITY DEFINER | 03 Evidence | Reihenfolge nach #1970 (`20261023120000`) | gering | fortführen, Migration einzeln. Erst aus Draft nehmen, damit `Migration validation` und der DB-Job laufen |
| #1907 | fix(billing): Nutzerplätze (`limit.team_seats`) durchsetzen | ja | clean | 19 Checks, unit/gates/MigVal skipped (40035137041) | 4: `_shared/seat-limit.ts`, `tenant-invite/index.ts`, `src/features/tenants/api.ts`, Test | nein | Grenzfall (Membership-Aufnahme). ABGELEITET: eher Billing | 08 Billing / Quota | keine | gering | fortführen nach Produktentscheidung (Free/Starter = 1 Platz ⇒ keine Einladungen; Beta-Plätze?) |
| #1891 | feat(dashboard): „Ihre Pflichten heute“ | nein | clean | 17 Checks **alles grün inkl. unit/MigVal** (40035793867) | 9: `CommandCenterDashboard.tsx`, `ObligationsPanel/Tracker`, `obligation*.ts`, `src/pdf/*`, 2 Tests | **ja** (CommandCenterDashboard 9×) | nein | 09 Dashboard | **#1967** (CommandCenterDashboard) | gering | fortführen; seriell vor #1967 |
| #1888 | fix(audit): „Audit bestanden“ → „Keine Befunde“ | ja | clean | 18 Checks, unit/gates skipped (40035628093) | 1: `src/pages/AuditLanding.tsx` | **ja** (AuditLanding 8×) | nein | 09 / Claims | **#1969** (AuditLanding) | gering. Defekt VERIFIZIERT: `AuditLanding.tsx:816` „Audit bestanden“ | fortführen (Claim-Freigabe), **vor** #1969 mergen oder in #1969 aufnehmen |
| #1887 | fix(app): Audit-Einstiege → Website-Audit | nein | **behind** (needs-rebase) | 34 Checks **alles grün inkl. unit/MigVal** (40035546979) | 13: `BrowserTopBar.tsx`, `GovernanceAddressBar.tsx`, `auditPrefill.ts`, `ComplianceStatusDashboard.tsx`, `DashboardExecuteStrip.tsx`, `workspaceBootstrapSteps.ts`, `scansApi.ts`, `WebsiteGovernanceView.tsx`, Tests | nein | nein | 09 (zwei Scan-Pfade) | **#1918** (gleiche Dateien + Zielkonflikt) | mittel | **blockiert** bis zur Dominik-Entscheidung über das TopBar-Ziel; danach `main` einmergen |
| #1869 | fix(security): Audit-Übernahme/Bericht nicht nur über audit_id | nein | clean | 19 Checks **alles grün inkl. unit/MigVal** (40034965211) | 14: `audit-claim/index.ts`, `audit-report-pdf/index.ts`, `_shared/audit-claim.ts`, `_shared/audit-report-access.ts`, `claimAudit.ts`, `pendingAudit.ts`, `PostRegisterOnboardingPage.tsx`, `NextBestActionCard.tsx`, `scripts/gtm-readiness-check.sh`, `docs/qa/landing-to-runtime-parity.md` | nein | **ja (P0)** | 03 / 11 QA | keine Datei-Überlappung | gering | **fortführen, höchste Priorität**. Lücke in main VERIFIZIERT: `audit-report-pdf/index.ts:107` prüft nur `if (callerEmail && …)` ⇒ anonymer Abruf möglich |

### Überlappungsliste (VERIFIZIERT aus den Dateilisten)
- `src/features/governance/dashboard/CustomerStartPanel.tsx`: #1918, #1963, #1967
- `startPanelModel.ts` + `test/…/startPanelModel.test.ts`: #1918, #1963
- `src/i18n/handoffApp.ts` (Hotspot): #1918, #1963
- `BrowserTopBar.tsx`, `WebsiteGovernanceView.tsx`, `dashboard-chrome-wiring.test.ts`: #1887, #1918
- `src/pages/AuditLanding.tsx` (Hotspot): #1888, #1969
- `src/App.tsx` (Hotspot): #1967, #1969
- `CommandCenterDashboard.tsx` (Hotspot): #1891, #1967
- Migrationen (jeweils einzeln mergen): #1967 `20261022090000`, #1970 `20261023120000`, #1908 `20261023223000`. Die Zeitstempel-Reihenfolge ist eindeutig, der Collision-Check ist bei #1970/#1967/#1908 grün.

### Vorgeschlagene Merge-Reihenfolge (ABGELEITET; jeder Schritt braucht laut Policy Dominiks Freigabe)
1. Security: #1869 → #1926 → #1961 schließen (überholt) → #1970 (Migration) → #1908 (Migration)
2. Fixes: #1963 → #1888 → #1887 *oder* #1918 (nach Entscheidung)
3. Legal/Pricing/Landing: #1969 (am besten aufgeteilt)
4. Features: #1891 → #1907 (nach Entscheidung) → #1967 (Migration zuletzt)
5. Docs: #1971 jederzeit, außer parallel zu `PLAN.md`-Änderungen

---

## A) Feature-/Defekt-Matrix nach Epic-Domänen

Reifegrad: echt / teilweise echt / Stub / simuliert / Mock / nur UI.

### A1 Auth / Organisation / Mitgliedschaften
| Feature | Existiert | Fundstellen | Reifegrad | Tests | Defekte / Hinweise | PR/Issue |
|---|---|---|---|---|---|---|
| Supabase Auth (Magic-Link, OAuth) | ja | `src/pages/Welcome.tsx` (OTP/OAuth, s. `test/welcome/welcome-earth.test.ts`) | echt | ja | – | – |
| Mandant + Auto-Anlage bei Signup | ja | Trigger `auto_tenant_on_signup` (zitiert in #1970-Migration); `provision-tenant`, `partner-provision-tenant` | echt | `test/runtime/db/tenant-onboarding.db.test.ts` | **zwei Mitgliedschaftstabellen** `memberships` (`20260430160000_rename_organizations_to_tenants.sql`) **und** `tenant_memberships` (`20260602100000_runtime_events_backbone.sql`). #1970 muss deshalb beide prüfen | #1650 Schema Drift |
| Einladungen/Rollen | ja | `supabase/functions/tenant-invite`, `tenant-members`, `update-member-role` | echt | teilweise | `limit.team_seats` wird **nicht** durchgesetzt (VERIFIZIERT: `_shared/seat-limit.ts` fehlt in main) | #1907 |
| Konto-Selbstlöschung Art. 17 | ja | `supabase/functions/gdpr-delete/index.ts` | **defekt**: alleinige Owner bekommen 409. `docs/runtime-status-matrix.md:108` meldet trotzdem „produktiv“ | `test/edge/gdpr-delete-lead-erasure.test.ts` | Statusquelle widerspricht dem Code | #1970 |
| MFA/AAL2 | ja | `_shared/requireAal2.ts` (`observeAal2`), Migration `20260621000000_p0a_mfa_security.sql` | teilweise (nur „observe“) | – | ABGELEITET: nur beobachtend, nicht erzwungen | – |

### A2 Bot Studio
| Feature | Existiert | Fundstellen | Reifegrad | Tests | Defekte / Hinweise |
|---|---|---|---|---|---|
| Bot-CRUD / Builder | ja | `src/features/bots/{BotsView,BotBuilderView,api}.ts(x)`, Routen `src/App.tsx:873-876` (`/app/bots*`) | echt (Browser-CRUD über PostgREST + RLS) | `test/bots/buildBotPrompt.test.ts` | Status in `implementation-status.ts:256` `channel-bots`: **preview** |
| Wizard | teilweise | `/chatbot/start` → `src/pages/product-entry-points/ChatbotStartPage.tsx` (93 Z., verlinkt nur auf `/app/bots`) | **nur UI** | – | kein geführter Wizard |
| Templates | teilweise | `src/features/bots/types.ts:5` `BotVertical = 'general' \| 'restaurant'` | echt, aber **nur Restaurant** | `test/bots/restaurant*.test.ts` | Branchen-Scope-Konflikt (siehe Abschnitt „Konflikte“) |
| Wissensbasis/KB für Bots | **nein** | kein KB-Bezug in `src/features/bots`; vorhanden sind nur fremde KBs: `agent_knowledge_base` (`20260624000000_agent_operations_layer_schema.sql`), `hermes_knowledge_items`, `legal_rag_*` | – | – | Epic-Szenario 2 („KB beantworten“) nicht abgedeckt |
| AI-Gateway-Anbindung | ja | `bot-chat` → `runAiTool('bot_reply')` (`_shared/ai.ts`), Residency fail-closed (#1966) | echt | `test/governance/residencyGuard.test.ts` (über #1966) | mehrere Gateways (siehe E) |
| Sandbox/Testchat | **nein** (nur curl-Beispiel) | `BotBuilderView.tsx:407,421` zeigt Endpoint + curl | nur UI | – | kein In-App-Testchat |
| Tool-Schemas | teilweise | `_shared/pdp/toolcall.ts`, Restaurant-Turn `_shared/restaurant-turn.ts` | teilweise | `restaurantConversation.test.ts` | kein generisches Tool-Schema für Bots |
| Handoff an Menschen | **nein** | keine Treffer für handoff/escalat in `_shared/bots.ts`, `bot-chat`, `whatsapp-webhook` (nur Text `bots.ts:242`) | – | – | Epic fordert Handoff |
| Policy vor Speicherung | ja | `bot-chat/index.ts:77-109`; `_shared/pdp/botmessage.ts:65` Default **`shadow`** | teilweise: Ablehnungen werden standardmäßig **nicht** durchgesetzt | `test/governance/bot-chat-privacy-order.test.ts` | Epic-Szenario 5 braucht `enforce` |
| Quota `limit.bots` / `bot_messages_monthly` | ja | `20260920130000_bots_quota_enforcement.sql`, `consumeUsage` in `bot-chat:109` | echt | `test/runtime/db/bots-quota.db.test.ts` | – |
| **Schema-Altlast** | ja | `20260628120000/121531/193744_bots_foundation.sql` (3×, je auch `bots_entitlements` und `bots_ai_tool` 3×) | – | – | „Feature B“ (`bot_agents`, `appointments`, `orders`, `order_items`, `voice_channels`, `bot_question_catalog`) liegt **ohne Code-Referenz** in Prod. `bot_conversations` hat die Form von A. Doku: Header von `20260628193744_bots_foundation.sql` |

### A3 Voice
| Feature | Existiert | Fundstellen | Reifegrad | Hinweise |
|---|---|---|---|---|
| Twilio-Webhook | ja | `supabase/functions/bot-voice-webhook/index.ts:190` (`verifyTwilioSignature`) | Code echt, **nicht produktiv angebunden** | Status `voice-telephony` = **coming-soon** (`implementation-status.ts:272`) |
| Voice-Runtime-Schema | ja | `20260928130000_voice_runtime_foundation.sql` (`voice_sessions`, `voice_executions`, `voice_evidence`, `voice_number_bindings`, `voice_tool_requests`, `voice_bot_configs`) | Schema echt, Nutzung unklar | doppelt zu `voice_channels` aus Bots-Feature B |
| Agent-Runtime | ja | `apps/agent-runtime` (`/voice-tool`, `/voice-sessions`) | Deploy kaputt (laut Registry: letzter Lauf `deploy-agent-runtime-vps.yml` am 06.10. fehlgeschlagen) | ABGELEITET, Workflow-Run nicht selbst geprüft |
| UI | ja | `/app/voice` → `VoiceRouter` (`App.tsx:786`), `VoiceSessionsView.tsx` | nur UI (read-only, Leerzustand „Geplant“) | Issue #1153 (Voice/Storage-Pricing) |
| Vapi | **nein** | kein Treffer | – | – |
| Tests | ja | `test/bots/voiceWebhookSecurity.test.ts` | – | – |

### A4 WhatsApp / Telegram / Web-Chat-Widget
| Feature | Existiert | Fundstellen | Reifegrad | Hinweise |
|---|---|---|---|---|
| WhatsApp Cloud API Webhook | ja | `supabase/functions/whatsapp-webhook/index.ts:7-72` (Verify-Token, HMAC `X-Hub-Signature-256`) | Code echt, Status **preview** | Opt-in/Templates: keine Treffer (VERIFIZIERT per grep) ⇒ fehlt. Persistenz **vor** dem PEP (Release-Gate-Doku aus #1961/#1966) |
| WhatsApp-Kanäle | ja | `20260826000000_whatsapp_channel.sql`, `WhatsAppChannelsView.tsx`, `/pricing/whatsapp` (`App.tsx:973`) | echt (CRUD) | – |
| Telegram | ja | `telegram-webhook` (510 Z.), `telegram-channels`, `20260623000001_telegram_connections.sql` | echt/preview | – |
| Web-Chat-Widget (Embed) | **nein** | kein Embed-Skript in `public/` (nur `public/sdk/cookie-consent.js`); `bot-chat` öffentlich, `verify_jwt=false` | nur API | Epic-Szenario 2 braucht ein Widget |
| Tests | ja | `test/bots/whatsapp-parse.test.ts` | – | – |

### A5 Booking / Orders
| Feature | Existiert | Fundstellen | Reifegrad | Defekte |
|---|---|---|---|---|
| Terminanfrage | ja | `supabase/functions/appointment-book/index.ts` (94 Z.), Tabelle `bot_appointments` (`20260628120000_bots_foundation.sql:94`) | **nur Anfrage-Erfassung** | **kein Kalender, keine Slots, kein Doppelbuchungsschutz**: keine Treffer für overlap/exclude/tstzrange/unique (VERIFIZIERT). `if (error) return jsonError(500,'INTERNAL', error.message)` gibt DB-Fehlertext an anonyme Aufrufer zurück. Entitlement-Gate `bots.appointments` vorhanden |
| Bestellannahme | ja | `supabase/functions/order-intake/index.ts` (187 Z.), `bot_orders` | teilweise echt | Restaurant-Preise kommen serverseitig aus `bots.config.restaurant.menu` (`order-intake:114,133`). Im Legacy-Pfad steuert der **Client** Preise und Summe (`:22-56,146`, `computeLegacyTotal`). Kein eigenständiger Katalog |
| Bestellstatus | ja | `src/features/bots/api.ts:114,124` (Status-Update durch Tenant), `BotInboxView.tsx` | echt (manuell) | – |
| Katalog | teilweise | nur Restaurant-Menü in `bots.config`. `orders`/`order_items` aus Feature B ungenutzt | – | – |
| Add-on-„booking“ | ja, **anderer Begriff** | `20260904000000_addon_booking_schema.sql` = Add-on-**Buchung** (Billing), nicht Terminbuchung | – | Verwechslungsgefahr |
| Tests | ja | `test/bots/restaurantOrder.test.ts` | – | – |

### A6 Governance / Evidence / Policies / Approval-Gates
| Feature | Existiert | Fundstellen | Reifegrad | Defekte |
|---|---|---|---|---|
| Rule Engine (DSGVO/AI-Act) | ja | `_shared/rules/evaluator.ts`, `gdpr.json`, `ai-act.json` | echt | – |
| PDP/PEP | ja | `_shared/pdp/{core,decide,classify,botmessage,toolcall,m365event}.ts` | echt, Default **shadow** | Statusquellen widersprechen sich: `implementation-status.ts:319` `policy-engine` **live**, `docs/runtime-status-matrix.md:81-82` „Policy-as-Code / Runtime Enforcement **roadmap**“ |
| Approval-Gates | ja | `supabase/functions/governance-approvals` | beta (`runtime-status-matrix.md:83`) | – |
| Evidence-Kette | ja | `governance_evidence` + `append_governance_evidence` (20260928140100); `evidence-vault`, `evidence-vault-export`, `evidence-export`, `evidence-anchor`, `evidence-r2`, `iso42001-evidence-vault`, `governance-evidence-handler` | echt | `governance_evidence` ist nicht append-only (#1908). `evidence_items` hat weder Kette noch Schutz (laut #1908) |
| Audit-Claim/Bericht | ja | `audit-claim`, `audit-report-pdf`, RPC `claim_gdpr_audit` | **Sicherheitslücke in main** (siehe #1869) | #1865, #1869 |
| Tests | ja | `test/governance` (53 Dateien), `test/runtime/db/evidence-integrity.db.test.ts`, `gate2-evidence-append.db.test.ts` | – | – |

### A7 Billing / Trial / Entitlements / Quota
| Feature | Existiert | Fundstellen | Reifegrad | Defekte |
|---|---|---|---|---|
| Pricing-SSoT | ja | `shared/pricing.ts` (+ Deno-Zwilling `supabase/functions/_shared/pricing.generated.ts`); Enterprise `monthlyEur: 1_249`, `priceOnRequest: true` (`shared/pricing.ts:852-865`) | echt | siehe Konflikt (c) |
| Stripe Checkout/Webhook | ja | `stripe-checkout`, `stripe-checkout-verify`, `stripe-webhook`, `stripe-portal`, `stripe-meter-sync`, `stripe-token-meter-sync` | echt (Registry `stripe-checkout-e2e` live) | #1039, #923 (Webhook→Entitlements), #1938 Stripe Tax |
| Trial | ja | `create-trial-subscription` (kartenlos, `trialing`), `shared/pricing.ts:662,758` `trialDays: 14`, `20260928160000_wp2a_trial_end_expiry.sql`, `src/features/billing/startGrowthTrial.ts` | echt | **kein 72h-Trial**: keine 72h-Logik in Billing (VERIFIZIERT per grep). Epic-Szenario 1 ist neu |
| Beta-Zugang | ja | `beta-enroll` (Growth bis 31.01.2027), `src/config/beta.ts`, `useBetaEnrollment.ts` | echt / preview | #1874, #1967, #1969 |
| Entitlements/Quota | ja | `_shared/entitlements.ts` (`gateFeature`), `_shared/usage.ts` (`consumeUsage`), `tenant_entitlements()` | echt | Seats nicht durchgesetzt (#1907); Usage-Attribution AI-Gateway offen (#1646) |
| Tests | ja | `test/billing` (22), `test/runtime/db/{addon-entitlements,entitlement-grants,tenant-entitlements-callers}.db.test.ts` | – | – |

### A8 Frontend-Onboarding (zwei Einstiege) und Dashboard
| Feature | Existiert | Fundstellen | Reifegrad | Defekte |
|---|---|---|---|---|
| Einstieg „Audit“ | ja | `/audit` (`AuditLanding.tsx`), `/unified-entry/*`, `ScanStartPage.tsx` | echt | „Audit bestanden“ (`AuditLanding.tsx:816`, #1888). Öffentlicher Scan landet nicht im Workspace (#1887) |
| Einstieg „Bot“ | teilweise | `/chatbot/start`, `/phonebot/start` (`App.tsx:517-518`) | nur UI | kein geführter Bot-Pfad |
| Onboarding | ja, mehrfach | `OnboardingView.tsx` (5-Schritt-Wizard), `features/onboarding/SetupAssistant.tsx`, `unified-entry/pages/PostRegisterOnboardingPage.tsx`, Edge `onboarding-orchestrator`, `kodee-onboard` | echt/teilweise | Mehrfachimplementierung (E). #1918 ersetzt den Wizard |
| Dashboard | ja | `/app` → `CommandCenterDashboard`/`ComplianceStatusView` (laut `docs/product/implementation-status.md` Pkt. 5); weitere: `GovernanceDashboardView`, `EnterpriseAiOsDashboard`, `DashboardPreviewPage` | echt, teils Demo | Demo-/Mock-Dateien: `src/enterprise-os/mock/data.ts`, `features/governance/vvt/demoRuntimeVvtData.ts`, `dsgvo-control-pack/dsgvoControlPackDemo.ts`, `features/ai-governance/useAiGovernanceData.ts` (Treffer „demo/mock/simulat“, nicht im Einzelnen geprüft = ABGELEITET) |
| Tests | ja | `test/features/governance` (61), `test/onboarding` (4) | – | #1381 Dashboard Actionability |

### A9 Automation / Workflows / Website-Builder (SiteOS)
| Feature | Existiert | Fundstellen | Reifegrad | Hinweise |
|---|---|---|---|---|
| n8n/Automations | ja | `automation-trigger`, `automation-callback`, `automation-trigger-trial-webhook`, `features/automations/AutomationSkillsView.tsx` | **preview**, keine produktive Ausführung (`implementation-status.ts:302`) | daneben `workflow-trigger`/`workflow-callback` + `features/workflows` (Doppelung) |
| SiteOS Builder | ja | `/builder/:slug` (Puck), `packages/siteos-core`, Edge `siteos`, `workers/siteos-preview`, `/build` `BuildStudioPage.tsx` | preview (`web-builder`, `implementation-status.ts:406`) | eigene Domain, DNS und Rollback fehlen |
| Weitere Builder | ja | `features/app-builder` (bolt), `features/website-operations/CreateWebsiteWizard.tsx`, `checkout-website-rebuild`, `checkout-siteos-project`, `platform/builder_orchestrator` | gemischt | Doppelung (E) |
| Tests | ja | `test/siteos` (39), `test/build-studio` (4), `test/automations` (2) | – | – |

---

## C) Ownership und Hotspots

**CODEOWNERS** (VERIFIZIERT `.github/CODEOWNERS`): `*` und alle Hot-Files → `@realsyncdynamics-spec` (ein Account, keine Teams). Explizit gelistet: `src/App.tsx`, `index.html`, `CLAUDE.md`, `shared/pricing.ts`, `src/config/pricing.ts`, `src/index.css`, `src/pages/MainLanding.tsx` (**veraltet**: nicht in `App.tsx` geroutet, `grep -c MainLanding src/App.tsx` = 0), `package.json`, `package-lock.json`, `supabase/migrations/`, Merge-Betriebsdateien.

**Hotspot-Liste neu (Commits auf `main` seit 23.09.2026; 266 Commits gesamt).** Methode: GitHub-API `list_commits(path, since)`, ein Commit entspricht einem Squash-PR. Kandidaten: Top-Dateien des lokalen 50-Commit-Fensters plus Policy-Hotfiles. **Ohne Lockfiles und generierte Dateien. Nicht erschöpfend** (BLOCKIERT für eine Vollauszählung: shallow Clone, `fetch` gesperrt; dafür wären rund 266 `get_commit`-Aufrufe nötig).

| Commits/30 T. | Datei | Hotspot (>5) |
|---|---|---|
| 27 | `src/App.tsx` | ja |
| 14 | `src/config/seo.ts` | ja |
| 13 | `src/product/implementation-status.ts` | ja |
| 13 | `test/product/implementation-status.test.ts` | ja |
| 13 | `src/i18n/handoff.ts` | ja |
| 10 | `src/components/landing/v4/LandingV4Sections.tsx` | ja |
| 9 | `.claude/os-funnel/PLAN.md` | ja |
| 9 | `src/i18n/handoffApp.ts` | ja |
| 9 | `src/config/production-edge-functions.ts` | ja |
| 9 | `shared/pricing.ts` | ja |
| 9 | `src/features/governance/dashboard/CommandCenterDashboard.tsx` | ja |
| 8 | `src/components/landing/v6/LandingV6View.tsx` | ja |
| 8 | `src/components/landing/v4/landing-v4-content.ts` | ja |
| 8 | `src/pages/AuditLanding.tsx` | ja |
| 7 | `CLAUDE.md`, `src/index.css`, `supabase/functions/gdpr-audit/index.ts` | ja |
| 6 | `src/components/landing/v6/useLandingV6.ts`, `tests/e2e/public-routes.spec.ts` | ja |
| ≤4 | `public/sitemap.xml` 4, `stripe-checkout` 4, `Welcome.tsx` 3 (lokal 4), `_shared/ai.ts` 3, `Faq.tsx` 3, `package.json` 2, `src/config/beta.ts` 2, `stripe-webhook` 2, `BETA_V5_WORKPLAN.md` 2, `CustomerStartPanel.tsx` 1, `startPanelModel.ts` 1, `pricingContent.ts` 0 | nein |

Abweichung VERIFIZIERT: Für `Welcome.tsx` und `stripe-webhook` zählt das lokale 50-Commit-Fenster einen Commit mehr als die API (vermutlich Pfad-History-Vereinfachung der API). Die API-Zahlen sind daher als **Untergrenze** zu lesen.

---

## D) WP8A: Branches `fix/entry-preload-vendor-viz` und `fix/welcome-earth-desktop-only`

| Prüfung | Ergebnis | Status |
|---|---|---|
| `git ls-remote origin` (2.038 Refs), grep `entry-preload\|welcome-earth\|vendor-viz\|desktop-only` | **0 Treffer**, also auf origin nicht vorhanden | VERIFIZIERT |
| `list_pull_requests(state=all, head=realsyncdynamics-spec:<branch>)` für beide | `[]`: es gab nie einen PR von diesen Heads | VERIFIZIERT |
| `search_pull_requests` „entry-preload“ | Treffer #1969, #1696, #1579, #1577 (Volltext, keine passenden Heads) | VERIFIZIERT |
| `search_pull_requests` „welcome-earth“ | 21 Treffer zu Earth-PRs (z. B. #1300 merged `/welcome`-Earth, #1299 closed, #1523, #1545), keiner mit Head `fix/welcome-earth-desktop-only` | VERIFIZIERT |
| `search_pull_requests` „vendor-viz“ | #1416, #1535 (merged/closed), keine passenden Heads | VERIFIZIERT |
| `git log --all --oneline` grep | keine Treffer. Lokal nur 50 Commits, Reflog zeigt nur `main`/`4df1fde` und den Session-Branch | VERIFIZIERT (lokal eingeschränkt) |
| Lokale Artefakte (`*.bundle`, Dateien mit WP8A-Namen) unter `/home/user`, `/tmp` | keine Bundles; nur `test/welcome/welcome-earth.test.ts` (Test auf main: Globe lazy, `hidden`/`lg:block`, Desktop-Layout) | VERIFIZIERT |
| Head-SHA / Merge-SHA | **nicht ermittelbar**: Branches existieren nicht auf origin und nicht lokal | BLOCKIERT (keine Quelle) |
| Bezug im Code | `vite.config.ts:47-56` definiert bereits Chunk `vendor-viz` (recharts + three gemeinsam). `.claude/os-funnel/PLAN.md:165` WP8a = „Messung zuerst, keine UI-Änderung“; `PLAN.md:163` WP7: „3D-Erde nur Desktop“ offen und zurückgestellt | VERIFIZIERT |
| „Gate 1 of 6“ | Im Repo kein Text „Gate 1 of 6“. Gate-System mit 6 Gates (1, 2, 3, 4, 4B, 5): `docs/RELEASE_ROADMAP_INTEGRATION_ORDER.md:64,100,129,187,217,275`, Templates `.github/ISSUE_TEMPLATE/gate-{1-infrastructure,2-governance,3-security,4-monetization,4b-revenue,5-qa}.md`. Gate 1 = „Infrastructure & CI/CD“. GitHub-Suche „Gate 1 of 6“ trifft nur die alten PRs #1 und #6 (April/Mai 2026) | Text VERIFIZIERT; Zuordnung zu WP8A ABGELEITET |

**Fazit D:** Die zwei WP8A-Branches liegen weder auf origin noch lokal noch als Bundle vor und hatten nie einen PR. Ihr Verbleib (andere Maschine, Fork oder nie gepusht) lässt sich nur durch Dominik klären. Eine Interferenz ist damit derzeit technisch ausgeschlossen. Die Epic-Bedingung (Head-SHA, Bundle, CI, Gate 1 of 6 prüfen) ist **nicht erfüllbar**, bis die Quelle genannt wird.

---

## E) Doppelimplementierungen (VERIFIZIERT anhand der Dateien; Bewertung ABGELEITET)

1. **Bots-Schema 3×**: `20260628120000/121531/193744_bots_foundation.sql` plus `bots_entitlements` und `bots_ai_tool` je 3× (unterschiedliche md5). Feature B (`bot_agents`, `appointments`, `orders`, `order_items`, `voice_channels`, `bot_question_catalog`) wird nicht genutzt, und `bot_conversations` kollidiert.
2. **Termin-/Bestelltabellen 2×**: `bot_appointments`/`bot_orders` (genutzt) und `appointments`/`orders`/`order_items` (Feature B, ungenutzt). Dazu „Add-on-Booking“ als Billing-Begriff.
3. **Voice-Schema 2×**: `voice_channels` (Feature B) und `voice_*` (`20260928130000_voice_runtime_foundation.sql`).
4. **Mitgliedschaften 2×**: `memberships` und `tenant_memberships`.
5. **AI-Einstiege/Gateways 4+**: `ai-gateway`, `ai-invoke`, `api-gateway`, `governance-router`, `_shared/ai.ts` (`runAiTool`), `_shared/aiGateway/*`, dazu `src/core/ai-gateway`. Laut Release-Gate-Doku aus #1961 sind sie nicht harmonisiert; #1646 betrifft die Usage-Attribution.
6. **Policy-Engines 3**: `_shared/rules/evaluator.ts` (statisch), `_shared/pdp/*` (PDP/PEP), `src/governance/PolicyEvaluationService.ts` (Frontend-Klasse mit `import { randomUUID } from 'crypto'` und `simulatePolicy`, ohne Konsumenten außerhalb `src/governance/` ⇒ toter Code, ABGELEITET).
7. **Evidence 7 Edge Functions + 2 Speicher**: `evidence-vault`, `evidence-vault-export`, `evidence-export`, `evidence-anchor`, `evidence-r2`, `iso42001-evidence-vault`, `governance-evidence-handler`. Tabellen `governance_evidence` (Kette) und `evidence_items` (ohne Kette), dazu `ai_evidence_events`, `evidence_snapshots`. Außerdem `packages/evidence-chain` und `services/realsync-evidence-runtime`.
8. **Checkout/Trial 5 Pfade**: `stripe-checkout`, `checkout-siteos-project`, `checkout-website-rebuild`, `create-trial-subscription`, `beta-enroll`. Clientseitig `startGrowthTrial.ts` und `freeAccountOffer.ts`.
9. **Pricing-Quellen**: `shared/pricing.ts` (SSoT), `src/config/pricing.ts` (laut Header Projektion), `_shared/pricing.generated.ts` (Zwilling), `src/content/pricingContent.ts`, `src/i18n/pricingCopy.ts`, **13 Migrationen `*_canonical_plan_catalog.sql`**, `README.md:200` mit eigenen Preisen („Enterprise ab 1.500 €“).
10. **Landing-Versionen**: `LandingV2/V4/V5/V6.tsx`, `Landing.tsx`, `MainLanding.tsx` (ungeroutet), `src/enterprise-os/pages/LandingPage.tsx`; Komponenten `src/components/landing/{v2,v4,v5,v6}` plus über 50 Einzel-Sektionen.
11. **Scan/Audit-Pfade**: `gdpr-audit` (öffentlich, `gdpr_audits`) und `tenant-audit` (Workspace, `scan_runs`). Ergebnisse fließen nicht zusammen (#1887). Weitere Scanner: `cookie-scan`, `cookie-scan-deep`, `shopify-scan`, `bulk-scan`. Zwei Audit-Claim-Schreiber: `audit-claim` Function und RPC `claim_gdpr_audit` (#1869).
12. **Onboarding 4+**: `OnboardingView`, `SetupAssistant`, `PostRegisterOnboardingPage`, `onboarding-orchestrator`, `kodee-onboard`.
13. **Dashboards 4+**: `CommandCenterDashboard`/`ComplianceStatusView`, `GovernanceDashboardView`, `EnterpriseAiOsDashboard`, `DashboardPreviewPage`.
14. **Workflows 2×**: `automation-trigger/-callback` und `workflow-trigger/-callback`.
15. **Builder 4+**: SiteOS (`packages/siteos-core`, `siteos`), `features/app-builder` (bolt), `website-operations/CreateWebsiteWizard`, `platform/builder_orchestrator`.
16. **Frontends/Runtimes**: `platform/nextjs_frontend` und `platform/governance_backend` neben dem Vite-Frontend. CLAUDE.md sagt „Kein Next.js“; nicht angefasst, gemäß Scope nicht gelesen. `worker/` neben `workers/`. Drei Browser-Extensions (`extension/`, `extension-governance/`, `extension-ai-monitor/`, s. `runtime-status-matrix.md:62`). Agent-Runtimes: `apps/agent-runtime`, `packages/agent-runtime-contracts`, `services/realsync-runtime-core`, `services/openclaw-agent`.
17. **Planungs-/Status-SSoTs mehrfach**: `src/product/implementation-status.ts` (laut eigener Aussage SSoT), `docs/runtime-status-matrix.md` (ebenfalls „Single Source of Truth“, Z. 3), `ROADMAP.md`, `.claude/os-funnel/{PLAN,OKTOBER-2026}.md`, `ZIELBILD.md` (#1971), `docs/claude/BETA_V5_WORKPLAN.md`. Widersprüche gibt es bei Policy Engine (live vs. roadmap) und `gdpr-delete` („produktiv“ trotz Defekt).

---

## Konflikte zur Entscheidung durch Dominik (nur dokumentiert, nicht gelöst)

### (a) Bot-/Branchen-Scope vs. `.github/PR_TRIAGE_POLICY.md` („Kein Restaurant- oder branchenfremder Scope im Kernprodukt“, Z. ~57)
**Im Kernprodukt (gemeinsame Laufzeit `supabase/functions` + `/app`-Shell), nicht als abgegrenztes Modul:**
- `supabase/functions/bot-chat/index.ts:32,122`: `runRestaurantConversationTurn` im allgemeinen Chat-Pfad
- `supabase/functions/_shared/{restaurant,restaurant-conversation,restaurant-turn}.ts`, `_shared/bots.ts`; Restaurant-Bezug zusätzlich in `whatsapp-webhook`, `bot-voice-webhook`, `order-intake` (`pricing_authority: 'bots.config.restaurant.menu'`, `:133`)
- `src/features/bots/types.ts:5` `BotVertical = 'general' | 'restaurant'`, `BotBuilderView.tsx:54-101` (Menü-Editor), `BotInboxView.tsx`
- Tests `test/bots/restaurantConversation.test.ts`, `restaurantOrder.test.ts`
- Migration-Seeds: nur `20260505210000_market_scanner_cron.sql` trifft Branchenbegriffe (nicht im Detail geprüft)

**Öffentliche Branchen-Seiten / Routen in `src/App.tsx` (Marketing, nicht Laufzeit):**
- `/fuer-praxen`, `/kanzleien`, `/arztpraxen`, `/fuer-agenturen`, `/agenturen` (`App.tsx:577-582`; `src/pages/niche/*`)
- `/branchen`, `/branchen/:slug` (`App.tsx:647-648`; `src/pages/Branchen.tsx`, `src/pages/branchen/IndustryDetail.tsx`)
- `/handwerk-website` („Website + Chat-/Telefon-Assistent für kleine Betriebe (Handwerk, Praxen, Kanzleien)“, `App.tsx:650-652`)
- Sektor-Doorways: `/healthtech`, `/legal-tech`, `/fintech`, `/behoerden`, `/versicherungen`, `/bildung`, `/schulen`, `/hr-software`, `/saas-anbieter`, `/steuerberater` (`App.tsx:649-715`)
- Inhaltsquellen: `src/content/{industryProfiles,landingIndustries}.ts`, `src/config/{website-templates,smb-experience}.ts`, `src/pages/SteuerberaterLanding.tsx`, `LegalTechLanding.tsx`
- Treffer für „Metzgerei/Fleischer“: **keiner** in `src` (grep auf `metzger|fleischer`)

**Bezug Epic #1972:** Referenz-Szenario „Handwerksbetrieb mit Telefonassistent“ (#1971 `ZIELBILD.md` §4) und Epic-Agenten 04–07 (Bot Studio, Voice, WhatsApp, Booking/Orders) zielen auf KMU-Branchenbots. Der Epic selbst nennt „Bots nur als abgegrenztes Modul“ nicht ausdrücklich, der COMMON_BRIEF schon.
**Offen:** Darf das Restaurant-Vertical im Kern-`bot-chat` bleiben, oder muss es in ein Modul bzw. eine separate App? Gelten Niche-Landingpages als „branchenfremder Scope“?

### (b) Veraltete Landing-Angaben (`/` rendert tatsächlich `LandingV6`, `src/App.tsx:499`, VERIFIZIERT)
- `AGENTS.md:14`: „`/` rendert `src/pages/LandingV4.tsx`“, dazu `:16-17` aktive Komponenten v4 und `landing-v4-classical.css`
- `.github/PR_TRIAGE_POLICY.md:55`: „`/` rendert aktuell `src/pages/LandingV4.tsx`“ und „V4 ist der aktuelle Ausgangspunkt“
- `docs/claude/BETA_V5_WORKPLAN.md:17`: „`/` = `src/pages/LandingV5.tsx`“
- `.claude/os-funnel/OKTOBER-2026.md:30,68,115`: „Landing v4 ist live auf `/`“ / „O-WP2 Landing v4 halten“
- `.claude/os-funnel/PLAN.md:73-75,102,113-115,163`: v2 bzw. v4 auf `/` (teils historisch markiert)
- `.claude/commands/wp1-landing.md:22,44`: „`LandingV2.tsx`“ auf `/`
- `ARCHITECTURE.md`: „V1.0 (MVP) – Feature Complete“, verweist auf `MainLanding.tsx` (nicht geroutet)
- `.github/CODEOWNERS`: Hot-File `/src/pages/MainLanding.tsx` (ungeroutet). LandingV6-Dateien fehlen dort.
- Korrekt: `CLAUDE.md:37`, `docs/product/implementation-status.md` Pkt. 4

### (c) Enterprise 1.249 € vs. „Enterprise per Vertrag / Preis auf Anfrage“
- `shared/pricing.ts:852-865`: `monthlyEur: 1_249`, `priceOnRequest: true`, Kommentar „Preis auf Anfrage“, Self-Service gesperrt
- `src/config/pricing.ts:308-318`: „… zeigten ‚1.249 €‘ für einen Plan, der nur per Vertrag zu haben ist“ ⇒ Anzeige unterdrückt
- `src/pages/EnterpriseLanding.tsx:306`: „Preis auf Anfrage“; `src/config/seo.ts:133` ebenso; `PartnersPage.tsx:118` „Preis auf Anfrage“
- `README.md:200`: „Enterprise (**ab 1.500 €**)“, widerspricht Policy und SSoT
- PR #1969 schreibt „Enterprise ‚Preis auf Anfrage‘“ fest und verweist auf `/enterprise-konfigurator` „Ihr Preis, sofort“ (Freigabe-Punkt 4)
- Policy (`PR_TRIAGE_POLICY.md`, Feste Produktentscheidungen): „1.249 € ist die höchste Stufe und die einzige Quelle … README, Pricing und Landing weichen nicht ab“. Außerdem existiert ein Plan „Partner“ mit 50 Plätzen (laut #1907-Text); ob er über Enterprise liegt, prüft Agent 08.

---

## Abhängigkeiten zu offenen PRs/Issues
- **#1869** (P0 Security) ↔ Issue #1865 und RPC-Härtung #1867 (laut PR-Text). Liefert `docs/qa/landing-to-runtime-parity.md`, auf das sich #1907 und #1908 beziehen.
- **#1961** ist durch **#1966** (`4df1fde`, merged 23.10.) überholt. Base #1959 ist geschlossen.
- **#1970 → #1908**: Migrationsreihenfolge `20261023120000` → `20261023223000`. Verträglichkeit laut #1908 geprüft (ABGELEITET, nicht selbst getestet).
- **#1967** Migration `20261022090000` liegt zeitlich **vor** #1970/#1908. Alle drei liegen nach der letzten main-Migration `20261020130000`. Bei Merge in Zeitstempel-Reihenfolge (#1967 → #1970 → #1908) gibt es keine Out-of-order-Migration. Wird #1967 zuletzt gemergt, läge seine Migration vor bereits angewendeten (ABGELEITET, vorher klären).
- **#1918 ↔ #1887**: inhaltlicher Konflikt beim TopBar-„Audit starten“-Ziel.
- **#1918/#1963/#1967**: `CustomerStartPanel`; **#1891/#1967**: `CommandCenterDashboard`; **#1888/#1969**: `AuditLanding`; **#1967/#1969**: `App.tsx`.
- **#1969** ↔ Agent 08 (Beta-Preise, USt-Modus nach #1950) und Issue #1938 (Stripe Tax).
- **#1907** ↔ Beta-Seats (`src/config/beta.ts`, #1874) und Issues #1039/#923.
- **Issue #1646** (Gateway-Usage-Attribution) ↔ Doppel-Gateways (E5). **#1650** (Schema Drift) ↔ Bots-Schema 3× (E1) und `memberships`/`tenant_memberships` (E4). **#1153** ↔ Voice (A3). **#1381** ↔ #1963, #1891, #1918.

## Vorschläge für Welle 2
Grundsatz: Kein neuer PR, wo ein offener PR das Thema schon trägt. Neue Bot-Arbeit nur in einem abgegrenzten Modulpfad und erst nach Dominiks Scope-Entscheidung (a).

| WP | Ziel | Dateien/Verzeichnisse (Ownership) | Bestehenden PR fortführen? | Risiko | Tests |
|---|---|---|---|---|---|
| W2-01 Security-Abschluss | #1869, #1926 mergefähig, #1961 schließen | wie in den PRs; keine neuen Dateien | **ja**: #1869, #1926; #1961 schließen | mittel (Verhalten 401/403) | CI unit/gates grün (vorhanden); manueller anonymer Aufruf von `audit-report-pdf` gegen Staging |
| W2-02 GDPR/Evidence-Migrationen | #1970, dann #1908 aus Draft, DB-Jobs laufen lassen | `supabase/migrations/2026102312*`, `…223000`, `gdpr-delete/*` | **ja** | hoch (Migration) | `test/runtime/db/account-self-deletion.db.test.ts`, `governance-evidence-append-only.db.test.ts` in CI |
| W2-03 Dashboard-Serie | #1963 → #1891 → #1918/#1887 (nach Entscheidung) → #1967 | `src/features/governance/dashboard/*`, `src/i18n/handoffApp.ts` | **ja** | mittel (Hotspots) | bestehende Dashboard-Tests + `startPanelModel.test.ts` |
| W2-04 Bot-Booking echt (Agent 07) | Kalender-Slots + Doppelbuchungsschutz (Exclusion Constraint / `tstzrange`) auf `bot_appointments`; Fehlertexte nicht an anonyme Aufrufer | `supabase/functions/appointment-book/*`, **neue** Migration (additiv), `src/features/bots/*` | nein (neu, nach WIP-Prüfung) | hoch (Migration, öffentliche API) | DB-Test für Nebenläufigkeit (zwei gleichzeitige Buchungen), Edge-Unit-Test |
| W2-05 Order-Katalog (Agent 07) | Legacy-Client-Preispfad in `order-intake` entfernen bzw. sperren; Katalog statt `bots.config.restaurant.menu` | `supabase/functions/order-intake/*`, `_shared/restaurant*.ts` | nein | mittel; Scope-Entscheidung (a) nötig | `test/bots/restaurantOrder.test.ts` erweitern |
| W2-06 Bot Studio (Agent 04) | KB für Bots, In-App-Sandbox, Handoff, PDP `enforce` | `src/features/bots/*`, `supabase/functions/bot-chat`, `_shared/pdp/botmessage.ts` | nein | hoch (Datenschutz) | PEP-Order-Test (vorhanden), neue KB-RLS-Tests |
| W2-07 Web-Widget (Agent 06) | Embed-Skript für `bot-chat`, Origin-Allowlist, Rate-Limit | `public/sdk/` (neu), `bot-chat` | nein | mittel (öffentlich) | E2E Playwright Widget, CORS-Test |
| W2-08 WhatsApp Opt-in/Templates (Agent 06) | Opt-in-Nachweis, Templates, PEP vor Persistenz | `supabase/functions/whatsapp-webhook/*` | nein | hoch | `whatsapp-parse.test.ts` + neuer Order-Test analog `bot-chat-privacy-order` |
| W2-09 72h-Trial (Agent 08) | Neuer Trial-Modus mit harter Grenze, abgeleitet von `create-trial-subscription` (`trial_end`), **kein** vierter Checkout-Pfad | `supabase/functions/create-trial-subscription`, `shared/pricing.ts` (Hotspot, Einzel-Freigabe) | nein; Konflikt mit #1969 (`shared/pricing.ts`) beachten | hoch (Pricing) | `test/billing/*`, `wp2a_trial_end_expiry`-DB-Test |
| W2-10 Seats | #1907 nach Produktentscheidung | wie PR | **ja** | mittel | `test/edge/seat-limit.test.ts` |
| W2-11 SSoT-Bereinigung (Doku) | Veraltete Landing-Angaben (b), README-Preis (c), Statuswidersprüche (`runtime-status-matrix.md` vs. `implementation-status.ts`), CODEOWNERS (MainLanding → LandingV6) | `AGENTS.md`, `.github/PR_TRIAGE_POLICY.md`, `README.md`, `.github/CODEOWNERS`, `docs/runtime-status-matrix.md` | teils über #1971 | gering (Docs), aber Policy-Datei braucht Einzel-Freigabe | `check:context`, `check:landing-claims` |
| W2-12 Schema-Altlast (Agent 02) | Bots-Feature-B-Tabellen und `memberships`/`tenant_memberships` dokumentieren; nur additive Folgeschritte | `docs/` bzw. `.claude/` (Budget beachten) | Issue #1650 | gering (nur Doku) | – |

## Blocker / offene Fragen an Dominik
1. **WP8A**: `fix/entry-preload-vendor-viz` und `fix/welcome-earth-desktop-only` existieren weder auf origin (`git ls-remote`, 2.038 Refs) noch lokal noch als PR-Head. Wo liegen sie (andere Maschine, Fork, Bundle-Pfad)? Was genau ist „Gate 1 of 6“? Im Repo gibt es nur das 6-Gate-System aus `docs/RELEASE_ROADMAP_INTEGRATION_ORDER.md`, Gate 1 = Infrastructure/CI.
2. **#1961 schließen?** Der Inhalt ist laut Code über #1966 in main (Einzel-Freigabe „Schließen“).
3. **TopBar „Audit starten“**: `/app/websites` (#1887) oder KI-Register (#1918)?
4. **Branchen-Scope (a)**: Restaurant-Vertical im Kern-`bot-chat`/`order-intake` belassen oder auslagern? Niche-/Branchen-Landingpages zulässig?
5. **Enterprise-Preis (c)**: 1.249 € anzeigen (Policy) oder „Preis auf Anfrage“ (SSoT `priceOnRequest`, #1969)? README „ab 1.500 €“ korrigieren.
6. **Seats (#1907)**: Sollen Free/Starter ab Merge niemanden mehr einladen können? Gibt es Beta-Sonderplätze?
7. **BOT_PDP_ENFORCEMENT**: Wann wird von `shadow` auf `enforce` umgestellt? Das ist Voraussetzung für Epic-Szenario 5.
8. **72h-Trial**: Ersetzt er `trialDays: 14` (Starter/Growth) oder nur den Bot-Einstieg? Wie verhält er sich zur Beta (Growth bis 31.01.2027)?
9. **Hotspot-Vollauszählung** BLOCKIERT: shallow Clone, `fetch` gesperrt. Darf eine Session `git fetch --unshallow` (nur lesend am Working Tree) ausführen, oder reicht die Kandidatenmethode?
10. **Draft-PRs mit Migrationen** (#1970, #1908, #1967): Die CI überspringt `Migration validation` und `unit`. Darf der Status auf „Ready for review“ wechseln, damit die DB-Jobs laufen? (Eine Status-Änderung ist eine GitHub-Schreibaktion und braucht deshalb eine Freigabe.)
