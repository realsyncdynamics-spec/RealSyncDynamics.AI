# Button-/CTA-Tester-Report — RealSyncDynamics.AI

> QA-Audit 2026-06-22 · Methodik: statischer Quelltext-Scan + Playwright-E2E (`e2e/button-tester.spec.ts`) gegen Production-Build (`npm run preview`, :4173).

## Zusammenfassung

| Kategorie | Befund |
|---|---|
| OK (Self-Serve-CTAs auf Hauptpfad) | Pricing-/Audit-/Upgrade-CTAs sauber, alle Ziele existieren |
| NO_ACTION (tote Buttons) | **0** auf geprüften öffentlichen Seiten (E2E bestätigt) |
| BROKEN_ROUTE | **0** — alle CTA-Ziele sind definierte Routen |
| JS_ERROR | **1 Klasse, behoben** (Telemetrie-404, s. u.) |
| FORBIDDEN_CTA | **4 Fundstellen** (1 behoben, 3 dokumentiert) |
| CHECKOUT_RISK | keiner — Checkout-CTAs zeigen korrekt auf `/checkout/:plan` |

## E2E-Ergebnis (Production-Build, :4173)

`e2e/button-tester.spec.ts` + `e2e/routing.spec.ts` + `e2e/checkout.spec.ts`:
**48 Tests, 48 grün** (nach Fix). Erstlauf: 42 grün / 6 rot (alle 6 = JS-Konsolen-Error, s. JS_ERROR).

## FORBIDDEN_CTA — Fundstellen

Verbotene Sprache laut `src/content/runtimeVocab.ts → CI_FORBIDDEN_CTA`.
**Wichtig:** Das CI-Gate `cta-enforcement.yml` scannt **nur `src/pages` + `src/components`** — die folgenden Fundstellen liegen außerhalb dieses Scopes und entkommen dem Gate.

| Datei:Zeile | Text | Pfad-Risiko | Status |
|---|---|---|---|
| `src/features/audit/AuditResultView.tsx:499` | „Demo-Call buchen" | **HOCH** — öffentliche Audit-Ergebnis-Seite, Hauptpfad | ✅ **behoben** → „Enterprise anfragen" |
| `src/marketing/types.ts:53` | „Sales kontaktieren" | MITTEL — Source-of-Truth für Marketing-CTAs | ✅ **behoben** → „Enterprise anfragen" |
| `src/marketing/types.ts:51` | „Partner-Pilot anfragen" | MITTEL | ✅ **behoben** → „Partner-Programm ansehen" |
| `src/enterprise-os/mock/data.ts:350` | „Vertrieb kontaktieren" | NIEDRIG — `/os`-Prototyp (Mockdata) | ⚠️ **dokumentiert** (Prototyp, nicht Hauptpfad) |
| `src/marketing/content/linkedin-posts.ts:270,364` | „Partner-Pilot anfragen" | NIEDRIG — generierte Kampagnen-Copy | ⚠️ **dokumentiert** |

**Empfehlung P1:** CTA-Enforcement-CI-Scope von `src/pages|components` auf **`src/**`** erweitern (mit Ausnahme von `src/content/runtimeVocab.ts` als Definitionsdatei), damit `src/features`, `src/marketing` und `src/enterprise-os` mit abgedeckt sind.

## Verbotene Claim-Begriffe (geprüft)

| Begriff | Fundstellen | Bewertung |
|---|---|---|
| `rechtssicher` | `PricingPage.tsx:128`, `PartnersPage.tsx:222` | **OK** — nur als bewusste Verneinung („wir versprechen kein 100 % rechtssicher") |
| `garantiert` | `PricingPage.tsx` (Support-SLA) | **GRENZWERTIG** — faktische SLA-Zusage, keine Compliance-Garantie. SOFTEN empfohlen. |
| `vollständig autonom` | — | nicht gefunden (clean) |
| `Bußgeld garantiert vermeiden` | — | nicht gefunden (clean) |

## JS_ERROR — Telemetrie-404 (behoben)

- **Symptom:** Auf **jeder** öffentlichen Seite im Production-Build feuerte ein `fetch` gegen `undefined/functions/v1/track-pageview` → 404-Konsolen-Error.
- **Ursache:** `src/lib/track.ts` baute `ENDPOINT` aus `import.meta.env.VITE_SUPABASE_URL` ohne Guard; ist die Variable im Build nicht gesetzt, entsteht `undefined/functions/…`. Aktiv nur in `PROD`-Builds (in Dev deaktiviert), daher im Dev-Modus unsichtbar.
- **Fix:** `const ENABLED = import.meta.env.PROD && Boolean(SUPABASE_URL)` — Tracker no-op't, wenn keine Backend-URL konfiguriert ist. Rebuild + E2E: 6/6 grün.
- **Hinweis:** In Produktion mit gesetztem `VITE_SUPABASE_URL` trat der 404 nicht auf; der Fix härtet env-lose Builds (Previews, Forks, CI-Artefakte).

## Methodik / Reproduktion
```
npm run build && npm run preview          # :4173
npx playwright install chromium
E2E_BASE_URL=http://localhost:4173 npx playwright test \
  routing.spec.ts button-tester.spec.ts checkout.spec.ts
```
