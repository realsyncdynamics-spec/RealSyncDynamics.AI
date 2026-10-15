---
name: aios-knowledge-update
description: AI-OS Knowledge Agent — Wissensbasis docs/ai-os pflegen: Entscheidung erfassen, mit Quelle verknüpfen, Frontmatter (owner, reviewed) setzen. Änderung nur per PR.
---

# Knowledge Base Update

**Agent:** Knowledge · **Routine:** `docs-control`
**Rechte:** `github.contents.read`, `github.knowledge.propose` (Draft-PR, nur `docs/ai-os/**.md`)

## Eingaben
- `source` (Pflicht): Entscheidung, PR, ADR oder Notiz

## Ablauf
1. Passende Notiz in `docs/ai-os/wissen/` wählen; nur neue Notiz, wenn kein Thema passt (Doku-Budget).
2. Verlinken statt kopieren: Quelle der Wahrheit bleibt Code/ADR/PLAN.md.
3. Frontmatter pflegen: `title`, `owner`, `reviewed: YYYY-MM-DD`, `status`.
4. Inhalt auf Zugangsdaten und personenbezogene Daten prüfen — beides gehört nie ins Repository.
5. Änderung als PR (Command Center → Wissen → „Als PR vorschlagen" oder Claude-Sitzung).

## Ausgaben
- `note`: aktualisierte Notiz mit Frontmatter und Quellenlinks

## Qualität
- Keine privaten Dokumente, Fallakten, Passwörter oder Schlüssel.
- Obsidian-kompatibel: normale Markdown-Links, keine Plugin-Syntax.
