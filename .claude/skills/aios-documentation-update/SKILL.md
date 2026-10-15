---
name: aios-documentation-update
description: AI-OS Knowledge Agent — Dokumentation nach einer Codeänderung nachziehen, innerhalb des Kontextbudgets (check:context). Ergebnis als PR.
---

# Documentation Update

**Agent:** Knowledge · **Routine:** `docs-control` (`.github/workflows/ai-os-docs-control.yml`)
**Rechte:** `github.contents.read`, `github.pr.prepare`

## Eingaben
- `change` (Pflicht): PR-Nummer oder geänderte Pfade

## Ablauf
1. Betroffene Doku finden (`rg -l "<Symbol|Route>" docs/ .claude/`); vorhandene Dateien aktualisieren.
2. `CLAUDE.md` nur ändern, wenn sich ein Einstiegspunkt ändert — kurz halten.
3. `npm run check:context` ausführen; Budget nie anheben, lieber auslagern.
4. Änderung als eigener Branch + Draft-PR.

## Ausgaben
- `diff`: Doku-PR mit Begründung je Datei

## Qualität
- Keine Messprotokolle oder Ledger in `CLAUDE.md`.
- Keine Doku-Ablage im Repo-Root (Grenze 8 Dateien).
