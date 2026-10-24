# Profil: Security

Ebene 3. Gilt zusätzlich zu `AGENTS.md`, lockert nichts davon.
Security-PR-Definition und Freigabe: `.github/PR_TRIAGE_POLICY.md`. Jeder Security-PR braucht
eine Einzel-Freigabe.

## Pfade

Nur die im Auftrag genannten Auth-, Policy-, Gateway-, RLS- oder Secret-relevanten Dateien.
Kennzeichnung: Titel `fix(security)`/`feat(security)` oder Label `security`.

## Prüfliste vor jeder sicherheitsrelevanten Änderung

| Punkt | Frage |
|---|---|
| Trust Boundary | Welche Eingaben kommen von Client, Provider, anderem Prozess? |
| Authentifizierung | Wer ist der Aufrufer, wie belegt? |
| Autorisierung | Serverseitig, je Mandant und Agent, nicht über feste IDs? |
| Tenant-Isolation | Kann ein Mandant Daten eines anderen lesen oder schreiben? |
| Tool-Rechte | Grant aus der Session, begrenzt durch den Katalog? |
| Session-Lifecycle | Was passiert bei Abbruch, Neustart, mehreren Instanzen? |
| Kill-Switch | Frisch gelesen, vor Entscheidung und Ausführung? |
| Einwilligung | Verifiziert oder abgelehnt? |
| Rate-Limits | Serverseitig gezählt, vor dem Await reserviert? |
| Replay | Request-ID gebunden, einmalig verbraucht? |
| Race Conditions | Was liegt zwischen Prüfung und Ausführung? |
| Idempotenz | Doppelter Call = kein doppelter Effekt? |
| Audit/Evidence | Jede Entscheidung im Prüfpfad, an derselben ID? |
| Fail-closed | Jeder Fehlerpfad lehnt ab? |

## Prüfmuster aus SEC-01 und SEC-05 (PRs #1975–#1977)

- Rechte nie aus dem Request-Body oder einer festen Agent-ID ableiten (SEC-01).
- Zustand (Zähler, Kill-Switch, Einwilligung) nur serverseitig (SEC-05).
- Nur vorher angemeldete Calls entscheiden; Anmeldung einmalig verbrauchen (Replay).
- Zwischen letzter Prüfung und Executor kein Await; schreibende Aktionen gesperrt, solange
  die Prüfung nicht in derselben Transaktion liegt.
- Sperren strukturell absichern (AST-Guard statt Regex), mit Negativnachweis.

## Prüfungen

Negativtests, die ohne den Fix scheitern (gegengeprüft), plus die Prüfungen des betroffenen
Profils. CodeQL läuft nur für PRs gegen `main`: gestapelte PRs vor der Merge-Freigabe auf `main` umstellen.

## Eskalation

Bestätigte Lücke außerhalb des Auftrags: dokumentieren, eigener Security-PR, nicht nebenbei fixen.
Keine Details zu offenen Lücken in öffentliche Texte über das Nötige hinaus.
