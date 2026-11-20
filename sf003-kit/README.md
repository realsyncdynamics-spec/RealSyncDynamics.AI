# RealSync Software Factory — SF-003 PostgreSQL Integration Kit

**Status der Härtungsfassung:** zusätzliche URI-/Server-Preflight-Checks und lokale Tests. **Keine reale PostgreSQL-Integration ausgeführt.** Siehe `HARDENING.md`.

**Stand:** 20.11.2026 · **Status:** vorbereiteter, nicht gegen PostgreSQL ausgeführter Testadapter. Keine Migration, kein PR, kein Deployment.

## Grundlage

Das separate Paket `RealSync_SF002_Transactional_Design_2026.zip` wurde gelesen. Seine 64 lokalen Node-Tests und der TypeScript-Check wurden unabhängig erfolgreich ausgeführt. Die dazugehörige Review-only-SQL und das In-Memory-Testdouble sind **keine** echte PostgreSQL-Integration.

Das GitHub-Repository besitzt gleichzeitig drei divergierende Entwicklungslinien: `factory/sf-001-foundation-20261120` (11 Commits), Draft-PR #2346 (abweichender Factory-Core) und Draft-PR #2347 (REA-Analyseadapter). Dieses Paket führt sie **nicht** automatisch zusammen und ändert nichts an GitHub.

## Inhalt

- `schema.sql`: ausschließlich für eine **wegwerfbare lokale Testdatenbank**. Legt Schema `sf003_test` mit Jobs, Leases, Events und idempotenten Command-Receipts sowie RLS-Gegenrollen an. **Keine** produktive Supabase-Migration und keine echten Nutzer-/Mandantendaten.
- `integration.test.mjs`: Node-Testharness mit PostgreSQL-Transaktionen, Row-Locks, Idempotenz, CAS, Rollback-Failure-Injection, Lease/Fencing, Budget, RLS und Append-Only-Proben.
- `package.json`: minimale Paket-Metadaten, Nutzung von `pg@8.21.0`.
- `RESULTS.md`: nachgewiesene und noch offene Prüfstufen.

## Isolierte Ausführung — nur nach bewusstem lokalen Setup

1. Eine **neue, separate PostgreSQL-Testinstanz** auf `127.0.0.1` einrichten; mit einer **wegwerfbaren** Datenbank, deren Name `sf003_test_` beginnt, z. B. `sf003_test_factory`. Sie darf keine RealSync-Produktions- oder Staging-Daten enthalten.
2. Test-PostgreSQL-User muss in der isolierten Instanz ein lokaler PostgreSQL-Superuser (z. B. `postgres`) sein, damit Rollentests mit `SET ROLE` sowie `FORCE ROW LEVEL SECURITY` korrekt durchführbar sind. Niemals einen produktiven Superuser verwenden. Der Test erstellt zwei reine Testrollen `sf003_operator_test` und `sf003_untrusted_test`.
3. `pg` als geprüfte und gepinnte Abhängigkeit bereitstellen (im RealSync-Repository bereits als Entwicklungsabhängigkeit vorhanden); kein Agent darf `npm install` im RealSync-Repo eigenmächtig starten.
4. Mit bewusst gesetzten lokalen Variablen starten:

```bash
SF003_DISPOSABLE_DB=YES SF003_SCHEMA_RESET=YES \
SF003_TEST_DATABASE_URL='postgresql://postgres:LOCAL_TEST_PASSWORD@127.0.0.1:55432/sf003_test_factory' \
node --test integration.test.mjs
```

**Fail-closed:** Ohne beide Schalter `SF003_DISPOSABLE_DB=YES` und `SF003_SCHEMA_RESET=YES`, lokale Loopback-Adresse, Port 55432 und passenden Testdatenbanknamen bricht die Suite ab, bevor sie eine Verbindung aufbaut. `schema.sql` löscht bei Testbeginn das bereits vorhandene Schema `sf003_test`; daher **niemals** gegen eine befüllte Datenbank oder eine Supabase-Projektadresse ausführen. Am Ende wird nur das Testschema entfernt.

## Noch nicht abgenommen

- Tatsächlicher PostgreSQL-Testlauf und Serverversionsverträglichkeit
- Mehrprozess-Crash mit hartem Abbruch während `COMMIT` und Reconnect / WAL-Dauerhaftigkeit
- JWT/AAL2, echte Plattform-Operatoren, attestierte Worker-Identität, anti-replay über API-Gateway
- Sichere Rollen- und Grants-Strategie für RealSync; lokale Testrollen sind nicht das produktive Berechtigungsmodell
- Row-Lock-Integration in den eigentlichen Factory-Core, Outbox/Provider-Side-Effects
- Sicherer Container, REA-MCP-Broker, GitHub-Pipeline, Dashboard, Produktions-Freigabegates

**GO nur für isolierte Tests, STOP für Migration/Merge/Deploy.** Vor produktiver Umsetzung sind Migration-Drift #2337, isolierte DB-Nachweise #2285 und die PR-/Security-Triage-Policy zu beachten.
