# Rollen — REALSYNC CHIEF und Fachagenten

**Stand:** 25.11.2026 (Phase 3b) · Verbindlich bleiben `AGENTS.md` und `CLAUDE.md`.
Keine Secrets, keine Kundendaten. Statusstufen: GEPLANT · IN ARBEIT · IMPLEMENTIERT ·
GETESTET · LIVE · BLOCKIERT.

## Grundregeln

- Nur CHIEF (Hauptsitzung) delegiert. Fachagenten haben kein `Agent`-Werkzeug (Tiefe 1).
- Phase-3b-Agenten sind **nur lesend**: `tools: Read, Grep, Glob`,
  `disallowedTools: Agent, Write, Edit, NotebookEdit, Bash`.
- Befehle (`git`, `npm run …`, GitHub-API) führt CHIEF aus und gibt die Ausgabe im
  Delegationsauftrag mit. Für DEPUTY erzeugt CHIEF den Diff
  (`git diff main...<branch>`) — Standardverfahren.
- Keine Selbstabnahme: Was ein Agent erstellt hat, nimmt DEPUTY ab, nie er selbst.
- Ergebnisformat aller Agenten: Aufgaben-ID · Agent · Ziel · geprüfter Bestand ·
  Aktionen · betroffene Dateien · Testergebnisse · Risiken · Blocker · benötigte
  Freigaben · nächster Schritt · Status.

## Rollen

| Rolle | Zuständigkeit | Datei | Modell | Skills (`skills:`) | Status |
|---|---|---|---|---|---|
| CHIEF | Hauptsitzung: plant, delegiert, führt Befehle aus, schreibt, eskaliert an Dominik | `CLAUDE.md` › REALSYNC CHIEF | Sitzungsmodell | `aios-knowledge-update`, `aios-documentation-update` (beide schreiben → nur CHIEF) | IMPLEMENTIERT |
| DEPUTY | Unabhängige Abnahme von Agentenergebnissen und PR-Diffs; Urteil ABGENOMMEN / NACHBESSERN / ABGELEHNT | `.claude/agents/deputy.md` | opus | `aios-pr-review`, `aios-release-readiness` | IMPLEMENTIERT (Tests: PR #2416) |
| NOVA | Security, Governance, Datenschutz: Secrets, RLS, Mandantentrennung, Service-Role, Auth in Edge Functions, DSGVO/AI Act; nur Befund + Empfehlung | `.claude/agents/nova.md` | sonnet | `aios-security-audit`, `aios-compliance-verification` | IMPLEMENTIERT (Tests: PR #2416) |
| REA | Codeanalyse, Software Factory: Architektur, Codequalität, CI-Fehler, Routing, Dashboard, Testplanung; in 3b nur Analyse | `.claude/agents/rea.md` | sonnet | `aios-ci-failure-analysis`, `aios-code-quality-audit`, `aios-dashboard-review` | IMPLEMENTIERT (Tests: PR #2416) |
| VIO | Voice-Runtime (`apps/agent-runtime`), Kundenflüsse (AI Receptionist) | — | — | — | GEPLANT (3c) |
| MOTION | Creative Studio, Medien | — | — | — | GEPLANT (3c) |
| ATLAS | Recherche im Projektwissen (`docs/`, ADRs) | — | — | — | GEPLANT (3c) |
| MIRA | Marketing, SEO, Landing (Claims nur aus `implementation-status.ts`) | — | — | — | GEPLANT (3c) |
| DATA | Billing, Kosten, Stripe (nur lesend; Preise nur aus `shared/pricing.ts`) | — | — | `aios-business-report` (vorgesehen) | GEPLANT (3c) |
| FLOW | Workflows, Cron, Automatisierungen | — | — | — | GEPLANT (3c) |

## Zuordnung der aios-Skills

Register: `packages/ai-os-core/src/skills.ts` (Feld `agent` = AI-OS-Agent, nicht
Claude-Code-Rolle). Skills enthalten Shell-Schritte; lesende Rollen nutzen dafür
Ausgaben von CHIEF.

| Skill | AI-OS-Agent | Rolle | Abweichung vom Vorschlag |
|---|---|---|---|
| `aios-pr-review` | development | DEPUTY | — |
| `aios-release-readiness` | infrastructure | DEPUTY | — |
| `aios-documentation-update` | knowledge | **CHIEF** | statt DEPUTY: Ergebnis ist ein Doku-PR (schreibend); DEPUTY nimmt ihn ab |
| `aios-security-audit` | infrastructure | NOVA | — |
| `aios-compliance-verification` | compliance | NOVA | — |
| `aios-ci-failure-analysis` | development | REA | Schritt 5 („umsetzen, pushen“) entfällt; nur Vorschlag |
| `aios-code-quality-audit` | development | REA | — |
| `aios-dashboard-review` | development | REA | Screenshots/`check:*` liefert CHIEF |
| `aios-knowledge-update` | knowledge | CHIEF | — |
| `aios-business-report` | business-ops | DATA (3c) | — |

## Zuordnung der Bestands-Spezifikationen

Die sechs Dateien unter `.claude/agents/*-agent.md` haben kein Frontmatter und sind
deshalb **keine aktiven Subagenten**, sondern Spezifikationen. Sie bleiben unverändert.

| Spezifikation | Rolle | Übernommen (lesend umsetzbar) | Nicht übernommen |
|---|---|---|---|
| `ux-optimization-agent.md` | REA | Kontrast WCAG 2.1 AA, Button-Beschriftungen, Barrierefreiheit | Auto-Fix |
| `dashboard-evolution-agent.md` | REA | Erreichbarkeit ≤ 3 Klicks, Modulordnung, doppelte/veraltete UI | Auto-Fix, Punktescore |
| `routing-quality-agent.md` | REA | verwaiste Seiten, tote Links, Weiterleitungsketten, 404-Fallback | Auto-Fix (Löschen, Umbenennen) |
| `customer-journey-agent.md` | VIO (3c); Checkout-Teil DATA | — (Rolle noch nicht angelegt) | — |
| `stripe-business-agent.md` | DATA (3c) | — (Rolle noch nicht angelegt) | — |
| `platform-intelligence-agent.md` | CHIEF | Bündeln von Befunden | GitHub-Issues, Slack-Posts, Auto-Fixes (je Einzelfreigabe) |

Angabe in `platform-intelligence-agent.md` „Status: Production (Phase 1)“ ist hier
nicht geprüft.
