# SF-005 – Goal & Loop Engine

**Stand: 20.11.2026. Status: isolierter Offline-Entwurf, nicht deployed.**

## Zweck

Erweitert die vorhandenen SF-001-Contracts auf dem bestehenden Factory-Branch um geschlossene, begrenzte Agenten-Loops. Keine zweite Agent-OS-Runtime. Alle Produktionsaktionen verbleiben hinter den bestehenden Governance- und Human-Approval-Gates.

## Implementiert

- `apps/factory-worker/loop/engine.mjs`: deterministische Goal Contracts und Zustandsübergänge.
- `apps/factory-worker/loop/test/engine.test.mjs`: native Node.js Offline-Tests (14 Testfälle).
- Zielvertrag mit Job- und Repository-Bindung, Akzeptanzkriterien und zwingender menschlicher Review.
- Evidence-Receipts je Kriterium, unabhängiger Verifier (andere ID), Ergebnis- und Fehlerzustände.
- Begrenzung von Iterationen, Token-Kosten und Zeit; das strengere SF-001-Joblimit gilt.
- Versionierter NEXT_STEPS-Checkpoint, Event-Historie und manuelle Stop-Gründe.

## Ablauf

`ready -> awaiting_verification -> review_required` wenn alle Kriterien als erfüllt markiert sind. Bei Fehlern `awaiting_verification -> retry_required -> ready`, soweit Budget und Frist reichen. Sonst `blocked`.

**review_required bedeutet nicht produktionsbereit.** Freigabe, PR-Erstellung, Merge und Deployment sind nicht Teil dieses Moduls.

## Verifikation

Im Repository:

```bash
node --check apps/factory-worker/loop/engine.mjs
node --check apps/factory-worker/loop/test/engine.test.mjs
node --test apps/factory-worker/loop/test/engine.test.mjs
```

Die Offline-Tests sind keine PostgreSQL-, Docker-, echte Agenten- oder E2E-Abnahme.

## Nicht implementiert und Sicherheitsgrenzen

- Kein echter Aufruf von Claude, Codex, REA oder anderen Werkzeugen.
- Kein Datenbankzugriff, keine dauerhafte Speicherung und kein crash-sicherer Wiederanlauf.
- VerifierId ist vorerst **nur ein Label**, nicht eine serverseitig verifizierte Identität.
- `artifact:`- und `sha256:`-Referenzen sind keine Echtheits- oder Testnachweise.
- NEXT_STEPS sind **nur Daten**, keine ausführbaren Anweisungen.
- Laufzeitlimit wird beim Funktionsaufruf geprüft; kein selbsttätiger externer Timeout-Kill.
- Die Kosten müssen derzeit durch den Aufrufer als Receipt gemeldet werden; keine tatsächliche Token-Messung.
- Kein produktiver Scheduler, kein Cron-Job, kein Dashboard und keine Berechtigungserweiterung.
- Keine automatische Freigabe und keine Mutation von `main`.

## Nächste technische Abnahmen

1. Drafts #2346 / #2347 und ihren WIP-Status konsolidieren.
2. SQL-first, transaktionale Jobpersistenz statt In-Memory-Store; stabile IDs, Locks, Leases, Fencing, Idempotenz.
3. Tenant-Isolation/RLS, E2E-Verifier-Attestierungen, sichere Evidenzpersistenz und Resume-Tests.
4. Server-authentifizierte Rollen, harte Provider-/Tool-Allowlist, Kostenreservierung und Kill-Switch.
5. Erst danach autorisierte Worker-Integration, reale Tests und separat freizugebende Draft-PR-Erzeugung.

**Diese Stufe ist ausschließlich ein geprüfter Vorschlag für den Loop-Vertrag.** Ein produktiver Software-Factory-Autopilot ist damit nicht nachgewiesen.
