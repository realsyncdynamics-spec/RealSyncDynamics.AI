# Agent-Memory — Arbeitsgedächtnis für REALSYNC CHIEF

**Status:** GEPLANT. Dieser Ordner enthält bisher nur diese Gliederung.

## Zweck

Ausführliche Regeln und Erfahrungen für die Hauptsitzung CHIEF und ihre Fachagenten.
Die Ablage hier verhindert, dass `CLAUDE.md` über das Kontextbudget
(`npm run check:context`) wächst. Verbindlich bleiben `AGENTS.md` und `CLAUDE.md`.
Bei Widerspruch gilt die Regelhierarchie aus `AGENTS.md`.

## Geplante Gliederung

| Datei (geplant) | Inhalt |
|---|---|
| `roles.md` | Rollen CHIEF, DEPUTY, REA, NOVA, VIO, MOTION, ATLAS, MIRA, DATA, FLOW: Zuständigkeit, Werkzeuge, Grenzen |
| `loop.md` | 10-Schritt-Loop mit Abbruchkriterien (max. 3 Korrekturversuche je Fehler) und Eskalationswegen |
| `approval-matrix.md` | Freigabematrix: Aktion → autonom / Rückfrage / nur Dominik; Abgleich mit `.claude/settings.json` und `.claude/hooks/guard-bash.mjs` |
| `lessons.md` | Erfahrungen: Befund, Ursache, Gegenmaßnahme, Datum, Prüfpfad |

## Regeln für diesen Ordner

- Keine Secrets, Tokens, Kundendaten oder personenbezogenen Daten.
- Nur belegte Aussagen mit Pfad oder Befehl. Annahmen sind als solche gekennzeichnet.
- Statusstufen: GEPLANT · IN ARBEIT · IMPLEMENTIERT · GETESTET · LIVE · BLOCKIERT.
