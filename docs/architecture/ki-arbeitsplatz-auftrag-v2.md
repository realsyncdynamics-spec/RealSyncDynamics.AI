# KI-Arbeitsplatz – Auftrag v2 (konsolidiert)

Stand: 01.11.2026 · Status: **geplant, nicht implementiert**
Grundlage: [`ki-arbeitsplatz-w0-1-bestandsabgleich.md`](./ki-arbeitsplatz-w0-1-bestandsabgleich.md) und W0 in [`docs/ARCHITECTURE_CURRENT.md`](../ARCHITECTURE_CURRENT.md) (#2055).
Bei Widerspruch zwischen diesem Dokument und Code gilt der Code (AGENTS.md). Widersprüche zu #2055 sind in Abschnitt 4 als offene Entscheidungen geführt.

---

## 0. Sperren

W1 beginnt erst, wenn:

1. Gate 4 (Budget-Governance und Telefonreserve, Draft-PR #2088) mit CI- und Testnachweis abgenommen ist,
2. PR C (Anfragen-Posteingang mit Übergabe an Menschen) als Draft vorliegt,
3. ein Environment-Gate für `db push` eingerichtet ist,
4. das P0-VPS-Audit abgeschlossen ist, soweit n8n oder VPS-Dienste berührt werden,
5. die Entscheidungen E1–E9 (Abschnitt 4) getroffen sind.

Freigaberahmen für Agenten: lesen, Doku, Draft-PRs mit additiven Migrationen und Tests. Nicht enthalten: Merge, Deploy, destruktive Migration, Rechteausweitung, Preise/Stripe/Entitlements, DNS, neue kostenpflichtige Anbieter.

---

## 1. Ziel

Kunden beauftragen Aufgaben in natürlicher Sprache und verfolgen Ausführung, Ergebnisse, Kosten und Freigaben im Dashboard. Der Arbeitsplatz verbindet Unternehmenswissen, Verbindungen, versionierte Skills und Routinen. Er ergänzt Onboarding, Landingpage-Builder (SiteOS) und Kundenassistenten; er ersetzt nichts.

Erster Ablauf (nach PR C):
Wissen bestätigen → Skill „Landingpage erstellen“ (SiteOS) → Entwurf → Vorschau → Formular testen → Veröffentlichung nach Freigabe → Testanfrage → Anfrage im Posteingang → interne Zusammenfassung als Aufgabenergebnis. Danach: Tagesübersicht als manuell startbare Routine.

---

## 2. Architektur

### 2.1 Oberfläche
- Kundenmodus des Command Centers (`src/features/command-center/`), Kundenroute `/app/arbeitsplatz` als Alias. Admin-Sichten erscheinen im Kundenmodus nicht.
- Begriffe im Kundenmodus: Aufgaben, Ergebnisse, Freigaben, Routinen, Wissen, Verbindungen, Verbrauch. Keine internen Begriffe (Policy, Evidence, Runtime).
- Mobile Mindestaktionen: Aufgabe starten, Ergebnis ansehen, Entwurf prüfen, Freigabe erteilen, Anfrage übernehmen, Routine pausieren, Assistent stoppen, Budgetstatus prüfen. Kein Terminal, kein SSH.

### 2.2 Aufgaben
- Kanonisch `agent_tasks`, Status über `board_status` und `move_agent_task`.
- Additiv: `board_status`-Werte `scheduled`, `waiting_external`, `uncertain`, `cancelled` (CHECK erweitern, bestehende Werte unverändert); Spalten `skill_version_id`, `requested_by`, `idempotency_key` (unique je Mandant), `budget_reservation_id`, `result_refs`.
- UI-Abbildung: `scheduled`/`planned` = eingeplant · `backlog` = wartet · `in_progress` = läuft · `awaiting_decision` = wartet auf Freigabe · `waiting_external` = wartet auf externen Dienst · `done` = abgeschlossen · `blocked` mit Fehler = fehlgeschlagen · `cancelled` = abgebrochen · `uncertain` = Ergebnis bzw. Verbrauch ungeklärt.
- Lease über vorhandene `claimed_by`/`claim_expires_at`. `evidence` (Pflicht bei `done`) nimmt Ergebnisverweise auf.
- Neu: `agent_task_steps` (Schrittart, Status, Quellen, Werkzeugaufruf, `idempotency_key`, Versuchszähler). Nur idempotente Schritte werden nach Neustart wiederholt; externe Aktionen nur mit Idempotenzschlüssel.
- Vor jeder Erweiterung: Regressionstest für `move_agent_task`, `TaskBoard.tsx` und bestehende Schreiber.

### 2.3 Kundenassistenten
- Kanonisch `bots` + `bot_conversations` + `bot_messages`, Kanäle über `whatsapp_channels` und den bestehenden Voice-Pfad.
- `bot_agents` weder erweitern noch neu anbinden; Referenz in `src/features/governance/voice/voiceApi.ts` als Befund, nicht umbauen.
- Interne Agenten (`agent_profiles`, `agent_configuration`, `agent_config_versions`) bleiben Admin-Sicht.

### 2.4 Routinen
- Kanonisch `agent_routines` + `agent_routine_runs`. Keine neue Tabelle.
- Additiv: `timezone` (IANA), `trigger_kind`, `skill_version_id`, `budget_limit`, `on_error`, `max_retries`, `owner_user_id`, `status` (aktiv/pausiert/deaktiviert), `frozen_scope`.
- Worker erzeugt je Lauf eine `agent_tasks`-Zeile und schreibt den Lauf aus der Antwort der ausführenden Funktion. pg_cron „succeeded“ ist kein Erfolgsnachweis.
- Verhalten festlegen für Sommerzeitwechsel, verpassten Zeitpunkt, doppeltes Ereignis, Parallellauf, Anbieterausfall, abgelaufene Verbindung.
- Kein Cron-Job ohne eigenen Cron-Key. Keine Funktion mit `requireServiceRole()` als Routinenziel.
- Aktivierung erst nach erfolgreichem Testlauf; nie automatisch durch Abschluss des Onboardings.

### 2.5 Wissen, Skills, Freigaben, Budget
- **Wissen:** `agent_knowledge_base` additiv erweitern (E3): Status bestätigt/Entwurf/extrahiert, Herkunft, Version, Aktualisierungsdatum, Verarbeitungsstatus, Zuordnung. Neue Angaben, die verbindliche Fakten ändern würden, nur als Vorschlag. Externe Inhalte sind Daten, nie Anweisungen. Schreibpfade für Kundenwissen erzwingen `tenant_id`.
- **Skills:** `automation_skills` bleibt Katalog. Neu `skill_versions` (Version, Owner, Eingaben, Wissensquellen, erlaubte Werkzeuge, Ergebnisformat, Kosten-/Laufzeitgrenze, Freigabepflicht, Entwurf/aktiv). Ausführung als Edge Function (E4). Ein Skill erhält Werkzeuge nur aus seiner freigegebenen Version; generierte Skills bleiben Entwürfe.
- **Freigaben:** Freigabetabelle nach E7. Keine dritte Freigabetabelle. Freigabe am konkreten Ergebnis (Was, wo, für wen, Kosten).
- **Budget:** jeder KI-Aufruf über `runAiTool` → `cost_check_and_reserve` (Mandantendeckel, #2055). Zusätzliches Kanalbudget nach E9. Unklarer Verbrauch intern als „geschätzt“, nicht fakturiert; Korrekturen append-only.

### 2.6 Ausgeschlossen
- `kodee`, `vps_connections`, `terminal_approvals`: kein Bestandteil, keine Kundenfunktion mit Shell- oder SSH-Wirkung.
- Legacy-Tabellen (`autonomous_*`, `hermes_*`, `token_usage`, `api_usage`, `usage_counters`, `agent_token_usage`, `runtime_approval_gates`) nicht neu nutzen; Regressionstest gegen Neunutzung (E5).

---

## 3. Abnahmekriterien W1

1. Arbeitsbereich A liest keine Quellen, Aufgaben oder Ergebnisse von B.
2. Skill nutzt nur freigegebene Werkzeuge.
3. Manipulierte Wissensquelle verändert keine Berechtigungen.
4. Entwürfe werden nicht automatisch veröffentlicht.
5. Doppelte Ereignisse erzeugen keine doppelten externen Aktionen.
6. Fehler und Timeouts führen nicht zur unbegründeten Budgetfreigabe.
7. Parallele Aufgaben umgehen das Budget nicht.
8. Neustarts verlieren keine Aufgaben und erzeugen keine unkontrollierten Wiederholungen.
9. Abgebrochene Aufgaben starten keine freigabepflichtigen Aktionen.
10. Skill-Änderungen verändern laufende Aufgaben nicht unbemerkt.
11. Ergebnisse bleiben auf 375 px abrufbar.
12. Bestehende Kundeninfrastruktur (Website, CMS, DNS) bleibt unverändert.
13. Schätzungen werden nicht abgerechnet.
14. Kunden sehen im Kundenmodus keine Admin-Sichten und keine Daten anderer Mandanten.
15. `move_agent_task` und `TaskBoard.tsx` verhalten sich für bestehende `board_status`-Werte unverändert.
16. Kein Code-Pfad des Arbeitsplatzes referenziert `bot_agents`.
17. Ein Routinenlauf mit HTTP-Fehler erscheint in `agent_routine_runs` als fehlgeschlagen, auch wenn pg_cron „succeeded“ meldet.
18. Kein Arbeitsplatz-Pfad erreicht `kodee` oder eine Funktion mit SSH-Wirkung.

---

## 4. Offene Entscheidungen

| # | Entscheidung | Empfehlung | Konflikt mit #2055 |
|---|---|---|---|
| E1 | Arbeitsplatz als Kundenmodus des Command Centers | Ja | #2055 nennt `src/features/workspace/` als Fundstelle; Zusammenführung klären |
| E2 | Kundenassistenten | `bots` | #2055: `bot_agents` Kandidat – durch Code überholt (W0.1 N2) |
| E3 | Wissenstabelle | `agent_knowledge_base` erweitern | #2055 nennt drei Modelle inkl. `governance_memory` |
| E4 | Skill-Ausführung über n8n/VPS | Nein; Edge Functions | – |
| E5 | Legacy-Tabellen | markieren, Neunutzung per Test sperren | – |
| E6 | Environment-Gate für `db push` | vor jedem weiteren Merge mit Migration | – |
| E7 | Freigaben für Workspace-Schritte | **offen** – `agent_decisions` (Command Center, M9 getestet) oder `governance_approvals`/`pdp_approval_gates` (#2055) | **ja** |
| E8 | Datenmodell PR C | **offen** – `bot_conversations` + Erweiterung (#2055) oder eigene Tabelle `inquiries` | **ja** |
| E9 | Kanalbudget für Workspace | **offen** – nur `cost_check_and_reserve` (#2055) oder zusätzlich Kanal `workspace` in `bot_usage_*` nach Gate 4 | teilweise |

---

## 5. Nächster Schritt

Nach den Entscheidungen und Aufhebung der Sperren aus Abschnitt 0: W1 als eigener Draft-PR `feat/workspace-core` auf Basis von Abschnitt 2.
