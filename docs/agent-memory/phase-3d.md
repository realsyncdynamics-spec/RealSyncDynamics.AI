# Phase 3d — Agentenintegration und technische Absicherung

**Stand:** 25.11.2026 · Branch `claude/festive-galileo-f79169` (gestapelt auf #2416) ·
Status: IMPLEMENTIERT, Hooks GETESTET (lokal), nichts gemergt, nichts LIVE.
Verbindlich bleiben `AGENTS.md` und `CLAUDE.md`. Statusstufen wie `roles.md`.

## 0. Nachtrag Senior-Review 25.11.2026 (geht Abschnitt 1–5 vor)

Zielarchitektur (Vorgabe Dominik): CHIEF koordiniert, DEPUTY nimmt ab, NOVA prüft
Sicherheit/Governance, **ATLAS bündelt die externe Recherche**, REA setzt um und bewertet
Integrationen, **VIO bleibt vorerst nur lesend**, MIRA Marketing/Vertrieb, MOTION
kreative Konzeption, DATA Wirtschaftlichkeit, FLOW Automatisierungskonzepte.

| Thema | Befund (belegt per `git diff`/`merge-base`) | Folge |
|---|---|---|
| Einzel-PRs #2423–#2428, #2430–#2432 | byte-identisch in #2436 enthalten | #2436 ist die Quelle; Einzel-PRs schließen nach Freigabe |
| ATLAS | #2429 (nur `WebSearch`, `WebFetch`) ist strenger als #2436 (`Read` + Web) | #2436 übernimmt die #2429-Fassung; `/rea-radar` verlangt genau diese Werkzeuge |
| VIO | #2436 gibt `Edit, Write, Bash` | #2436: nur `Read, Grep, Glob`; Schreibgrenze-Hook hier bleibt als zweite Schicht für eine spätere Freigabe |
| Radar | #2434 und dieser Branch hatten zwei abweichende Fassungen | Konflikt zugunsten #2434 aufgelöst (NOVA-/DEPUTY-Runde 2); `rea.md`, `rea-radar.md`, `docs/rea/` = #2434 |
| #2420 | Head `e33300b` ist Vorfahr von #2434 | vollständig ersetzt; Schließen vorbereitet, nur nach Freigabe |
| Bash-Hook | Probe: 13 von 16 Umgehungen offen | gehärtet (Commit `8a18cb9`), 0 von 16; Tests in `npm test` |

Merge-Reihenfolge neu (je Einzel-Freigabe, nach jedem Merge Folge-PRs per Merge von `main`
aktualisieren, Entscheidung des Inhabers 25.11.2026): **#2436 → #2416 → dieser Branch (#2440).**
Beide Vorgänger sind hier per Merge enthalten, die Reihenfolge ist für diesen Branch daher
unkritisch. #2434 ist hier vollständig
enthalten und wird nicht separat gemergt. Dieser Branch enthält #2416 und #2436 bereits per
Merge; `deputy.md`, `nova.md`, `roles.md` sind zugunsten #2436 aufgelöst (DEPUTY-Abnahme
25.11.2026, Nr. 9). Die Tabelle in Abschnitt 1 mit den Einzel-PRs ist damit überholt.

Hook ≠ Berechtigungsgrenze: Ein Hook prüft Befehlstext. Code in Dateien, die erlaubte
Befehle starten (`npm test`, `node skript.mjs`), sieht er nicht. Echte Grenzen sind:
Branch-Schutz auf `main`, Environment-Freigabe für Deploys (#2336), keine Prod-Tokens in
Agentensitzungen.

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
| DEPUTY | #2436 | Read, Grep, Glob · opus · 25 | Probe 3c (PR-Text) | Konflikt mit #2416 hier aufgelöst | Merge offen |
| NOVA | #2436 | Read, Grep, Glob · sonnet · 25 | Probe 3c | Konflikt mit #2416 hier aufgelöst | Merge offen |
| REA | hier | Read, Grep, Glob, Edit, Write, Bash | Probe 3c (#2425), Radar-Text hier nicht neu geprobt | Radar hängt an ATLAS | Merge offen |
| VIO | #2436 | Read, Grep, Glob · sonnet (nur lesend) | Schreibgrenze-Hook vorbereitet, greift erst bei Schreibrechten | Merge = Deploy der Runtime, sobald REA dort ändert | Merge offen |
| MOTION | #2436 | Read, Grep, Glob · plan · 15 | Probe 3c | erzeugt nichts | Merge offen |
| ATLAS | #2436 (Fassung #2429) | WebSearch, WebFetch · 25 (kein Repo) | Probe 3c | Webinhalte nur als Daten an CHIEF/REA | Merge offen |
| MIRA | #2436 | Read, Grep, Glob · 20 (Recherche via ATLAS) | Probe 3c (damals mit WebSearch) | – | Merge offen |
| DATA | #2436 | Read, Grep, Glob · 30 | Probe 3c | Steuerwiderspruch Abschnitt 4 | Merge offen |
| FLOW | #2436 | Read, Grep, Glob · 25 | Probe 3c | – | Merge offen |

Restrisiken der Hooks (grundsätzlich): Code in Dateien, die erlaubte Befehle ausführen
(`npm test`, Skripte), IP-Adressen statt Hostnamen, Ziel aus Dateien (`wget -i`). Bekannter
Fehlalarm: Heredoc-Körper werden als Befehle geprüft (`bash <<EOF` würde sie ausführen),
ein Python-Heredoc mit Voice-Host im Text wird daher blockiert. Empfehlung für #2427:
zusätzlich `hooks:` im Frontmatter von `vio.md` mit `guard-write-scope.mjs --agent vio`
(unabhängig vom Feld `agent_type`).
