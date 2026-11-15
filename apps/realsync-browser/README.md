# RealSync Browser — lokaler MVP

**Status:** lokaler MVP, nicht produktiv, nicht installierbar.
Entwurf und Prüfstand: `docs/product/browser-guardian-entwicklungsentwurf.md`.

Startet ein lokales Chromium (Playwright), das nur über den Browser Guardian
(`packages/browser-guardian`) gesteuert wird. Jeder Planschritt wird geprüft
(Ziel, Daten, Kontext, Wirkung); Freigaben gibt ein Mensch im Terminal mit
`FREIGEBEN`. Nachweise: `~/.realsync-browser/evidence/<sitzung>.jsonl`.

```bash
node apps/realsync-browser/src/cli.ts --policy apps/realsync-browser/examples/policy.example.json --plan apps/realsync-browser/examples/plan.example.json --headed
```

- `--simulate` — ohne Browser (SIMULATION, im Nachweis `executor: 'simulation'`)
- `--evidence <datei>` — eigener Pfad für den Nachweis
- `REALSYNC_BROWSER_KILL_SWITCH=1` — jede Aktion wird abgelehnt

Voraussetzung: Node 22 (TypeScript ohne Build) und `playwright` mit Chromium.

Tests (echtes Chromium, ohne Internet):

```bash
node --test apps/realsync-browser/test/playwright-driver.test.ts
```
