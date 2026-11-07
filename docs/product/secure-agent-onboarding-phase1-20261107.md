# Secure Agent Onboarding – Phase 1: Architektur, Spezifikation und Entscheidung

**Stand:** 2026-11-07. **Repository:** realsyncdynamics-spec/RealSyncDynamics.AI, main @ c8af738fa834a8977486e5f7fd5f206c101ab3dd.  
**Änderungstyp:** ausschließlich Dokumentation. **Freigabe:** keine Implementierungs-, Merge-, Migrations-, Preis-, Landing- oder Deployment-Freigabe.  
**Geltungsbereich:** Paket C (ONB-06/07/08/10), erster Pilot: KI-Empfangsassistent für einen Handwerksbetrieb.  
**Beleggrenze:** GitHub-Dateien und PR-Metadaten geprüft; keine produktive Datenbank, Provider-Secrets, Live-Telefonate, Stripe-Transaktionen oder Ende-zu-Ende-Tests geprüft. Deshalb keine Produktionsfreigabe.

## 1. Entscheidung und Ist-Zustand

**Konzept: GO für eine eng begrenzte E2E-Pilot-Spezifikation. Aktivierung/Produktionsreife: NO-GO.**

Die Produktentscheidung K4 vom 27.10.2026 in docs/PRODUCT_PRIORITIZATION.md lautet: KI-Mitarbeiter mit eingebauter Governance; erster Fall ist der Handwerks-Empfangsassistent (Anfragen, Kontaktdaten, Terminwunsch, menschliche Übergabe). Full-Service-Onboarding gehört als kontrollierter Einführungsprozess zu diesem Fall, nicht als vierte Laufzeit oder zweites IAM/Ticket/CRM-System.

Quellen mit Priorität:
1. [PR-Policy](../../.github/PR_TRIAGE_POLICY.md) – WIP-Stopp und Freigaben.
2. [CLAUDE.md](../../CLAUDE.md) – React/Vite, Supabase, Cloudflare Pages, Homepage.
3. [Produkt-Fokus](../PRODUCT_FOCUS.md) und [K4-Priorisierung](../PRODUCT_PRIORITIZATION.md).
4. [Voice-Triage vom 28.10.](voice-agent-studio-wip-triage-20261028.md) – historische Planung, kein aktueller Statusnachweis.
5. Diese [Capability-Matrix](secure-agent-onboarding-capability-matrix-20261107.md).

**Wichtige Aktualisierung zur älteren Triage:** GitHub bestätigt PR #1994, #1998, #2044 und #2046 als gemergt (28./29.10.). #1152 (alter Self-Service-Onboarding-PR) ist geschlossen und nicht gemergt. Keines davon belegt ohne Runtime-/Provider-Test eine vollständige produktive Onboarding-Strecke. Am 07.11. wurden über die GitHub-Suche 37 offene PRs angezeigt. Gemäß PR-Policy: kein neuer Feature-PR bei mehr als 20 offenen PRs; nur die dort erlaubten Ausnahmen.

**Bestehende Bausteine (Code nachgewiesen; Produktion ungeprüft):**
- Frontend: src/features/bots/BotBuilderView.tsx, src/features/bots/api.ts, src/features/bots/types.ts, vorhandene /app/bots-Routen.
- Mandantenkontext: src/core/access/TenantProvider.tsx; serverseitige Mitgliedschaft + RLS separat zu verifizieren.
- Governed Voice: apps/agent-runtime, src/features/governance/voice/voiceApi.ts, voice_sessions, voice_evidence und voice_tool_requests.
- Governance: supabase/functions/governance-approvals/index.ts (JWT/Mitgliedschaft/Rollen, Entscheidungs-Evidence), src/core/runtime/governanceEvents.ts, src/core/runtime/evidence.ts.
- Self-Assessment: src/features/activation/AiSetupStep.tsx (Selbstauskunft, keine automatische Risikoentscheidung).
- Feature Flags: src/config/featureFlags.ts enthält ein anderes standardmäßig AUS geschaltetes Feature; ein eigenes Managed-Onboarding-Flag ist noch nicht nachgewiesen.
- Pricing: shared/pricing.ts als Single Source of Truth; keine neuen Paket-/Entitlement-Keys in Phase 1.

**Prüfpunkt mit besonderer Relevanz:** src/features/bots/api.ts setzt bei createBot das Feld enabled standardmäßig auf true; src/features/bots/BotBuilderView.tsx kann enabled im gespeicherten Bot ändern. Das dokumentierte Secure-Onboarding-Go-live-Gate darf deshalb nicht lediglich ein neuer UI-Wizard sein. Vor einer verbindlichen Aktivierung ist eine serverseitig/DB-seitig durchgesetzte, kanalübergreifende Aktivierungsentscheidung nachzuweisen bzw. gesondert zu entwerfen. Kein produktiver Eingriff in dieser Phase.

## 2. Architekturziel und Grenzen

Ein Tenant und vorhandene Bot-/Voice-Identität, keine parallele Runtime:

Kunde (vorhandene Auth + TenantProvider)  
→ bestehendes Bot-/Agent-Projekt (tenant_id und bot_id aus verifizierter Mitgliedschaft)  
→ Paket-C-Onboarding-Instanz als geplanter Adapter/Workflow  
→ ONB-06 Use-Case & Prompt-Prüfung  
→ ONB-07 menschliche Kontrolle, Allowlist und Eskalation  
→ ONB-08 Incident-Pfad und Recovery  
→ ONB-10 Deployment-/Disclosure-/Approval-Gate  
→ vorhandene Governance-Approvals / Evidence-APIs, nur nach Verträglichkeitsprüfung  
→ separater, serverseitiger Aktivierungsentscheid über tatsächlichen Runtime-Pfad  
→ periodische Governance-Prüfung und explizite Incident-Nachverfolgung.

Keine neuen Persistenzschemata oder Endpunkte in Phase 1. Ein Onboarding-Workflow darf keine per Browser übermittelte tenant_id oder enabled=true als Autorität verwenden. Eine später nötige Persistenz wird zunächst als Proposal dokumentiert; sicherheits- und migrationsrelevante Änderungen sind gesondert zu genehmigen.

Das bestehende Governance-Approvals-Backend ist nicht automatisch ein Agent-Aktivierungs-Gate. Es muss geprüft werden, ob seine Approval-IDs, Rollen, Laufzeiten und Evidence-Semantik einen konkreten Agenten-Konfigurationsstand referenzieren können und ob ein Runtime-Consumer vor Aktivierung tatsächlich blockiert.

## 3. Phase-1-Paket C – vier Workflows

| ID | Ziel / Inputs | Pflichtergebnis / Evidenz | Review-Verantwortung |
|---|---|---|---|
| ONB-06 | Use Case, Zweck, Prompt-/Konfig-Version, Datenquellen, erlaubte Tools | Use-Case-Registry; versionierte Guardrails; Testfallliste; negative Tool-/Prompt-Injection-Prüfungen | Tenant-Owner + autorisierter technischer Reviewer |
| ONB-07 | Risikoklassen, Rechte, menschliche Eskalation, Bestätigungsregeln | Rollen-/Permission-Matrix; Human-Handoff-Test; Approver-Entscheidung mit Reason und Zeit | Kundenseitiger Owner/Approver |
| ONB-08 | Ausfall-Szenarien, Datenschutzvorfall, Falschantwort, Providerfehler | Severity-Matrix; Incident-Eskalation; Stopp-/Deaktivierungsprobe; Incident-Übungsnachweis | Kundenseitiger Incident-Owner |
| ONB-10 | Alle Vorbefunde, kanalabhängige Offenlegung, Entitlement, Providerstatus, Budget, Datenflüsse | Vollständiger Gate-Report, Disclosure-Test-Evidence, expliziter menschlicher Go-live-Entscheid, Monitoring-Baseline | Berechtigter Kunde; technische Laufzeit erzwingt die Entscheidung |

Jede Workflow-Instanz muss (ZIEL, IST, IN PRÜFUNG, BESTANDEN, ABGELEHNT, BLOCKIERT) inkl. Owner, Deadline, versionierter Artefakte und Evidence-Links unterscheiden. Keine Erfolgsmeldung, wenn nur eine UI-Bestätigung vorliegt.

**Vorgeschlagenes Vertragsmodell (noch NICHT implementiert):**
- workflow_instance_id, template_id, template_version, package_key, tenant_id, project_id, bot_id, channel
- opened_at, started_by, assigned_owner, stage, stage_status, due_at, completed_at
- config_version/hash; evidence_refs (hash, uri, created_at); control_id, result, tester_id, timestamp
- approval_id, decision, approver_id, rationale, valid_until; risk_severity
- immutable event/idempotency key; provider/entitlement/runtime verification timestamps
- escalation state; incident references; reviewer_notes ohne unkontrollierte PII.

Keine Datenmodellentscheidung ohne Bestandsabgleich mit verfügbaren Tabellen, Audit- und RLS-Policies.

## 4. Gate- und Zustandsmaschine

**Entwurf:** DRAFT → DISCOVERY → CONFIGURED → PILOT_TESTING → REVIEW_REQUIRED → APPROVED_FOR_ACTIVATION → ACTIVATION_PENDING → ACTIVE_MONITORED. Fehlerpfade: BLOCKED / REJECTED / EXPIRED / SUSPENDED.

Der Übergang zu ACTIVE_MONITORED ist erst zulässig, wenn **alle** folgenden serverseitig verifizierten Bedingungen vorliegen:

- Tenant-Mitgliedschaft + berechtigte Rolle; unverwechselbare bot_id, channel und geprüfter Konfigurations-Hash.
- Entitlement und Provider-/Kanalroute in Echtbetrieb verifiziert.
- Aktive Budgetobergrenzen und Kill-Switch bzw. Deaktivierungsweg.
- Allowlist/Tool-Rechte und Datenquellen geprüft; keine selbst erweiterbaren Agent-Rechte.
- Menschenübergabe/Fallback unter Erfolg, Fehler und Out-of-Budget getestet.
- Tests bestanden; kritische offene Risiken geschlossen oder explizit als *nicht delegierbare* Blocker behandelt.
- Dokumentierter KI-Offenlegungstest zum konkreten Kanal und Konfigurationsstand.
- Menschliche Freigabe mit Zeit, Rolle, Grund, Gültigkeit, Evidence.
- Laufzeitdurchsetzung gegen bypass via Bot-CRUD/API und alle Provider-Webhooks nachgewiesen.

**Fail-closed:** Fehlt auch nur ein zwingender Gate-Nachweis, keine neue Live-Aktivierung; vorhandene aktive Agenten dürfen nicht ohne separate, risikobewertete Betriebsregel unkontrolliert deaktiviert werden. Ein erfolgreicher Pilot-Test ist keine Live-Freigabe.

## 5. Art. 50 EU AI Act – kontrollierbarer Nachweis

Art. 50(1) ist seit 02.08.2026 grundsätzlich anwendbar; bei direkter KI-Interaktion ist die Betroffenheit und etwaige gesetzliche Ausnahme anhand des konkreten Einsatzes zu prüfen. **RealSync-Produktstandard:** ausdrückliche klare KI-Offenlegung vor/nach Beginn der ersten relevanten Interaktion – unabhängig von der Ausnahme für offensichtlich erkennbare KI-Systeme. Andere Pflichten (Aufzeichnung/Transkription, DSGVO, ggf. besondere Datenkategorien) gesondert behandeln.

- **Website:** Sichtbarer und zugänglicher Hinweis im geöffneten Chat *vor* der ersten Nutzereingabe; mobil und mit Screenreader prüfbar. Testartefakt: Screenshot/DOM-Test + Timestamp + release/config hash.
- **WhatsApp:** Verständlicher KI-Hinweis in der ersten Nachricht der Bot-Interaktion; Nachrichtenversand und Delivery-/Event-Beleg von Testkanal. Keine unbewiesene Annahme, dass die erste Nachricht ankommt.
- **Voice:** KI-Offenlegung in der ersten tatsächlich hörbaren Begrüßung *vor* inhaltlicher Bearbeitung; aufgezeichneter synthetischer Test-Call bzw. rechtlich zulässiges Testartefakt mit Provider-Event und Session-Nachweis. voice_sessions.disclosure_played_at ist ein geeignetes vorhandenes Feld, allein jedoch kein Beweis, dass der Hinweis abgespielt wurde.
- **Fallback:** Wenn Offenlegung oder Beweis fehlschlägt, Gate BLOCKED; nicht automatisch fortsetzen.

Offizielle Rechtsquellen (vor Live-Claims aktualisieren):
- https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-50
- https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act
- https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32026R1744

Für Anhang III gelten einschlägige Hochrisikopflichten ab 02.12.2027, für Anhang I ab 02.08.2028. Art. 50 ist **nicht** entsprechend verschoben. Es werden keine pauschalen Konformitätsgarantien erteilt.

## 6. Rechte, Mandanten und Service-Support

Phase 1 ist **customer-only**. Ein Serviceadmin erhält keinen pauschalen Cross-Tenant-Zugriff. Die vorhandenen Funktionen (TenantProvider, PostgREST/RLS, governance-approvals) sind notwendige, aber nicht hinreichende Bausteine.

Ein späteres Support-Grant-Modell (nicht Teil des Piloten) erfordert:
- Kundenfreigabe durch autorisierten Tenant-Owner mit Zweck, Umfang, Ablaufzeit.
- Serverseitige, zeitliche, rollen- und mandantengebundene Einschränkung.
- Zugriff- und Änderungslog je relevanter Operation; Widerruf und sofortige Revalidierung.
- Keine service_role im Browser, kein Rechtewechsel durch URL/LocalStorage.
- Getestete Negativfälle: fremder Tenant, abgelaufener Grant, widerrufener Grant, fehlendes Audit.

Solange kein solcher durchsetzbarer Vertrag nachgewiesen ist, Support-Oberflächen ausschließlich ohne Fremdmandantenzugriff planen und Capability als NOT IMPLEMENTED markieren.

## 7. E2E-Szenario – Handwerksbetrieb

1. Neuer oder vorhandener Kunde meldet sich an und wählt einen Tenant, dessen Mitglied er ist; Bot wird ohne Freischaltung als Konfigurationsentwurf angelegt.
2. Zweck: Anrufannahme für Handwerk, Kontaktanfrage, Rückruf und Terminwunsch. Keine automatisch verbindliche Buchung ohne bestätigte Integration.
3. ONB-06: erlaubte Quellen/Tools und Prompt-Version dokumentieren, bösartige Anfragen/PII-Leakage simulieren.
4. ONB-07: menschliche Übergabe, Abbruch, unzulässige Tool-Aktion und Bestätigungsforderung simulieren.
5. ONB-08: Provider-Fehler, Budgetlimit, Kill-Switch, Incidents und Meldewege im Test nachweisen.
6. ONB-10: KI-Hinweis im gewählten Kanal und tatsächliche Ausspielung nachweisen; kundenseitiger Reviewer bestätigt *den konkreten* Konfigurations-Hash.
7. Ein anderer Tenant sowie ein gewöhnlicher Nutzer ohne Freigaberecht werden serverseitig zurückgewiesen.
8. Ein Versuch, enabled=true über bestehenden CRUD-/API-Pfad zu speichern, **muss** vor produktiver Einführung durch ein wirksames Aktivierungsgate verhindert werden. Solange dies nicht bewiesen ist: NO-GO.
9. Nach ausdrücklicher, separater Freigabe: echter Test-Call, Evidence/Usage/Providerstatus kontrollieren; Stopp und Widerruf nachweisen.
10. Abschlussbericht mit allen Kontroll-IDs, Hashes, Status, Tester und Gate-Entscheid.

**Abnahmetest-Katalog (nur Spezifikation; kein Test ausgeführt):**
- T01 Tenant A sieht nie Tenant B; ungültiger/missing Tenant fail-closed.
- T02 Normale Rolle kann kein Approval/Activation-Gate umgehen.
- T03 Alle ONB-06-/07-/08-/10-Pflichtkontrollen sind vor Review vorhanden.
- T04 Website-KI-Hinweis sichtbar + zugänglich; ohne Hinweis Gate blockiert.
- T05 WhatsApp-Erstnachricht mit Hinweis tatsächlich im Testkanal bestätigt.
- T06 Voice-Hinweis hörbar; Nachweis korreliert mit disclosure_played_at, Session-ID und Konfig-Hash.
- T07 Replay/abgelaufene Approval/Fremd-Konfig-Version blockiert.
- T08 Nicht erlaubter Tool-Write/Budget-Exhaustion/Kill-Switch fail-closed.
- T09 Menschliche Übergabe erfolgreich sowie Fallback bei Providerfehler geprüft.
- T10 Incident öffnet sich bei Fehlerszenario, Evidenz bleibt unveränderbar; keine sensiblen Daten im Log.
- T11 Anlegen/Aktualisieren des Bot enabled-Status kann nicht das Gate umgehen.
- T12 Unterstützungsrolle ohne Kunden-Grant sieht keine Kundendaten.
- T13 Kein Fake-Success nach Stripe-Redirect oder Provider-Timeout.
- T14 Deaktivierung verhindert neue produktive Interaktionen; Verlauf bleibt gemäß Retention-Policy prüfbar.

**KPI:** Time to First Successful Pilot = Zeitpunkt des ersten nachweislich bestandenen Pilottests minus dokumentiertem Onboarding-Start. Go-live-Dauer separat.

## 8. Phasenfolge und Change-Isolation

**P1-A (dieser Stand):** Nur Dokumentation: Bestand, Capability-Matrix, Onboarding-/Gate-Spezifikation, Testfälle, NO-GO.  
**P1-B (nach expliziter Freigabe und WIP-Lage):** Kleiner isolierter Typ-/Fixture-/Validator-PR, keine DB-Migrationen, keine Aktivierung.  
**P1-C:** Separat genehmigter Security-/Persistenz-/RLS-Vertrag, inklusive Tests und Migration einzeln, falls wirklich notwendig.  
**P1-D:** Kundenseitiger Wizard und E2E-Pilot auf vorhandener Runtime; Publish/Marketing bleibt verborgen.  
**P1-E:** Unabhängige Risiko-, Rechts-, Provider- und Produktionsfreigabe; erst dann Landing- und Checkout-Claims nach eigener Einzelentscheidung.

**Feature-Flag-Entwurf:** Name/Route erst nach Routing-Inventar, default OFF, kein öffentlicher CTA; in Phase 1 weder Flag-Code noch Landing-Datei verändern. Bestehende Landing-Hotspots in src/App.tsx und src/components/landing/** bleiben unberührt.

## 9. Konkrete offene Entscheidungen / NO-GO-Kriterien

1. Vor Aktivierung: serverseitiger Gate-Consumer im *wirklichen* Bot- und Provider-Aktivierungspfad erforderlich. Aktueller Bot-CRUD erlaubt enabled=true als Default; präzise serverseitige Verträge/RLS noch nicht auditiert.
2. Art.-50-Offenlegung über Web, WhatsApp und Voice muss pro Kanal real getestet und nachgewiesen werden.
3. Human Handoff ist im Voice-Tool-Katalog enthalten, aber echte Übergabekette/Provider-Fallback nicht E2E bestätigt.
4. Approvals existieren, aber Bindung an Bot-ID, Konfig-Hash, Ablauf und alle Aktivierungspfade nicht vollständig nachgewiesen.
5. Support-Grant nicht nachgewiesen: Phase 1 ohne Serviceadmin-Cross-Tenant.
6. Fehlendes nachgewiesenes Workflow-Instanzmodell, Persistenz, KPI/Event-Verknüpfung, Re-Assessment.
7. Keine verifizierten Live-Provider-, DB-/Secret-, Zahlungs- oder tatsächlichen Test-Call-Nachweise.
8. WIP-Policy blockiert neue Feature-PRs, solange mehr als 20 offen sind.
9. Vertriebs-/Produktionsclaims und Preisänderungen benötigen Einzel-Freigabe.
10. Code- und PR-Inventar ersetzt weder CI noch RLS-/E2E-/Provider-Test.

**GO:** Dokumentationsreview, WIP-/Security-Triage und Validierung kleiner Verträge.  
**NO-GO:** Neues öffentlich buchbares Secure Agent Onboarding, tatsächlicher Agent-Go-live, Migration, Preis-/Landing-Änderung, Feature-Merge und Deployment ohne gesonderte Freigaben.

*Nachweise: Alle oben benannten Pfade gelten für main @ c8af738; die Produktivumgebung wurde in dieser Bestandsanalyse nicht verändert.*