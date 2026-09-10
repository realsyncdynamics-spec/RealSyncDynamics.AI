# Claude Code — Kontext- und Token-Policy

Stand: 2026-09-10

## Problem

Die alte Root-`CLAUDE.md` war ~88 KB / ~22k Tokens und wurde **in jeder Nachricht** geladen.
Zusätzlich startete `.claude/hooks/session-start.sh` in Cloud-Sessions (`CLAUDE_CODE_REMOTE=true`) jedes Mal `npm install` (Timeout 10 min).
`.mcp.json` lud acht MCP-Server (7× Hostinger + Perplexity) — Tool-Schemas in jeder Runde.

## Regeln

1. Root-`CLAUDE.md` bleibt unter ~150 Zeilen / ~2k Tokens.
2. Ledger, Migrationszählung, Deploy-Run-IDs, Tabellen-Forensik → `docs/` oder Git-History, nie in CLAUDE.md zurückschreiben.
3. Cloud-SessionStart darf kein `npm install` ausführen.
4. MCP nur aktivieren, wenn die Session sie braucht.
5. Website-Arbeit: Scope auf `src/pages` + genutzte Components. Kein Repo-Root-Glob.
6. Lange Chats beenden; neue Session nach großen Kontext-Änderungen.

## Wiederherstellen der langen Datei

`git show a5041eb:CLAUDE.md` (Stand vor diesem Slim-Cut).
Nicht nach Root kopieren, solange Cloud Code Tokens sparen soll.
