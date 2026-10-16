---
name: aios-pr-review
description: AI-OS Development Agent — einen Pull Request prüfen (Korrektheit, Scope, Sicherheitsgrenzen, Repo-Regeln). Eingabe PR-Nummer. Nur Bericht, kein Merge.
---

# GitHub PR Review

**Agent:** Development · **Register:** `packages/ai-os-core/src/skills.ts` (`aios-pr-review`)
**Rechte:** `github.pulls.read`, `github.actions.read` — lesen, kein Approve, kein Merge.

## Eingaben
- `pr` (Pflicht): PR-Nummer
- `focus` (optional): Schwerpunkt, z. B. Sicherheit, UI, Migration

## Ablauf
1. PR-Metadaten, Diff und Check-Status lesen (GitHub-MCP `pull_request_read`).
2. Scope gegen den PR-Titel prüfen: berührt der Diff Hot-Files (`scripts/lib/merge-playbook.mjs`)?
3. Harte Verbote aus `CLAUDE.md` prüfen: Secrets, Service-Role im Browser, destruktive Migration, Tenant aus URL/Body statt JWT → `memberships`.
4. Je Befund einen realistischen Fehlerpfad (Eingabe → falsches Ergebnis) nennen.
5. Rote Checks an `/aios-ci-failure-analysis` übergeben statt selbst zu raten.

## Ausgaben
- `findings`: Liste `Datei:Zeile — Schweregrad — Fehlerpfad — Fix`
- `verdict`: mergebar · Änderungen nötig · blockiert (mit Begründung)

## Qualität
- Stilfragen sind nie Blocker.
- Keine erfundenen Zeilen: jede Fundstelle per Read/Grep belegt.
- Kein Kommentar auf GitHub ohne ausdrücklichen Auftrag.
