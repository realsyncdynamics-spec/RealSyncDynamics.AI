# SF-000 – Konsolidierung der RealSync Software Factory

**Stand: 20.11.2026 – Review-Entwurf.** Kein Merge, kein Deployment, keine Migration, keine Secrets und kein produktiver Zugriff.

## Baseline und Branch-Strategie

Der SF-000-Branch basiert auf factory/sf-006-offline-ci-20261120. Die vorhandenen Branches, Draft-PRs und main bleiben unverändert. Der PR soll nur die neu hinzugefügten SF-000-Dateien enthalten. Die späteren Merge-Abhängigkeiten und die aktuellsten Quell-SHAs sind vor der Integration neu zu prüfen.

| Linie | Quelle | Belegte Bausteine | Grenze |
| --- | --- | --- | --- |
| A | factory/sf-006-offline-ci-20261120 | factory-core, Offline-Worker, Handoff, REA/Loop-Demo, Offline-CI | Keine Produktionsautorisierung oder Persistenz |
| B | Draft-PR #2346 und gestapelter Draft-PR #2347 | Verträge, lokale Policy, TrustedActor-Typ, Offline-REA-Dockerplan | Datentypen sind keine Authentifizierung; Docker nicht produktiv abgenommen |
| C | sf001/phase0-mock-contract-20261120 | factory-contract, factory-atomic, factory-lease, factory-recovery | Simulation, keine realen Transaktionen oder Produktionszugriffe |

## Nachgewiesene Unterschiede

- Statusgraph A: queued, analyzing, planning, implementing, validating, blocked, draft_pr_ready, failed, cancelled.
- Statusgraph B: draft, specified, queued, paused, running, validating, pr_ready, failed, canceled.
- Statusgraph C: draft, specified, approved_for_sandbox, running, testing, review_required, completed, blocked, failed, cancelled.
- C hat completed, A nur draft_pr_ready. Es ist **nicht zulässig**, completed zu einer genehmigten Veröffentlichung oder erfolgreichen Live-Funktion umzudeuten.
- B verwendet Budgetwerte als EUR-Zahlen; A/C verwenden Cent. Es erfolgt keine automatische Währungs- oder Rundungskonvertierung.
- A kennt lediglich Actor-Labels, B einen TrustedActor-Typ, C einen FactoryMockContext. Keiner dieser Werte verifiziert eine reale Person, MFA, eine Worker-Lease oder eine Freigabe.
- Mock-Evidenzen, lokale Hashes und GitHub-URL-Texte sind keine gesichert abgelegten Herkunftsnachweise.
- Der SF-006-CI-Workflow führt vier explizite synthetische Node-Test-Suites aus. Er prüft nicht die isolierte Real-Ausführung und ist kein Nachweis für einen erfolgreichen kompletten Repository-Build.

## SF-000 – implementierter, bewusst begrenzter Umfang

1. apps/factory-worker/consolidation/status-compat.mjs enthält eine **rein lesende Status-Vokabularbrücke** für alle drei Linien.
2. apps/factory-worker/consolidation/test/status-compat.test.mjs überprüft alle 28 Statuswerte und Negativfälle. Die Adapter-Ausgabe ist ein unverbindlicher Anzeige-Hinweis.
3. Diese Datei enthält den Konsolidierungs- und Abnahmeplan. Keine bestehende State Machine, Policy, Datenbank oder Release-Funktion wird geändert.

**Sicherheitsinvariante:** Jeder Adapter-Ausgang hat canStartWorker=false, canCreatePullRequest=false, canMerge=false, canDeploy=false; humanReviewStillRequired=true, evidenceVerified=false und statusAuthenticated=false. Ein Anzeige-Hinweis darf niemals zur Autorisierung eines Jobs werden.

Lokale Prüfung mit Node 22 ohne Paketinstallation:

    node --check apps/factory-worker/consolidation/status-compat.mjs
    node --check apps/factory-worker/consolidation/test/status-compat.test.mjs
    node --test apps/factory-worker/consolidation/test/status-compat.test.mjs

Der bestehende GitHub-Workflow deckt diese neue Suite noch nicht ab und der neue PR-Zielbranch ist nicht Teil der expliziten PR-Baseliste des Workflows. Der lokale Testnachweis ersetzt **keinen CI-Nachweis**. Das Anpassen von GitHub-Workflow-Regeln bedarf einer eigenen Sicherheitsprüfung und Freigabe.

## Ziel-Vertrag – nach Review, nicht Bestandteil dieses PRs

- Eine kanonische, versionierte FactoryJob-State-Machine mit getrennten Statusbereichen für Code-Review, Freigabe und produktives Release.
- Geprüfte source_commit_sha, spec_sha256, scope_id, Job-Version, Lauf-/Lease-Epoche, Actor- und Approval-Identität und referenzierte Evidence.
- Budgets als sichere ganzzahlige Beträge in fest definierter Währung; FX separat belegt.
- Berechtigungen serverseitig über vorhandenes AI-OS-Gateway und bestehende Default-Deny-Policy, nicht über vom Job selbst gelieferte TrustedActor-Werte.
- Private, nicht exponierte Factory-Datenbankstrukturen erst in **separater isolierter PostgreSQL-Umgebung** testen: atomare Job-Events, idempotente Receipts, Leases/Fencing, Outbox, Recovery und RLS/Grants.
- Unabhängige QA mit eigenem Testplan, anschließend menschliches Review. Merge/Deploy/Migration benötigen jeweils eine gesonderte Freigabe.

## P0-Reihenfolge

1. SF-000 Status- und Vertragsabweichungen von A/B/C fachlich abnehmen.
2. Produktionsdeploy-Gate #2336 und offenen Migration-Drift #2337 getrennt bearbeiten; keine automatischen Produktionsfreigaben ableiten.
3. SF-001/SF-002-Code und SF-003-Recovery/Lease-Tests auf einen kanonischen Vertrag abgleichen; keine stillschweigende Löschung alter Tests.
4. Vollständigen Repo-Typecheck, bestehende Vitest-Suites, isolierte PostgreSQL-Konkurrenztests und unabhängigen Sicherheitsreview nachholen.
5. Erst danach einen nichtkritischen echten Entwicklungsauftrag bis zu einem Draft-PR erproben.

## Rollback

Die SF-000-Arbeiten sind rein additive Dateien auf einem separaten Branch. Der Branch kann ohne Migration oder Datenverlust verworfen werden. Bestehende Branches und Draft-PRs bleiben bestehen. Vor einem Merge mit Produktionswirkung ist eine **neue ausdrückliche Freigabe** erforderlich.
