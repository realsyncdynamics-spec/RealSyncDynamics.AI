# RealSync Governed Inbox — MVP-Spezifikation

> **Status:** Entwurf / Hypothese · Stand 2026-11-07 · Autor: Dominik Steiner
> **Kein Bau-Auftrag.** Diese Spezifikation ist bis zur Klärung der Gabelungen
> in Abschnitt 0 nicht freigegeben. Sie ersetzt keinen Entscheid in
> [`docs/PRODUCT_PRIORITIZATION.md`](../PRODUCT_PRIORITIZATION.md).
> Alle Zielwerte, Zielgruppen- und Kostenaussagen sind **Annahmen**, keine Messwerte.

---

## 0. Abgleich mit Repo und Entscheidungen (vor jeder Umsetzung lesen)

### 0.1 Widersprüche zu bestehenden Entscheiden

| # | Spezifikation sagt | Repo sagt | Fundstelle | Folge |
|---|---|---|---|---|
| W1 | Primäre Zielgruppe: Dienstleister/Agenturen (1–25 MA, M365); Handwerk sekundär | K4: „zuerst Handwerk“ | `AGENTS.md` (Produkt), `docs/PRODUCT_PRIORITIZATION.md` K4 | Neuer Founder-Entscheid nötig (K5) oder Zielgruppe an K4 angleichen |
| W2 | Erster governter Workflow = E-Mail-Posteingang | Erster Kundenablauf = AI Receptionist (Anfrage, Kontakt, Terminwunsch, Übergabe an Menschen) | K4 „Erster Kundenablauf“; „Erst wenn dieser Ablauf durchgängig funktioniert und verkauft wird, folgen weitere …“ | Governed Inbox ist nach K4 ein **zweiter** Ablauf. Vorziehen nur per Entscheid |
| W3 | LLM-Aufrufe über EU-Endpunkt | `ai-gateway`: Cloud-Kette (Anthropic/OpenAI) in keinem Pfad; ohne lokalen/EU-Provider fail-closed 503; „EU-Anbieter kommen mit Gateway v2“ | `supabase/functions/ai-gateway/index.ts` Z. 23–25 | Ohne Gateway v2 bzw. einen freigegebenen EU-Anbieter ist F3/F5 heute **nicht betreibbar** |
| W4 | Starter-Plan, Preis offen | Preise nur aus `shared/pricing.ts`; K4 lässt Preise unverändert, neue Paketideen = Hypothesen | `AGENTS.md` (Claims und Preise), K4 „Ausdrücklich unverändert“ | Kein neuer Plan ohne Preisfreigabe; Kostenrechnung zuerst |
| W5 | Spec-Erfolgskriterium: „erste zahlende Kunden über Self-Service“ | Nordstern `PLAN_100.md`: 5–10 echte Pilotkunden; öffentliche CTAs nie Pilot/Demo/Call | `docs/PLAN_100.md`, `AGENTS.md` | Kein Widerspruch zum Self-Service, aber Ziel „10 Kunden“ ist eine Annahme |

**Empfehlung:** Die Inbox als **Kanal desselben Ablaufs** schneiden statt als neues
Produkt — „Anfrage per E-Mail“ ist eine Eingangsquelle des AI Receptionist
(Anfrage → Kategorie → Entwurf → Freigabe → Übergabe). Damit bleibt K4 gültig,
Handwerk bleibt Zielgruppe, und die Kategorien *Angebot/Anfrage* und *Termin*
landen im selben Posteingang wie Telefon/WhatsApp. Die Dienstleister-These wird
über die Discovery-Gespräche (Schritt 2 unten) geprüft, nicht vorab gebaut.

### 0.2 Bestand, der wiederverwendet werden kann (geprüft im Code, nicht produktiv verifiziert)

| Baustein der Spec | Vorhanden im Repo | Lücke |
|---|---|---|
| Auth & Workspace, Rollen | `requireAuthAndTenant` (`supabase/functions/_shared/auth.ts`), Memberships owner/admin/member | Rollenmapping Inhaber/Mitglied → owner/member festlegen |
| Microsoft 365 | `microsoft365-connect`, `microsoft365-audit-sync`, `_shared/m365/graph.ts`, Secret-Versiegelung `_shared/secretBox.ts` (AES-256-GCM) | Heutiger Connector ist **App-only (Client Credentials)** für `directory_audits`/`sign_ins`. Die Spec braucht **delegiertes OAuth** (Multi-Tenant-App, `Mail.ReadWrite`, `offline_access`), Refresh-Token-Speicher, Delta-Sync, Change Notifications |
| Audit-Trail mit Hash-Kette | `append_governance_evidence(p_row, p_expected_previous_hash)` (Migration `20260928140100_gate2_evidence_append_rpc.sql`), `src/core/runtime/evidence.ts` (SHA-256 über kanonisches JSON), Append-only-Anker (`20260901090000_evidence_append_only_anchors.sql`) | Ereignistyp „inbox_decision“ und Felder aus Abschnitt 6 abbilden; keine neue Kette bauen |
| Freigabe-Liste | `governance-approvals` (list/approve/reject, Evidence je Entscheidung), PDP-Approval-Gates | UI für E-Mail-Vorschläge; „ändern“ als dritter Ausgang |
| Posteingang / Übergabe | `/app/bots/inbox` (`src/features/bots/BotInboxView.tsx`: Konversationen, Termine, Bestellungen), `/app/leads` | E-Mail als weitere Quelle einhängen statt eigener Inbox |
| Webhook pro Kategorie | `webhook-deliver`, `webhook-dispatcher`, `webhook-retry-cron`, `governance-webhooks` | Kategorie-Trigger + Freigabe vor Auslieferung |
| Export CSV/PDF | `evidence-vault-export`, `evidence-export` (Feature `evidence_export` ab Starter) | Filter auf Inbox-Ereignisse |
| Löschung | `governance-erasure-sweeper`, `governance-dsr` | Workspace-Löschung inkl. Mail-Inhalte + Nachweis |
| Gmail | `gmail-organizer/` (Python, Labeling nach Absender, Einzelnutzer-OAuth) | Nicht MVP-fähig (Restricted Scopes/CASA), nur Referenz |

---

## 1. Ziel & Positionierung

Das MVP soll beweisen, dass kleine Betriebe für einen nachvollziehbaren
KI-Posteingang zahlen. Es ist kein zweites Produkt, sondern ein governter
Workflow von RealSync Dynamics AI.

**Kernsatz:** KI sortiert E-Mails, schlägt Aktionen vor und dokumentiert jede
Entscheidung — mit menschlicher Freigabe für alles mit Außenwirkung.

> Formulierungen wie „DSGVO-konform“ oder „auditierbar“ sind nach `AGENTS.md`
> Claims und dürfen öffentlich erst verwendet werden, wenn AVV, Subprozessor-Liste
> und EU-Verarbeitung (Abschnitt 7) nachweisbar stehen.

**Abgrenzung** zu Gemini in Gmail und Copilot in Outlook: dort generische
Triage. Hier: Branchenregeln, Übergabe ins CRM/Posteingang, Freigabe-Workflow
und ein prüfbarer Entscheidungspfad (Prüfpfad).

**Erfolgskriterium (Annahme):** erste zahlende Kunden über Self-Service, ohne
Einrichtungsgespräch. Zielwerte in Abschnitt 9.

## 2. Zielgruppe & Nicht-Ziele

- **Primär (Annahme, per Discovery zu bestätigen):** kleine Dienstleister und
  Agenturen, 1–25 Mitarbeitende, DACH, Microsoft 365. → **Kollidiert mit K4, siehe W1.**
- **Sekundär:** Handwerksbetriebe über eigene Branchenvorlage mit stark geführtem Onboarding.

**Nicht im MVP**
- Gmail-Anbindung (CASA-Assessment, siehe Abschnitt 3)
- automatischer Versand ohne menschliche Freigabe
- frei konfigurierbarer Workflow-Editor
- Training eigener Modelle auf Kundendaten
- Enterprise-Funktionen (SSO, SCIM, Datenresidenz-Auswahl)
- native CRM-Connectoren (stattdessen CSV und Webhook)

## 3. Integrationen

| Anbindung | Rolle | Zugriff | Hauptrisiko |
|---|---|---|---|
| Microsoft 365 (Graph API) | Kern, Phase 1 | OAuth, Multi-Tenant-App; delegiert `Mail.ReadWrite` + `offline_access`; Delta-Abfrage + Change Notifications | Mandanten können Nutzerzustimmung sperren → Admin-Consent (zu prüfen); Publisher-Verifizierung einplanen |
| IMAP | Option, Phase 2 | App-Passwort, verschlüsselt (`secretBox`); IDLE bzw. Polling; Entwürfe per `APPEND` in den Entwurfsordner | Ordnernamen, Rate Limits, Auth je Anbieter (IONOS, T-Online, Strato, All-Inkl) |
| Gmail (Gmail API) | Roadmap | Restricted Scopes (`gmail.readonly`, `gmail.modify`) | Google-Verifizierung + jährliches CASA-Assessment; ein Anbieter nennt ab 3.000 USD (Quelle laut Autor: Leviathan — nicht im Repo verifiziert) |

`gmail.send` allein käme ohne CASA aus, kann aber nicht lesen und taugt nicht für
Triage (Quelle laut Autor: Unified.to — nicht verifiziert).

**Auslöser für Gmail:** genug zahlende Kunden oder ein Geschäft, das die
Assessment-Kosten pro Jahr deckt. Schwelle folgt aus der Kostenrechnung.

## 4. Funktionsumfang

Interne Aktionen im eigenen Postfach laufen automatisch; alles mit Außenwirkung
braucht eine Freigabe.

| ID | Funktion | Verhalten |
|---|---|---|
| F1 | Registrierung & Workspace | E-Mail + Passwort oder Microsoft-Login; ein Workspace pro Firma; Rollen Inhaber und Mitglied |
| F2 | Postfach verbinden | M365-OAuth; Erst-Import der letzten 30 Tage (Annahme); danach Delta-Sync; Reconnect-Hinweis bei abgelaufenem Token |
| F3 | Klassifikation | Jede neue E-Mail: 1 von 6 Kategorien, Priorität (hoch/normal/niedrig), Konfidenz 0–1, Begründung in einem Satz |
| F4 | Interne Aktion | Ab Konfidenz-Schwelle (Standard 0,8): Outlook-Kategorie setzen, Ordner verschieben. Darunter: Vorschlag in der Review-Liste |
| F5 | Antwortentwurf | Entwurf im Firmen-Ton aus Textbausteinen; landet als Entwurf in Outlook; **nie** automatischer Versand |
| F6 | Freigabe-Liste | Vorschläge annehmen, ändern oder ablehnen; jede Korrektur fließt als Beispiel in künftige Klassifikationen des Workspace |
| F7 | Übergabe & Report | CSV-Export und Webhook pro Kategorie (nach Freigabe); wöchentlicher Report: E-Mails, Aktionen, Korrekturquote, geschätzte Zeitersparnis (als Schätzung gekennzeichnet) |

**Die 6 Kategorien**

| Kategorie | Beispiel | Standard-Aktion |
|---|---|---|
| Angebot / Anfrage | „Was kostet …?“ | Priorität hoch, Entwurf |
| Rechnung | Rechnung, Mahnung, Zahlungserinnerung | Ordner „Buchhaltung“, Webhook |
| Termin | Terminwunsch, Verschiebung | Priorität hoch, Entwurf |
| Lieferung | Versandbestätigung, Lieferschein | Ordner „Lieferungen“ |
| Support / Reklamation | Problem, Beschwerde | Priorität hoch, Entwurf, Webhook |
| Sonstiges / Werbung | Newsletter, Werbung | Ordner „Sonstiges“, Priorität niedrig |

Spam filtert Microsoft 365 selbst; „Sonstiges / Werbung“ fängt nur Werbung im Posteingang ab.

**Sicherheitsregeln aus `AGENTS.md` (gelten zusätzlich)**
- Workspace/Mandant, Rolle und Freigabe werden serverseitig ermittelt, nie aus dem Request-Body.
- Fail-closed: Fehler in Auth, Policy oder Kill-Switch → keine Aktion, nur Vorschlag.
- Webhooks mit Außenwirkung laufen erst nach Freigabe (Kategorie-Default „Webhook“ heißt: Vorschlag, nicht Automatik).
- „Korrektur fließt als Beispiel ein“ = Few-Shot-Beispiele **pro Workspace**, mandantengetrennt; kein Training (siehe Nicht-Ziele).

## 5. Architektur & technische Bausteine

Fluss: M365 → Sync-Worker → Klassifikation → Regel-Engine → (automatische interne Aktion | Freigabe-Liste) → Übergabe. Jeder Schritt schreibt in den Audit-Store.

| Baustein | Aufgabe im MVP | Bestand (siehe 0.2) |
|---|---|---|
| Web-App | Onboarding, Freigabe-Liste, Audit-Ansicht, Report | Vite/React, `/app/bots/inbox` erweitern |
| Auth & Workspace | Login, Mandantentrennung, Rollen | Supabase Auth + Memberships + RLS |
| Sync-Worker | Graph-Delta, Change Notifications, Token-Refresh, Retry mit Backoff | Neu; Muster aus `microsoft365-audit-sync` |
| Klassifikation | LLM über EU-Endpunkt; JSON (Kategorie, Priorität, Konfidenz, Begründung) | `ai-gateway` — **blockiert durch W3** |
| Regel-Engine | Schwelle prüfen, Aktion wählen, Entwurf aus Textbausteinen | PDP (`_shared/pdp/`) als Entscheidungsinstanz prüfen |
| Audit-Store | Append-only mit Hash-Kette, Export CSV/PDF | `append_governance_evidence`, `evidence-vault-export` |
| Übergabe | Outlook-Entwurf, Webhook pro Kategorie, CSV | `webhook-deliver`/`-dispatcher` |

**Offene Architekturfrage:** bestehender Stack oder eigener Dienst.
**Empfehlung:** bestehender Stack — Auth, Tenant-Isolation, Evidence-Kette,
Freigaben und Webhooks existieren bereits; ein eigener Dienst würde genau diese
Governance-Bausteine duplizieren.

## 6. Audit-Trail & Governance

Jede KI-Entscheidung erzeugt einen unveränderlichen, hash-verketteten Eintrag
(gleiche Kette wie die bestehende Evidence Chain, kein Parallelbau).

| Feld | Inhalt |
|---|---|
| `event_id`, `workspace_id` | eindeutige ID, Mandant |
| `message_ref` | Graph-Message-ID + SHA-256 des Inhalts, kein Klartext im Log |
| `received_at`, `decided_at` | Zeitstempel UTC |
| `model`, `model_version` | Anbieter und Modellname |
| `prompt_version`, `rule_version` | Version von Prompt und Kategorieregeln |
| `category`, `priority`, `confidence`, `reason` | Ergebnis der Klassifikation |
| `action`, `action_mode` | z. B. Kategorie gesetzt; automatisch oder vorgeschlagen |
| `reviewer_id`, `review_result` | wer freigegeben hat; angenommen, geändert, abgelehnt |
| `prev_hash`, `hash` | Hash-Kette für Manipulationsnachweis |

**Regeln**
- Kein Eintrag wird geändert oder gelöscht; Korrekturen sind neue Einträge.
- Inhaber sehen den Trail im Dashboard und exportieren ihn als CSV und PDF.
- Jede automatische Aktion ist mit einem Klick rückgängig; das Rückgängigmachen wird geloggt.
- Aufbewahrung offen (Vorschlag: Vertragslaufzeit + 12 Monate).
- **Zu klären:** `reason` ist vom LLM erzeugter Text und kann personenbezogene
  Daten aus der Mail enthalten. Entweder in der Datenminimierung (30 Tage)
  mitlöschen und nur Hash in der Kette halten, oder als strukturierte Begründung
  ohne Freitext erzeugen. Sonst widerspricht der Trail Abschnitt 7.

## 7. Datenschutz & Compliance ab Tag 1

Das MVP verarbeitet personenbezogene Daten Dritter (Absender, Inhalte). Vor dem
ersten zahlenden Kunden:

- [ ] AVV nach Art. 28 DSGVO als Klick-Vertrag im Onboarding
- [ ] Subprozessor-Liste öffentlich (Hosting, LLM-Anbieter, E-Mail-Versand)
- [ ] Verarbeitung und Speicherung in der EU; LLM-Aufrufe über EU-Endpunkt mit vertraglichem Trainingsausschluss
- [ ] Datenminimierung: Inhalte nur solange die Freigabe offen ist (Vorschlag: max. 30 Tage), danach nur Metadaten und Hash
- [ ] Löschung des Workspace inkl. aller Inhalte binnen 30 Tagen nach Kündigung
- [ ] Verschlüsselung: TLS im Transport; Tokens und App-Passwörter verschlüsselt at rest
- [ ] Datenschutzerklärung und Verzeichnis von Verarbeitungstätigkeiten ergänzt
- [ ] Einordnung nach EU AI Act dokumentiert (Annahme: kein Hochrisiko-System; Transparenzpflichten prüfen)

Die Punkte sind Produktanforderungen, keine Rechtsprüfung. AVV und
Datenschutzerklärung vor dem Launch juristisch gegenlesen lassen.

## 8. Risiken

| Risiko | Folge | Gegenmaßnahme |
|---|---|---|
| KI-Kosten pro E-Mail höher als gedacht | Starter ohne Marge | Kostenrechnung je E-Mail vor Preisfestlegung; kleines Modell für Klassifikation, großes nur für Entwürfe |
| Admin-Consent in M365-Mandanten | Self-Service bricht ab | Consent-Hilfeseite für Admins; Abbruchrate im Onboarding messen |
| Fehlklassifikation wichtiger Mails | Vertrauensverlust | Konfidenz-Schwelle, Freigabe-Liste, Rückgängig per Klick |
| Native KI in Outlook wird besser | weniger Abgrenzung | Fokus auf Prüfpfad, Branchenregeln, Übergabe |
| Solo-Betrieb und Support | Zeitengpass | kein Custom-Build, Self-Service-Doku, nur E-Mail-Support |
| Kein EU-LLM-Provider im Gateway (W3) | F3/F5 nicht betreibbar | Gateway v2 / EU-Anbieter vor Sync-Worker entscheiden |
| Fokusverlust gegenüber K4 (W1/W2) | zwei halbe Abläufe statt einem verkauften | Inbox als Kanal des AI Receptionist schneiden |

## 9. Akzeptanzkriterien & Erfolgsmessung

**Technisch (MVP fertig, wenn alle erfüllt)**
- [ ] Neuer Nutzer verbindet ein M365-Postfach ohne Hilfe in unter 5 Minuten.
- [ ] Neue E-Mails sind spätestens 2 Minuten nach Eingang klassifiziert.
- [ ] Zu jeder Klassifikation existiert ein vollständiger Audit-Eintrag mit gültiger Hash-Kette.
- [ ] Kein Entwurf wird ohne Freigabe versendet (Test: 0 Sendevorgänge über die API; zusätzlich: App fordert keinen `Mail.Send`-Scope an).
- [ ] Token-Ablauf und Verbindungsabbruch werden erkannt und angezeigt.
- [ ] Workspace-Löschung entfernt alle Inhalte nachweisbar.

**Geschäftlich (Zielwerte = Annahmen, keine Messwerte)**

| Kennzahl | Ziel |
|---|---|
| Klassifikations-Genauigkeit auf Testset (200 echte, anonymisierte E-Mails) | ≥ 85 % |
| Korrekturquote in der Freigabe-Liste nach 2 Wochen | ≤ 15 % |
| Trial-Nutzer, die ein Postfach verbinden | ≥ 60 % |
| Trial → zahlend | ≥ 10 % |
| Erste zahlende Kunden ohne Gespräch | 10 |

## 10. Offene Entscheidungen

1. **K5 (neu, Founder):** Inbox vorziehen, als Kanal des AI Receptionist schneiden oder nach K4 hinten anstellen? (W1/W2)
2. Dienstleister/Agenturen oder Handwerk als erste Zielgruppe?
3. Welcher LLM-Anbieter mit EU-Endpunkt — und wann kommt Gateway v2? (W3)
4. Tech-Stack: bestehender RealSync-Stack (Empfehlung) oder separates Modul?
5. Preis und Limits — erst nach Kostenrechnung und Preisfreigabe (`shared/pricing.ts`).
6. Aufbewahrungsdauer Audit-Einträge und Umgang mit `reason`-Freitext.

## 11. Nächste Schritte

1. Kostenrechnung je E-Mail (Tokens, Modell, Storage, Infrastruktur, Zielmarge je Plan)
2. 5–10 Discovery-Gespräche zur Zielgruppen-Entscheidung, ohne Pitch
3. Microsoft-Entra-App registrieren und Publisher-Verifizierung starten
4. Testset aus 200 anonymisierten E-Mails für die Genauigkeitsmessung aufbauen
5. Entscheid K5 in `docs/PRODUCT_PRIORITIZATION.md` festhalten, bevor Code entsteht

---

*Erstellt: 2026-11-07 · Quelle: MVP-Spezifikation von Dominik Steiner · Ist-Abgleich gegen `main` (Stand Commit `c8af738`), nur Code gelesen, nichts produktiv verifiziert.*
