# Landing-Konsolidierung — Plan (Bewertung + Vorgehen)

Stand: 2026-06-23 · Status: **Vorschlag** (noch nicht umgesetzt)

Ziel: Den Wildwuchs konkurrierender Landing-/Einstiegs-Seiten reduzieren auf
**eine kanonische Startseite** plus klar abgegrenzte Spezialseiten — ohne
Breaking Changes an öffentlichen Routen und ohne SEO-Verlust.

## Ist-Zustand (Bewertung)

| Route / Datei | Rolle | Zeilen | Interne Refs | Bewertung |
|---|---|---|---|---|
| `/` → `PublicWorkspacePreview.tsx` | **Startseite**, jetzt mit Europa-Erde-Hero (Zielbild) | 253 | — | **Kanonisch behalten** |
| `/preview` → `PublicWorkspacePreview.tsx` | Alias derselben Komponente | — | 0 | Redundant → Redirect auf `/` |
| `/landing` → `Landing.tsx` | „European Enterprise Trust"-Marketing-Landing | 643 | 0 | Redundant zur Startseite; einzigartige Sektionen ggf. portieren |
| `/realsync-landing` → `marketing/landing/RealSyncDynamicsLanding.tsx` | WIP-Variante | 763 | 0 | **Entfernen** — CTA-/Design-Verstöße (`rounded-full`, „Demo anfordern"), nicht verlinkt |
| `public/realsync-landing.html` | Redirect-Stub → `/?_landing=realsng` | — | — | **Toter Code** (`?_landing` wird nirgends gelesen) → entfernen |
| `/os/*` → `enterprise-os/*` | Eigener Parallel-Produktauftritt, eigene Nav/Footer | 312+ | 26 | **Kein Landing-Dupe** — separate Architektur-Entscheidung (s. u.) |

Kernprobleme:
- Drei „Startseiten"-artige Surfaces (`/`, `/landing`, `/realsync-landing`) mit
  unterschiedlichen Themes → Inkonsistenz, Wartungslast, Verwirrung.
- Verwaiste Routen (0 interne Verlinkung) bleiben nur per Direkt-URL/SEO erreichbar.
- Toter Redirect-Stub (`?_landing` ohne Handler).

## Soll-Zustand

- **Eine kanonische Startseite:** `/` (Europa-Erde-Hero).
- **Spezialseiten** bleiben (Audit, Pricing, Branchen, SEO-Landings) — unberührt.
- **Enterprise-OS (`/os/*`)** als bewusst getrennter Auftritt **oder** als zu
  retirierender Prototyp — eigene Entscheidung, nicht Teil dieser Konsolidierung.

## Vorgehen (phasiert, risikoarm)

### Phase 1 — Toten/kaputten Code entfernen (niedriges Risiko) — ✅ UMGESETZT
1. Route `/realsync-landing` aus `App.tsx` entfernen; Komponente
   `marketing/landing/RealSyncDynamicsLanding.tsx` löschen (0 Refs).
2. `public/realsync-landing.html` löschen (toter `?_landing`-Redirect).
3. Prüfen: `sitemap.xml` / `robots.txt` enthalten keine dieser Pfade (aktuell
   nicht gelistet) — sonst entfernen.
- **Tests:** keine e2e-Abdeckung für `/realsync-landing` → kein Testbruch.

### Phase 2 — Aliase auf kanonisch umlenken (niedriges Risiko) — ✅ UMGESETZT
4. `/preview` → `<Navigate to="/" replace />` (statt dupliziertem Element).
- **Tests:** `e2e/landing.spec.ts` testet `/` (nicht `/preview`) → kein Bruch.

### Phase 3 — `/landing` konsolidieren (mittleres Risiko, Entscheidung nötig)
Option A (empfohlen): **`/landing` → Redirect auf `/`.** Vorher einmalig prüfen,
ob `Landing.tsx` Sektionen enthält, die auf `/` fehlen (Audience, Digitale
Souveränität, Supply-Chain-Governance) → diese als Sektions-Komponenten in die
Startseite übernehmen, dann redirecten.
Option B: `/landing` als eigenständige Marketing-Seite behalten, aber Theme/CTAs
mit `/` angleichen (eine Designsprache).
- **Tests:** `e2e/landing.spec.ts` enthält einen ganzen `describe('/landing')`-
  Block → bei Redirect/Umbau **mitziehen** (sonst rote Playwright-CI).

### Phase 4 — Enterprise-OS klären (separate Entscheidung)
`/os/*` ist ein vollständiger Parallel-Auftritt mit eigener IA. Nicht hier
auflösen — eigenes ADR: „Enterprise-OS = Zukunft der App-Shell **oder**
Prototyp retirieren?". Bis dahin unverändert lassen.

## Risiken & Gegenmaßnahmen
- **SEO:** Falls verwaiste Routen extern verlinkt/indexiert sind → 301-Redirects
  statt harter Entfernung (React-`<Navigate>` ist clientseitig; für echte 301
  ggf. `_redirects`/Server-Regel). Aktuell nicht in `sitemap.xml` → Risiko gering.
- **Playwright:** `/landing`-Tests vor Phase 3 anpassen.
- **CTA-Enforcement:** Entfernen von `/realsync-landing` beseitigt latente
  Verstöße; keine neuen einführen.

## Empfehlung
Phase 1 + 2 sofort (reiner Aufräum-Gewinn, kein Testbruch). Phase 3 nach
kurzer Sektions-Diff-Entscheidung. Phase 4 als eigenes ADR.
