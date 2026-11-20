# SF-004 – Offline-Integrationslabor

**20.11.2026 – experimentell, nicht auf main, kein Deployment.**
Branch: factory/sf-004-integration-lab-20261120 (auf factory/sf-005-goal-loop-20261120).
SF-004 ergänzt den fehlenden Integrationsnachweis zwischen SF-003 und SF-005; es ist kein chronologisch bereits produktiv freigegebenes Release.

## Inhalt

- apps/factory-worker/integration/compose.mjs: feste Offline-Abfolge aus Goal Loop, REA-JSON-Receipt, Coding-Handoff, Quell-Snapshot-Review und ausschließlich einem vorgeschlagenen Patch-Receipt.
- apps/factory-worker/integration/index.mjs: feste Imports der bestehenden SF-003-/SF-005-Module.
- apps/factory-worker/integration/test/compose.test.mjs: 9 Unit-Tests mit kontrollierten Adaptern.
- apps/factory-worker/integration/test/integration.test.mjs: 4 synthetische Tests mit echten Modul-Imports.

## Zwingende Statusgrenzen

Das Ergebnis bleibt **awaiting_verification**. Ein REA-Hash ist keine attestierte Herkunft. Ein verglichener Snapshot ist kein unabhängig verifizierter Git-Checkout. Der Patch-Hash ist kein bestandener Test. Das Kriterium isolated_tests wird absichtlich nicht als bestanden markiert. verifyLoopEvidence wird nicht aufgerufen.

Keine tatsächlichen Provider-Aufrufe, Docker/REA-CLI, Dateischreiboperationen, GitHub-PRs, SQL-Migrationen, Secrets, automatische Freigabe, Merge oder Deployment.

## Prüfbefehle

```bash
node --check apps/factory-worker/integration/compose.mjs
node --check apps/factory-worker/integration/index.mjs
node --check apps/factory-worker/integration/test/compose.test.mjs
node --check apps/factory-worker/integration/test/integration.test.mjs
node --test apps/factory-worker/integration/test/compose.test.mjs
node --test apps/factory-worker/integration/test/integration.test.mjs
node --test apps/factory-worker/handoff/test/handoff.test.mjs
node --test apps/factory-worker/loop/test/engine.test.mjs
```

**Ausgeführte lokale Prüfung:** 9/9 Unit-Tests des Offline-Kompositionsvertrags bestanden auf Node.js 22.16.0; Syntax der vier neuen JS-Dateien lokal geprüft. Die vier realen Import-Integrationstests wurden bei Erstellung noch nicht auf einem vollständigen Repository-Checkout ausgeführt. Keine Aussagen über bestandene CI, Docker, PostgreSQL, Claude/Codex oder REA.

## Noch blockiert

1. Parallelentwürfe #2346/#2347 und unterschiedliche Factory-Contracts vor jedem Merge konsolidieren.
2. Rootless Container und fest gepinntes Image; Netzwerkunterbindung, Ressourcenlimits, Ausbruch-/Cleanup-Tests und Host-Isolation nachweisen. Der hiesige lokale Testcontainer hat weder Docker noch Podman.
3. Serverseitig authentifizierte und mandantengebundene Auftragsfreigabe, unabhängige Checkout-SHA-Attestierung, Tool-Allowlist, Kostenreservierung und Kill-Switch.
4. Transaktionale PostgreSQL-Persistenz, Worker-Leases mit Fencing, Idempotenz, RLS sowie unabhängige und persistierte Prüfnachweise.
5. Erst danach echter Coding-Agent auf **synthetischem** isoliertem Workspace mit unabhängigen Tests und menschlicher PR-/Release-Freigabe.

**Status:** ausschließlich ein prüfbarer Integrationsentwurf. Kein autonomer Factory-Betrieb.
