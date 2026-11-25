# Rollen — REALSYNC CHIEF und Fachagenten

**Stand:** 25.11.2026 (Phase 3c, Branch `chore/agents-3c`) · Verbindlich bleiben `AGENTS.md`
und `CLAUDE.md`. Keine Secrets, keine Kundendaten. Statusstufen: GEPLANT · IN ARBEIT ·
IMPLEMENTIERT · GETESTET · LIVE · BLOCKIERT.

Grundlage: Fassung Phase 3b aus PR #2416 (`chore/chief-setup`, offen, nicht auf `main`).
Diese Datei ersetzt sie inhaltlich. Beide PRs legen `roles.md`, `deputy.md` und `nova.md`
neu an (add/add). Empfohlene Reihenfolge: erst #2416 mergen, dann `origin/main` per Merge in
`chore/agents-3c` holen und die drei Dateien zugunsten der 3c-Fassung auflösen
(`docs/MERGE_CONFLICT_CONCEPT.md`).

## Grundregeln

- Nur CHIEF (Hauptsitzung) delegiert. Alle neun Fachagenten haben kein `Agent`-Werkzeug
  (`disallowedTools: Agent`). Auf `main` gibt es noch keine Tiefenbegrenzung in
  `.claude/settings.json` und keinen Bash-Guard-Hook; beides kommt erst mit PR #2416.
- Lesend (`tools` ohne Edit/Write/Bash): DEPUTY, NOVA, MOTION, ATLAS, MIRA, DATA, FLOW.
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
| REA | Software Factory: ein Arbeitspaket nach 10-Schritt-Loop, Branch `claude/<kurzname>`, Draft-PR | `.claude/agents/rea.md`, Befehl `.claude/commands/rea.md` | Sitzungsmodell (kein `model:`) | Read, Grep, Glob, Edit, Write, Bash | keine vorgeladen; zugeordnet: `aios-ci-failure-analysis`, `aios-code-quality-audit`, `aios-dashboard-review` | GETESTET (Probe 3c) |
| VIO | Voice-Runtime `apps/agent-runtime`, AI Receptionist, Branchenvorlagen, KI-Offenlegung, Notfall/Weiterleitung | `.claude/agents/vio.md` | sonnet | Read, Grep, Glob, Edit, Write, Bash | — | GETESTET nur Verhalten (Probe 3c); Schreibgrenze `apps/agent-runtime/**` technisch nicht durchgesetzt und nicht getestet |
| MOTION | Medienjob-Pläne (Briefing, Storyboard, Prompt, Kosten, Stufe S0–S4); erzeugt nichts | `.claude/agents/motion.md` | sonnet, `permissionMode: plan` | Read, Grep, Glob | — | GETESTET (Probe 3c) |
| ATLAS | Recherche & Faktencheck (Projektwissen, Web), Tool-Radar-Zulieferung | `.claude/agents/atlas.md` | sonnet, `effort: medium` | Read, Grep, Glob, WebSearch, WebFetch | — | GETESTET (Probe 3c, nur intern) |
| MIRA | Marketing, SEO, Akquise; Textvorschläge, Umsetzung via REA | `.claude/agents/mira.md` | sonnet | Read, Grep, Glob, WebSearch | — | GETESTET (Probe 3c) |
| DATA | Finanzen/Pricing: Preis-Drift, Stripe-Logik im Code, Kosten, § 19 UStG | `.claude/agents/data.md` | sonnet | Read, Grep, Glob | `aios-business-report` | GETESTET (Probe 3c) |
| FLOW | Workflows, Cron, Edge-Function-Trigger, Prozesse; YAML-Diff nur für Nicht-Deploy | `.claude/agents/flow.md` | sonnet | Read, Grep, Glob | — | GETESTET (Probe 3c) |

„GETESTET (Probe 3c)“ heißt: Headless-Probe (`claude -p --agent <name>`) mit Normal- und
Grenzfall am 25.11.2026; Probe-Tabelle im Text des Draft-PR zu `chore/agents-3c`. Geprüft
sind Werkzeugliste und Verhalten, nicht `npm run lint/test/build` (nur Markdown geändert) →
`TEILWEISE`, maßgeblich ist die CI auf dem Head. Kein Agent ist LIVE, solange der PR nicht
gemergt ist.

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
| `stripe-business-agent.md` | DATA (nur lesend) |
| `platform-intelligence-agent.md` | CHIEF (Bündeln von Befunden; keine Issues/Slack/Auto-Fixes) |

## Offene Punkte (Stand 3c)

- VIO-Schreibgrenze technisch durchsetzen (Vorschlag im PR; braucht Freigabe für Hooks).
- Netzwerksperre für Voice-/Telefonie-APIs im Bash-Guard (#2416) prüfen.
- Ablageort der Einwilligungsakte (digitaler Klon) festlegen.
- Definition „Medienjob“ für die Kostenrechnung (DATA/MOTION) festlegen.
- S0–S4 sind nur in `motion.md` definiert, nicht in `docs/`.
