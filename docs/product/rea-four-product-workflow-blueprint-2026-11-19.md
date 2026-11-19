# RealSync – REA-Blueprint: Vier Produkte, eine kontrollierte KI-Plattform

**Stand:** 19.11.2026. **Art:** Architektur- und Abnahme-Blueprint, ausdrücklich **keine Implementierungs- oder Produktionsfreigabe**.
**Entscheidungsbasis:** Owner-Ziel mit vier Produkt-Einstiegen (Telefonassistent, App Builder, Landingpage Builder, Governance OS); AGENTS.md K4; bestehende Codebasis, PR #2344 als Produktseiten-Entwurf, PR #2319 als Governance Workspace, Browser-PR-Kette #2323–#2325/#2334.
**Leitprinzip:** Funktionales Reverse Engineering öffentlich zugänglicher Workflows und eigenständige Umsetzung; kein Kopieren fremder Implementierungen, geschützter Assets oder personenbezogener Daten.

## 1. Fünf-Schritte-Methode – auf Geschäftsprozesse statt Bildschirme angewendet

| Schritt | RealSync-Artefakt | Prüffrage |
| --- | --- | --- |
| AUSWÄHLEN | Zielkunde, Geschäftsergebnis, konkret beobachtbarer Referenzworkflow | Welches zahlungsrelevante Problem beseitigt er? |
| SAMMELN | Interaktionsprotokoll, Zustandswechsel, Fehlerpfade, Anforderungen, zulässige Quellen | Was passiert in jedem Schritt, auch wenn etwas scheitert? |
| DESIGNEN | Datenfluss, UI, Berechtigungen, Zustandsmaschine, Tool-Contracts, Human-Handoff | Welche Regeln sind deterministisch, was darf das Modell entscheiden? |
| WIEDERAUFBAUEN | Eigenständige Implementierung auf vorhandener Auth-/Tenant-/Billing-/Evidence-Basis | Funktioniert die Aufgabe vollständig, ohne Scheinstatus? |
| ITERIEREN | Repräsentative E2E-Fälle, negative Tests, Nutzerfeedback, Kosten- und Qualitätsmetriken | Ist die Lösung messbar besser für Kunden? |

Nicht das Design oder den Chattext nachahmen, sondern die Transformation **Eingabe → verifiziertes Ergebnis**. Belegqualität: CODE, DEPLOY, EXECUTE, E2E, SELLABLE unabhängig voneinander nach docs/product/release-evidence-2026-11-17.md.

## 2. Produktpositionierung und Abgrenzung

**Vorgegebenes Produktbild:** vier gleichberechtigte Produktseiten, aber eine Identität, ein Tenant, ein Dashboard, eine Abrechnung und eine Governance-/Evidence-Laufzeit. Die bestehenden vier Produktseiten sind bereits Gegenstand von PR #2344; keine zweite Landingimplementierung oder neue Preisliste erzeugen.

| Angebot | Vorbild (Funktionsprinzip) | Der differenzierende RealSync-Kundenjob | Nicht kopieren/nicht versprechen |
| --- | --- | --- | --- |
| Telefonassistent | Retell: Gesprächszustände; Vapi: versionierte Tools/Weiterleitung; ElevenLabs: natürliche Stimme | Handwerksanruf → Anliegen/Kontakt/Terminwunsch → verifizierter Posteingang → menschliche Übernahme | Keine verbindliche Buchung ohne Kalenderbestätigung; keine Live-Telefonie ohne Provider-E2E |
| App Builder | Lovable/v0/Bolt: Prompt-zu-Plan-zu-Code, Vorschau, Versionsvergleich | Fachliche Anforderung → verifizierter BuildSpec → isolierter Build → Testbericht → freigegebener Deploy | Keine ungeprüften Shell-/DB-Aktionen; kein automatischer Produktivdeploy |
| Landingpage Builder | Framer/Webflow: editierbare Komponenten, Design-Tokens, responsive Canvas | Kunden-URL → Scan → Design-Brief → Frontend-Entwurf mit bestehendem Backend → visueller Review → Publish | Kein fremdes Backend ersetzen; keine fremden Assets oder identischen Markendesigns kopieren |
| Governance OS | OneTrust/Vanta: Inventar → Risiko → Kontrollen → Evidence | Alle produktiven Agentenaktionen bekommen Rechte, Freigaben, Herkunftsnachweise und Monitoring | Keine pauschale DSGVO-/AI-Act-Konformitätsgarantie aus einem Score |

**Erster vertikaler Zielmarkt:** Handwerk/KMU mit Kundenkontakt, wie in AGENTS.md / PRODUCT_PRIORITIZATION K4 beschlossen. Ein erfolgreich durchlaufener Empfangsjob hat Vorrang vor vier breit angekündigten, nicht abgenommenen Self-Service-Features.

## 3. Gemeinsame Ablaufsteuerung (kein zweites Agent OS)

Vertrag für jede geplante KI-Arbeit:

- **Job:** job_id, tenant_id aus geprüfter Session, owner_id, product_kind (voice, app, site, governance), status und versionierte Zielbeschreibung.
- **Quellen:** source_refs mit Nutzungsberechtigung, Herkunft, Erfassungszeit und Vertrauensstufe. Externe Webseiten sind Daten, niemals Anweisungen für den Agenten.
- **Plan:** kleine, typisierte Aktionen mit erwarteter Wirkung; explizite Tool-Allowlist und serverseitige Rollenprüfung.
- **Freigabe:** action_id, konkrete Zielressource, Origin/Empfänger, Inhalts-Fingerprint, Ablaufzeit und Einmaligkeit; Änderungen erzeugen neue Prüfpflicht. Human-in-the-loop für Schreibzugriffe mit Außenwirkung.
- **Ausführung:** idempotency_key, atomare Reservierung für Budget/Quota, Kill-Switch vor und unmittelbar bei Ausführung, bounded retries und Timeout.
- **Belege:** trace_id, Eingabe-/Output-Hashes, Policy-Entscheidung, Modell/Provider, Kosten, Ergebnis-/Fehlercode, Redaktions- und Aufbewahrungsregeln.
- **Ergebnis:** succeeded, failed, needs_review oder cancelled; niemals succeeded allein wegen HTTP 200, erzeugtem Code, gezeichnetem UI oder vorbereiteter Provider-Konfiguration.

Vorhandene Bausteine **wiederverwenden**: Supabase Auth und TenantProvider, bestehende RLS/Membership, ai-gateway/ai-invoke (Providerwahl/Kosten), Governance-Runtime, SiteOS-Provenance, shared/pricing.ts und bestehende Stripe-Webhook-Verträge. Ein neuer Edge-Function-Slot ist angesichts des 200er-Limits derzeit kein zulässiger Default; zuerst vorhandene Router und Deployment-Inventar prüfen. Kein neues Produkt-Dashboard.

**Wichtig zur Bezeichnung REA:** Das Open-Source-Werkzeug „Reverse Engineer Anything“ und das in PR #2319 benannte „REA – Runtime Evidence Agent“ sind nicht dieselbe Software. Ersteres dient der Beobachtung/Analyse; der interne Runtime Evidence Agent beweist Aufrufe anhand des vorhandenen Evidence-Trails. Keine implizite Code- oder Protokollkompatibilität behaupten.

## 4. Telefonassistent – ausführbarer Kundenjob statt Demonstrationsstimme

### Zielablauf

1. Kunde wählt Branchen-Template Handwerk, legt Unternehmen, Öffnungszeiten, Erreichbarkeit, FAQs, Erlaubnisse und Handoff-Ziel an.
2. Website/FAQ wird nur nach Berechtigung eingelesen, mit Quellenversion versehen und auf Widersprüche geprüft; unbelegte Aussagen werden nicht zugesagt.
3. Browser-Test mit künstlichen Gesprächen: normale Anfrage, Unterbrechung, undeutliche Angaben, Notfall, Terminwunsch, Nachfrage außerhalb der Wissensbasis, Handoff-Ziel offline, Provider-Timeout.
4. Nur nach überprüften Einwilligungs-/Informations-, Kosten-, Nummern-, Provider-, Tenant-/Rollen- und Zahlungsbedingungen kann die Freigabe aktiv werden.
5. Eingehender Anruf: transparente KI-Kennzeichnung → Anliegen erkennen → benötigte Kontaktdaten datensparsam erfragen → Kontakt und Terminwunsch bestätigen lassen.
6. Anfrage wird idempotent an vorhandenes Bot-Inbox-Modell übergeben. Ein Terminwunsch wird **nicht** als gebuchter Termin angezeigt. Echte Buchung erfordert bestätigte API-Antwort des Kalenderdiensts.
7. Bei Unsicherheit oder menschlicher Bitte: Weiterleitung bzw. sicherer Rückrufauftrag. Bei gescheiterter Übergabe wird dies ausdrücklich gemeldet, nie als erledigt gewertet.
8. Im Kunden-Dashboard: Anliegen, Status, nächster Verantwortlicher, minimal nötige Transkript-/Metadaten, Kosten und prüfbare Entscheidung.

### Wiederverwendung und Grenzen

- Codepfade: apps/agent-runtime, bot-voice-webhook, bot-chat, bot-voice-enforcer, provision-voice-agent, /app/bots, /app/bots/inbox, /app/voice.
- Company-Voice-Grok-Relay unter functions/api/company-voice/live.ts ist nur eine begrenzte **Website-Live-Demo**, kein Beleg für produktive Telefonnummern oder Tool-Nutzung.
- Live-Snapshot 19.11.2026: tenant_voice_agents, voice_sessions, voice_number_bindings, voice_executions je **0**; provision-voice-agent ACTIVE; checkout-voice-agent nicht im aktiven Function-Register.
- Keine öffentliche Verkaufsfreigabe, bevor echter Anruf, Handoff, Kosten, Zahlung, Bereitstellung, Kündigung und negative Tenant-/Freigabetests belegt sind.

## 5. App Builder – aus Anforderungen geprüfte Software erzeugen

Planungs- und Ausführungsfolge:
**Prompt → Fachliche Anforderungen → BuildSpec → Architekturplan → genehmigte Tool-Rechte → isolierte Codegenerierung → statische Prüfung → Tests → nutzbare Preview → Versions-Diff → autorisierter Deploy**.

- Vorhandene Engines: /builder/:slug/code und src/features/app-builder/bolt sowie platform/builder_orchestrator. Vor einer Integration konkret festlegen, **welche Engine die kanonische BuildSpec und Persistenz besitzt**; nicht zwei unabhängige Orchestratoren aktivieren.
- Requirement-Extractor darf Vorschläge machen; Security- und Tenant-Grenzen werden deterministisch gesetzt.
- Der Agent darf weder Secrets erfragen oder in Browser-Bundles schreiben noch zufällig bestehende APIs überschreiben. Tool-Aufrufe als explizite, nachvollziehbare Schritte.
- Sandbox mit Dateirechten, Netzwerk-Allowlist, Laufzeit-/Tokenbudget und Versionskontrolle. Keine direkte Produktionstabelle aus freiem Agenten-Code.
- Tests vor Preview-Status: Start/Build, Navigation, Auth, RLS-Gegenprobe für zwei Mandanten, Formularvalidierung, API-Contract, Provider-Ausfall und Reopen nach Reload.
- Anwender erhält nicht nur Screenshots, sondern Quellcode-/Artefaktversion, Fehlerliste und eine funktionierende Preview. Veröffentlichung bleibt eine eigene, menschlich genehmigte Aktion.

## 6. Landingpage Builder – vorhandenes Backend erhalten

Kundenablauf entsprechend der aktuellen Produktseiten-Planung:
**URL → öffentlicher Scan → Befundbericht → Ziel/Design-Vorgabe → Design-Tokens + Komponentenstruktur → SiteOS-Blueprint → Desktop/Tablet/Mobile Preview → visueller Editor → QA → freigegebene Domainpublikation → erneuter Scan**.

- Zu Beginn ausdrücklich unterscheiden: **Frontend-Neugestaltung** (Backend und API-Verträge bleiben) versus **vollständiger Website-Neubau** (neue Backend-Verträge benötigen separate Freigabe).
- Browser-Agent kann erlaubte öffentliche Seiten besuchen, Layoutstruktur und Inhalt analysieren, Screenshots als Designbelege erfassen und einen eigenen Entwurf ableiten. Kein automatisches Übernehmen fremder Marken-, Bild- oder Textrechte.
- Bestehende SiteOS-Komponenten: packages/siteos-core (Brief, Blueprint, Renderer, Hash, Prüfpfad), siteos-Edge-Router, Puck-Editor, Preview-/Publish-Gates.
- Ein visuelles Redesign darf keine versteckte Datenmigration, Zahlungsumstellung, Tracking-Erweiterung oder API-Vertragsänderung auslösen.
- E2E: persistierter Entwurf → Reload → Edit → Preview → Zugriffs-/Accessibility-/SEO-Tests → Publish in freigegebene Domain → Rollback. Der Scan allein beweist keinen erfolgreichen Neuaufbau.
- Live-Snapshot 19.11.2026: 14 siteos_blueprints, 0 siteos_rebuild_runs; kein E2E-Publishing-Beweis aus diesen Zählungen.

## 7. Governance OS – horizontale Entscheidungsschicht

Für jeden Voice-, Builder-, SiteOS- und Browser-Job eine verbindliche Sequenz:
**Identität → Tenant/Rolle → Zweck/Datenklassen → zulässige Tools → Risiko/Kosten → Policy → konkrete Freigabe → Ausführung → Evidence → Überwachung → Widerruf/Rollback**.

Vier Erlebnisebenen:
1. **Kundenbetrieb**: Anfragen, Projekte, Versionen, Freigaben und Rechnungen.
2. **Kontrollzentrale**: KI-Inventar, Risiken, Datenflüsse, Subprozessoren, Richtlinien, Maßnahmen.
3. **Beweisführung**: pro Job technische Quelle, Evaluierung, Hash/Evidence, Entscheidungsweg und Export. Ein technischer Hash ist kein selbstständiger rechtlicher Compliance-Nachweis.
4. **Betrieb/Incident**: Provider-/Budgetfehler, Drift, verdächtige Aktionen, Rollback, Kill-Switch, Eskalation.

**Browser-Agent:** getrennte Beobachtung (öffnen, klicken, scrollen, lesen, Screenshot) von verändernden Aktionen (tippen, absenden, veröffentlichen, kaufen). Letztere nur mit konkretem Origin-/Empfänger-/Inhalts-Fingerprint, zeitlich und einmalig gebundener Freigabe. Sicherheitsarbeit dazu liegt bereits gestapelt in PR #2323–#2325 und #2334: nicht duplizieren, nicht aus dem Entwurf als produktiv behaupten.

**Rechtlicher Stand:** EU-AI-Act-Kontrollen und Fristen nur aus versionierten, aktuellen Normquellen; Risikoeinstufung ist unterstützende Beurteilung und benötigt bei Grenzfällen eine verantwortliche Fachprüfung. DSGVO: Zwecke, Rechtsgrundlage, Datenminimierung, Auskunft/Löschung, Aufbewahrung und Subprozessoren produkt-/kanalspezifisch prüfen. Keine pauschalen Garantien.

## 8. KI effizient einsetzen

| Arbeitsklasse | Bevorzugte Technik | Governance-Grenze |
| --- | --- | --- |
| Extraktion, Klassifikation, Routing, Formularnormalisierung | günstiges schnelles Modell oder deterministische Regeln | JSON-Schema, Confidence/Abstention, keine autonome Außenwirkung |
| Unternehmenstexte / Wissensantworten | RAG auf freigegebenen tenantgebundenen Quellen | Quellenbelege, Verfallszeit, keine erfundenen Tatsachen |
| Code-/UI-Plan und Refactoring | leistungsfähiges Coding-Modell im isolierten Task-Kontext | Diff, Review, Build, Tests, Tokenbudget, kein Prod-Write |
| Echtzeit-Telefonie | Streaming-Sprachmodell oder Speech-Pipeline nach Latency/Qualität/Kosten-Test | minimale Gesprächsdaten, Provider-Timeout, Handoff, harte Minuten-/Budgetgrenze |
| Compliance-Auswertung | deterministische Kontrollregeln + KI zum Erklären/Zuordnen | Gesetzesversion und Evidenz, Human Review statt automatisch „konform“ |
| Browser-Aktionen | Planner + separater kontrollierter Executor | Zielbindung, serverseitige Freigabe, Session, Screenshot-Redaktion, Kill-Switch |

**Providerprinzip:** vorhandene ai-gateway-/ai-invoke-Routen ausbauen, keine unkontrollierte Schlüsselverwaltung je Produkt. Cloud/ EU-lokal nach Tenant-Policy, tatsächlichem Modell-/Hosting-Nachweis und Anbieter-AVV; Fallback nur innerhalb erlaubter Residenz. Kleine Modelle für Routine, leistungsfähigere für schwierige Entscheidungen, deterministische Guards für Sicherheit. Metriken pro Job: End-to-End-Erfolg, menschliche Nachbearbeitungszeit, Kosten je erfolgreichem Job, Fehlzusagen, Rollbacks, Laufzeit und Eskalationsquote.

## 8a. Konkrete Agentenrollen – eine kontrollierte Jobkette

**Nicht 20 dauerhaft autonome Agenten starten.** Pro Kundenauftrag gibt es einen verantwortlichen Job-Controller, der spezialisierte Worker nur bei Bedarf aufruft. Alle Worker geben strukturierte Ergebnisse zurück; sie bekommen *keine* ungeprüften Schreibrechte.

| Rolle | Aufgabe und Eingabe | Ausführung | Ergebnis / Stop-Bedingung |
| --- | --- | --- | --- |
| Intake & Intent | Voice-Nachricht oder Kundenprompt; Absicht + fehlende Angaben erkennen | kleines Modell, JSON-Schema, Bestätigung durch Nutzer | validierter Brief; bei Unsicherheit Rückfrage oder Human-Handoff |
| Knowledge Worker | nur autorisierte Website/FAQ/Dateien, Index und Quellversion | Berechtigungsfilter + Retrieval, ggf. kleines Modell | belegte Wissenskarte; bei fehlender Quelle keine Zusage |
| Voice Dialogue | sprachliche Echtzeitführung mit Unterbrechungen | geprüfter Streaming-Provider + strikte Tool-Allowlist | hörbare Antwort, ausdrücklicher KI-Hinweis, kein frei erfundener Buchungserfolg |
| Human-Handoff Worker | geprüfter Kontakt + Anliegen + Terminwunsch | deterministische Eingabevalidierung + vorhandene Ticket-/Inbox-Funktion | idempotent gespeicherter Vorgang und tatsächlicher Übergabestatus; sonst sichtbarer Fehler |
| App Architect | bestätigter Build-Brief, Tech-Constraints | leistungsfähiges Reasoning-/Coding-Modell | typisierte BuildSpec + überprüfbare TODOs |
| App Coder | BuildSpec und begrenzter Quellcodekontext | Coding-Agent in Sandbox | Commit/Diff/Artefakte; **keine** direkte Produktivmutation |
| Build QA | ausgebautes Artefakt und Testvertrag | deterministische Tests + optional KI zur Fehler-Triage | reproduzierbares Testprotokoll; Stop bei Auth-/RLS-/Build-Fehler |
| Browser Observer | vom Eigentümer freigegebene URL und Beobachtungsgrenzen | Playwright/Screenshot/DOM; REA nur als **separates autorisiertes Analysewerkzeug** | Quellen-/Layout-/Verhaltensbelege, keine automatische Aktion mit Außenwirkung |
| Visual Designer | Scan-Befund, Branding, UX-Brief | Multimodales Design-/Coding-Modell; bestehende SiteOS-Renderer | eigenständige Komponenten/Tokens/Preview, vorhandenes Backend unverändert |
| Governance Decision | geprüfte Session, Tool-Aktion, Ressource, Budget, Datentyp, Zweck | **deterministische Policy**, kein LLM als Autorisierungsinstanz | ALLOW, DENY oder REQUIRE_APPROVAL; fail-closed |
| Evidence Verifier | trace_id + Request-/Result-Hashes | bestehende Runtime Evidence/Hash-/Chain-Verifikation | belegt/ausstehend/abweichend, **nie** bloß „grün“ aus Modelltext |

### Modellwahl und Kostensteuerung

1. **Vor jeder Ausführung:** serverseitiger Tenant, Berechtigung, Datenresidenz, Rate-Limit, Budgetreservierung und erlaubte Tool-Scopes. Eine Modellentscheidung darf nichts davon umgehen.
2. **Model Routing:** schneller und günstiger Pfad für Klassifikation/Extraktion/FAQ; großes Coding-/Reasoning-Modell nur für schwierige Architektur- oder Codearbeit; Streaming-Audio nur während des freigegebenen Gesprächs.
3. **Eskalieren statt blind wiederholen:** Bei ungültigem Schema, Widersprüchen, Quellenlücken oder mehrfach misslungenem Build maximal begrenzte Retries, danach ein menschlich prüfbarer Fehlerbericht.
4. **Lokale Daten nur bei belegter Residenz:** der bestehende EU-lokal-Pfad ist kein Blankoscheck für alle Provider/Tools. Keine Fallback-Route außerhalb vertraglicher Tenant-Policy.
5. **Messen auf Auftragsebene:** Kosten je tatsächlich erfolgreicher Anfrage/Build/Publikation, Fehlerrate, mittlere Zeit bis zur menschlichen Übernahme, Anteil unbelegter Aussagen und Reopen-/Rollback-Erfolg.

### REA-Upstream und Namenskollision

Das öffentlich geprüfte Open-Source-Projekt ist **REA – Reverse Engineer Anything**: https://github.com/morluto/rea (MIT laut Upstream). Das Tool kann autorisierte App-, Website- und Runtime-Beobachtungen evidenzbasiert unterstützen; es ist **nicht** der in PR #2319 so bezeichnete RealSync **REA – Runtime Evidence Agent**. Integration ausschließlich als isolierter **Entwicklungs-/Analyseworker**, nicht als ungeprüfte Kunden-Runtime; vorher Lizenz, Berechtigungen, Setup, Node-Version, Abhängigkeiten und erlaubte Zielsysteme prüfen.

**Status dieses Arbeitsschritts:** Die öffentlich verfügbaren REA-Informationen wurden geprüft. REA wurde hier weder installiert noch gegen ein fremdes Produkt ausgeführt; es liegt kein tatsächlicher REA-Aufzeichnungslauf vor. Die vorliegenden Produktanalysen beruhen auf offener Dokumentation und dem verbundenen RealSync-Repository, nicht auf heimlich beobachteten Produktkonten.

## 9. Abnahmematrix (bewusst ohne erfundene Prozentreife)

| Produkt | Ein positiver End-to-End-Nachweis | Unverzichtbarer Negativnachweis | Freigabe |
| --- | --- | --- | --- |
| Voice | echter Testanruf → korrekte Anfrage → Inbox → menschliche Übergabe → prüfbarer Verlauf | Provider offline, nicht bestätigter Kalender, fremder Tenant, Kostenlimit | Nach nummern-/provider-/billing-/DSGVO-Test |
| App | reale App aus Brief generiert, in Sandbox gebaut, erneut geöffnet und getestet | fremde Tenant-Daten, Secret-Leak, fehlerhafter Build, ungeprüfter Deploy | Erst nach Preview/Revision/Test/Deploy-/Rollback-E2E |
| Site | Kundenseite rechtmäßig analysiert, eigenes Frontend persistent geändert und auf Testdomain veröffentlicht | unzulässige Quelle, API-Vertragsbruch, fremde Domain, defekter Rollback | Erst nach End-to-End-Publish und Abnahmescan |
| Governance | Risiko/Policy/Approval/Evidence zu einer echten Agentenaktion vollständig verknüpft | fremder Tenant, Replay, abgelaufene Genehmigung, Fail-open, fehlender Evidence-Eintrag | Erst nach autorisiertem Enforcement-/Export-E2E |

## 9a. Verifizierte Voice → Inbox-Brücke (19.11.2026, read-only)

**Eingang A – Twilio:** Der Codepfad supabase/functions/bot-voice-webhook/index.ts überprüft die Twilio-Signatur und bindet Mandant/Bot über die angerufene Nummer (voice_number_bindings), reserviert Gesprächsbudget und legt bei angenommenem Anruf mit upsertConversation(channel: voice, externalRef: CallSid) eine Konversation an. Aus einem gesprochenen Schritt werden Bot-Nachrichten gespeichert. Für Zeit-/Budgetende können voice-call-closing.ts und bot_voice_mark_callback einen Rückrufwunsch idempotent am existierenden Gespräch erfassen, sofern eine verwendbare Rufnummer existiert.

**Eingang B – Runtime:** In apps/agent-runtime/src/voice/tool-executors.ts ist handoff_human ausdrücklich not_configured. Ein Modell kann eine menschliche Übergabe vorschlagen, aber diese Runtime führt sie derzeit nicht aus. schedule_appointment schreibt maximal eine Anfrage im Zustand requested; es bestätigt keinen Kalendertermin. Ein echter Telefontransfer braucht einen gesonderten, sicherheits- und kostenbewerteten Executor samt Providerintegration, Policyprüfung und Negativtests.

**Produktionsabfrage (nur Summen):** public.bot_conversations enthält 4 Einträge, davon 0 im Kanal voice und 0 mit callback_status=erfasst. Die Spalten callback_status, callback_requested_at und callback_reason sind vorhanden. Ein Schema-/Bestandsbeleg, kein positiver Anruf-E2E.

**Bestehender Entwicklungszweig #2303:** Die Inbox-Triage zeigt und priorisiert mit Commit 38c07df7fae6e73226c763588c83bdc2740b34ea nun auch gespeicherte Rückrufwünsche. Dabei behauptet sie weder einen ausgeführten Rückruf noch eine bestätigte Weiterleitung. Nur React/TypeScript und Tests; keine Backend-/Provider-/Auth-/Policy-/Billing-/Migration-Änderung. Draft bis abgeschlossener CI/Abnahme.

**Nachweisabfolge vor Verkaufsfreigabe:**
1. Autorisierte Testnummer mit signiertem Provider-Webhook und positiver Nummernauflösung in einer Testumgebung.
2. Korrekt reservierter Anruf, KI-Hinweis, gespeicherte Konversation und Gesprächsschritt.
3. Testweise provoziertes Zeit-/Budgetende bei rückrufbarer Nummer: einmaliger Rückrufstatus erfasst, keine unbewiesene Kontaktzusage.
4. Kunden-UI zeigt denselben Vorgang beim richtigen Tenant nach Reload; fremder Tenant darf ihn nicht lesen.
5. Ein nach Freigabe implementierter Human-Handoff-/Rückruf-Bearbeitungspfad muss eigenen Ausführungserfolg beweisen, bevor die Inbox 'übergeben' oder 'erledigt' zeigen darf.
6. Einmaliges Kostenledger, Provider-Fehler, Replay, Consent, Kill-Switch, Datenschutz/Retention und Kündigung negativ testen.
## 10. Priorisierter Bau- und Freigabepfad

**P0 – Stopper:** Edge-Function-Kapazität/gezielter Deploy (#2333, #2279), Tenant-/RLS-/Policy-Sicherheitsprüfung, Voice-Handoff und Kostenreservierung, reale Provider-/Stripe-Abnahme. Gleichzeitig **aktuellen öffentlichen §-19-UStG-Text** der Live-Seite gegen die im Repo dokumentierte Regelbesteuerung prüfen; Änderung ist ein eigener freigabepflichtiger Legal/Pricing-Schritt.

**P1 – Ein funktionierender Kundenjob:** AI Receptionist für Handwerk → gespeicherte Anfrage → menschliche Übernahme; App- und SiteOS-Module bleiben kontrollierte Previews, solange End-to-End fehlt.

**P2 – Zwei Builder-Kundenjobs:** SiteOS-Frontend-Transformation mit unverändertem Backend und funktionierendem Publish; App Builder mit genau einem kanonischen BuildSpec-/Build-/Persistenzpfad.

**P3 – Governance als sichtbarer Produktnutzen:** Freigabe-/Evidence-Verlauf pro Aktion im bestehenden /app-Dashboard, Drilldown je Voice-/App-/Site-Job; keine zweite Plattform.

**P4 – Vertikalisierung:** weitere Branchen, Kalender-/CRM-Integrationen, Varianten/Experimente und Providerwahl nach beobachteten Pilotdaten statt nach Feature-Listen.

### Projekt-WIP-Regel und Umsetzungsstatus

Dieses Dokument ist ein **Docs-PR**, kein neues Feature. Solange über 20 PRs offen sind, untersagt .github/PR_TRIAGE_POLICY.md zusätzliche Feature-PRs. Bestehende WIP-Stränge erst konsolidieren. Bei Implementierung ausschließlich kleine, separat geprüfte Änderungen; keine automatische Produktionsfreigabe, keine Preisanpassung und keine Migration aus diesem Blueprint ableiten.

**Prüfstand:** Repo/PRs und Read-only-Supabase-Bestandszählung eingesehen. Kein Build, kein E2E-Test, kein Merge, kein Produktions-Deploy, keine neue Funktion aktiviert.