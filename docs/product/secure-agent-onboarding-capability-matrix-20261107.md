# Secure Agent Onboarding – Phase-1 Capability-Matrix und Backend-Gaps

**Stand:** 2026-11-07 · **Codebasis:** main @ c8af738fa834a8977486e5f7fd5f206c101ab3dd  
**Paket:** C / ONB-06, ONB-07, ONB-08, ONB-10. **Anwendungsfall:** Handwerks-Empfangsassistent.  
**Verwandte Spezifikation:** [Phase-1-Architektur](secure-agent-onboarding-phase1-20261107.md).

## Bewertungsregeln

- **LIVE:** Nur nach aktuellem Ende-zu-Ende-Produktionsnachweis mit Datum, realem Tenant und redigiertem Evidence-Beleg. Im Rahmen dieser GitHub-only-Prüfung wurde **keine** Fähigkeit als LIVE bestätigt.
- **PREVIEW:** Implementierung/Vertrag oder Teilpfad im Repository erkennbar; Integration bzw. produktive Funktion nicht vollständig belegt.
- **BLOCKED:** Konkreter Go-live-Blocker oder ungedeckte Voraussetzung; Teilcode kann bereits existieren.
- **NOT IMPLEMENTED:** Erforderliche dedizierte Capability konnte in dieser gezielten Repository-Sichtung nicht nachgewiesen werden; bedeutet nicht zwingend, dass im gesamten Repo kein verwandter Code existiert.
- **Produktivstatus:** Für sämtliche Zeilen **NICHT LIVE VERIFIZIERT**. Repo-Code/PR-Merge ist keine Produktionsmessung.

## A. Inventar – wiederverwendbare Fähigkeiten

| ID | Fähigkeit | Ist-Beleg (Repo) | Phase-1-Status | Lücke / nächster Check |
|---|---|---|---|---|
| C01 | Supabase Auth, Tenant-Auswahl, Entitlements | src/core/access/TenantProvider.tsx; src/core/access/load-entitlements.ts | PREVIEW | Auth-Mitgliedschaft/RLS mit zwei echten Test-Tenants und rollenbasierten Writes prüfen |
| C02 | Bot-CRUD für Chat/Voice/WhatsApp | src/features/bots/api.ts; types.ts; BotBuilderView.tsx | BLOCKED | createBot enabled-Default true und frei speicherbarer enabled-Status: zwingende serverseitige Aktivierungssperre nicht nachgewiesen |
| C03 | Bot-Gesprächs-/Inbox-Daten | src/features/bots/api.ts; /app/bots/inbox | PREVIEW | Live-Annahme/Handoff, Inbox-Kopplung und PII-Retention kanalabhängig prüfen |
| C04 | Voice-Runtime mit Session-/Tool-Traces | apps/agent-runtime; src/features/governance/voice/voiceApi.ts | PREVIEW | Tatsächlich provisionierter Provider, reale nummern-/sessiongebundene Aktivierung und Failover-Test fehlen |
| C05 | Voice-Disclosure-Datenfeld | voiceApi.ts: disclosure_played_at; supabase/migrations/20260928130000_voice_runtime_foundation.sql | PREVIEW | Feld allein beweist hörbare Offenlegung nicht; Testausschnitt und Provider-Ereignis korrelieren |
| C06 | Voice-Tool-Spezifikation mit handoff_human | apps/agent-runtime/src/voice-tools.ts | BLOCKED | Tool-Definition ist kein Beleg für erfolgreiche menschliche Übergabe / Provider-Fallback |
| C07 | Governance-Approval-API und Evidence | supabase/functions/governance-approvals/index.ts; evidence.ts | PREVIEW | Prüfen, ob Gate für Bot-ID + Konfig-Hash + Ablauf + alle kanalspezifischen Aktivierungswege durchsetzbar ist |
| C08 | Governance-Event-Typen | src/core/runtime/governanceEvents.ts; runtime_events laut Produktfokus | PREVIEW | Keine neuen Breaking Changes; Onboarding-Ereignisse als additive Vorschläge und Writer/Idempotenz prüfen |
| C09 | Deterministischer Evidence-Hash | src/core/runtime/evidence.ts | PREVIEW | Pure Hash-Funktion ist kein kompletter persistenter revisionssicherer Onboarding-Evidence-Flow |
| C10 | AI-System-Ersterfassung als Selbstauskunft | src/features/activation/AiSetupStep.tsx | PREVIEW | Ohne automatischen Score/Review; nur als Input übernehmen, nicht als bestandene Prüfung |
| C11 | Bestehende Flag-Infrastruktur | src/config/featureFlags.ts (Governance AI standardmäßig AUS) | PREVIEW | Eigenes Secure-Onboarding-Flag und verborgener Landingentwurf noch nicht gebaut; in Phase 1 kein Code-Change |
| C12 | Preis-/Entitlement-SSoT | shared/pricing.ts; docs/product/capability-matrix.md | PREVIEW | Kein Paket-C-Entitlement verifiziert; kein Checkout/Preis in Phase 1 freischalten |
| C13 | Bestehende Voice-Security-Patches | PR #1994, #1998, #2044, #2046 laut GitHub merged | PREVIEW | Diff/Deploy/Runtime-Semantik pro Patch prüfen; ältere Voice-Triage nennt diese PRs noch als offen |
| C14 | Kundenseitige Governance-Aktivierung | src/features/activation/GovernanceActivationView.tsx, AiSetupStep.tsx | PREVIEW | Eignung als Wizard-Host prüfen; keine neue parallele Activation Engine |
| C15 | Dediziertes, persistentes Paket-C-Onboarding-Instanzmodell | Kein belastbarer dedizierter Nachweis in gezielter Sichtung | NOT IMPLEMENTED | Schema- und RLS-Proposal erst nach Abgleich vorhandener Tabellen; keine Migration |
| C16 | Ausnahmsweise cross-tenant Service-Grant mit Kundenfreigabe, TTL und Audit pro Zugriff | Kein belastbarer durchsetzbarer Nachweis in gezielter Sichtung | NOT IMPLEMENTED | Kein service-admin Cross-Tenant in Phase 1 |
| C17 | Zentraler Bot-Go-live-Enforcer über CRUD, Webhook und Provider | Nicht E2E nachgewiesen; enabled-Default im Bot-CRUD | BLOCKED | Gate vor Live-Aktivierung unabhängig von UI/Client erzwingen; Test T11 obligatorisch |
| C18 | Vollständiger ONB-06/07/08/10-E2E-Test mit Evidence | Nicht nachgewiesen | NOT IMPLEMENTED | Pilotspezifikation + E2E-T12ff in Phase 1; Implementierung später |
| C19 | Veröffentlichung/Marketing von Paket C | Keine Freigabe | BLOCKED | Nur verborgener, default-OFF Entwurf; keine neuen Landing-Claims/Checkout |
| C20 | Aktuelle Produktionsevidenz | GitHub-only-Sichtung | BLOCKED | Live-Backend, RLS, Edge-Deploys, Provider, Zahlungen und Test-Calls separat verifizieren |

## B. Mapping: ONB-Workflows zu Code und fehlenden Verträgen

| Workflow | Geplanter Pflichtnachweis | Vorhandener Anschluss | Status | Akzeptanz-Blocker |
|---|---|---|---|---|
| **ONB-06** Prompt & Use-Case Governance | Versionierte Use-Case- und Tool-Registry, negative Tests, genehmigte Guardrails | Bot-Konfiguration, Voice-Tools, Governance-Events | PREVIEW | Konfig-Hash und freigegebene Allowlist nicht end-to-end als Aktivierungsvoraussetzung verifiziert |
| **ONB-07** Human in the Loop | Rollenmatrix, Bestätigung, Approval/Decision-Evidence, positiver/negativer Handoff-Test | governance-approvals, voice-tools handoff_human | BLOCKED | Verbindliche menschliche Übergabe sowie rollen-/config-gebundene Gate-Kopplung nicht belegt |
| **ONB-08** Incident & Feedback | Severity, Alarm-/Stopppfad, Incident-Owner, Reaktion, Re-Test, Event-Evidence | incident.* in governanceEvents, Voice-Kill-Switch/Telemetry | PREVIEW | Incident-Auslöser→Kundenbenachrichtigung→Closure→Reassessment nicht E2E belegt |
| **ONB-10** Agent Deployment Gate | Freigabe der Risiken/Tools/Budgets/Disclosure und serverseitig blockierter Go-live | Bot-CRUD, governance-approvals, Voice-Evidence | BLOCKED | Kein bewiesenes universelles Gate; Art. 50 muss kanalspezifisch getestet werden |

## C. Art.-50-Checkliste pro Kanal (ONB-10)

| Kanal | Testnachweis | Negativfall | Status |
|---|---|---|---|
| Website-Chatbot | Browser-/Screenreader-Prüfung der eindeutigen KI-Kennzeichnung vor Nutzereingabe; UI-Version + Testtimestamp | Nachricht senden ohne sichtbaren KI-Hinweis → Go-live blockiert | BLOCKED – nicht getestet |
| WhatsApp | Testnachricht über autorisierten Testkanal mit verständlicher KI-Kennzeichnung; Provider-Nachweis der Zustellung bzw. Empfangsprüfung | Erstnachricht ohne Hinweis/Providerfehler → Go-live blockiert | BLOCKED – nicht getestet |
| Voice | Reale oder autorisierte synthetische Test-Session; hörbarer KI-Hinweis vor dem fachlichen Dialog; Provider-Event, Session-ID und config hash | disclosure_played_at vorhanden, aber akustisch kein Hinweis → Go-live blockiert | BLOCKED – nicht getestet |

**Norm:** Art. 50(1) KI-VO verlangt grundsätzlich Hinweise bei direkter Interaktion mit einem KI-System; vorbehaltlich der gesetzlichen Ausnahme, wenn dies offensichtlich ist. RealSync setzt als Produktstandard einen ausdrücklichen Hinweis. Inkrafttreten/Anwendbarkeit Art. 50: 02.08.2026; anders als Hochrisikoregeln nicht auf 2027/2028 verschoben. Quellen:
- https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-50
- https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act
- https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32026R1744

## D. Erforderliche Architekturverträge (zunächst Proposal, kein Code)

| Vertrag | Minimale Invariante | Verantwortliche Stelle / noch zu prüfen |
|---|---|---|
| TenantResolver | tenant_id nur aus JWT + Mitgliedschaft, nicht URL/hidden input | Serverseitige Auth-/RLS-/Roles-API |
| ConfigurationSnapshot | Jeder Gate-Entscheid verweist auf unveränderliche Bot-Konfiguration (Hash + Version) | Bot-Config/DB und Runtime |
| ApprovalBinding | Kunde mit Berechtigung genehmigt konkrete config; TTL/Revocation; replay-sicher | governance-approvals und Consumer |
| DisclosureEvidence | Anwendungs-/Kanalnachweis aus tatsächlichem Test, nicht Selbstauskunft | Website-/Meta-/Voice-Testadapter |
| ActivationEnforcer | Kein Bot-Kanal/Provider aktiv ohne sämtliche Pflichtnachweise; kein CRUD-Bypass | DB/Edge Provider/Gateway |
| BudgetAndKill | Harte Limits, fail-closed bei fehlender Freigabe/Budget | bot-chat, voice-runtime, WhatsApp und Provider |
| EvidenceAppend | Event-IDs, hashes, Autor, Tenant, Zeit; einmalig/idempotent | Bestehende Governance-/Evidence-Writer |
| SupportAccess | Customer-grant/TTL/Scope/Audit vor Cross-Tenant | Derzeit NICHT verwenden; separate Sicherheitsentscheidung |
| IncidentLifecycle | Severity, Owner, Incident-Event, Maßnahme, Abschluss | Governance-Events plus ggf. Support-Connector |
| FeatureFlag | Nachweislich default OFF, keine öffentliche Route/Checkout | Zukünftiger isolierter Frontend-PR |

## E. Test- und Freigabematrix

| Testgruppe | Erforderlicher Beleg | Status |
|---|---|---|
| Unit: Workflow-Validierung und Pflichtkontrollen | grüne Tests und versionierte Fixtures | NOT RUN |
| Unit: Art.-50-Templates, Default-Disclosure | Chat/WhatsApp/Voice-Snapshots | NOT RUN |
| Security: Cross-Tenant/RLS/Auth, Support-Grant | A/B-Tenant-Negativfälle; kein service_role-Browserzugriff | NOT RUN |
| Integration: Approval/Config-Hash/Expired/Replay | Gate nur für genau eine geprüfte config; expired/rejected blockiert | NOT RUN |
| Integration: Bot-CRUD-Bypass | enabled=true per API/DB darf ohne Gate nicht aktivieren | NOT RUN |
| Integration: Budget/Kill/Provider-Fallback | Hard-Limit, kontrollierte Beendigung, No-Write | NOT RUN |
| E2E: Handwerks-Pilot | Discovery → ONB-06/07/08/10 → Pilot → Abschlussbericht | NOT RUN |
| E2E: Disclosure | Tatsächliche UI/Message/Voice-Ausspielung | NOT RUN |
| Production Smoke | Freigegebener isolierter Tenant, Provider und redigierte Evidenz | NOT AUTHORIZED |
| Deploy/Checkout/Landing | Gesonderte Einzel-Freigabe | NOT AUTHORIZED |

## F. Lückenpriorisierung und GO/NO-GO

**P0-Blocker vor jeder Live-Aktivierung:**
1. Universelles serverseitiges, nicht umgehbares Aktivierungs-Gate über Bot-CRUD und sämtliche Kanäle.
2. Für jeden Kanal tatsächlich bestandene Art.-50-Disclosure-Prüfung.
3. Menschliche Freigabe an unveränderlichen Konfigurationsstand und Tenant gebunden.
4. Human-Handoff und Fail-closed-Budget-/Provider-Fallback im echten Pilot.
5. RLS-/Tenant-Negativtests und echte Evidence-Korrelation.

**P1 vor Self-Service/Managed-Service-Angebot:**
- Persistente und auditierbare Workflow-Instanzen, Wiederaufnahme, Owner, Deadlines, Incident-Reassessment.
- Messung Time to First Successful Pilot und Evidence Coverage.
- Kunden-Command-Center ohne Cross-Tenant-Support-Rechte.
- Separat freigegebene Paketentitlements und Preisgestaltung.
- Erst nach echter E2E-Abnahme dokumentierte/öffentliche Claims.

**Entscheidung 2026-11-07:** GO nur für Architekturdokumentation, Validierung, Triage. NO-GO für produktive Agentenfreigabe und öffentliche Paketvermarktung.

**WIP-Regel:** Bei der am 07.11. beobachteten Zahl 37 offener PRs keine Feature-PR. Zulässige Docs-/Triage-Arbeit bleibt isoliert. Keine Migration, kein Merge, kein Deploy, keine Security-Veränderung, keine Preis- oder Landing-Änderung in diesem Dokumentationsschritt.
