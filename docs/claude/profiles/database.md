# Profil: Database (Supabase, RLS, Migrationen, Edge Functions)

Ebene 3. Gilt zusätzlich zu `AGENTS.md`, lockert nichts davon.

## Pfade

Schreiben: `supabase/migrations/**` (nur neue Dateien), `supabase/functions/**`.
Dateien unter `supabase/migrations/`, die schon auf `main` liegen, nie ändern.

## Regeln

- Jede Migration: Einzel-Freigabe, nie gebündelt, nie parallel zu anderen Migrationen oder offenen Rebases.
- Append-only, eindeutiger Timestamp nach der letzten Datei auf `main` (`npm run migrate:rename` bei Kollision).
- Keine destruktiven Schritte (`DROP`, Datenlöschung, Typverengung) ohne ausdrückliche Freigabe.
- RLS-Änderungen sind Security-Änderungen → `security.md`.
- Service-Role nur in Edge Functions.

## Produktionswirkung

Ein Push auf `main` unter `supabase/migrations/**` oder `supabase/functions/**` führt heute
automatisch `supabase db push --include-all` bzw. den Functions-Deploy aus
(`.github/workflows/deploy.yml`). Merge = Produktionsmigration. `automerge` ist für diese PRs gesperrt.

## Prüfungen

`npm run check:migration-collisions`, `npm run check:edge-syntax`, `npm run check:edge-refs`,
`npm run check:function-acls`, `npm run test:db` (lokale Test-DB, Voraussetzungen siehe `scripts/test-db/`).
CI: `ci.yml` Job `Migration validation`, `migration-collision.yml`, `migration-drift.yml`.
