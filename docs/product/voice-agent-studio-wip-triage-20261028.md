# Voice Agent Studio — WIP-Triage, Bestandsaufnahme und Implementierungsfreigabe

**Stand:** 2026-10-28  
**Bezug:** RealSyncDynamics.AI `main@fd2b6c0`  
**Status:** Dokumentierte Zielarchitektur und PR-Entscheidungsgrundlage; **keine** Freigabe für Preise, Migrationen, Merge, Deployment oder reale Anrufe.

## 0. Warum zunächst keine neue Feature-PR entsteht

Am 2026-10-28 liefert `GET /pulls?state=open&per_page=100` **29 offene PRs**. Die verbindliche `.github/PR_TRIAGE_POLICY.md` untersagt neue Feature-PRs bei mehr als 20 offenen PRs. Diese Dokumentation ist eine reine Bestands- und Triage-Unterlage zur Anwendung der PR-Policy. Sie ändert weder öffentliche Claims noch Preise, Datenbanken, Runtime oder Frontend. Die in §6 genannten Feature-PRs sind **Vorschläge, keine jetzt angelegten PRs**.

Weitere verbindliche Regeln:
- Sicherheits-PRs vor Features; Migrationen einzeln, nicht parallel; Hotspot `src/App.tsx` seriell bearbeiten.
- Landing-Claims, Preis-, Steuer- und Rechtstextänderungen nur nach Einzel-Freigabe.
- Kein Merge auf `main`, kein Deploy ohne eigene Freigabe.
- In `docs/PRODUCT_FOCUS.md` ist die Governance Runtime Kernprodukt. Voice ist ein abgegrenztes, governantes Anwendungsmodul, keine zweite Runtime.
- `CLAUDE.md` ist für Stack und aktuelle Homepage maßgeblicher als der veraltete Landing-V4-Stand in `AGENTS.md`.

## 1. Quellennachweis und Bestands-Gap

Eine Code-Datei oder ein „live“-Flag beweist **keinen aktuellen End-to-End-Produktionsbetrieb**. Die folgende Bewertung beruht auf eingesehenen Repo-Dateien/PR-Beschreibungen; Produktions-DB, Secrets, echte Nummern, Webhooks und Testanrufe wurden nicht geprüft.

| Fähigkeit | Code-Befund | Ziel / Lücke |
|---|---|---|
| Öffentlicher Telefonbot-Einstieg | `src/App.tsx`: `/phonebot/start` → `PhonebotStartPage`, CTA → `/app/bots` | Noch kein branchenspezifischer Self-Service-Wizard |
| Verwaltung von Bots | `/app/bots`, `/app/bots/:botId`, `/app/bots/inbox`; `BotsView`, `BotBuilderView`, `BotInboxView` | Derzeit CRUD-/Konfigurationsansicht, kein durchgängiger kundenverständlicher Aktivierungsprozess |
| Branchenkonfiguration | `src/features/bots/types.ts`: `BotVertical = 'general' \| 'restaurant'` | Handwerk, Medizin, E-Commerce etc. fehlen als geprüfte Vorlagen; Restaurant-Bestandsfunktionen nicht duplizieren |
| Voice-Audits | `/app/voice`, `/app/voice/:sessionId`; `voiceApi.ts` liest `voice_sessions`, Requests, Executions und Evidence mandantengebunden | Mit Bot-Konversationen und Kundenergebnissen verknüpfen, ohne separate Daten-/Auth-Welt |
| Bot-Laufzeit | Funktionen `bot-chat`, `bot-voice-webhook`, `appointment-book`, `order-intake` im Repo; `docs/product/bots.md` dokumentiert Twilio | Aktuelle produktive Bereitstellung, sichere Tool-Rechte, Nummernprovisionierung und echte Sprachqualität erst live nachweisen |
| Stripe | Checkout, Portal, Webhook und Metering existieren im Repo | Voice-Produktkatalog/Entitlements, Zahlungs- und Aktivierungs-Verknüpfung E2E validieren |
| Mandanten | `src/core/access/TenantProvider`; `bots`-CRUD mit Tenant-Filter; RLS-Dokumentation | Onboarding und Provisionierung benötigen serverseitige Rollen-/Tenantbindung |
| Voice-Bereitstellung | PR #1998 (Draft): ElevenLabs-Tenant-Agenten, Reconcile, Entitlement-Gating | Nicht gemergt; Integration nach Sicherheits-/Migrationsfreigabe, keinen zweiten Provisioner bauen |
| Voice-Sicherheit | PR #1994 (Draft): Runtime-Rechte, Consent-Fail-Closed, Tool-Args-Bindung | Sicherheitsgate, vor produktiven Tool-Schreibaktionen separat abnehmen |
| Kosten-/Telefonlimit | PR #2044 (Draft): atomare KI-/Voice-Budgets, Ledger, Rate-Limits; PR #2046 (Draft, gestapelt): Abschlussansage/Rückruf | Offene Budgetentscheidung A/B, Minutengrenzen, Verabschiedung nicht in jedem Timing garantiert; Blocker für Self-Service-Live-Aktivierung |
| Produktverfügbarkeit | `src/config/platform-capabilities.ts` führt `bots: live`, Messdatum 2026-08-23; `docs/product/implementation-status.md` führt `voice-telephony: coming-soon` | Statuskonflikt durch erneute Produktionsmessung lösen; **nicht** allein wegen eines Registry-Flags verkaufen |
| Preise / Entitlements | `shared/pricing.ts` ist Preis-SSoT, `docs/product/bots.md` nennt Voice ab Agency; `BotsView` nennt „Bots ab Growth“; Bestandsdokumentation teils abweichend | Auf maßgeblichen serverseitigen Entitlement-Stand abgleichen; keine neuen Preise hardcoden oder veröffentlichen |
| Human Handoff | `docs/product/entitlement-reality-map.md` dokumentiert fehlenden Mechanismus | Reale Übergabe-/Fallback-Tests nötig, bevor als voll verfügbar beworben |
| Datenschutz | Generische Governance-/Evidence-Module vorhanden | Voice-spezifische Information, Aufzeichnung/Transkription, Retention, AVV- und Branchenprüfung je Prozess nötig |
| UX Onboarding | Bestehende Unified-Entry-, Auth- und Onboarding-Routen | Branchenauswahl, Wizard-Speicherstände, Integration-Status, Testfreigabe und Aktivierung als Erweiterung entwickeln |

**Wichtig:** Veraltete Dokumente sind keine Produktionsmessung. `docs/ARCHITECTURE_CURRENT.md` stammt vom 2026-08-13 und nennt zum Teil ältere Landingpfade; das tatsächliche Routing in `src/App.tsx` hat Vorrang.

## 2. Zielbild: eine Plattform, keine doppelte Laufzeit

```text
/voice-agents (Marketing/Branchenauswahl; späterer Feature-PR)
  -> Auth / vorhandener TenantProvider
  -> /app/voice-studio/start (Wizard und gespeicherter Entwurf)
  -> Branchen-Template (versioniert; serverseitig validiert)
  -> existierende bots / bot_* Funktionen und Voice-Module
  -> Test-/Simulation (keine bezahlte Nummer notwendig)
  -> vorhandenes Stripe-Checkout + verifiziertes Entitlement
  -> Telefonprovider-Provisionierung (idempotent, statusbehaftet)
  -> Activation Gate (Policy + Tests + Budget + Routing + Zahlung)
  -> Agent aktiv -> Bot-Inbox / Voice-Sessions / Evidence / Usage / Billing
```

Bestandsnutzen strikt wiederverwenden:
- **Frontend:** Vite/React/Router/Tailwind, keine weitere React-App/Next.js-Ebene.
- **Identität:** Supabase Auth, TenantProvider und RLS. Ein Onboarding-Lauf gehört genau einem durch Session und Mitgliedschaft aufgelösten Tenant.
- **Agent:** Bestehendes `bots`-Modell, kanalgebundene Einstellungen und Voice-Evidence; neue Konfiguration bei Bedarf versioniert ergänzen.
- **Abrechnung:** `shared/pricing.ts` und serverseitige Produkt-/Entitlement-Zuordnung; kein zweiter Stripe-Vertrag.
- **Telefonie:** vorhandenen Twilio-/Webhook-Pfad und geprüfte Provisionierung aus #1998 untersuchen; LiveKit/OpenAI Realtime nur bei nachgewiesenem Bedarf und mit Kostentest.
- **Governance:** Bestehender Prüfpfad, Policy Engine, Approvals und Evidence; bei jeder privilegierten Tool-Ausführung Event dokumentieren.

## 3. Einfache Customer Journey (10 Schritte)

1. Branche wählen: **Handwerk**, **Arztpraxis**, **E-Commerce** als geplante erste drei vertikale Produkte.
2. Firmen- und Kontaktdaten eingeben; Zeitzone und Öffnungszeiten.
3. Eigene Website/Dateien/FAQ als autorisierte Wissensquelle anbieten; Quellenstatus und Extraktionsfehler sichtbar machen.
4. Stimme, Ansprache, Sprachen und KI-Hinweis wählen.
5. Fähigkeiten aus einer **serverseitigen Allowlist** wählen (Annahme, Rückruf, Kalender lesen, Terminwunsch, ggf. verbindliche Buchung).
6. Kalender/CRM/Shop mit OAuth/offiziellen APIs verbinden; bei nicht unterstützten Systemen geführte Integrationsanfrage.
7. Browser-Testcall und branchenspezifische Simulationen; Ergebnisse und Fehler darstellen.
8. Nummer/Weiterleitung wählen; Telekom-Provider-Verifikation ggf. als ausstehend markieren.
9. Verbindlichen Tarif mit echter Kostenoffenlegung wählen und via Stripe bezahlen.
10. Erst bei erfüllten technischen, rechtlichen und kostenbezogenen Voraussetzungen aktivieren; Status und notwendige nächste Handlung jederzeit sichtbar.

**UX-Regel:** Ein nicht eingerichteter oder nicht freigegebener Schritt ist kein grünes Häkchen. Demo-Werte niemals als echte Kundenvorgänge ausgeben.

## 4. Aktivierungszustände und atomare Verträge

Empfohlene domänenweite Zustandsmaschine (möglichst im vorhandenen Schema abbilden):

`draft -> configured -> testing -> ready_for_checkout -> payment_pending -> provisioning -> activation_review -> active`

Alternative Übergänge: `needs_attention`, `suspended`, `failed`, `archived`.

Invarianten:
- `active` ausschließlich serverseitig, nach authentifiziertem Tenant und berechtigter Rolle.
- Nur `verified_paid_entitlement && provider_route_ready && tests_passed && disclosure_ready && budget_configured && allowed_tools_valid && handoff_configured` darf `activation_review -> active` passieren.
- Idempotenz über eindeutige Provider-/Checkout-/Provisioning-Ereignisse, keine browserseitige Erfolgsbehauptung nach Stripe-Redirect.
- Fehlendes/ungültiges Budget **fail-closed**; laufender Anruf mit kontrollierter, getesteter Ansage/Übergabe, keine bewusst stumme Trennung.
- Produktive Schreibtools benötigen überprüften Anrufer-/Patientenkontext, zweckgebundene Berechtigung und ggf. ausdrückliche Bestätigung.
- Outbound Cold Calling kein frei zugängliches Starter-Feature; rechtliche Freigabe und spezifischer Zweck nötig.
- Medizinische Vorlagen ohne Diagnosen; Notfälle mit klarer Eskalationslogik.

## 5. Minimaler Branchenumfang für echten Marktstart

| Produkt | Erster verkaufsfähiger Scope | Außerhalb des Erst-Releases |
|---|---|---|
| Handwerk | Öffnungszeiten, Leistungen, Anfragen, Notdienstvorsortierung, Rückruf, Terminwunsch | Verbindliche Preisgarantien ohne Angebotsdaten, autonome Vertragsabschlüsse |
| Arztpraxis | Telefonempfang, organisatorische Informationen, Terminwünsche, sichere Rückrufaufnahme, Notfallhinweis | Diagnose, Behandlungsentscheidung, ungeprüfte PVS-Privat-API, medizinische Daten ohne Rechts-/Sicherheitsfreigabe |
| E-Commerce | Artikelnummern, autorisierte Katalogsuche, Versand-FAQ, Rückruf; Bestellstatus nur mit geeigneter Verifikation | Frei erfundene Lieferzeiten/Preise, Bestelländerung ohne starke Authentisierung |

Jede Vorlage hat explizit: `template_id`, Version, Skill-Allowlist, Pflichtfelder, Default-Disclosure, Quellenregeln, Testfälle, Fehler-/Handoff-Verhalten und Freigabestatus. Keine Prompt-Selbsterweiterung ohne Review.

## 6. Priorisierte Folge-PRs (NUR Plan; bei WIP-Stopp NICHT anlegen)

Die Reihenfolge ist eine Abhängigkeit, keine pauschale Merge-Erlaubnis:

| Reihenfolge | Arbeitspaket / idealer kleiner PR | Blocker / Abnahme |
|---|---|---|
| S0 | Bereits offene **#1994**, **#2044**, **#2046** sicherheitsseitig einzeln prüfen und entscheiden | Security-Priorität; #2046 ist auf #2044 gestapelt; Budget A/B, Ansagen und echte Live-Tests offen |
| S1 | #1998 Voice-Provisioning gegen abgesicherte Runtime/Entitlements abgleichen | Eigene Migrationsfreigabe; Provider-Failover und Deaktivierung verifizieren |
| P1 | Branchen-Template-Schema und isolierte Typ-/Fixture-Tests, ohne neue Tabellen falls nicht nötig | Nach WIP-Reduktion; unabhängig von Hotspot |
| P2 | Öffentliches Voice-Angebot und Branchenkarten (ohne unbelegte Claims und nicht freigegebene Preise) | Einzel-Freigabe für Landing-Claims, Route `src/App.tsx` als Hotspot seriell |
| P3 | Authentifizierter Wizard: Tenantbindung, Draft, Resume, Validierung | RLS-/Rollen-/Playwright-Tests |
| P4 | Knowledge-Import, FAQ, präzise Hybrid-Suche + Quellenprüfungen | Authorisierung, SSRF, Rate-Limit, Datenschutz |
| P5 | Providerunabhängiger Browser-Test + Gesprächsevaluation | Keine automatische Produktivnummer, Testbudget |
| P6 | Stripe/Entitlement/Provisioning/Activation-State-Machine | Kontrollierte Migrationen, idempotente Webhooks, Budget- und Abuse-Gate |
| P7 | Reporting: Inbox, Usage, Qualität, Versionen, Wissenslücken | Mandantentrennung, Lösch-/Aufbewahrungstests |
| P8 | Branchenfreigaben in Reihenfolge Handwerk → E-Commerce → Arztpraxis | Für Arztpraxis gesonderte Gesundheitsdaten-/Legal-Prüfung |

## 7. Zwingende technische Abnahme

**Ein durchgehender, testbarer Handwerkskunden-Fall**:
- Neuer Nutzer registriert sich über vorhandene Auth, wird eindeutig Tenant zugeordnet, wählt Handwerk und legt einen Draft an.
- URL/FAQ werden nur nach Autorisierung importiert; Quelle, Importfehler und Version sichtbar.
- Wählt Stimme, KI-Hinweis, Rückruf und Terminwunsch; unerlaubte Fähigkeiten bleiben serverseitig gesperrt.
- Browser-Test führt ein echtes Gespräch mit Tool-Trace; Test-Budget kann nicht überschritten werden.
- Stripe-Checkout startet über vorhandenen serverseitigen Pfad; nur verifizierter Webhook schaltet Entitlement frei.
- Nummer wird nur mit Providerbestätigung aktiv; jedes fehlende Gate erklärt `needs_attention`.
- Ein echter erlaubter Inbound-Test führt zu `bot_conversations`/Evidence/Usage; Cross-Tenant-Read bleibt 403/leer.
- Bei abgelaufenem Budget oder Providerfehler saubere Terminierung und Rückruf-Fallback, keine irreführende Erfolgsmeldung.
- Agent lässt sich pausieren; danach keine neuen beantworteten Anrufe.
- Unit, RLS, E2E, Security-Regression, Build und Produktions-Smoke-Test sind nachvollziehbar dokumentiert.

## 8. Kritische offene Entscheidungen (kein stillschweigender Default)

1. **PR-Triage:** Welche PRs werden geprüft/gelöst, damit <=20 offen sind? Kein Schließen ohne inhaltliche Prüfung.
2. **#2044 / #2046:** Budget A/B, Limit-/Ansagefenster, echtes Verhalten bei stummem Hangup, Einbindung in USD-Mandantengrenze.
3. **#1998:** Provider-Ausfallverhalten; zahlende Kunden nicht mit unbemerktem Voice-Ausfall zurücklassen.
4. **Preislogik:** Voice als bestehendes Modul, separates Add-on oder produktbasierter Tarif? SSOT und verbindliche Einzel-Freigabe.
5. **Telefonie:** EU-Region, Telefonnummernbestand, Nummernkauf-/Portierungsnachweise, zulässige Aufzeichnung und Löschfrist.
6. **Realitätsprüfung:** Live-Funktionsliste und produktiver Voice-Call; `platform-capabilities.ts` und `implementation-status.md` widersprechen sich.

## 9. Nächster erlaubter Schritt unter WIP-Stopp

Eine **Triage-Liste** der 29 offenen PRs nach Security, Fix/CI, Legal/Pricing, Landing, Feature und Migration erstellen. Jeden Schließ-/Rebase-/Merge-Vorschlag mit individueller Begründung vorlegen. Keine PR-Schließung ohne Vergleich mit `main` und Owner-Freigabe in den geschützten Kategorien.

Nach Abbau der WIP-Sperre den kleinsten unabhängigen Feature-PR **P1: Branchen-Template-Schema mit Tests** starten. Öffentliche Website und Stripe-Anbindung erst nach entsprechenden Gates.

### Nachweisgrenze

Die Bewertung ist ein **Code- und PR-Inventar**, keine Live-Zertifizierung. Es wurden in dieser Triage keine DB-Änderungen, Secrets, Provider-Verbindungen, Zahlungen oder Anrufe ausgeführt.
