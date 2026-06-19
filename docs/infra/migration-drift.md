# Prod-Migrations-Drift — `20260510` Orphan + Pipeline-Maskierung

**Status:** offen — Reconciliation erfordert eine prod-seitige `supabase migration repair`
(History-Mutation), die bewusst NICHT automatisiert ausgefuehrt wird.

## Symptom

Der Deploy-Job „Push migrations" (`.github/workflows/deploy.yml`) lief gruen,
obwohl `supabase db push` real mit Exit-Code 1 abbrach. Ursache war ein
fehlendes `exit` im Failure-Zweig — eine `::error::`-Annotation allein faellt
den Job nicht. Folge: **keine** Migration erreichte Prod, auch
`supabase/migrations/20260626000000_dsr_erasure_automation.sql` (P0.2) nicht.

Dieser PR fixt die Maskierung (harter `exit`). Der eigentliche Drift bleibt und
ist hier dokumentiert.

## Root Cause

`supabase db push` bricht ab mit:

```
Remote migration versions not found in local migrations directory.
... supabase migration repair --status reverted 20260510
```

- Betroffene Datei: `supabase/migrations/20260510_ai_governance_core.sql`.
- Sie ist (neben `00001_initial_schema.sql`) die **einzige** Migration ohne
  14-stelligen Zeitstempel — Versions-Prefix `20260510` (8-stellig) statt
  `YYYYMMDDHHMMSS`. Die uebrigen 158 Dateien sind 14-stellig.
- Die Remote-History (`supabase_migrations.schema_migrations`) fuehrt exakt
  `20260510` (`ai_governance_core`). Der CLI-`db push` matcht die 8-stellige
  Datei dennoch nicht gegen diesen Eintrag und behandelt ihn als Orphan; das
  blockiert den gesamten Push.

## Blast Radius

- Die Prod-History fehlt zahlreiche Eintraege (~`20260602xxxxxx`–`20260619`,
  `20260624`–`20260625`), obwohl die zugehoerigen **Objekte** in Prod
  existieren (`runtime_events`, `subject_ref_keys`/`subject_ref_mappings`,
  `request_subject_erasure`, `process_subject_erasure_queue`). Das Schema ist
  also weiter als die aufgezeichnete History.
- Solange der Orphan nicht reconciled ist, deployt **kein** PR Migrationen.
- Latent in Prod aktiv: `runtime_events.spec_version` Default = `'1.0'`, aber die
  CHECK-Constraint erlaubt nur `('0.1','0.2')` → jeder Insert ohne explizites
  `spec_version` scheitert; `runtime_events` ist in Prod leer. Fix liegt in
  `20260626000000` (Default → `'0.2'`) — erreicht Prod aber erst nach
  Reconciliation.

## Reconciliation (manuell / nach expliziter Freigabe)

Append-only-Guard verbietet das Umbenennen der gemergten 8-stelligen Datei
(umbenennen = alte Datei geloescht → Guard schlaegt an). Die History-Korrektur
muss daher prod-seitig erfolgen, z. B.:

```bash
supabase link --project-ref <ref>
# Orphan-Eintrag als reverted markieren, damit db push fortfahren kann:
supabase migration repair --status reverted 20260510
# Danach Trockenlauf prüfen, welche Migrationen db push anwenden WOLLTE:
supabase db push --include-all --dry-run
```

**Achtung:** Nach dem Repair will `db push` alle in der History fehlenden
Migrationen anwenden, deren Objekte teils bereits existieren. Nicht-idempotente
Migrationen koennen dabei (halb) fehlschlagen. Vor einem echten Push ist der
Dry-Run auszuwerten und ggf. einzelne bereits-angewendete Versionen via
`supabase migration repair --status applied <version>` als angewendet zu
markieren. Diese Schritte gehoeren in einen kontrollierten, beobachteten
Infra-Lauf — nicht in einen automatischen Deploy.
