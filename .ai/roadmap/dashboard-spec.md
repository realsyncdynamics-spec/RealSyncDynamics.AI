# Dashboard „Roadmap“ M0–M19 — Spezifikation (keine Implementierung)

**Ort (Vorschlag):** neuer Tab im bestehenden Command Center (`/app/command-center`, M1-a), kein
eigenes Dashboard. Umsetzung erst nach M1–M4 und separatem Go.

## Datenquelle
Phase 1: statisch aus `.ai/roadmap/*.md` (Build-Zeit). Später optional Tabelle mit RLS (Migration = Go).
Status nur aus belegten Quellen (PR-Status via GitHub, Tests via CI) — sonst `unbekannt`.

## Felder je Meilenstein

| Feld | Typ | Quelle |
|---|---|---|
| ID, Name, Phase, Priorität | Text/Enum (P0–P2) | Roadmap-Datei |
| Status | `geplant · aktiv · Draft · gemergt · blockiert · unbekannt` | PR-Status / Roadmap |
| Fortschritt / Abnahmekriterien | Checkliste DoD mit erfüllt/offen | Roadmap + CI |
| Verantwortlicher | Rolle (Grok, Claude Code, Dominik) | Roadmap |
| Abhängigkeiten | Liste von IDs, rot wenn nicht erfüllt | Roadmap |
| PRs / SHAs | Nummer, Zustand, Merge-SHA | GitHub |
| Tests | letzter CI-Lauf, bestanden/fehlend | GitHub Checks |
| Blocker | Freitext + Verweis | Roadmap |
| Offene Entscheidungen | Verweis auf `.ai/decisions/` | Ledger |
| Nächster Schritt | ein Satz | Roadmap |

## Regeln
Keine Demo-Daten als Live-Daten. Hard-Edge-UI (SaaS). A11y (axe) und 375-px-Ansicht wie M1-b.
