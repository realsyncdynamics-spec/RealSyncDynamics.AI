# Sicherung PR #2451 — verwertbare Inhalte für einen späteren isolierten PR

**Stand:** 25.11.2026 · PR #2451 bleibt geschlossen (Entscheidung Unternehmensleitung).
**Herkunftsnachweis:** Head `4c761d2ad047514439e54fafd28708f56d61a9c1`, abrufbar auch nach
Löschen des Branches per `git fetch origin pull/2451/head`. Diese Datei übernimmt nur, was nach
Deduplizierung gegen `AGENTS.md`, `CLAUDE.md`, #2416/#2436/#2440 neu ist.

## 1. Nicht übernehmen (Widerspruch zur Zielarchitektur)

| Inhalt in #2451 | Grund |
|---|---|
| `.claude/agents/*.md` (10 Dateien) | `Write`/`Edit` für ATLAS, MOTION, MIRA, DATA, FLOW, VIO; `Bash` für DEPUTY, NOVA, DATA. Verstößt gegen „nur REA schreibt“, „ATLAS nur Web“, „VIO/NOVA/DEPUTY lesend“. |
| FLOW darf delegieren (`Agent(rea, nova, deputy, atlas, data)`) | Widerspricht „nur CHIEF delegiert“ (#2440, `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1`). |
| Berechtigungsmatrix §4 (W-Spalten) | Gibt Schreibzugriffe (Supabase, Drive, Gmail, Calendar, Voice-Provider) an Rollen, die laut Zielarchitektur lesend sind. |
| `.gitignore`-Ausnahme `!.claude/skills/realsync-agent-core/` | Entfällt, wenn der Skill dem bestehenden Muster `aios-*` folgt (siehe 3). |

## 2. Übernehmen — Analyse „Technische Durchsetzung“ (§4 aus `docs/ai-os/agenten-team.md`)

Inhaltlich korrekt und deckungsgleich mit dem NOVA-Auftrag vom 25.11.2026; als Quelle für den
Konsolidierungsplan (`konsolidierung-agentenregister.md`) verwendet:

1. Technisch erzwungen ist, **welche** Werkzeuge ein Subagent hat (`tools`/`disallowedTools`).
   Wer `Write`, `Edit` oder `Bash` hat, erreicht jeden Pfad, sofern kein Hook greift.
2. MCP-Werkzeuge stehen in keiner `tools`-Liste. Ein nicht auflösbarer Eintrag kann den
   Subagent-Start scheitern lassen → MCP läuft über die Hauptsitzung (CHIEF).
3. „Lesend“ auf Supabase ist nicht erzwingbar, solange der Connector `execute_sql` anbietet;
   echte Trennung braucht eine eingeschränkte DB-Rolle oder `apps/mcp-server`.
4. Offene Entscheidungen §7: Register zusammenführen; Budgetgrenze in der Anthropic-Konsole;
   Supabase lesend.

## 3. Übernehmen — 20 Pflichtregeln, dedupliziert

Ziel: **ein** Skill im bestehenden Muster, Vorschlag `.claude/skills/aios-agent-core/SKILL.md`
(fällt unter die vorhandene `.gitignore`-Ausnahme `!.claude/skills/aios-*/`, Eintrag in
`packages/ai-os-core/src/skills.ts`). Er verweist auf die Quelle statt zu kopieren.

| # | Regel (#2451) | Bereits geregelt in | Entscheidung |
|---|---|---|---|
| 1 | core-instructions | `AGENTS.md` → Regelhierarchie | Verweis |
| 2 | governance | `AGENTS.md` → Produkt (K4) | Verweis |
| 3 | communication (Fakten/Annahmen/Vorschläge trennen) | teilweise `AGENTS.md` → Nachweise | **übernehmen (1 Zeile)** |
| 4 | handoff (Übergabeformat) | `roles.md`: Übergaben nur über CHIEF | **Format übernehmen**, Delegationsrecht FLOW streichen |
| 5 | task-management (Ziel, Abnahme, Grenze je Auftrag) | `CLAUDE.md` CHIEF-Loop (#2416) | Verweis |
| 6 | memory-management | Konflikt: `docs/ai-os/` (Register `KNOWLEDGE_ROOT`) vs. `docs/agent-memory/` (#2416) | **Entscheidung nötig** (siehe Plan, E3) |
| 7 | human-approval | `AGENTS.md` → Freigaben | Verweis |
| 8 | permission-management („nicht gelistet = verboten“) | nur implizit | **übernehmen** |
| 9 | evidence-documentation | `AGENTS.md` → Nachweise | Verweis |
| 10 | existing-system-reuse (`rg` im Bestand vor Neubau) | nur für Landing | **übernehmen** |
| 11 | duplicate-work-prevention (offene PRs zuerst prüfen) | fehlt | **übernehmen** (Kernursache der Doppel-PRs) |
| 12 | security-awareness | `AGENTS.md` → Sicherheit | Verweis |
| 13 | data-privacy (keine echten Kundendaten in Prompts/Tests/Doku) | teilweise | **übernehmen (1 Zeile)** |
| 14 | prompt-injection-defense | einzeln in `deputy.md`, `nova.md` | **zentral übernehmen** |
| 15 | cost-management | `roles.md` (Einzelfreigabe je Job) | Verweis + „günstigstes ausreichendes Modell“ **übernehmen** |
| 16 | error-handling (max. 3 Versuche) | `CLAUDE.md` CHIEF-Loop | Verweis |
| 17 | result-validation (keine Selbstabnahme) | `roles.md` | Verweis |
| 18 | product-status-validation | `AGENTS.md` → Claims | Verweis |
| 19 | license-compliance (MIT/Apache-2.0/BSD, sonst eskalieren) | fehlt | **übernehmen** |
| 20 | status-reporting | Konflikt: drei Statusskalen (siehe Plan, E4) | **Entscheidung nötig** |

Ergebnis: 8 neue Regeln (3, 4-Format, 8, 10, 11, 13, 14, 15-Modellwahl, 19), 11 Verweise,
2 offene Entscheidungen. Der Skill wird dadurch kürzer als `AGENTS.md`-Kopien und lädt weniger Kontext.

## 4. Übernehmen — Übergabe- und Berichtsformat (wörtlich aus #2451)

```
An:        <Agent>
Auftrag:   <ein Satz>
Kontext:   <Dateien, PR, Befund>
Grenze:    <was nicht getan werden darf>
Abnahme:   <woran Erfolg erkennbar ist>
```

```
Ergebnis:   <was, wo (Branch/PR/Datei)>
Prüfung:    <Befehl> → <Ergebnis>
Risiken:    <oder „keine erkannt“>
Blocker:    <oder „keine“>
Nächster Schritt: <eine konkrete Aktion oder Freigabe>
```

## 5. Übernehmen — MCP-Ist-Tabelle (§3) als Ausgangspunkt

In `konsolidierung-agentenregister.md` → MCP-Matrix eingearbeitet und gegen die Sitzung vom
25.11.2026 abgeglichen (dort mit Prüfstatus je Eintrag).
