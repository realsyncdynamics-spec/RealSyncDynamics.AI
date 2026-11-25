# Rollen — REALSYNC CHIEF und Fachagenten

**Stand:** 25.11.2026 (Phase 3c, je Agent ein Branch `agents/<name>`, diese Datei auf
`agents/roles`) · Verbindlich bleiben `AGENTS.md` und `CLAUDE.md`. Keine Secrets, keine
Kundendaten. Statusstufen: GEPLANT · IN ARBEIT · IMPLEMENTIERT · GETESTET · LIVE · BLOCKIERT.

Grundlage: Fassung Phase 3b aus PR #2416 (`chore/chief-setup`, offen, nicht auf `main`) und
die Sammelfassung aus PR #2421 (`chore/agents-3c`). Jede Agentendatei liegt auf einem eigenen
Branch mit eigenem Draft-PR. Diese Datei ersetzt die 3b-Fassung inhaltlich. #2416 legt
`roles.md`, `deputy.md` und `nova.md` ebenfalls neu an (add/add). Wird #2416 zuerst gemergt:
`origin/main` per Merge in `agents/roles`, `agents/deputy`, `agents/nova` holen und die Datei
zugunsten der 3c-Fassung auflösen (`docs/MERGE_CONFLICT_CONCEPT.md`).

Empfohlene Merge-Reihenfolge: `agents/deputy` → `agents/nova` → `agents/rea` → `agents/roles` → `agents/atlas` (#2429) → Radar-Konsolidierung (#2434, enthält REA 3c aus #2425 und ersetzt #2420)
→ übrige. Ein Status in der Tabelle gilt erst, wenn der jeweilige Branch auf `main` ist.

## Grundregeln

- Nur CHIEF (Hauptsitzung) delegiert. Nach dem Merge der Branches `agents/*` haben alle neun
  Fachagenten kein `Agent`-Werkzeug (`disallowedTools: Agent`). Heute liegt auf `main` nur
  `rea.md`; dort fehlt `Agent` lediglich in `tools`, `disallowedTools: Agent` kommt mit
  `agents/rea`. Belegt per init-Werkzeugliste der Probe: kein Agent hat `Agent`.
- Übergaben zwischen Fachagenten laufen nur über CHIEF. Fehlt die Datei des Zielagenten
  (Branch noch nicht gemergt), meldet der Agent BLOCKIERT. Auf `main` gibt es noch keine Tiefenbegrenzung in
  `.claude/settings.json` und keinen Bash-Guard-Hook; beides kommt erst mit PR #2416.
- Lesend (`tools` ohne Edit/Write/Bash): DEPUTY, NOVA, MOTION, MIRA, DATA, FLOW.
- Nur Web, kein Repo (`tools: WebSearch, WebFetch`): ATLAS (Inhaber-Entscheidung 25.11.2026, zentraler Recherche-Agent, auch für `/rea-radar`).
  Schreibend: REA (Repo, Freigabematrix in `rea.md`) und VIO (nur `apps/agent-runtime/**`,
  Grenze nur als Anweisung, technisch nicht durchgesetzt).
- Für lesende Rollen führt CHIEF Befehle (`git`, `npm run …`, GitHub-API) aus und gibt die
  Ausgabe im Auftrag mit. Für DEPUTY erzeugt CHIEF den Diff (`git diff origin/main...<branch>`).
- Keine Selbstabnahme: Was ein Agent erstellt hat, nimmt DEPUTY ab. Die eigene `deputy.md`
  prüft CHIEF.
- Ergebnisformat aller Agenten: Aufgaben-ID · Agent · Ziel · geprüfter Bestand · Aktionen ·
  betroffene Dateien · Testergebnisse · Risiken · Blocker · benötigte Freigaben · nächster
  Schritt · Status. Ausnahme REA: Abschlussbericht nach `rea.md`; CHIEF ergänzt Aufgaben-ID
  und Status bei der Übergabe an DEPUTY.
- Kostenpflichtige Erzeugung (ElevenLabs, Twilio, HeyGen, Higgsfield, Canva) nur mit
  Einzelfreigabe von Dominik über CHIEF, je Job und Betrag. Ohne Freigabe nur Mock/Plan.

## Rollen

| Rolle | Zuständigkeit | Datei | Modell | Werkzeuge | Skills (`skills:`) | Status |
|---|---|---|---|---|---|---|
| CHIEF | Hauptsitzung: plant, delegiert, führt Befehle aus, schreibt, eskaliert an Dominik | Abschnitt in `CLAUDE.md` erst mit PR #2416 | Sitzungsmodell | alle | `aios-knowledge-update`, `aios-documentation-update` (schreibend → nur CHIEF) | IMPLEMENTIERT (Regeln in #2416, nicht auf `main`) |
| DEPUTY | Unabhängige Abnahme, Urteil ABGENOMMEN / NACHBESSERN / ABGELEHNT | `.claude/agents/deputy.md` | opus | Read, Grep, Glob | `aios-pr-review`, `aios-release-readiness` | GETESTET (Probe 3c) |
| NOVA | Security, Governance, Datenschutz; nur Befund + Empfehlung | `.claude/agents/nova.md` | sonnet | Read, Grep, Glob | `aios-security-audit`, `aios-compliance-verification` | GETESTET (Probe 3c) |
| REA | Software Factory: ein Arbeitspaket nach 10-Schritt-Loop, Branch `claude/<kurzname>`, Draft-PR | `.claude/agents/rea.md`, Befehl `.claude/commands/rea.md` | Sitzungsmodell (kein `model:`) | Read, Grep, Glob, Edit, Write, Bash | keine vorgeladen; zugeordnet: `aios-ci-failure-analysis`, `aios-code-quality-audit`, `aios-dashboard-review` | GETESTET (Probe 3c); Radar-Modus (#2434, Recherche über ATLAS) ungeprüft |
| VIO | Voice-Runtime `apps/agent-runtime`, AI Receptionist, Branchenvorlagen, KI-Offenlegung, Notfall/Weiterleitung | `.claude/agents/vio.md` | sonnet | Read, Grep, Glob, Edit, Write, Bash | — | GETESTET nur Verhalten (Probe 3c); Schreibgrenze `apps/agent-runtime/**` technisch nicht durchgesetzt und nicht getestet |
| MOTION | Medienjob-Pläne (Briefing, Storyboard, Prompt, Kosten, Stufe S0–S4); erzeugt nichts | `.claude/agents/motion.md` | sonnet, `permissionMode: plan` | Read, Grep, Glob | — | GETESTET (Probe 3c) |
| ATLAS | Markt- und Webrecherche, externer Faktencheck, Radar-Recherche für `/rea-radar` (Repo-Faktencheck macht DEPUTY bzw. DATA) | `.claude/agents/atlas.md` | sonnet, `effort: medium` | WebSearch, WebFetch (Read/Grep/Glob/Bash/Edit/Write/Agent gesperrt) | — | GETESTET Werkzeuggrenze (Probe A3/A4 25.11.2026: init-Werkzeuge `WebSearch, WebFetch`, keine Datei angelegt, keine Auftragsdaten in Suchanfragen); Webrecherche selbst nicht geprobt |
| MIRA | Marketing, SEO, Akquise; Textvorschläge, Umsetzung via REA | `.claude/agents/mira.md` | sonnet | Read, Grep, Glob, WebSearch | — | GETESTET (Probe 3c) |
| DATA | Finanzen/Pricing: Preis-Drift, Stripe-Logik im Code, Kosten, § 19 UStG | `.claude/agents/data.md` | sonnet | Read, Grep, Glob | `aios-business-report` | GETESTET (Probe 3c) |
| FLOW | Workflows, Cron, Edge-Function-Trigger, Prozesse; YAML-Diff nur für Nicht-Deploy | `.claude/agents/flow.md` | sonnet | Read, Grep, Glob | — | GETESTET (Probe 3c) |

„GETESTET (Probe 3c)“ heißt: Headless-Probe (`claude -p --agent <name>`) mit Normal- und
Grenzfall am 25.11.2026, im Worktree des jeweiligen Branches (`main` + genau diese
Agentendatei); Probe-Tabelle im Text des jeweiligen Draft-PR. Geprüft sind Werkzeugliste und
Verhalten, nicht `npm run lint/test/build` (nur Markdown geändert) → `TEILWEISE`, maßgeblich
ist die CI auf dem Head. Kein Agent ist LIVE, solange sein Branch nicht gemergt ist.

## Zuordnung der aios-Skills

Register: `packages/ai-os-core/src/skills.ts`. Skills enthalten Shell-Schritte; lesende
Rollen nutzen dafür Ausgaben von CHIEF.

| Skill | Rolle | Hinweis |
|---|---|---|
| `aios-pr-review`, `aios-release-readiness` | DEPUTY | — |
| `aios-documentation-update` | CHIEF | nicht DEPUTY: Ergebnis ist ein Doku-PR (schreibend); DEPUTY nimmt ihn ab |
| `aios-security-audit`, `aios-compliance-verification` | NOVA | — |
| `aios-ci-failure-analysis`, `aios-code-quality-audit`, `aios-dashboard-review` | REA | nicht vorgeladen; Fix nur auf eigenem Branch |
| `aios-knowledge-update` | CHIEF | — |
| `aios-business-report` | DATA | vorgeladen; Shell-Schritte liefert CHIEF |

## Zuordnung der Bestands-Spezifikationen

Die sechs Dateien `.claude/agents/*-agent.md` haben kein Frontmatter und sind keine aktiven
Subagenten. Sie bleiben unverändert.

| Spezifikation | Rolle |
|---|---|
| `ux-optimization-agent.md`, `dashboard-evolution-agent.md`, `routing-quality-agent.md` | REA (ohne Auto-Fix) |
| `customer-journey-agent.md` | VIO (Dialogteil), FLOW (Prozessteil), DATA (Checkout-Teil) |
| `stripe-business-agent.md` | DATA (nur lesend). DATA ersetzt ihn nicht; seine Empfehlung „add 19% VAT“ (`:81-85`) gilt bei `PRICING_TAX_MODE = 'EXEMPT'` nicht |
| `platform-intelligence-agent.md` | CHIEF (Bündeln von Befunden; keine Issues/Slack/Auto-Fixes) |

## Offene Punkte (Stand 3c)

- VIO-Schreibgrenze technisch durchsetzen (Vorschlag im PR; braucht Freigabe für Hooks).
- Netzwerksperre für Voice-/Telefonie-APIs im Bash-Guard (#2416) prüfen.
- Ablageort der Einwilligungsakte (digitaler Klon) festlegen.
- Definition „Medienjob“ für die Kostenrechnung (DATA/MOTION) festlegen.
- S0–S4 sind nur in `motion.md` definiert (Branch `agents/motion`), nicht in `docs/`.
