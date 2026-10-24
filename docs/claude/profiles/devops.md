# Profil: DevOps (CI, Build, Deploy, Monitoring)

Ebene 3. Gilt zusätzlich zu `AGENTS.md`, lockert nichts davon.

## Pfade

`.github/workflows/**`, `deploy/**`, `scripts/` (Deploy-, Release- und Prüfskripte), `wrangler.toml`,
`workers/**/wrangler.jsonc`.

## Regeln

- Änderung an einem Workflow mit Produktionswirkung, an Secrets-Zugriff, Environments,
  Branch-Schutz oder Auto-Merge: Einzel-Freigabe, als eigenes Paket.
- Kein Workflow-Dispatch für Deploy-, Migrations- oder Lösch-Workflows ohne Einzel-Freigabe.
- Notfallpfad `npm run release:merge` (pusht direkt auf `main` und deployt): nur mit Einzel-Freigabe.
- Prüfungen nicht abschwächen: kein `continue-on-error`, kein Entfernen von Required Checks,
  kein `|| true` um Tests.

## Produktionspfade

Inventar, Risiken und Zielkonzept: `docs/claude/DEPLOYMENT_GOVERNANCE_PLAN.md`.
Kurz: Pages, Supabase (DB und Functions), VPS-Runtime und drei Workers deployen heute bei
Push auf `main` ohne Environment-Freigabe.

## Prüfungen

YAML-Struktur lokal parsen, `npm run check:context`, bei Skripten deren Tests.
Wirkung erst nach Merge sichtbar: Plan mit Rollback vorlegen, bevor die Freigabe erteilt wird.
