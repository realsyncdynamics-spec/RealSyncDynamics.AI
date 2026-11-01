# KI-Arbeitsplatz – Auftrag W1, konsolidierte Fassung v2

Stand: 01.11.2026, Code-Stand `main` @ `dbbd8a4`. Status: **geplant**. Nichts aus diesem Dokument ist implementiert.

Grundlage: [`ki-arbeitsplatz-w0-1-bestandsabgleich.md`](ki-arbeitsplatz-w0-1-bestandsabgleich.md) und W0 in [`docs/ARCHITECTURE_CURRENT.md`](../ARCHITECTURE_CURRENT.md#w0--ai-workspace-bestandsaufnahme-und-architekturentscheidung).

Ziel: Kunden steuern Landingpages und KI-Mitarbeiter über einen Arbeitsplatz aus Wissen, Verbindungen, versionierten Skills und Routinen – im Dashboard nachvollziehbar mit Status, Ergebnissen, Freigaben und Verbrauch.

---

## 0. Sperren

W1 beginnt erst, wenn:

1. Gate 4 (Budget-Governance, Draft-PR #2088) mit CI- und Testnachweis abgenommen ist,
2. PR C (Anfragen-Posteingang `inquiries`, `site-inquiry`, `/app/anfragen`, Übergabe an Menschen) als Draft vorliegt,
3. das Environment-Gate für `db push` eingerichtet ist (B1, E6),
4. das interne P0-VPS-Audit abgeschlossen ist, soweit n8n oder VPS-Dienste berührt werden,
5. die Entscheidungen E1–E7 (Abschnitt 4) getroffen sind.

Ohne Einzelfreigabe nie: Merge, Produktions-Deploy, destruktive Migration, Rechteausweitung, Preise/Stripe/Entitlements, DNS, neue kostenpflichtige Anbieter (siehe `AGENTS.md`).

---

## 1. Befunde gegenüber der Erstfassung

Siehe Bestandsabgleich, Abschnitt 2 (N1–N5). Kurz:

- `agent_tasks` hat bereits `board_status`, Lease-Felder, `evidence` und `move_agent_task` → erweitern statt neu bauen.
- Kundenassistent = `bots`/`bot_conversations`/`bot_messages` (Schema A), nicht `bot_agents`.
- Routinen-Registry `agent_routines`/`agent_routine_runs` existiert.
- Oberfläche = Command Center (`/app/command-center`).
- `inquiries`, `agent_task_steps`, `skill_versions` fehlen.

---

## 2. Architektur

### 2.1 Oberfläche
- Der KI-Arbeitsplatz ist der **Kundenmodus des Command Centers** (`src/features/command-center/`).
- Kundenroute `/app/arbeitsplatz` als Alias auf dieselbe Ansicht im Kundenmodus. Admin-Sichten (Agentenkonfiguration, Plattform-Monitoring) erscheinen dort nicht.
- Begriffe im Kundenmodus: „Aufgaben“, „Ergebnisse“, „Freigaben“, „Routinen“, „Wissen“, „Verbindungen“, „Verbrauch“. Keine internen Begriffe wie Policy, Evidence, Runtime.
- Mobile Mindestaktionen: Aufgabe starten, Ergebnis ansehen, Entwurf prüfen, Freigabe erteilen, Anfrage übernehmen, Routine pausieren, Assistent stoppen, Budgetstatus prüfen. Kein SSH, kein Terminal.

### 2.2 Aufgaben
- Kanonisch `agent_tasks`; Statusführung über `board_status` und `move_agent_task`.
- Additiv:
  - `board_status`-Werte `scheduled`, `waiting_external`, `uncertain` (CHECK erweitern, bestehende Werte unverändert),
  - Spalten `skill_version_id`, `requested_by`, `idempotency_key` (eindeutig je Mandant), `budget_reservation_id`, `result_refs`.
- UI-Abbildung: `scheduled`/`planned` = eingeplant · `backlog` = wartet · `in_progress` = läuft · `awaiting_decision` = wartet auf Freigabe · `waiting_external` = wartet auf externen Dienst · `done` = abgeschlossen · `blocked` mit Fehler = fehlgeschlagen · `cancelled` = abgebrochen · `uncertain` = Ergebnis bzw. Verbrauch ungeklärt.
- Lease: vorhandene `claimed_by`/`claim_expires_at`, kein zweiter Mechanismus.
- Neu nur `agent_task_steps` (Schrittart, Status, Quellen, Werkzeugaufruf, `idempotency_key`, Versuchszähler). Nicht-idempotente Schritte (Versand, Buchung, Veröffentlichung) werden nach Neustart nicht blind wiederholt, sondern als `uncertain` geprüft.
- Vor jeder Erweiterung: Regressionstests für `move_agent_task`, `TaskBoard.tsx` und bestehende Schreiber (`siteos/handlers/*`, `agent-os-admin`).

### 2.3 Kundenassistenten
- Kanonisch `bots` + `bot_conversations` + `bot_messages` (Schema A), Kanäle über `whatsapp_channels` und den bestehenden Voice-Pfad.
- `bot_agents` weder erweitern noch neu anbinden. Die Referenz in `src/features/governance/voice/voiceApi.ts` ist als Befund gemeldet, nicht umgebaut.
- Interne Agenten (`agent_profiles`, `agent_configuration`, `agent_config_versions`) bleiben Admin-Sicht.

### 2.4 Routinen
- Kanonisch `agent_routines` + `agent_routine_runs`. Keine neue Tabelle `routines`.
- Additiv: `timezone` (IANA), `trigger_kind`, `skill_version_id`, `budget_limit`, `on_error`, `max_retries`, `owner_user_id`, `status` (`aktiv`/`pausiert`/`deaktiviert`), `frozen_scope` (Rechte und Budget zum Aktivierungszeitpunkt).
- Der Worker erzeugt je Lauf eine `agent_tasks`-Zeile und schreibt den Lauf **aus der Antwort der ausführenden Funktion** in `agent_routine_runs`. `pg_cron` „succeeded“ ist kein Erfolgsnachweis.
- Verhalten:
  - Sommerzeit: Planung in Ortszeit der Routine, Ausführung genau einmal je lokalem Termin.
  - Verpasster Zeitpunkt: einmal nachholen innerhalb eines Fensters, sonst als verpasst protokollieren.
  - Doppeltes Ereignis: Idempotenzschlüssel, genau ein Lauf.
  - Parallellauf: Sperre je Routine; zweiter Lauf wird übersprungen und protokolliert.
  - Anbieter nicht erreichbar: begrenzte Wiederholung, danach fehlgeschlagen.
  - Abgelaufene Verbindung: Lauf stoppt, Routine wird pausiert, Hinweis an den Verantwortlichen.
- Kein Cron-Job ohne eigenen, gesetzten Cron-Key (Muster `docs/runbooks/cron-vault-secrets.md`). Keine Funktion mit `requireServiceRole()` als Routinenziel.

### 2.5 Wissen, Skills, Freigaben, Budget
- **Wissen:** `agent_knowledge_base` additiv erweitern (Kategorie, Status bestätigt/Entwurf/extrahiert, Herkunft, Version, Aktualisierungsdatum, Verarbeitungsstatus, Skill-Zuordnung). Änderungen an verbindlichen Angaben nur als Vorschlag. `tenant_id IS NULL` bleibt Plattformwissen; Schreibpfade für Kundenwissen erzwingen `tenant_id` (Test). Wissensinhalte sind Daten, nie Anweisungen.
- **Skills:** `automation_skills` eingefroren. Neu `skill_versions` (Eingaben, Wissensquellen, erlaubte Werkzeuge, Schritte, Ergebnisformat, Qualitätskriterien, Kosten-/Laufzeitgrenzen, Freigabepflicht, Version, Verantwortlicher). Ausführung als Edge Function, nicht über n8n. Ein Skill erhält Werkzeuge nur aus seiner gepinnten Version; generierte Skills bleiben Entwurf.
- **Freigaben:** `agent_decisions` / `agent_decision_approvals`. Keine Freigabe über `governance_approvals` für Arbeitsplatz-Schritte, keine dritte Freigabetabelle. Freigabe zeigt: Was, in welchem System, für wen, mit welchen Kosten.
- **Budget:** Vorgesehen sind `bot_usage_reservations` / `bot_usage_ledger` mit Kanal `workspace`, nach Abnahme von Gate 4. **Widerspruch:** W0 in `ARCHITECTURE_CURRENT.md` legt `runAiTool` → `cost_check_and_reserve` fest. Bis zur Entscheidung E7 wird kein Budgetpfad für den Arbeitsplatz gebaut. Verbrauch wird als gemessen/geschätzt/korrigiert gekennzeichnet; Schätzungen werden nicht abgerechnet.

### 2.6 Ausgeschlossen
- `kodee`, `vps_connections`, `terminal_approvals`: kein Bestandteil des Arbeitsplatzes, keine Kundenfunktion mit Shell- oder SSH-Wirkung.
- Legacy-Tabellen (`autonomous_*`, `hermes_*`, `token_usage`, `api_usage`, `usage_counters`, `agent_token_usage`, `runtime_approval_gates`) nicht neu nutzen; Regressionstest gegen Neunutzung.
- Bestehende Kundenwebsite, CMS, Kundendatenbank und DNS bleiben unverändert. „Landingpage erstellen“ erlaubt nie das Überschreiben einer vorhandenen Website.

---

## 3. Erster Ablauf und Abnahme

Erster Ablauf (nach Aufhebung der Sperren):

Wissen bestätigen → Skill „Landingpage erstellen“ (SiteOS) → Entwurf → Vorschau → Formular testen → Veröffentlichung nach Freigabe (`agent_decisions`) → Testanfrage → Anfrage im Posteingang (PR C) → interne Zusammenfassung als Ergebnis der Aufgabe. Danach: manuell startbare Tagesübersicht.

Abnahmekriterien (Auszug, zusätzlich zu Bestandsabgleich Abschnitt 5 und Gate-4-Kriterien):

1. Arbeitsbereich A liest keine Quellen, Aufgaben oder Ergebnisse von B (RLS-Test).
2. Ein Skill nutzt nur Werkzeuge seiner Version (Negativtest).
3. Manipulierte Wissensquelle ändert keine Berechtigung.
4. Entwurf wird nie ohne Freigabe veröffentlicht.
5. Doppeltes Ereignis → genau eine externe Aktion.
6. Timeout → keine unbegründete Budgetfreigabe.
7. Parallele Aufgaben überschreiten kein Limit (atomare Reservierung).
8. Worker-Neustart verliert keine Aufgabe und wiederholt keine nicht-idempotenten Schritte.
9. Abgebrochene Aufgabe startet keine freigabepflichtige Aktion.
10. Skill-Änderung verändert laufende Aufgaben nicht (Version gepinnt).
11. Ergebnisse auf 375 px abrufbar (E2E, eingeloggt).
12. Kundeninfrastruktur bleibt unverändert.
13. Geschätzte Kosten erscheinen nicht in `bot_usage_billable`.
14. Kunde im Kundenmodus sieht keine Admin-Sichten und keine Daten anderer Mandanten.
15. `move_agent_task` und `TaskBoard.tsx` verhalten sich für bestehende `board_status`-Werte unverändert.
16. Kein Arbeitsplatz-Codepfad referenziert `bot_agents`.
17. Routinenlauf mit HTTP-Fehler der Zielfunktion erscheint in `agent_routine_runs` als fehlgeschlagen, auch wenn `pg_cron` „succeeded“ meldet.
18. Kein Arbeitsplatz-Pfad erreicht `kodee` oder eine Funktion mit SSH-Wirkung.

---

## 4. Offene Entscheidungen

| # | Entscheidung | Empfehlung |
|---|---|---|
| E1 | Arbeitsplatz als Kundenmodus des Command Centers | Ja |
| E2 | Steuerbare Kundenassistenten | `bots` (Schema A) |
| E3 | Kanonische Wissenstabelle | `agent_knowledge_base` erweitern; `agent_memory` bleibt Gesprächsgedächtnis |
| E4 | Skill-Ausführung über n8n/VPS | Nein; Edge Functions |
| E5 | Legacy-Tabellen | markieren, Neunutzung per Test sperren, Rückbau separat |
| E6 | Environment-Gate für `db push` | vor jedem weiteren Merge mit Migration |
| E7 | Budgetpfad Arbeitsplatz: `bot_usage_*` (Kanal `workspace`) oder `runAiTool` → `cost_check_and_reserve` (W0) | offen – beide Pfade vor Entscheidung gegenüberstellen; keine dritte Logik |

---

## 5. Nächster Schritt nach Aufhebung der Sperren

Branch `feat/workspace-core`, Draft-PR, additive Migrationen für 2.2 (Aufgaben/Schritte) mit Regressionstests aus Abschnitt 3 (Kriterien 14–16). Kein Merge ohne Einzelfreigabe.
