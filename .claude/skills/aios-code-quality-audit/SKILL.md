---
name: aios-code-quality-audit
description: AI-OS Development Agent — Code-Qualität eines Pfads prüfen (tote Pfade, Duplikate, fehlende Tests, Typlücken) mit priorisierter Maßnahmenliste.
---

# Code Quality Audit

**Agent:** Development · **Rechte:** `github.contents.read`

## Eingaben
- `path` (Pflicht): Verzeichnis oder Datei, z. B. `src/features/admin`

## Ablauf
1. Umfang bestimmen (`rg --files <path> | wc -l`); nur diesen Pfad lesen.
2. Belege sammeln: `npm run lint`, betroffene Tests unter `test/`, `npm run check:dead` (nur Kandidaten).
3. Duplikate suchen (gleiche Muster in mehreren Dateien, z. B. kopierte Admin-Prüfungen).
4. Testlücken: Welche exportierte Logik hat keinen Test unter `test/`? (vitest liest nur `test/**`.)
5. Je Punkt Nutzen und Aufwand schätzen, klar als Schätzung markiert.

## Ausgaben
- `report`: priorisierte Tabelle — Befund · Beleg · Nutzen · Aufwand · Vorschlag

## Qualität
- Kandidaten aus `check:dead` sind keine Löschfreigabe (Importgraph, Registries, Vorschau-Routen prüfen).
- Keine Repo-weiten Refactors ohne Nutzenbeleg.
