# SF-003 – REA → Coding-Agent → Code-Review (Offline-Übergabe)

**Stand: 20.11.2026.** Isolierter Prototyp auf Factory-Branch, **keine Live-REA-, MCP-, Claude-Code- oder Codex-Verbindung**. Kein Merge, Deploy, PR, API-Key oder produktiver Codezugriff.

## Zweck

SF-003 ergänzt die SF-001-Verträge und den SF-002-Read-only-Worker um einen strikt offline ausgeführten Übergabe- und Reviewprozess. Die vorhandene interne AI-OS-Laufzeit bleibt perspektivisch maßgeblich für Autorisierung und Protokollierung. Keine zweite Runtime.

Der Name REA bezeichnet das externe Open-Source-Werkzeug *Reverse Engineer Anything* (morluto/rea), **nicht** den internen Runtime Evidence Agent. Eine Installation oder direkte REA-MCP-Verbindung ist **nicht** Bestandteil dieses Pakets.

## Neue Dateien

- `apps/factory-worker/handoff/bridge.mjs`: REA-JSON-Syntax prüfen, Hash-Receipt erstellen, Auftrag und Commit-SHA binden, Offline-Handoff für `claude-code` / `codex` vorbereiten.
- `apps/factory-worker/handoff/review.mjs`: Quell-Snapshot-Hashes und sichere Demo-Pfade prüfen, reviewfähigen Unified-Diff **nur im Speicher** erzeugen.
- `apps/factory-worker/handoff/demo.mjs`: vollständig künstlicher Demo-Durchlauf, keine KI-/REA-Ausführung.
- `apps/factory-worker/handoff/test/handoff.test.mjs`: 14 Node-Tests zu Bindung, Vertrauensgrenzen, Limits, Pfaden, unveränderten Snapshots und Diff-Vorschau.

## Sicherheitsgrenzen

- Einziger Repository-Scope: `realsyncdynamics-spec/RealSyncDynamics.AI`, einziger Editier-Scope: `examples/factory-demo/*.js`.
- 40-stellige Commit-SHA, 64-stellige Evidenz-SHA-256, Job-Bindung, Provider-Positivliste, maximal 512 KiB REA-JSON.
- Review nur mit passendem ursprünglichen SHA-256; höchstens drei Dateien, 16 KiB neue Inhalte je Datei, 64 KiB Diff.
- REA-Ausgaben sind **nicht vertrauenswürdige Daten**; Rohtext wird nicht in Coding-Agent-Anweisungen weitergeleitet.
- Keine Tool-Autorisierung durch JSON-Felder. Hash ≠ attestierte Herkunft. Keine echte Prompt-Injection-Sicherheitsgarantie.
- `testsRun=false`, `filesWritten=false`, `pullRequestCreated=false`, `deploymentPerformed=false` sind fest im Review-Artefakt ausgewiesen.

## Lokaler Nachweis

Ausgeführt auf einer separaten lokalen Kopie in dieser Sitzung mit Node.js `v22.16.0`:

```bash
node --check apps/factory-worker/handoff/bridge.mjs
node --check apps/factory-worker/handoff/review.mjs
node --check apps/factory-worker/handoff/demo.mjs
node --test apps/factory-worker/handoff/test/handoff.test.mjs
node apps/factory-worker/handoff/demo.mjs
```

**Ergebnis: 14/14 Offline-Tests bestanden; Syntax OK; synthetisches Ergebnis `review_required`.** Keine GitHub Actions/komplette Repo-CI, keine Docker- oder REA-E2E-Ausführung. Für die echte REA-CLI fordert upstream mindestens Node 22.23.4, 24.22.1 oder 26.12.1 – Node 22.16.0 genügt nicht.

## Abhängigkeiten und nächste Freigaben

- Bestehende parallele Draft-PRs **#2346 (SF-001)** und **#2347 (Offline-REA)** nutzen andere Contracts/Branches. Vor dem Merge müssen die unterschiedlichen Ansätze konsolidiert werden; keinen konkurrierenden Feature-PR unter bestehendem WIP-Stopp eröffnen.
- SF-002-Docker-Sandbox zuerst mit eigener Demo-App testen: Prozessisolation, fehlender Netzwerkzugriff, Limits, cleanup, Host-Isolation und reale Tool-Version.
- Echte REA-Ausgabe nur nach autorisiertem Quellzugriff, attestiertem Checkout und streng isoliertem Worker übernehmen.
- Coding-Agent zuerst in begrenztem temporären **Demo-Workspace** aktivieren. Serverseitige Authentifizierung, Policies, Budgetreservierung, Kill-Switch, Evidence-Persistenz und unabhängige Tests müssen vor jedem echten Tool-Aufruf bestehen.
- PR-Erstellung/CI, Merge und produktive Veröffentlichung benötigen jeweils ihre eigenen Review-/Freigabegates.

**SF-003 ist ein überprüfbarer Offline-Handoff, noch keine autonom programmierende Software Factory.**
