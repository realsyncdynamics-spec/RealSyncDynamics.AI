# /wp8-responsive — Session-Auftrag

Du arbeitest an **WP8 Responsive / Mobile** aus `.claude/os-funnel/PLAN.md` (§3 Nachtrag 2026-10-14, §4).
Pro Aufruf genau **ein** Teilpaket, ein Branch, ein PR. Argument: `8a` | `8b` | `8c` | `8d`. Ohne Argument: `8a`.

## Vor dem Start (Pflicht)

1. `PLAN.md` lesen. Prüfen, ob E-R1–E-R5 für dein Teilpaket entschieden sind. Fehlt eine Entscheidung, dann **stopp** und die Frage melden.
2. Offene PRs zählen. Bei **> 20 → stopp** (WIP-Policy) und keinen Branch anlegen.
3. Für 8b–8d: Die Befundliste aus WP8a muss auf `main` liegen. Sonst stopp.
4. Alle `(?)`-Pfade aus dem Plan im Repo auflösen und im PR-Text nennen.

## 8a — Messung (keine UI-Änderung)

- Viewports: 360, 390, 768, 1024, 1440 px.
- Routen: `/`, `/audit`, `/pricing`, `/login`, `/welcome`, `/app/activation`, `/app/dashboard`, Agent-Register.
  App-Routen mit Test-Login aus dem bestehenden Smoke-Setup. **Kein** Produktions-Account, keine Service-Role.
- Je Route und Viewport erfassen: horizontaler Overflow (welches Element), Tap-Ziele < 24 px, Inputs < 16 px Schrift, three.js-Requests.
- Lighthouse mobil für `/` und `/audit`: LCP, CLS, INP, mit Commit-Hash.
- Ergebnis: Test bzw. Script `check:responsive` im CI, **zunächst als Warnung, nicht blockierend**, dazu die Befundliste als Tabelle im PR-Text.
  Kein neues Dokument unter `docs/` (Budget voll, B10).

## 8b–8d — Umsetzung

- **Nur** Befunde aus der 8a-Liste beheben. Kein Befund, keine Änderung.
- Erlaubt: Layout-Regeln, Breakpoints nach E-R3, Container Queries, `min-width: 0` / `overflow-wrap`, `100dvh`, `env(safe-area-inset-*)`, responsive `srcset`/`sizes` für das v6-Europa-Bild.
- **Verboten:** Änderungen an Farb- oder Typo-Tokens, neue Texte oder Claims, Preis- oder Katalogänderungen, Änderungen an E-V2/E-V3-Inhalten, three.js auf Mobile.
- Nach dem Fix den 8a-Check für die betroffenen Routen auf **blockierend** stellen.

## Leitplanken (aus PLAN §5)

Kein Deploy, kein Merge, kein Push auf `main`. Keine Supabase-, Stripe-, Cloudflare- oder KV-Änderung.
Tenant nur über `JWT → memberships`. Keine Fake-KPIs: Leere Kacheln bleiben Empty State.

## Prüfung

`npm run lint`, `npm test` (betroffene Suites), `check:responsive`, `npm run check:fabrication`.
Bei Bild-Änderungen zusätzlich Lighthouse mobil vorher/nachher.

## PR-Text (Definition of Done)

Teilpaket · geänderte Dateien · aufgelöste `(?)`-Pfade · behobene Befunde (ID aus 8a) · Diff-Beleg „keine Token-Änderung“ · Screenshots 360/768 px vorher/nachher · welche Checks liefen · was ist **live** / **preview** / **coming soon** (hier normalerweise: nichts Neues).
