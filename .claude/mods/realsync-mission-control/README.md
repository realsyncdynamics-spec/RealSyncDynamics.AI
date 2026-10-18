# RealSync Mission Control (Claude-Code-Mod)

Eine Steuerzentrale für die Entwicklung von RealSyncDynamics.AI in Claude Code.
Sie zeigt, woran Claude arbeitet, und hält riskante Aktionen an, bis du sie
ausdrücklich freigibst.

**Ein Entwicklungswerkzeug, kein Teil der Anwendung.** Der Mod liegt unter
`.claude/mods/`. Root-`tsc` (`npm run lint`), Vitest (`test/**`), der
Vite-Build und `check:context` erfassen ihn nicht.

## Voraussetzungen

- Claude Code **2.1.287 oder neuer** (Mod-API), getestet mit **2.1.302**
- `git` im `PATH`
- optional `gh`, angemeldet (`gh auth login`), für PR-, CI- und Review-Daten.
  Ohne `gh` zeigt der Bereich ausdrücklich „Status nicht verfügbar“.
- **Windows:** keine `bash`, kein `sleep`, kein `find`/`du` nötig. Der Mod ruft
  nur `git` und `gh` auf. Beim Messen versteht er Pfade im Stil `C:\…`, das
  Zerlegen von Shell-Befehlen folgt aber der POSIX-Syntax (Claude führt Bash
  auch unter Windows über Git Bash aus).

## Installation (lokal)

Nur für eine Sitzung:

```bash
claude --plugin-dir .claude/mods/realsync-mission-control
```

Dauerhaft (liest direkt aus dem Ordner; nach Änderungen `/reload-plugins`):

```bash
claude plugin marketplace add ./.claude/mods
claude plugin install realsync-mission-control@realsync-mods --scope user
```

Entfernen: `claude plugin uninstall realsync-mission-control@realsync-mods --scope user`

Einstellungen (`/config` oder `pluginConfigs` in den Settings):

| Feld | Werte | Bedeutung |
|---|---|---|
| `safety` | `an` (Standard) / `aus` | `aus` protokolliert riskante Aktionen nur, z. B. wenn stattdessen Blast Radius genutzt wird |
| `repo` | `owner/repo` | Ziel der GitHub-Abfrage, Standard `realsyncdynamics-spec/RealSyncDynamics.AI` |

## Bedienung

| Wo | Was |
|---|---|
| `/mission-control` | öffnet das Pane; optional mit Bereich: `agenten`, `dateien`, `kontext`, `github`, `sicherheit` |
| `/mc-status` | derselbe Stand als Text (für schmale Terminals, Mobile oder wenn kein Pane möglich ist) |
| Statuszeile | `◆ Mission Control │ ⎇ Branch ±Änderungen │ Agenten n │ Kontext % │ CI │ ⛔ Freigaben` |
| Tasten im Pane | `1`–`6` Bereiche, `r` aktualisieren, Esc zurück zum Prompt |

Aufbau: **oben** die Statusleiste (Projekt, Branch, Agenten, Kontext, CI),
**in der Mitte** die aktive Aufgabe mit dem tatsächlichen Fortschritt,
**seitlich** Agenten und Dateiaktivität (ab 100 Spalten nebeneinander,
darunter untereinander), **unten** Warnungen, Blocker und nächste Schritte.

## Was angezeigt wird, und woher es kommt

Jede Anzeige stammt aus einer Quelle, die die Engine tatsächlich meldet. Fehlt
eine Quelle, steht dort „nicht verfügbar“ oder „nicht gemeldet“. Es gibt
keine Schätzwerte und keine erfundenen Prozentangaben.

| Bereich | Inhalt | Quelle |
|---|---|---|
| A. Agenten | Beschreibung, Typ, Status, Laufzeit, Anzahl Tools, letztes Tool | `Agent`-Aufrufe, `tool.call` mit `agentId`, `$.agent.list()`, `turn.complete` des Subagenten |
| B. Fortschritt | Auftrag, Ablauf *Aufgabe → Analyse → Implementierung → Test → Review → Freigabe* mit Beleg je Schritt, Checkliste der Teilaufgaben („n von m erledigt“), Blockierte | Prompt, Lese- und Schreibzugriffe, Prüfläufe, PR-Status; `TaskCreate`/`TaskUpdate`/`TodoWrite` |
| C. Dateien | gelesen, bearbeitet, neu, gelöscht, uncommittet; **Diff** je Datei (Arbeitsstand ↔ HEAD, neue Datei, sonst letzter Commit) | Read/Edit/Write-Aufrufe, `rm`, `git status`, `git diff` |
| D. Kontext | Füllung in %, genutzt/frei, Verlauf der letzten 30 Züge, Δ zum Vorzug, Cache gelesen/geschrieben des letzten Zugs, Kosten | `$.session.usage()`, `turn.complete.usage` |
| E. Git & CI | Branch, Upstream, ahead/behind, letzter Commit, lokale Änderungen, lokale Prüfläufe (test/build/lint/typecheck mit Ergebnis), aktueller PR (Merge-Konflikt, Review, Checks), blockierte PRs, Überschneidungen mit Dashboard-PRs, offene P0/P1 | `git`, `gh api` (REST) |
| F. Sicherheit | Protokoll aller angehaltenen, freigegebenen, abgebrochenen und protokollierten Aktionen | eigener `tool.call`-Guard |

Bewusst nicht angezeigt:

- Cache-Restlaufzeiten: Die Engine meldet sie nicht.
- Fortschrittsprozente: Wo keine messbare Zahl existiert, zeigt der Mod eine Checkliste.
- Künstliche Aktivität zum Warmhalten des Caches: Der Mod stellt keine Modellanfragen.

Hinweise ab **70 %** Kontext: `/compact` erwägen. Ab **85 %**: Arbeitsstand
dokumentieren, dann `/compact` oder eine neue Sitzung.

## Safety Control

Vor jedem Werkzeugaufruf prüft der Mod, ob die Aktion riskant ist. Bei einer
riskanten Aktion misst er zuerst die Auswirkung, etwa betroffene Dateien,
verlorene Commits oder das Ziel-Projekt. Dann fragt er im Dialog von
Claude Code nach: **„Abbrechen“** (Standard) oder **„Einmal ausführen“**.

Angehalten werden:

- **Löschen:** `rm -r/-f`, `rm` versionierter Dateien, `git rm`, `find -delete`
- **Git-Verlust:** `git reset --hard`, `git clean`, `git checkout -- .`, `git restore`, `git stash drop/clear`, `filter-branch`, `reflog expire`
- **Force-Push:** `--force`, `-f`, `--force-with-lease`, `+refspec`
- **Branch:** `git branch -D/-m`, `push --delete`, `checkout -B`, `switch -C`
- **Merge:** `gh pr merge`, Push oder Merge direkt auf `main`/`master`, GitHub-MCP `merge_pull_request`/`enable_pr_auto_merge`/`push_files` auf `main`
- **Datenbank / Supabase:** `supabase db push/reset`, `migration up/repair`, `psql`, `prisma migrate`, `drizzle-kit push`, `wrangler d1 … --remote`, Supabase-MCP `apply_migration` und schreibendes `execute_sql` (lesendes SQL bleibt frei)
- **Umgebungsvariablen:** Schreiben in `.env*` (außer `.example`/`.sample`/`.template`), `supabase secrets`, `wrangler secret`, `gh secret`, `vercel env`. Werte werden nie angezeigt.
- **Deployment:** `wrangler deploy`, `wrangler pages deploy`, `supabase functions deploy`, `npm run deploy*`/`release*` (z. B. `release:merge`), `npm publish`, `vercel`, `gh workflow run`, Vercel- und Cloudflare-MCP-Schreibaufrufe
- **Externe Aktion:** `npm run stripe:*` (Stripe-Katalog) und weitere MCP-Werkzeuge mit `deploy`, `publish`, `delete`, `reset`, `migrate`, `secret`, `rollback` …

Nur protokolliert, nicht angehalten: Änderungen an `supabase/migrations/`,
`wrangler.*` und `.github/workflows/` sowie `git rebase`. Ein gewöhnlicher
`git push` oder `git merge` auf einem Feature-Branch läuft still durch.

Grundsätze:

- **Nur die ausdrückliche Wahl „Einmal ausführen“ gibt frei.** Ein
  geschlossener Dialog, eine frei getippte Antwort, ein Dialog, der sich nach
  Inaktivität selbst auflöst, oder eine Sitzung ohne Person (`claude -p`)
  zählen als „nicht ausführen“.
- **Fail-closed:** Wirft die Prüfung selbst einen Fehler, wird die Aktion verweigert.
- **Unabhängig vom Berechtigungsmodus:** Auch was `allowedTools` oder Auto
  freigeben würden, wird angehalten.
- **Keine vollständige Sicherheitsbarriere.** Die Erkennung arbeitet mit
  Mustern. Ein Befehl in einem Skript (`bash deploy.sh`) oder ein
  verschleierter Aufruf wird nicht erkannt. Die Berechtigungsregeln von
  Claude Code (`.claude/settings.json`), Branch-Protection und CI-Gates
  bleiben deshalb nötig.

## Die offiziellen Beispiel-Mods

Geprüft wurde der Quellcode im Repository `anthropics/claude-code-playground`
(Commit `569c528`, 01.10.2026), Ordner `claude-code/mods/`. Alle drei Mods
bestehen `claude plugin validate`. Sie bringen keine Abhängigkeiten mit und
haben keinen Netzwerkzugriff.

| Mod | Ergebnis | Empfehlung |
|---|---|---|
| **Replay Theater** | liest Dateien vor jeder Bearbeitung, öffnet nach einem Zug mit Änderungen ein fokussiertes Pane zum Durchschalten der Diffs | **ergänzend sinnvoll.** Mission Control verweist auf `/replay` statt die Funktion zu doppeln. Achtung: Das Pane öffnet sich nach jedem Zug mit Änderungen von selbst. |
| **Token Weather** | Kontextanzeige über dem Prompt | **redundant** zu Bereich D. Belegt das Band über dem Prompt dauerhaft und verdrängt dort andere Mods (Replay Theater). Nur eines von beiden nutzen. |
| **Blast Radius** | hält riskante Bash-Befehle an (rm, reset, clean, Force-Push, Migrationen) | **redundant** zu Bereich F, der zusätzlich RealSync-spezifische Fälle abdeckt (Supabase, Wrangler, .env, Merge, MCP). Der Guard hat **kein `.catch`**, lässt den Befehl bei einem eigenen Fehler also durch (fail-open). Braucht `bash`, `sleep`, `find`, `du`, unter Windows also Git Bash oder WSL. Wer ihn nutzen will: `safety` = `aus` setzen, sonst wird doppelt gefragt. |

Installation aus einem lokalen Klon des Playground-Repos:

```bash
claude plugin marketplace add ./claude-code-playground/claude-code/mods
claude plugin install replay-theater@claude-code-playground-mods --scope user
```

## Entwicklung und Tests

```bash
cd .claude/mods
claude plugin validate ./realsync-mission-control   # Manifest, Hooks, Aufrufe
claude plugin test ./realsync-mission-control       # 84 Tests gegen die Engine
```

`tsc -p .claude/mods/realsync-mission-control` prüft die Typen, sobald die
Engine den Mod einmal geladen und `.claude-plugin/types/` angelegt hat.

| Datei | Inhalt |
|---|---|
| `hooks/register.tsx` | Hooks, Zustand, Freigabedialog, Pane |
| `hooks/risk.ts` | Risikoerkennung (reine Funktionen) |
| `hooks/derive.ts` | Ablaufphasen, Hinweise, git-/gh-Parser |
| `types/index.d.ts` | Vertrag für `$.state` |
| `tests/` | Klassifizierer-, Engine- und Pane-Tests (Terminal, Desktop, Mobile) |
