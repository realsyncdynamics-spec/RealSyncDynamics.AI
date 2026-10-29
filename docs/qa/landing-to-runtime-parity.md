# Landing-to-Runtime-Parität — Claim-to-Execution-Matrix

**Stand:** 13.10.2026, Basis `main` @ `85402fc`.
**Methode:** Statische Code-Analyse von Frontend, Edge Functions, Migrationen
und Tests. Die P0-Befunde unten wurden direkt am Code nachgeprüft.
**Nicht geprüft:** Produktion, Staging, deployte Function-Versionen,
Datenbankinhalt und Secrets.

Die Spalte **Produktion** steht deshalb überall auf „nicht verifiziert“.
Eine vorhandene Komponente oder eine deployte Function ist kein Nachweis.

Statuswerte:

- **FULL:** Pfad von UI bis Persistenz und Evidence vorhanden und getestet.
- **PARTIAL:** echter Kern vorhanden, aber Teile des Claims fehlen.
- **BLOCKED:** Code vorhanden, aber externe Voraussetzung fehlt.
- **MISSING:** kein ausführbarer Pfad.

Abkürzungen:

- `C` = `src/components/landing/v4/landing-v4-content.ts`
- `S` = `src/components/landing/v4/LandingV4Sections.tsx`
- `P` = `shared/pricing.ts`
- `PP` = `src/features/billing/PricingPage.tsx`
- `IS` = `src/product/implementation-status.ts`
- `PC` = `src/config/platform-capabilities.ts`

---

## 1. Matrix

### Free Audit / Website-Scan · P0 · PARTIAL

| Feld | Befund |
|---|---|
| Claim | „Kostenlosen Check starten“, „90s bis zum Ergebnis“; „URL genügt · kein Account vor dem Einstieg“ (S:244-256) |
| Frontend | `/audit` → `AuditLanding.tsx`. Das Formular verlangt eine E-Mail (AuditStepper:298-300) und widerspricht damit „URL genügt“. |
| Backend | `gdpr-audit` (`verify_jwt=false`) |
| Persistenz | `gdpr_audits` |
| Auth | anonym; IP-Hash-Limit 5/h |
| Entitlement | – |
| Execution | real: Abruf, Detektoren, Score |
| Evidence | kein Eintrag in der Evidence-Kette |
| Tests | `test/edge/gdpr-audit-*`, `test/public-scan/*`, `tests/e2e/audit.spec.ts` |
| SSRF | statische Prüfung plus Prüfung jeder Weiterleitung. DNS-Auflösung erst mit #1860. Aktives Rebinding bleibt als dokumentierte Grenze. |
| Folge-PR | #1860 |

### Audit-Übernahme nach Registrierung · P0

Status: FULL im Code, sobald dieser PR und #1867 gemergt sind. Live ungeprüft.

| Feld | Befund |
|---|---|
| Claim | Ergebnis → Konto → Workspace (Post-Scan-CTAs) |
| Frontend | `/welcome`, `/unified-entry/onboarding`, Dashboard-Karte |
| Backend | RPC `claim_gdpr_audit` |
| Persistenz | `gdpr_audits.tenant_id`, `user_id`, `claimed_at` |
| Auth | JWT, E-Mail-Bindung, Mitgliedschaft |
| Entitlement | – |
| Execution | real |
| Evidence | `governance_admin_log` nur über die Edge Function |
| Tests | `test/edge/audit-claim.test.ts`, `test/onboarding/claim-audit-flow.test.ts`, DB-Test in #1867 |
| Befund | Die Edge Function `audit-claim` war ein zweiter Schreiber, autorisiert nur über die teilbare UUID. Behoben in **diesem PR**. |
| Folge-PR | #1867 (DB), dieser PR |

### Bericht abrufen (`audit-report-pdf`) · P0 · PARTIAL

| Feld | Befund |
|---|---|
| Claim | „mit PDF-Bericht“ (C:142, PC:80); „Kompakter PDF-Bericht“ (P:569) |
| Frontend | Kein Aufrufer. Der Browser druckt HTML (AuditLanding:965, 990). |
| Backend | `audit-report-pdf` (`verify_jwt=false`) |
| Persistenz | Storage `documents/audit-reports/<id>.html` |
| Auth | Vorher ohne Token keine Prüfung, also Datenabfluss allein über die UUID. Behoben in **diesem PR**. |
| Entitlement | – |
| Execution | erzeugt **HTML**, nicht PDF (`format:'html'`) |
| Evidence | `pii_redaction_log` |
| Tests | `test/edge/audit-report-access.test.ts` (neu) |
| Folge-PR | dieser PR (Zugriff). Echtes PDF ist ein eigener PR. |

### Onboarding und Datenübernahme · P0 · PARTIAL

| Feld | Befund |
|---|---|
| Claim | Workspace ohne Sackgasse nach dem Scan |
| Frontend | `/onboarding/:scanId`: Branche nur im `localStorage`. Daneben `/unified-entry/onboarding`, `/app/activation`, `/app/onboarding`. |
| Backend | `save-company-profile`, `onboarding-orchestrator` (ohne Aufrufer im Frontend) |
| Persistenz | `company_profiles`, `governance_activations`, `tenants` |
| Auth | JWT plus Mitgliedschaft |
| Entitlement | – |
| Execution | teilweise |
| Evidence | `trial_audit_logs` |
| Tests | `test/edge/onboarding-setup-functions.test.ts`, `e2e/onboarding.spec.ts` |
| Lücke | Systeme, Verantwortliche, Datenkategorien, Rahmenwerke und Freigaben werden nicht zentral und bestätigt übernommen. |
| Folge-PR | #1841, #1714 prüfen |

### KI-Inventar · P1 · PARTIAL

| Feld | Befund |
|---|---|
| Claim | Nicht auf v4. Im SEO-Meta von `/` steht „KI-Inventar“ (`seo.ts:279`). In `public-nav.ts:60` hat es das Badge `live`, IS sagt `preview`. |
| Frontend | `/app/ai-systems` |
| Backend | `governance-resources` |
| Persistenz | `governance_assets` |
| Auth | JWT, nur owner/admin |
| Entitlement | kein Plan-Gate |
| Execution | real (CRUD) |
| Evidence | `governance_admin_log` |
| Tests | `test/features/governance/ai-registry-crud.test.tsx` u. a. |

### Shadow-AI-Erkennung · P1 · PARTIAL

| Feld | Befund |
|---|---|
| Claim | „Shadow AI Detection“ (`EnterpriseAiOs.tsx:5`) |
| Backend | `enterprise-ai-os-agents-run` (Substring-Heuristik über vom Nutzer gelieferte Quellen) |
| Persistenz | `ai_systems`, `enterprise_ai_system_registry` |
| Auth | JWT plus Mandant |
| Execution | heuristisch, keine autorisierte Integrationsquelle |
| Tests | `test/lib/enterprise-ai-os-discovery.test.ts` |
| Lücke | Selbstauskunft ist nicht getrennt markiert. Darf nicht „erkannt“ heißen. |

### Governance-Policies · P1 · PARTIAL

| Feld | Befund |
|---|---|
| Claim | „Policy Engine … als ausführbare Kontrollen durchsetzen“. Die Karte verlinkt auf die **Demo**-Seite `/runtime`. |
| Frontend | `/app/policies/templates` |
| Backend | `governance-resources`, `governance-ingest`, `governance-decide` |
| Persistenz | `governance_policies`, `policy_pack_activations` |
| Auth | JWT owner/admin; Ingest-Key |
| Entitlement | – |
| Execution | Auswertung nur für Ingest-Events; PDP im Gateway nur im Shadow-Modus |
| Evidence | `ai_evidence_events` |
| Tests | `test/policy-engine.test.ts`, `test/governance/pdp-*` |

### Anbieterprüfung / AVV · P1 · PARTIAL

| Feld | Befund |
|---|---|
| Claim | „Dienstleister“ in der Governance Runtime (C:144); „AVV ab Buchung automatisch aktiv“ (PP:271) |
| Frontend | `/app/vendors` |
| Backend | `governance-vendors` |
| Persistenz | `vendors` (`dpa_status`, `transfer_mechanism`, Fristen) |
| Auth | JWT, Writer-Rolle |
| Entitlement | kein Plan-Gate |
| Execution | real (Register) |
| Evidence | `runtime_events`, `audit()` |
| Tests | `test/edge/governance-vendors-logic.test.ts` |
| Lücke | Keine Unterauftragsverarbeiter, keine Erinnerungen, kein Re-Review-Zyklus. |

### KI-Kompetenz (Art. 4 AI Act) · P1 · MISSING

| Feld | Befund |
|---|---|
| Claim | nur `landing-v2` |
| Frontend, Backend, Persistenz | – |
| Execution | nein |
| Lücke | Kompetenzregister fehlt vollständig. |

### Freigaben · P1 · PARTIAL

| Feld | Befund |
|---|---|
| Claim | „Freigaben in einer laufenden Kontrollschicht“ |
| Frontend | `/app/approvals` |
| Backend | `governance-approvals` |
| Persistenz | `governance_approvals` |
| Auth | JWT owner/admin |
| Entitlement | – |
| Execution | real |
| Evidence | `governance_evidence`, `ai_evidence_events` |
| Tests | nur Zähl-Tests |
| Lücke | Ausführung wartet nur bei SiteOS-Publish und Browser-Runtime (#1724) auf die Freigabe. |
| Folge-PR | #1859, #1724 |

### Risk, DSR, DSFA, Incidents · P1 · PARTIAL

| Feld | Befund |
|---|---|
| Claim | wie bei Freigaben |
| Frontend | `/app/risks`, `/app/dsr`, `/app/dpia`, `/app/incidents` |
| Backend | `governance-risk-score`, `-dsr`, `-dpias`, `-incidents` |
| Persistenz | eigene Tabellen je Modul (zwei Incident-Tabellen) |
| Auth | JWT plus Rolle |
| Entitlement | kein Plan-Gate |
| Execution | real (Register) |
| Evidence | `audit()` |
| Tests | `test/edge/governance-dsr-logic`, `-incidents-logic` |
| Lücke | Module sind nicht miteinander verbunden. |

### KI-Governance-Report · P1 · MISSING

| Feld | Befund |
|---|---|
| Claim | „Nachweis-Export“ (C:144) |
| Frontend | `/app/compliance`: JSON plus SHA-256 |
| Backend | `governance-audit-report-gen` (DB-Zeilen), `generate-compliance-report` |
| Persistenz | `audit_reports` |
| Auth | JWT plus `gateFeature('compliance.export')` |
| Execution | kein kundenindividueller Report mit den 12 Abschnitten |
| Tests | `test/edge/entitlement-gates.test.ts` |
| Folge-PR | #1868 (Snapshot-Modell) |

### Monitoring, Cron, Drift · P1 · PARTIAL

| Feld | Befund |
|---|---|
| Claim | „05 Beobachten — laufend prüfen“ (C:165, ohne Coming Soon); „Die RealSync Runtime monitort kontinuierlich“ (`AuditLanding:619`); „täglich“ (PP:251, 259) |
| Frontend | `/app/monitoring` |
| Backend | `audit-monitor-cron`, `scheduler-dispatch` |
| Persistenz | `monitored_domains`, `audit_monitor_results`, `audit_monitor_alerts` |
| Auth | Cron-Key, konstantzeitig geprüft |
| Entitlement | `monitoring.daily/monthly/drift` |
| Execution | Cookie- und Tracker-Drift real |
| Evidence | `append_governance_evidence` |
| Tests | `test/edge/audit-monitor-cron.test.ts` |
| Lücke | Kein Retry innerhalb eines Laufs; `scheduler-dispatch` ohne Lock. Die Copy widerspricht dem Registerstatus `coming-soon`. |

### Evidence Vault / Hash-Kette · P1 · PARTIAL

| Feld | Befund |
|---|---|
| Claim | „Hash-verkettete Nachweiskette mit … Integritätsprüfung“ (C:146), verlinkt auf die **Demo** `/evidence`. `/evidence-vault`: „RFC-3161-getimestampt … unveränderlich“. P:824 und PP:279: „unveränderlich“. |
| Frontend | `/app/evidence`, `/app/evidence-vault` |
| Backend | `evidence-vault`, `evidence-anchor` |
| Persistenz | `ai_evidence_events` (append-only per Trigger), `evidence_snapshots` (Trigger), `governance_evidence` und `evidence_items` (**nicht** append-only) |
| Auth | JWT, Mitgliedschaft, `evidence.advanced` |
| Execution | real |
| Evidence | – |
| Tests | `test/runtime/db/evidence-integrity.db.test.ts` u. a. |
| Lücke | RFC 3161 ist nicht implementiert. „Unveränderlich“ ist nicht belegt; belegt ist nur „manipulationserkennbar“. |

### WhatsApp-Bot · P2 · BLOCKED/PARTIAL

| Feld | Befund |
|---|---|
| Claim | Landing-Karte „…Governance und Evidence“ (Landing: „geplant“). `/pricing/whatsapp`: „offizielle WhatsApp Business API“. |
| Frontend | `/app/bots/whatsapp` |
| Backend | `whatsapp-webhook` (Meta Cloud API, HMAC-Signatur) |
| Persistenz | `whatsapp_channels`, `bot_conversations`, `bot_messages` |
| Auth | Signatur, Kanal → Mandant |
| Entitlement | `bots.whatsapp` plus Nachrichten-Quoten |
| Execution | Code real; Provider-Credentials unbekannt |
| Evidence | `audit()`, `ai_tool_runs` |
| Tests | `test/bots/whatsapp-parse.test.ts` (kein Signaturtest) |
| Lücke | Kein Human Handoff. `PC` sagt `live`, IS sagt `preview`. |

### Telefonbot · P2 · BLOCKED/PARTIAL

| Feld | Befund |
|---|---|
| Claim | „Voice-Kanal, Human Handoff, Policy Enforcement“; `/phonebot/start`: „DSGVO- und AI-Act-konform“ |
| Frontend | `/app/voice` (Tabellen ohne Writer im Deploy) |
| Backend | `bot-voice-webhook` (Twilio-Signatur) |
| Persistenz | `voice_*` |
| Auth | Twilio-Signatur |
| Entitlement | `bots.voice` plus Minuten |
| Execution | TwiML-Pfad real |
| Evidence | – |
| Tests | `test/bots/voiceWebhookSecurity.test.ts` |
| Lücke | Kein Handoff. Pauschale Konformitätsaussage. |

### Website-Chatbot · P2 · PARTIAL

| Feld | Befund |
|---|---|
| Claim | `/chatbot/start`: „ohne externe AI-Aufrufe“, „Evidence Vault loggen“ |
| Frontend | `/app/bots` |
| Backend | `bot-chat` (`verify_jwt=false`) |
| Persistenz | `bots`, `bot_conversations` |
| Auth | öffentlich über `(tenant_id, bot_id)` |
| Entitlement | `bots.enabled` plus Monatsquote |
| Execution | real |
| Evidence | – |
| Tests | `test/bots/*` |
| Lücke | Keine Wissensbasis, kein Rate-Limit, keine Origin-Allowlist (Quote fremd verbrennbar), kein Widget. |

### DSGVO Web App Builder / SiteOS · P2 · PARTIAL

| Feld | Befund |
|---|---|
| Claim | „…in den bestehenden Web-App-Transformation-Flow übergeben“ |
| Frontend | `/builder/:slug`, `/build` (Fortschritt per 260-ms-Timer) |
| Backend | `siteos/*`, Cloudflare Pages |
| Persistenz | `siteos_*` |
| Auth | JWT plus Rolle |
| Entitlement | `siteos.builder`, `siteos.publish`, `limit.sites` |
| Execution | real bis Produktion |
| Evidence | Custody-Kette |
| Tests | `test/siteos/*` (rund 30 Dateien), `e2e/siteos-production-publish.spec.ts` |
| Lücke | Kein Rollback. Fortschrittsanzeige ohne echten Schrittbezug. |
| Folge-PR | #1862, #1823 |

### Claude Code Optimizer · P2 · MISSING

| Feld | Befund |
|---|---|
| Claim | „Repository auf DSGVO- und EU-AI-Act-Risiken prüfen, konkrete Fixes erzeugen…“ (C:137) |
| Frontend | `/claude-code-optimizer/*`: Website-Scan und `setTimeout`-Animation |
| Backend | nutzt `gdpr-audit` |
| Persistenz | `sessionStorage` |
| Auth | – |
| Execution | **keine** Repository-Analyse, kein PR |
| Tests | `test/optimizer/*` (Helfer) |
| Lücke | Claim und Funktion widersprechen sich. |

### AI Gateway · P2 · PARTIAL

| Feld | Befund |
|---|---|
| Claim | „…Kosten erfassen — mit EU-Option“ (C:145, „LIVE“) |
| Frontend | – |
| Backend | `ai-gateway`, `ai-invoke` |
| Persistenz | `usage_events`, `ai_tool_runs` |
| Auth | JWT plus Mandant / Internal-Key |
| Entitlement | `limit.ai_calls_monthly` wird nur gezählt, nicht blockiert |
| Execution | nur lokale Provider; Cloud-Fallback hart aus |
| Evidence | keine Kette |
| Tests | `test/ai-gateway/*`, `test/edge/ai-gateway-*` |
| Lücke | PDP nur Shadow. Rate-Limit nur im Isolate. |

### Billing, Entitlements, Limits · P1 · PARTIAL

| Feld | Befund |
|---|---|
| Claim | Tarife und Limits (P, C:182-238) |
| Frontend | `/pricing`, `/checkout/:plan`, `/app/billing` |
| Backend | `stripe-checkout`, `stripe-webhook`, `stripe-portal`, `stripe-*-meter-sync` |
| Persistenz | `subscriptions`, `tenant_entitlements`, `webhook_events` |
| Auth | Webhook-Signatur, owner/admin |
| Entitlement | `tenant_entitlements_resolve` |
| Execution | Checkout und Webhook real; Revenue-Test nicht belegt |
| Evidence | – |
| Tests | `test/billing/*`, `e2e/checkout.spec.ts` |
| Lücke | Seats, Reports/Exporte und Evidence-Speicher werden nicht serverseitig durchgesetzt. Domains nur im Cron. Meter-Sync vergleicht Secrets nicht konstantzeitig. |
| Folge-PR | #1844, #1839, #1819 |

### Dashboard-Vorschau (Landing) · P1 · PARTIAL

| Feld | Befund |
|---|---|
| Claim | statische Beispielwerte, gekennzeichnet („Beispieldaten“) |
| Frontend | S:376-497. Das Ledger zeigt `Math.random`-Hashes, „ANCHORED“. |
| Execution | – |
| Lücke | Zufällige Hashes wirken wie echte Verankerung. |

### Echtes Dashboard · P1 · PARTIAL

| Feld | Befund |
|---|---|
| Frontend | `/app/dashboard` mit Live-Daten. `/app/vvt` zeigt nur `DEMO_VVT_ENTRIES`. |
| Lücke | `/dashboard/business` liegt ohne `AppGate`. |

## 2. P0-Befunde dieses Durchgangs

1. **Audit-Übernahme allein über die UUID (behoben in diesem PR).**
   - `supabase/functions/audit-claim` schrieb mit der Service-Role.
   - Autorisiert war, wer die `audit_id` kannte. Die steht im teilbaren
     Link `/audit/result/:id`.
   - Jedes frisch registrierte Konto konnte so ein fremdes Audit
     unumkehrbar in den eigenen Mandanten ziehen.
   - Jetzt ruft die Function die RPC mit dem Nutzer-Token auf.
2. **Bericht ohne Anmeldung (behoben in diesem PR).**
   - `audit-report-pdf` prüfte den Besitz nur, wenn ein Token mitkam.
   - Ohne Token gab es den Bericht samt E-Mail, Firma und 24-h-Signed-URL.
   - Jetzt gilt:
     - Authentifizierung vor jedem Lesezugriff.
     - Zugriff nur für bestätigte Audit-E-Mail, Mitglied des übernehmenden
       Mandanten, Super-Admin oder plattform-intern (Service-Role-Key,
       konstantzeitig).
3. **RPC wählt Mandanten still und prüft keine E-Mail-Bestätigung.**
   - Offen in #1867.
   - Dieser PR ist auf beide RPC-Stände vorbereitet: Mandantenauswahl nur auf
     Verlangen der RPC, PGRST202 → `TENANT_SELECTION_UNAVAILABLE`, kein
     geratener Mandant.
4. **SSRF ohne DNS-Prüfung:** offen in #1860.

## 3. Claim-Korrekturen, die ohne neuen Code fällig sind

| Ort | Problem | Vorschlag |
|---|---|---|
| C:137 | Claude Code Optimizer: Repository-Prüfung | Als „Website-Check für Entwickler“ benennen oder als „geplant“ markieren |
| C:142, P:569, PC:80 | „PDF-Bericht“ | „druckfertiger Bericht (HTML/Druck-PDF)“, bis echtes PDF vorhanden |
| C:146 → `/evidence`, C:147 → `/runtime` | Karten tragen „LIVE“, verlinken aber Demo-Seiten | Auf Produktseiten verlinken oder „Demo“ kennzeichnen |
| C:165, `AuditLanding:619`, PP:251/259 | Monitoring ohne Coming Soon | Mit IS (`coming-soon`) angleichen |
| P:824, PP:279, `EvidenceVaultPage:8-9` | „unveränderlich“, „RFC-3161“ | „manipulationserkennbar (Hash-Kette)“; RFC 3161 streichen |
| `PC:119-133` | Bots `live`, IS `preview`, Landing „geplant“ | `PC` auf `preview` setzen (dann zeigt `CapabilityAvailabilityNotice` den Hinweis) |
| `ChatbotStartPage:36,87` | „ohne externe AI-Aufrufe“ | Nur behaupten, wenn eu_local erzwungen ist |
| S:244-256 | „URL genügt“, Formular verlangt E-Mail | Copy oder Formular angleichen |
| `scripts/check-landing-claims.mjs` | prüft nur 7 Phrasen und nicht `src/config`, `src/i18n`, `shared/pricing.ts` | Wortliste (unveränderlich, revisionssicher, RFC 3161, monitort kontinuierlich) und Pfade erweitern |

## 4. Reihenfolge der Folge-PRs (nach Abhängigkeit)

1. #1860 (SSRF-DNS) und #1867 (RPC-Härtung) reviewen und mergen; dieser PR ist mit beiden kompatibel.
2. Claim-Korrekturen aus Abschnitt 3 plus erweiterter `check-landing-claims`. Reine Copy, kein Backend.
3. Echtes PDF für `audit-report-pdf` (Bucket-Pfad, `application/pdf`, Mehrseitigkeit, Download-Test).
4. Plan-Durchsetzung: `limit.team_seats` in `tenant-invite`, `limit.compliance_exports_monthly` in den Export-Functions, `limit.domains` beim Anlegen.
5. `bot-chat`: Rate-Limit pro IP/Origin und Origin-Allowlist.
6. KI-Kompetenzregister (Art. 4) als Review-Migration plus Function plus UI.
7. Append-only-Trigger für `governance_evidence`.
8. Report (#1868 weiterführen) auf Basis der obigen Register.
