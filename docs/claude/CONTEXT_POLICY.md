# Claude Code — Kontext- und Token-Policy

Stand: 2026-09-12, ergänzt 2026-10-24

## Problem

Die alte Root-`CLAUDE.md` war ~88 KB / ~22k Tokens und wurde **in jeder Nachricht** geladen.
Zusätzlich startete `.claude/hooks/session-start.sh` in Cloud-Sessions (`CLAUDE_CODE_REMOTE=true`) jedes Mal `npm install` (Timeout 10 min).
`.mcp.json` lud acht MCP-Server (7× Hostinger + Perplexity) — Tool-Schemas in jeder Runde.
Ein versehentliches Read von `package-lock.json` (~185k Tokens) oder
`pricing.generated.ts` (~35k Tokens) leert das Fenster in einem Turn.

## Regeln

1. Root-`CLAUDE.md` bleibt unter ~150 Zeilen / ~2k Tokens (`npm run check:context`).
2. Ledger, Migrationszählung, Deploy-Run-IDs, Tabellen-Forensik → `docs/` oder Git-History, nie in CLAUDE.md zurückschreiben.
3. Cloud-SessionStart darf kein `npm install` ausführen. Abhängigkeiten kommen aus dem Setup-Skript
   der Cloud-Umgebung (unten). Agenten installieren nicht selbst, auch nicht über `npx`, Scratchpad oder globale Pakete.
4. MCP nur aktivieren, wenn die Session sie braucht; Website-Default: `.mcp.json` leer.
5. Website-Arbeit: Scope auf `src/pages` + genutzte Components. Kein Repo-Root-Glob.
6. Lange Chats beenden; neue Session nach großen Kontext-Änderungen.
7. Read-Deny in `.claude/settings.json` für Lockfiles, `*.generated.ts`, Build-Reports —
   nicht umgehen, indem die Dateien per Shell ganz ausgegeben werden.
8. `CLAUDE.md` importiert `AGENTS.md` (`@AGENTS.md`, offizielle Claude-Code-Importsyntax; ohne Import
   liest Claude `AGENTS.md` nicht, sobald eine `CLAUDE.md` existiert). Beide zählen ins Budget.
   Profile unter `docs/claude/profiles/` werden nur bei Bedarf gelesen, nie importiert.
9. Betriebsregeln zu Cron/Health gehören in Runbooks — kanonisch:
   `docs/runbooks/agenten-bestandsaufnahme-2026-09-06.md` §3 — nicht zurück in Root-`CLAUDE.md`.

## Cloud-Setup für Abhängigkeiten (Entscheidung A, 24.10.2026)

Abhängigkeiten werden vor der Agentensitzung bereitgestellt, nicht im Gespräch und nicht als
SessionStart-Hook. Einrichtung durch Dominik: Cloud-Umgebung → Edit → Setup script. Das Skript
läuft beim Start jeder neuen Cloud-Session (neuer Container), außerhalb des Agentenkontexts,
und startet ein Verzeichnis über dem Repo. Die Sperre `npm install`/`npm ci` in
`.claude/settings.json` bleibt unverändert.

```bash
#!/bin/bash
set -uo pipefail
cd RealSyncDynamics.AI || exit 1
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 HUSKY=0
log="$HOME/.deps-setup.log"; : > "$log"
# Nur aus Lockfiles (reproduzierbar). Ein Fehler stoppt nur das betroffene Paket.
for d in . apps/agent-runtime apps/mcp-server services/openclaw-agent \
         services/playwright-scanner services/realsync-runtime-core; do
  if (cd "$d" && npm ci --no-audit --no-fund >/dev/null 2>&1); then
    echo "ok $d" >> "$log"
  else
    echo "FEHLER $d" >> "$log"
  fi
done
```

- Ohne Lockfile und daher nicht reproduzierbar: `worker/`, `deploy/playwright-scanner/`. Werden nicht installiert.
- Agenten lesen `~/.deps-setup.log` und melden fehlende Pakete. Prüfungen dort sind `TEILWEISE`.
- Abweichungen zur CI: Container-Node (aktuell 22) gegenüber CI-Node 20; Playwright-Browser des
  Containers gegenüber der Projektversion. Maßgeblich bleibt die CI.

## Wiederherstellen der langen Datei

`git show a5041eb:CLAUDE.md` (Stand vor diesem Slim-Cut).
Nicht nach Root kopieren, solange Cloud Code Tokens sparen soll.
