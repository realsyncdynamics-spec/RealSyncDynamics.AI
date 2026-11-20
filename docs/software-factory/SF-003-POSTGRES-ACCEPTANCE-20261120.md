# SF-003 PostgreSQL-Abnahme – 20.11.2026

**Status:** Isolierter Datenbank-Prototyp in GitHub Actions erfolgreich getestet; **keine Produktionsfreigabe**.

## Nachweis

- Repository: realsyncdynamics-spec/RealSyncDynamics.AI
- Branch: sf003/pg-abnahme-20261120
- Getesteter Commit: 88f9dd2635555471a3c9f5a67399aeaa98aed198
- Erfolgreicher Actions-Lauf: https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/actions/runs/44658268677
- Job: 136029796153, Conclusion: success
- Umgebung: GitHub-hosted Ubuntu 24.04, Node 22, pg 8.21.0 aus Root-package-lock.json, PostgreSQL 16.15.
- Neue lokale Testdatenbank: sf003_test_factory, TCP 127.0.0.1:55432, synthetische Daten.

## Gemessene Ergebnisse

| Teststufe | Ergebnis |
|---|---|
| Lokale Syntaxprüfung | bestanden |
| Sicherheits- und Preflight-Tests | **12/12 bestanden** |
| Echte PostgreSQL-Integrationstests | **12/12 bestanden** |
| Vollständiger GitHub-CI-Testjob | **success** |
| Deployment, Supabase-Migration, Merge | nicht ausgeführt |

Die zwölf PostgreSQL-Tests prüfen idempotente Jobanlage, Konflikte unter gleichem Request-Key, parallele Compare-and-Swap-Updates, Command-Receipts und Replay, zwei Transaktionsrollback-Szenarien, Worker-Lease-Race und Fencing, Lease-Renewal, Budgetüberlauf, Append-only-Event-Trigger, RLS-Deny sowie persistierte Receipts über eine neue DB-Sitzung.

## Fehlersuche und Korrektur

- Lauf 44657741853 scheiterte beim Datenbank-Identitätscheck, bevor die Schemaanlage erfolgen konnte.
- Der Diagnose-Lauf 44658078242 zeigte: inet_server_addr()::text liefert die Zeichenkette 127.0.0.1/32.
- Korrektur: host(inet_server_addr()) AS address normalisiert diese Darstellung; die Positivliste für Loopback, der feste Port und die Superuser-/DB-Namensprüfung bleiben strikt bestehen.
- Erfolgreicher Folgelauf 44658268677: alle 24 Prüfungen grün.

## Sicherheitsgrenzen

- Kein bestehender Server, kein Supabase-Projekt, keine Kundendaten.
- Workflow nur für den dedizierten Testbranch, mit contents: read und Checkout ohne persistierte Credentials.
- Abhängigkeiten aus der bestehenden npm-Lockdatei mit npm ci --ignore-scripts.
- PostgreSQL 16 als eigenständiger temporärer Cluster; Teststarter erzeugt ein zufälliges Kennwort.
- SQL-Preflight und Schemaanlage in derselben Transaktion; Fail-closed beim nicht genehmigten Ziel.
- Kein Pull Request, kein Merge nach main, keine produktive Veränderung.

## Ausstehende Gates

1. WAL-/fsync-Dauerhaftigkeit, harter Server-/Worker-Abbruch und Recovery.
2. Persistente Outbox, externe Provider-Side-Effects, Duplicate-Suppression außerhalb der Datenbank.
3. Vollständige tenant-basierte RLS-Isolation, echte MFA und Produktionsauthentifizierung.
4. Verbindung zur RealSync Factory-Core-Laufzeit, REA, Coding-Agenten und Evidence Vault.
5. Unabhängiger Code-/Security-Review, vollständige Repository-CI und separate Betriebsfreigabe.

**Entscheidung:** GO ausschließlich für weitere isolierte Abnahme- und Recovery-Tests. STOP für produktive Migration, autonomes Worker-Deployment und Merge ohne explizite Freigabe.
