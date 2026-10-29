# .ai/ — Projektgedächtnis für Agenten

Gilt zusätzlich zu `AGENTS.md` (hat Vorrang) und `CLAUDE.md`. **Öffentliches Repo:** keine Secrets,
keine Kundendaten, keine personenbezogenen Daten. Kundenprojekte liegen in eigenen (privaten) Repos.

## Struktur

| Pfad | Zweck |
|---|---|
| `decisions/` | Freigaben-Ledger: eine Datei je Entscheidung, `YYYY-MM-DD-<slug>.md` |
| `handoffs/` | Übergaben zwischen Agenten (Grok Bot ↔ Claude Code ↔ Design) |
| `locks/` | Kurzlebige Claims auf Pfade/Bereiche, um parallele Worker zu trennen |
| `provenance/assets.jsonl` | Herkunftsnachweis generierter/importierter Assets (eine JSON-Zeile je Asset) |
| `studio/` | Status des Creative-Web-Studio-Workstreams (ohne Kundendaten) |

## Bestehende Berichte (Archiv, unverändert)

`ARCHITECTURE_OPTIMIZATION_PLAN.md`, `CLOUDFLARE_OPTIMIZATION_SPRINT.md`,
`CLOUDFLARE_SPRINT_PROGRESS.md`, `PHASE2A_PROGRESS.md`, `SECURITY_ARCHITECTURE.md` (Stand 2026-07-23).

## Worker-Regeln (verbindlich für jedes begrenzte Arbeitspaket)

1. Ein Ziel, ein Scope — nur die freigegebene Aufgabe.
2. Nur dokumentierte Pfade — keine erfundenen Tool-Zugänge oder Testergebnisse.
3. Draft only — PRs immer als Draft; Merge nur mit separatem Go des Eigentümers.
4. Kein Prod — kein Production-Deploy, keine Stripe-/Preisänderung, keine kostenpflichtigen Calls.
5. Trennung — SaaS-Regeln (Hard-Edge, `shared/pricing.ts`) gelten nicht automatisch für Studio-Kundenseiten.
6. Gedächtnis — Wissen unter `.ai/`; keine Secrets; öffentliches Repo beachten.
7. Beweis — Erfolg nur mit Artefakten (PR-URL, Dateiliste, Befehlsausgabe).
8. Eskalation — bei Blocker stoppen, Zustand sichern, melden; max. 3 Reparaturversuche.
9. Kostenlos zuerst — bezahlte Integrationen nur nach Quote + Go.
10. Kommunikation — Ergebnisbericht auf Deutsch, technisch präzise.
