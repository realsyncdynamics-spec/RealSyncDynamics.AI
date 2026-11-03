# Runbook: Environment-Gate vor `supabase db push` (E6)

Jeder produktive `db push` und jeder Ledger-Repair läuft erst, wenn
`scripts/ci/verify-db-target.mjs verify` das Ziel bestätigt hat. Fehlt eine
Angabe oder widerspricht sie, bricht der Job ab, bevor etwas in die Datenbank
geschrieben wird.

## Was geprüft wird

| Reihenfolge | Prüfung | Abbruch-Code |
|---|---|---|
| 1 | `DEPLOY_ENVIRONMENT` gesetzt und `production` oder `staging` | `ENV_MISSING`, `ENV_UNKNOWN` |
| 2 | Environment-Variable `SUPABASE_EXPECTED_PROJECT_REF` gesetzt, 20 Kleinbuchstaben | `EXPECTED_REF_MISSING`, `EXPECTED_REF_INVALID` |
| 3 | Secret `SUPABASE_PROJECT_ID` = erwartete Ref | `TARGET_REF_MISSING`, `TARGET_REF_MISMATCH` |
| 4 | `supabase/.temp/project-ref` (nach `supabase link`) = erwartete Ref | `LINKED_REF_MISSING`, `LINKED_REF_MISMATCH` |
| 5 | `production` nur von `refs/heads/main` | `PRODUCTION_NOT_MAIN` |

Meldungen zeigen Projekt-Refs nur maskiert (`***abcd`). Die Ausgabe von
`db push` läuft durch `verify-db-target.mjs redact`, bevor sie im Log oder in
der Step-Summary landet. Der Filter ersetzt `SUPABASE_DB_PASSWORD`,
`SUPABASE_ACCESS_TOKEN`, Postgres-URI-Zugangsdaten, `sbp_…`-Tokens, JWTs und
`password=…`.

## Abgedeckt

- `.github/workflows/deploy.yml`, Job `db-push`
- `.github/workflows/migration-reconciliation.yml`
- `scripts/deploy-phase4.sh` (lokal)

Nicht abgedeckt: `functions deploy`. Das Gate betrifft nur Schreibzugriffe auf
die Datenbank.

## Einmalige Einrichtung (vor dem Merge des Gate-PRs)

Nur Namen, keine Werte in Tickets oder Chats.

1. GitHub → Settings → Environments → `production` anlegen oder öffnen.
2. **Deployment branches**: nur `main`.
3. **Environment variable** `SUPABASE_EXPECTED_PROJECT_REF` = Projekt-Ref des
   Produktionsprojekts. Das ist eine Variable, kein Secret: Die Ref ist kein
   Zugangsdatum, soll aber bewusst gepflegt werden.
4. Optional: **Required reviewers** für `production`. Dann wartet jeder
   db push auf eine menschliche Freigabe.

Ohne Schritt 3 schlägt der nächste Deploy nach dem Merge mit
`EXPECTED_REF_MISSING` fehl. Das ist beabsichtigt (fail-closed), blockiert
aber Migrationen, bis die Variable steht.

## Lokal (`deploy-phase4.sh`)

```bash
export SUPABASE_EXPECTED_PROJECT_REF=<ref aus dem Environment>
export SUPABASE_PROJECT_ID=<ref, gegen die gelinkt wurde>
supabase link --project-ref "$SUPABASE_PROJECT_ID"
./scripts/deploy-phase4.sh staging
```

`production` verlangt zusätzlich den Branch `main`.

## Fehlerbilder

| Code | Ursache | Behebung |
|---|---|---|
| `EXPECTED_REF_MISSING` | Variable im Environment fehlt | Schritt 3 oben |
| `TARGET_REF_MISMATCH` | Secret `SUPABASE_PROJECT_ID` zeigt auf ein anderes Projekt | Secret oder Variable prüfen. **Nicht** die Variable an das Secret anpassen, ohne zu klären, welches Projekt richtig ist |
| `LINKED_REF_MISSING` | `supabase link` lief nicht oder schlug fehl | Link-Schritt und Zugangsdaten prüfen |
| `PRODUCTION_NOT_MAIN` | Lauf von einem anderen Branch | nur von `main` deployen |
