# Claude Code — Kontext- und Token-Policy

Stand: 2026-09-12

## Problem

Die alte Root-`CLAUDE.md` war ~88 KB / ~22k Tokens und wurde **in jeder Nachricht** geladen.
Zusätzlich startete `.claude/hooks/session-start.sh` in Cloud-Sessions (`CLAUDE_CODE_REMOTE=true`) jedes Mal `npm install` (Timeout 10 min).
`.mcp.json` lud acht MCP-Server (7× Hostinger + Perplexity) — Tool-Schemas in jeder Runde.
Ein versehentliches Read von `package-lock.json` (~185k Tokens) oder
`pricing.generated.ts` (~35k Tokens) leert das Fenster in einem Turn.

## Regeln

1. Root-`CLAUDE.md` bleibt unter ~150 Zeilen / ~2k Tokens (`npm run check:context`).
2. Ledger, Migrationszählung, Deploy-Run-IDs, Tabellen-Forensik → `docs/` oder Git-History, nie in CLAUDE.md zurückschreiben.
3. Cloud-SessionStart darf kein `npm install` ausführen.
4. MCP nur aktivieren, wenn die Session sie braucht; Website-Default: `.mcp.json` leer.
5. Website-Arbeit: Scope auf `src/pages` + genutzte Components. Kein Repo-Root-Glob.
6. Lange Chats beenden; neue Session nach großen Kontext-Änderungen.
7. Read-Deny in `.claude/settings.json` für Lockfiles, `*.generated.ts`, Build-Reports —
   nicht umgehen, indem die Dateien per Shell ganz ausgegeben werden.
8. Betriebsregeln zu Cron/Health gehören in Runbooks — kanonisch:
   `docs/runbooks/agenten-bestandsaufnahme-2026-09-06.md` §3 — nicht zurück in Root-`CLAUDE.md`.

## Wiederherstellen der langen Datei

`git show a5041eb:CLAUDE.md` (Stand vor diesem Slim-Cut).
Nicht nach Root kopieren, solange Cloud Code Tokens sparen soll.
