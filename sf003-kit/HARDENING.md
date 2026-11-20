# SF-003 Guard-Härtung (20.11.2026)

**Nur lokale Dateikopie, keine Datenbank angeschlossen.**

1. Die bisherige URI-Zielprüfung wurde in ein isoliertes, einzeln testbares Modul ausgelagert. Damit sind auch `?host=...`, `?port=...`, `?sslmode=...` und Fragmentparameter explizit gesperrt.
2. Der Testzugriff ist auf Loopback + Port `55432`, einen benannten DB-Namen `sf003_test_*`, gültige Zugangsdaten sowie zwei Zustimmungsschalter beschränkt.
3. Vor dem Schema-Reset wird der tatsächlich verbundene PostgreSQL-Server mit `current_database`, `inet_server_addr`, `inet_server_port`, `is_superuser`, `pg_is_in_recovery` geprüft. Andere Schemas oder Objekte unter `public` verhindern einen Lauf.
4. Ein vor dem DDL gescheiterter Setup-Vorgang kann nun nicht mehr im `after()`-Hook versehentlich ein vorhandenes Testschema löschen.
5. Vorbereitende Prüfung und Schemaanlage erfolgen innerhalb derselben Datenbanksitzung und Transaktion; auch vor dem optionalen Testschema-Abbau wird der Server erneut geprüft.
6. Die Gegenproben sind reine Node-Tests mit Mock-Pool. Sie beweisen keine PostgreSQL-Isolation, keine sicheren Container und keine RLS-Funktion.

## Einschränkung

Selbst ein loopback-spezifischer Teststarter kann ein SSH-Port-Forward oder einen bösartigen lokalen TCP-Proxy nicht grundsätzlich ausschließen. Für echte Integrationstests muss ein **unabhängig bereitgestellter, wegwerfbarer PostgreSQL-Prozess** mit kontrolliertem Datadir und eindeutigem Port verwendet werden. Der lokale Postgres-Superuser darf nicht zu einer RealSync-Umgebung gehören.

## Lokaler Testablauf (nur bei bewusst geschaffener neuer Testinstanz)

`node --test preflight.test.mjs` kann ohne PostgreSQL laufen. 

Zum DB-Test zusätzlich `pg` aus einer geprüften Abhängigkeitsinstallation bereitstellen, Datenbankname `sf003_test_factory`, Port `55432`, Superuser nur auf dem isolierten Cluster, dann:

```
SF003_DISPOSABLE_DB=YES SF003_SCHEMA_RESET=YES \
SF003_TEST_DATABASE_URL=postgresql://postgres:LOCAL_PASSWORD@127.0.0.1:55432/sf003_test_factory \
node --test integration.test.mjs
```

**STOP:** Keine produktive Supabase-Instanz, kein Deployment, kein PR unter WIP-Stopp, kein RLS-/Evidence-Live-Claim. Vor einer möglichen Übernahme ist ein separates Code-Security-Review erforderlich.

**Hinweis zu Testrollen:** `schema.sql` legt NOLOGIN-Testrollen clusterweit an. Das Testpaket entfernt diese Rollen nicht, um keine Rollen in anderen Datenbanken eines geteilten Clusters zu verändern. Nur einen ausschließlich für SF-003 eingerichteten, wegwerfbaren PostgreSQL-Cluster verwenden.
