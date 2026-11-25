# Rollen — REALSYNC CHIEF und Fachagenten

**Stand:** 25.11.2026 (Phase 3c, gebündelt in PR #2436) · Verbindlich bleiben `AGENTS.md`
und `CLAUDE.md`. Keine Secrets, keine Kundendaten. Statusstufen: GEPLANT · IN ARBEIT ·
IMPLEMENTIERT · GETESTET · LIVE · BLOCKIERT.

Diese Datei ersetzt die 3b-Fassung aus #2416 inhaltlich; die Einzel-PRs #2423–#2432 sind in
#2436 enthalten. Merge-Reihenfolge (je Einzel-Freigabe, Folge-PRs danach per Merge von
`main` aktualisieren): **#2416 → #2436 → #2440** (#2440 enthält #2434). Beim add/add-Konflikt
mit #2416 gilt für `roles.md`, `deputy.md`, `nova.md` diese Fassung
(`docs/MERGE_CONFLICT_CONCEPT.md`). Ein Status gilt erst, wenn er auf `main` ist.

## Grundregeln

- Nur CHIEF (Hauptsitzung) delegiert. Nach dem Merge der Branches `agents/*` haben alle neun
  Fachagenten kein `Agent`-Werkzeug (`disallowedTools: Agent`). Heute liegt auf `main` nur
  `rea.md`; dort fehlt `Agent` lediglich in `tools`, `disallowedTools: Agent` kommt mit
  `agents/rea`. Belegt per init-Werkzeugliste der Probe: kein Agent hat `Agent`.
- Übergaben zwischen Fachagenten laufen nur über CHIEF. Fehlt die Datei des Zielagenten
  (Branch noch nicht gemergt), meldet der Agent BLOCKIERT. Auf `main` gibt es noch keine Tiefenbegrenzung in
  `.claude/settings.json` und keinen Bash-Guard-Hook; beides kommt erst mit PR #2416.
- Lesend (`tools` ohne Edit/Write/Bash): DEPUTY, NOVA, VIO, MOTION, ATLAS, MIRA, DATA, FLOW.
  Schreibend: nur REA (Repo, Freigabematrix in `rea.md`). VIO ist vorerst nur lesend
  (Vorgabe Dominik, 25.11.2026); Umsetzung in `apps/agent-runtime/**` übernimmt REA.
- ATLAS ist die einzige Instanz für externe Recherche (nur `WebSearch`, `WebFetch`, kein
  Repo-Zugriff). REA bewertet, CHIEF koordiniert (`/rea-radar`).
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
| REA | Software Factory: ein Arbeitspaket nach 10-Schritt-Loop, Branch `claude/<kurzname>`, Draft-PR | `.claude/agents/rea.md`, Befehl `.claude/commands/rea.md` | Sitzungsmodell (kein `model:`) | Read, Grep, Glob, Edit, Write, Bash | keine vorgeladen; zugeordnet: `aios-ci-failure-analysis`, `aios-code-quality-audit`, `aios-dashboard-review` | GETESTET (Probe 3c) |
| VIO | Voice-Runtime `apps/agent-runtime`, AI Receptionist, Branchenvorlagen, KI-Offenlegung, Notfall/Weiterleitung: Befunde und Vorschläge | `.claude/agents/vio.md` | sonnet | Read, Grep, Glob | — | IMPLEMENTIERT (nur lesend seit 25.11.2026, nicht neu geprobt); Schreibrechte nur nach Einzel-Freigabe |
| MOTION | Medienjob-Pläne (Briefing, Storyboard, Prompt, Kosten, Stufe S0–S4); erzeugt nichts | `.claude/agents/motion.md` | sonnet, `permissionMode: plan` | Read, Grep, Glob | — | GETESTET (Probe 3c) |
| ATLAS | Externe Recherche (Web), Radar-Zulieferung für REA; kein Repo-Zugriff (Fassung #2429) | `.claude/agents/atlas.md` | sonnet, `effort: medium` | WebSearch, WebFetch | — | GETESTET (Probe 3c, nur intern); A1 lieferte zuerst TEILWEISE BELEGT statt WIDERLEGT → Regel „Teil widerlegt = ganz widerlegt“ ergänzt, A1 wiederholt (siehe PR `agents/atlas`) |
| MIRA | Marketing, Vertrieb, SEO; Textvorschläge, Umsetzung via REA, Recherche via ATLAS | `.claude/agents/mira.md` | sonnet | Read, Grep, Glob | — | GETESTET (Probe 3c, damals mit WebSearch) |
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

- VIO-Schreibgrenze: technisch vorbereitet in #2440 (`guard-write-scope.mjs`); greift erst, wenn VIO Schreibrechte bekommt (Einzel-Freigabe).
- Netzwerksperre für Voice-/Telefonie-APIs im Bash-Guard (#2416) prüfen.
- Ablageort der Einwilligungsakte (digitaler Klon) festlegen.
- Definition „Medienjob“ für die Kostenrechnung (DATA/MOTION) festlegen.
- S0–S4 sind nur in `motion.md` definiert (Branch `agents/motion`), nicht in `docs/`.
