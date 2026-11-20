# SF-008 – Isoliertes PostgreSQL-Transaktionslabor

**Stand 20.11.2026:** Reines Testlabor auf `factory/sf-008-ephemeral-postgres-20261120`; keine produktive Migration, kein Supabase-Zugriff, kein Deploy.

## Zweck

Nach der read-only-Konvergenz des SF-007-Adapters weist SF-008 zentrale Datenbank-Invarianten mit einer eigens gestarteten PostgreSQL-Service-Instanz nach. Das Labor ist absichtlich NICHT der produktive Factory-Store; die Schema-Namen und Berechtigungen sind Test-Fixtures und dürfen nicht in Supabase kopiert oder angewandt werden.

## Dateien

- `apps/factory-worker/postgres-lab/schema.sql`: isoliertes Schema `sf008`, sechs Tabellen, RLS-Fixture für `internal_A`, SECURITY INVOKER-Funktionen für Version-CAS, Ereignis/Receipt/Outbox/Kosten-Testledger und monotone Worker-Lease-Epochen.
- `apps/factory-worker/postgres-lab/assertions.sql`: Replay, gleicher Schlüssel mit verändertem Payload, Versionenkonflikt, atomarer Rollback über fünf Datensatzarten, Scope-Isolation, INSERT-Abweisung bei fremdem Scope, unveränderliche Events und veraltete Fencing-Epochen.
- `apps/factory-worker/postgres-lab/run-tests.sh`: verweigert Betrieb ohne expliziten Wegwerfmodus und exakt lokalen Host/Port, DB `sf008_test` und DB-User `postgres`; prüft fremde SQL-Rolle sowie echtes konkurrierendes Schreiben aus zwei separaten `psql`-Sessions.
- `.github/workflows/factory-sf008-postgres-lab.yml`: GitHub-Runner mit PostgreSQL-16-Wegwerfservice, minimalen Repository-Rechten und ohne Produktionsvariablen.

## Aussagekraft

Ein grüner Testlauf belegt, dass **diese Testfunktionen** unter echten PostgreSQL-Transaktionen genau einen Versionsschreiber zulassen, mehrteilige Änderungen bei Fehler zurückrollen und die geprüften rollenbasierten Zugriffsfälle ablehnen. Der Ledger-Test verwendet ausschließlich Kosten `0` und weist keine reale Budgetreservierung nach. Die Simulation des Lease-Ablaufs wird durch den Testadministrator vorgenommen; sie ist kein realer Crash-Test eines Coding-Workers.

**Nicht belegt:** Integration der zwei divergierenden Factory-Verträge zu einer kanonischen Runtime, Supabase Auth/JWT/AAL2, echte Tenant-RLS der Produktionsdaten, Zugriff auf externe Provider, attestierte REA/Codex-Ausführung, Provider-Kosten, transaktionale Recovery nach Crash, sichere Rootless-Sandbox, reales Evidence Vault, GitHub-PR-Erstellung oder Deployment.

Das Labor vergibt direkte Schreibrechte an die isolierte Testrolle und ist **kein** produktionsfähiges Berechtigungsmodell. Produktive Writes müssen später ausschließlich über geprüft autorisierte, transaktionale Server-Operationen erfolgen. Für Live-Datenbanken sind Schema-Inventar, Security-Review, RLS, Least-Privilege-Grants und separate Migrationsfreigabe zwingend.

## Abnahmekommando – nur mit temporärer PostgreSQL-Datenbank

```bash
SF008_EPHEMERAL_DB=true PGHOST=127.0.0.1 PGPORT=5432 \
PGDATABASE=sf008_test PGUSER=postgres PGPASSWORD=<nur-lokales-testpasswort> \
bash apps/factory-worker/postgres-lab/run-tests.sh
```

Die Skripte sind nicht an eine öffentliche Produkt-Route gebunden. Keine Änderung an `main` oder an einer Live-Konfiguration ist beabsichtigt.

## Nächste Gate-Entscheidung

Nach erfolgreichem Test gilt **GO für Review einer echten Persistenzarchitektur**, nicht für deren produktive Inbetriebnahme. Der kanonische AI-OS-Jobvertrag, Scope/Identität aus vertrauenswürdigem Serverkontext, Abgleich aller offenen SF-Drafts, echtes Budgetledger, atomare Outbox-Reconciliation und dauerhaftes Fencing müssen separat implementiert und in einer weiteren isolierten Umgebung getestet werden.
