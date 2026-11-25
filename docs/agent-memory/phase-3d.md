# Phase 3d — Agentenintegration und technische Absicherung

**Stand:** 25.11.2026 · Branch `claude/festive-galileo-f79169` (gestapelt auf #2416) ·
Status: IMPLEMENTIERT, Hooks GETESTET (lokal), nichts gemergt, nichts LIVE.
Verbindlich bleiben `AGENTS.md` und `CLAUDE.md`. Statusstufen wie `roles.md`.

## 1. Bestand und Konflikte (geprüft mit `git merge-tree`, 25.11.2026)

Alle Einzel-PRs basieren auf `main` = `3a58095` und sind 0 Commits hinter `main`.

| PR | Inhalt | gegen #2416 | Auflösung |
|---|---|---|---|
| #2416 | CHIEF-Setup: Bash-Guard, Rechte, Tiefe 1, Auto-Merge aus, DEPUTY/NOVA/roles (Fassung 3b) | – | zuerst; enthält Workflow- und Rechte-Änderung → Einzel-Freigabe |
| #2423 DEPUTY | `deputy.md` Fassung 3c | **Konflikt** (add/add) | 3c-Fassung übernehmen: Obermenge, zusätzlich WebFetch/WebSearch gesperrt |
| #2424 NOVA | `nova.md` Fassung 3c | **Konflikt** (add/add) | 3c-Fassung übernehmen: Obermenge, Web gesperrt, Skill `aios-compliance-verification` |
| #2426 ROLES | `roles.md` Fassung 3c | **Konflikt** (add/add) | 3c-Fassung übernehmen, Status VIO danach auf diese Datei verweisen |
| #2425 REA | `rea.md` | sauber | in diesem Branch konsolidiert (Abschnitt 3) |
| #2420 / #2434 | REA-Radar; #2434 enthält #2420 vollständig | sauber | in diesem Branch konsolidiert (Abschnitt 3) |
| #2427 VIO, #2428 MOTION, #2429 ATLAS, #2430 MIRA, #2431 DATA, #2432 FLOW | je eine Agentendatei | sauber | unverändert mergebar |

CI: Die Jobs `gates`, `unit`, `build`, `spa`, `responsive` laufen bei Draft-PRs nicht
(`.github/workflows/ci.yml:31`, Bedingung `!draft`). Auf #2416 sind sie `skipped`; grün sind
nur CodeQL, E2E, hygiene, conflict-state, Cloudflare-**Preview**. Volle CI-Abnahme braucht
„Ready for review“ (Entscheidung Dominik). Lokal für #2416 geprüft: `guard-bash.test.mjs`
50/50 OK, `npm run check:context` OK; `lint`/`test`/`build` nicht lokal (kein `node_modules`,
`npm install` gesperrt) → `TEILWEISE`.

Empfohlene Reihenfolge (je Merge Einzel-Freigabe, danach Rest-PRs per Merge von `main`
aktualisieren): #2416 → dieser Branch → #2423 → #2424 → #2426 → #2429 ATLAS → #2427 VIO →
#2428/#2430/#2431/#2432. #2420, #2425, #2434 sind durch diesen Branch ersetzt (schließen nur
nach Freigabe).

## 2. Technische Absicherung (neu)

| Regel | Durchsetzung | Test |
|---|---|---|
| VIO schreibt nur in `apps/agent-runtime/` | `guard-write-scope.mjs` (Edit/Write/MultiEdit/NotebookEdit, `agent_type` = `vio`), realpath gegen Symlinks, `.env*`/Schlüssel gesperrt | 21 Fälle |
| VIO-Bash nur Allowlist aus `vio.md` | `guard-bash.mjs` v3: `npm --prefix apps/agent-runtime test/typecheck/build`, lesende Werkzeuge, `git status/diff/log/show…`; Umleitungen nur in die Grenze | 30 Fälle |
| Keine Voice-/Telefonie-APIs | `guard-bash.mjs` (curl/wget/nc/…, `node -e`/`python -c`, `… \| sh`, Anbieter-CLIs, jede URL bei Nicht-Textwerkzeugen), `guard-network.mjs` (WebFetch, MCP-URL-/Code-Felder), deny `mcp__ElevenLabs`, `Bash(twilio *)` | 52 Fälle (27 Bash, 25 WebFetch/MCP) |
| ATLAS darf öffentliche Preis-/Doku-Seiten lesen | `blockedUrlHost`: Bare-Domain und `www/docs/help/support/status/blog/community` erlaubt, sonst gesperrt; nie mit Zugangsdaten in der URL | in den 52 enthalten |
| Keine Schlüssel lesen | deny `Read(**/.env)`, `.env.local`, `.env.*.local`, `.env.production` | – |

Sperrliste: `.claude/hooks/lib/voice-hosts.mjs`. Freigabe eines Dienstes = Eintrag per PR
entfernen (Einzel-Freigabe), kein Umgehungsschalter. Befehl: `npm run test:hooks` (nur Mocks,
kein Netzwerk). Wirkungsnachweis in dieser Sitzung: Nach dem deny-Eintrag hat Claude Code
die `mcp__ElevenLabs__*`-Werkzeuge entfernt; der Bash-Guard hat einen eigenen Heredoc mit
Voice-Host blockiert (erwarteter Fehlalarm, Abschnitt 5).

## 3. REA ↔ ATLAS (konsolidiert)

| Tätigkeit | Zuständig |
|---|---|
| Marktbeobachtung, Wettbewerb, neue KI-Tools | ATLAS |
| Technische Integrationsprüfung, Umsetzung | REA |
| Sicherheitsbewertung · Abnahme · Verteilung | NOVA · DEPUTY · CHIEF |

Umgesetzt: Subagent `rea-radar` (#2434) entfernt, `/rea-radar` ruft `atlas` (Budget 30
Web-Aufrufe) und danach `rea`; eine Berichtsdatei `docs/rea/RADAR_BERICHT.md`, kein
`docs/agent-memory/tool-radar/` (#2425). Voraussetzung: #2429 (ATLAS) gemergt, sonst meldet
`/rea-radar` BLOCKIERT. Inhalte von `RADAR_BERICHT.md`/`ARBEITSPAKETE.md` unverändert aus
#2434 übernommen, **nicht** neu web-geprüft.

## 4. Steuerdokumentation gegen `PRICING_TAX_MODE`

Wirksam: `PRICING_TAX_MODE = 'EXEMPT'` (`shared/pricing.ts:3092`), Hinweis „Gemäß § 19 UStG
wird keine Umsatzsteuer berechnet.“ (`:3074`).

| Stelle | Aussage | Bewertung |
|---|---|---|
| `data.md`, `mira.md`, `atlas.md`, `deputy.md` (#2423–#2431) | maßgeblich ist `PRICING_TAX_MODE`, bei `EXEMPT` keine USt | konsistent |
| `data.md` | Grenzen 25.000 € Vorjahr / 100.000 € laufendes Jahr, Gründungsjahr 25.000 € | als Annahme markiert; steuerlich prüfen lassen |
| `.github/PR_TRIAGE_POLICY.md:69` (Regelebene 4!) | „seit 15.10.2026 regelbesteuert, netto zzgl. 19 % USt … §-19-Hinweis gilt nicht mehr“ | **Widerspruch** zum Code |
| `.claude/agents/stripe-business-agent.md:81-85` | „should add 19% VAT“ | **Widerspruch** (schon in `roles.md` 3c vermerkt) |

Eskalation an Dominik: Welcher Steuerstatus gilt? Nichts geändert (Preise/Recht nur mit
Einzel-Freigabe). Bis zur Klärung gilt laut `AGENTS.md` der Code.

## 5. Je Agent

Kosten: keine Messung vorhanden. Treiber sind Modell und `maxTurns`; externe Kosten nur über
gesperrte Dienste. Tagesbudget E-T1 (1 Mio. Tokens) ist Vorgabe, technisch nicht durchgesetzt.

| Agent | PR | Werkzeuge (Frontmatter) | Prüfstand | Offene Risiken | Freigabe |
|---|---|---|---|---|---|
| CHIEF | #2416 | alle; Bash-Guard, Tiefe 1 | Guard 50/50, check:context | volle CI fehlt (Draft) | Merge offen |
| DEPUTY | #2423 | Read, Grep, Glob · opus · 25 | Probe 3c (PR-Text) | Konflikt mit #2416 | Merge offen |
| NOVA | #2424 | Read, Grep, Glob · sonnet · 25 | Probe 3c | Konflikt mit #2416 | Merge offen |
| REA | hier | Read, Grep, Glob, Edit, Write, Bash | Probe 3c (#2425), Radar-Text hier nicht neu geprobt | Radar hängt an ATLAS | Merge offen |
| VIO | #2427 | wie REA · sonnet | Grenze jetzt technisch, 51 Fälle | `npm test` führt Code aus (nicht abdeckbar); Merge = Deploy der Runtime | Merge + Deploy offen |
| MOTION | #2428 | Read, Grep, Glob · plan · 15 | Probe 3c | erzeugt nichts | Merge offen |
| ATLAS | #2429 | Read, Grep, Glob, WebSearch, WebFetch · 25 | Probe 3c (intern) | Repo-Lesen + Web = Abflussweg über URLs | Merge offen |
| MIRA | #2430 | Read, Grep, Glob, WebSearch · 20 | Probe 3c | – | Merge offen |
| DATA | #2431 | Read, Grep, Glob · 30 | Probe 3c | Steuerwiderspruch Abschnitt 4 | Merge offen |
| FLOW | #2432 | Read, Grep, Glob · 25 | Probe 3c | – | Merge offen |

Restrisiken der Hooks (grundsätzlich): Code in Dateien, die erlaubte Befehle ausführen
(`npm test`, Skripte), IP-Adressen statt Hostnamen, Ziel aus Dateien (`wget -i`). Bekannter
Fehlalarm: Heredoc-Körper werden als Befehle geprüft (`bash <<EOF` würde sie ausführen),
ein Python-Heredoc mit Voice-Host im Text wird daher blockiert. Empfehlung für #2427:
zusätzlich `hooks:` im Frontmatter von `vio.md` mit `guard-write-scope.mjs --agent vio`
(unabhängig vom Feld `agent_type`).
