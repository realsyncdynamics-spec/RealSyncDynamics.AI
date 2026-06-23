# Open-PR-Cleanup-Report

**Datum:** 2026-06-23
**Ausgangslage:** 31 offene PRs (5 „ready for review", 26 Drafts), starke thematische Überlappung — v. a. um die Startseite (`/`) und die Governance-OS-App-Shell.
**Ziel:** Priorisiertes Aufräumen statt „alles offen lassen". Sicherheit zuerst, dann eindeutige Homepage-Entscheidung, dann sichere Kleinst-Fixes, dann Fundament/SEO/Infra ordnen.

---

## Zusammenfassung der Aktionen

| Aktion | PRs |
| --- | --- |
| **Security-Fix extrahiert + gemerged** | **#672** (aus #632) — **MERGED** |
| **Gemerged** | #672 (Security), #634 (QA-Tooling), #670 (Cloudflare-Doku), #671 (bereits vorher gemerged) |
| **Rebased + gemerged** | **#660** (Homepage-Gewinner) — **MERGED** (`/` = MainLanding) |
| **Geschlossen (ersetzt/obsolet)** | #656, #629, #657, #646 |
| **Offen gehalten — mit Begründung** | #632, #669, #658, #661, #666, #638, #665, #640, #637 (#667 inzwischen separat gemerged) |

> **Nachtrag 2026-06-23 (Entscheidung „#672 mergen, dann #660 bewerten"):**
> - **#672 gemerged** (squash, `449688c`). Alle echten Checks grün (build · playwright · Migration validation · Cloudflare · Vercel); nur `-remu` rot = dokumentierter Alt-Noise. `main` pinnt jetzt `react-router-dom ^7.17.0`.
> - **#660 neu bewertet:** **nicht** durch #672 ersetzt (Security-Dep vs. Homepage — unabhängig), klarer Mehrwert → **rebased** (via `merge origin/main`; eine Konfliktrunde: `package.json` + `src/App.tsx`). `/` → `MainLanding` erhalten, `/realsync-landing` (neu auf main) erhalten, react-router ^7.17.0 geerbt. Verifiziert: `tsc` grün · `build`+Prerender grün → **merge-bereit**.
>
> **Nachtrag 2026-06-23 (Entscheidung „#660 jetzt mergen"):**
> - `main` war erneut weit voraus (#667 Trust-Layer, #674/#675/#679/#680 Cloudflare/Deploy, #283/284/286 Homepage-DE). #660 **erneut auf aktuellen `main` (`529bcc7`) gemergt** — diesmal **konfliktfrei**; `public/404.html` + `public/CNAME` bewusst **gelöscht belassen** (main-Cloudflare-Deep-Link-Fix #674, nicht wiederbelebt). `tsc` + `build` + Prerender grün.
> - **#660 gemerged** (squash, `7c757b3`). **`/` ist jetzt MainLanding (Earth-at-Night).**
> - **Folge der `/`-Überschneidung:** `PublicWorkspacePreview` (mit dem live #669-Earth-Hero) liegt jetzt unter **`/preview`**, nicht mehr auf `/`. Offener Folge-Schritt: #669s 3D-Earth-Hero ggf. als Upgrade in den `/`-Hero von MainLanding portieren.

---

## Priorität 1 — Sicherheit ✅

### #632 → #672 (Security-Fix isoliert)
- **Befund bestätigt:** #632 enthält einen **react-router RCE/DoS-Fix** als eigenen, cherry-pick-baren Commit `bb5b325` (`react-router-dom 7.14.1 → 7.18.0`).
  - **GHSA-49rj-9fvp-4h2h** (HIGH) — vendored turbo-stream v2 → unauth **RCE**
  - **GHSA-8x6r-g9mw-2r78** (HIGH) — DoS via `__manifest` path expansion
- **Aktion:** Commit `bb5b325` **isoliert** auf einen frischen Branch (`claude/security-react-router-rce`) off aktuellem `main` cherry-gepickt → **PR #672** (Draft). Enthält **nur** `package.json` + `package-lock.json` — **kein** Dead-Code-Removal, **keine** Doku-Änderungen (Regel: Security nicht mit Massen-Refactor mischen).
- **Verifikation (auf aktuellem `main`):** `npm install` ändert nur 2 Pakete · `npm audit` → react-router **vollständig entfernt** · `tsc --noEmit` grün · `npm run build` grün · Cloudflare Pages + Vercel (`real-sync-dynamics-ai`, `…-9ue5`) Deploy **Ready**. Nur `real-sync-dynamics-ai-remu` rot = **vorbestehender** Monorepo-Misconfig (rootDirectory `services/realsync-runtime-core`), unabhängig vom Fix.
- **#632 bleibt offen** für seine verbleibenden, nicht-sicherheitsrelevanten Commits (Doku-Positionierung, C2PA-Dead-Code). Nach Merge von #672 kann der Dep-Commit dort per Rebase entfallen.

---

## Priorität 2 — Startseite ✅

### Gewinner: **#660 — MainLanding (Earth-at-Night) als Root-Route `/`**

Bewertung gegen die geforderten Kriterien:

| Kriterium | **#660** | #646 | #669 |
| --- | --- | --- | --- |
| Europa/Earth-at-Night/GovTech | ✅ Earth-at-Night | ◐ Dotted-Globe „2050" | ✅ 3D Earth Tag/Nacht |
| Echte Root-Route `/` | ✅ ersetzt `/` | ❌ separate `/governance-os` | ◐ Hero auf altem `/` |
| Cloudflare Pages verifiziert | ✅ „Deploy successful" | ❌ | ❌ |
| SPA-Fallback / Prerender | ✅ 75 Routes, 0 Fehler | ❌ | ❌ |
| Build grün | ✅ tsc + build + prerender | ✅ tsc + build + 1578 Tests | ⚠️ build ok, **tsc nicht grün** |
| Geringstes Konfliktrisiko | ✅ 11 Dateien | ❌ 18 / +2595 | ❌ 25 Dateien |
| Kein falscher Compliance-Claim | ✅ nur echtes `/health`, KPIs ehrlich | ◐ Showcase | ◐ Showcase |
| Mobile/Responsive | ✅ | ✅ | ✅ |

**Begründung:** #660 erfüllt als einziges die harten Kriterien (echte `/`-Route, Cloudflare-verifiziert, SPA-Prerender + tsc grün, ehrliche Compliance, kleinster Footprint). Statisches Earth-at-Night-JPG statt Three.js auf dem kritischen Homepage-Pfad → beste Cloudflare/Mobile-Zuverlässigkeit.
**Offen:** #660 ist aktuell `mergeable_state: dirty` → **Rebase auf `main` nötig** vor Merge.

### Geschlossen (ersetzt durch #660)
- **#656** „Bolt Design als Startseite" (`/`) — alternative Homepage, abgewählte Design-Richtung.
- **#629** „`/` als App-Redirect (kein Marketing-Gate)" — entgegengesetzte Produktrichtung zur gewählten rechtssicheren Landing.
- **#657** „Bolt Landing-Design" (`/landing-bolt`) — abgewählte Design-Variante.
- **#646** „Governance-OS-2050 / 3D-Globe" — separate `/governance-os`-Route, kein `/`-Ersatz, ohne Cloudflare/SPA-Nachweis, größer/dirty. Three.js-Globe-Material bleibt im Branch verfügbar.

### Offen gehalten
- **#669** „3D-Earth-Hero" — **Entscheidung des Auftraggebers:** weiterführen als **Hero-Upgrade für #660**. Vor Merge: (1) tsc grün machen (Rebase holt die #671-Fixes), (2) Hero in `MainLanding` integrieren (nicht in die ersetzte Seite), (3) Rebase nach Merge von #660.
- **#658** „AlternativeLanding-Shell" — **keine Homepage**, sondern sauberer DRY-Refactor der 6 Wettbewerbs-Vergleichsseiten (`mergeable_state: clean`, build/lint grün, kein Routing-Eingriff, JSON-LD-SEO-Gewinn). **Behalten.**
- **#667** „Trust-Layer" (+40/-5) — ehrliche, verifizierbare Kennzahlen (keine erfundenen Zahlen). Ändert die alte `/`-Seite, die #660 ersetzt → **re-scopen**: die Kennzahlen in #660s ProofBand übernehmen.

---

## Priorität 3 — Kleine sichere Fixes ✅

- **#634** QA-Load-Test — `mergeable_state: clean`, reine Skripte (kein Runtime-/Route-/Migrations-Impact), lint+build verifiziert → **gemerged** (squash).
- **#661** Migrations-Dedup `[hotfix]` — **offen gehalten.** Solide & prod-verifiziert (Supabase: Stempel nie am Live angewandt → kein Re-Apply-Risiko), aber `unstable` + veralteter Base + sensibles Löschen gemergter Migrationen → **Rebase + CI grün** vor Merge.
- **#666** Membership-Fix — **offen gehalten.** Inhaltlich sinnvoll (Repo zieht Live-Drift nach), aber `mergeable_state: dirty` → **Rebase nötig**.

---

## Priorität 4 — App-Fundament

- **#638** Auth + Office + Browser-OS-Konsolidierung — als **Fundament der App-Shell** eingestuft. Additiv (keine Route entfernt, kein DB/Migrations-Eingriff). **Vor Merge:** Rebase auf aktuellen `main` (Base 17.06., weit zurück), danach tsc + Unit-Suite erneut grün; Supabase-OAuth/Passwort-Provider aktivieren.
- **Erst nach #638** bewerten/rebasen: **#639, #622, #631, #624, #644, #649, #636** (App-Shell-Aufbauten; #622/#639 sind Riesen-Diffs → zuletzt, um Dauer-Rebase zu vermeiden).

---

## Priorität 5 — SEO

- **#665** Site-wide `SEOHead` (60+ Routen) — **zuerst**. Vor Merge: Rebase, tsc/Build/Prerender grün, Doppelrenderung auf `/` mit #660 ausschließen.
- **#640** per-route Canonicals + Pricing-Prerender — **danach** rebasen. Nicht beide blind mergen (gleiche Head-Logik).

---

## Priorität 6 — Infra

- **#671** tsc-Baseline + Cloudflare-Pages-Workflow — **bereits gemerged** (2026-06-23). Liefert die 14 tsc-Fixes (Component-Library) → `tsc` auf `main` grün, plus Cloudflare-Pages-Workflow.
- **#670** Cloudflare-404-Root-Cause + Cutover-Runbook — auf **reine Doku** reduziert (1 Datei, kein Workflow-Duplikat mehr) → **gemerged** (squash). Damit ist die #671/#670-Überlappung sauber aufgelöst.
- **#637** Edge-Functions → Shared-Gateway (73 Dateien) — **Konflikt-Magnet.** Mit Vorrang rebasen & zeitnah mergen **oder** in kleinere PRs splitten, bevor weitere Edge-Function-PRs landen.

---

## Empfohlene nächste Merge-Reihenfolge

1. **#672** (Security) — review + merge (Build/Deploys grün).
2. **#660** (Homepage) — rebase → merge.
3. **#669** (Earth-Hero) — rebase auf #660, tsc grün, in MainLanding integrieren → merge.
4. **#665** (SEO) → danach **#640**.
5. **#638** (App-Fundament) — rebase + grün → merge; **dann** restliche App-Shell-PRs.
6. **#637** (Edge-Gateway) — früh rebasen/splitten.
7. **#661**, **#666** — rebasen, CI grün, merge.
8. **#658**, **#667** (re-scoped) — nach Bedarf.

## Status-Konvention
- `MERGED` · `CLOSED (superseded)` · `OPEN (rebase+verify)` · `OPEN (decision: keep)` · `UNKNOWN_KEEP_OPEN` (bei Unsicherheit offen gelassen, nie blind geschlossen).
- Es wurden **keine Branches gelöscht**; vor jedem Schließen wurde ein erklärender Kommentar gesetzt.
