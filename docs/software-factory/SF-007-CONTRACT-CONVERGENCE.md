# SF-007 – Konvergenz der AI-OS- und Factory-Core-Verträge

**Status:** Isolierter, rein lesender Integrationsentwurf. Kein Merge auf main, keine Migration, kein Deployment, keine produktive Worker-Freigabe.

## Ausgangslage (Repository-Abgleich 20.11.2026)

Der AI-OS-Branch `sf001/phase0-mock-contract-20261120` und der Factory-Core-Branch `factory/sf-006-offline-ci-20261120` sind voneinander abgezweigt. Die State Machines sind NICHT direkt kompatibel:

| AI-OS-Zustand | Factory-Core-Zustand | Sichere Projektion |
|---|---|---|
| draft | queued | intake |
| specified | analyzing / planning | planning |
| approved_for_sandbox | queued | approval_unverified |
| running | implementing | execution_unverified |
| testing | validating | validation_unverified |
| review_required | draft_pr_ready | human_review_pending |
| completed | draft_pr_ready | legacy_completion_unverified |
| blocked / failed / cancelled | passende Endzustände | blocked |
| widersprüchliche Snapshots | aktiver Worker trotz terminalem AI-OS-Status | inconsistent_snapshots |

**Keine Zeile dieser Tabelle ist eine Berechtigungs- oder Freigabeentscheidung.** Insbesondere ist `draft_pr_ready` kein nachgewiesen existierender Pull Request, `completed` kein Produktionsrelease und `approved_for_sandbox` kein kryptografisch verifizierter Genehmigungsbeleg.

## Was in SF-007 implementiert ist

- `apps/factory-worker/integration/contract-projection.mjs`: strikt schemaspezifische, reine Statusprojektion aus zwei künstlichen Quellen. Identische Job-ID, Scope, Repository und gepinnter Commit müssen in den Eingaben korrelieren. Unbekannte Felder, fremde Jobs und unvereinbare Status werden abgewiesen bzw. sichtbar als Konflikt gemeldet.
- `apps/factory-worker/integration/test/contract-projection.test.mjs`: 18 negative und positive Tests für unterschiedliche Phasen, fehlende Autorität, gefälschte Privilegien, Scope-/Commit-Wechsel, manipulierte Schemas und widersprüchliche Zustände.
- Ein dedizierter GitHub-Actions-Workflow führt ausschließlich Node-eigene, synthetische Tests aus (kein npm install, kein externes Werkzeug).

Der Projektionsadapter wird **nicht** durch `apps/factory-worker/integration/index.mjs` als Freigabefunktion eingebunden. Er ist ein Diagnose- und UI-Vertrag, kein zweiter Scheduler, Worker oder API-Endpunkt. Keine automatische Konvertierung des AI-OS-Eventlogs in das Factory-Core-Eventlog; beide enthalten fachlich unterschiedliche Ereignisse.

## Vertrauensgrenzen

Jede Projektion liefert `authority.canExecute`, `canVerifyTests`, `canCreatePullRequest`, `canMerge`, `canDeploy` und `canSpend` fest mit `false`. Auch zwei syntaktisch übereinstimmende Snapshots beweisen weder ihre Herkunft noch ihre Aktualität. Gefälschte clientseitige Operator-, MFA- oder Approval-Flags werden vom strikten Eingabeschema abgelehnt. Das Verfahren benötigt keine Datenbank und keine Zugangsdaten.

## Noch zu konsolidieren – verbindliches Ziel

1. **Eine kanonische Job-ID und Statusmaschine:** AI-OS bleibt Autorität für Identität, menschliche Freigaben, Tenant-/Scope-Policy und Budget; die Factory-Core-Phasen werden als interne Worker-Phasen oder Unterzustände geführt. Keine zweite produktive Agent-Runtime.
2. **Atomare Postgres-Grenze:** Job, Versions-CAS, Event, Idempotenzreceipt, Outbox und Kostenreservierung in *einer* Transaktion. Private Schema-Rechte sowie ausdrückliche, minimale Grants; keine Data-API-Freigabe für anon/authenticated.
3. **Authentisches Fencing:** Durable Leases, monoton steigende Epoch, vertrauenswürdige DB-Uhr; jeder Worker-Write muss aktuelle Epoch, Holder, Scope und Kill-Switch erneut prüfen.
4. **Rollen-/Tenant-Negativtests:** Fehlende Operator-Berechtigung, fremder Workspace und manipulierte Approval-Daten müssen aus einer echten, isolierten Postgres-Testumgebung abgewiesen werden. RLS und Server-Permissions separat prüfen.
5. **Evidenz/Recovery:** Attestierter Checkout, Version/Digest von Artefakten, unabhängige Tests; verlorene Commit-Antwort und abgelaufene Lease dürfen nicht doppelt ausgeführt werden.
6. **Release-Gates:** Erst danach isolierter Code-Worker, manuelle PR-/Sicherheitsreview und separate produktive Freigabe.

## Prüfumfang

```bash
node --check apps/factory-worker/integration/contract-projection.mjs
node --check apps/factory-worker/integration/test/contract-projection.test.mjs
node --test apps/factory-worker/integration/test/contract-projection.test.mjs
```

Ein grüner Offline-Test beweist **nur** reine JS-Vertragsinvarianten. Auf dem aktuellen Laufzeitsystem sind weder PostgreSQL noch Docker verfügbar. SF-007 darf daher keinerlei echte DB-Transaktion, Datenbank-RLS, Rootless-Sandbox, REA/Claude/Codex oder Release-Fähigkeit als bestanden einstufen.

**Gate:** GO für Entwurfsreview und isolierte Verträglichkeitstests. NO-GO für Datenbankmigrationen, externe Tools, Kosten, Merge und Deployment.
