# Audit: Landing-Page kanonisch

Stand: 2026-06-15 · Nur Recherche, keine Code-Änderungen.

## Ergebnis vorab

Es gibt zwei Landing-Page-Implementierungen, aber **kein Konflikt im Routing** — sie sind
auf unterschiedliche Routen gemountet und referenzieren sich nicht gegenseitig:

| Datei | Route(n) | Status |
|---|---|---|
| `src/pages/Landing.tsx` | `/` (App.tsx Z. 252), `/landing` (Z. 254) | **LIVE — kanonische Production-Landing** |
| `src/enterprise-os/pages/LandingPage.tsx` | `/os` (Z. 571, lazy import Z. 202) | **Prototype — eigenständiger Klick-Test** |

Die ursprüngliche Sorge ("optimierst du seit Tagen die falsche Seite") trifft **so nicht
zu** — `/` zeigt definitiv `Landing.tsx`. Das eigentliche Risiko liegt woanders (siehe
"Tatsächliche offene Punkte" unten).

## Details `src/pages/Landing.tsx`

- **Routen:** `/` und `/landing` (beide identisch, `/landing` als Marketing-Alias)
- **Zuletzt geändert:** 2026-06-14 21:21 (vor 1 Tag)
- **Nur von `App.tsx` importiert**, keine weiteren Referenzen
- **Struktur (495 Zeilen, 9 Blöcke):** Hero (58–141), TrustStrip (192–217),
  ProductMechanics (220–255), AudienceSection (258–289), AutomationSkillsTeaser
  (291–359), GovernanceOsBrowser (362–399), BetaProgramSection (402–427),
  FinalCta (430–461), Footer (464–495)
- **Design:** European Enterprise Trust — `rounded-chip/card/panel` (10–14px),
  Petrol (#0F766E) als Primärakzent, AI-Cyan als Sekundärakzent
- **E2E-Test:** `e2e/landing.spec.ts` (82 Zeilen) deckt Hero-Headline, primäre/sekundäre
  CTAs, Beta-CTA, verbotene Marketing-Phrasen, Footer-Links ab

## Details `src/enterprise-os/pages/LandingPage.tsx`

- **Route:** nur `/os` (kein Link aus der Public-Nav, nur per direkter URL erreichbar)
- **Zuletzt geändert:** 2026-06-12 21:06 (vor 3 Tagen)
- **Nur von `App.tsx` importiert** (lazy)
- **Kommentar in App.tsx (Z. 568–570):**
  > „Enterprise OS Prototype — neues Designsystem + IA (Phase 1 Foundation).
  > Eigenständiger Klick-Prototyp mit Mockdaten unter `/os`, `/os/app/*`.
  > Bestehende `/`, `/app/*` Routen bleiben unverändert."
- **Struktur (312 Zeilen, 6 Blöcke):** Hero (82–172), Modules-Grid (174–201, 8 Karten),
  Positioning/Scanner-vs-OS (203–256), Trust (258–283), FinalCta (285–307), Footer (309)
- **Design:** Security-Blue (#0052FF) als Akzent statt Petrol, `bg-puzzle-grid`-Pattern,
  importiert Mock-Daten aus `enterprise-os/mock/data.ts` (SCORES, RISKS, WEBSITES)
- **Keine E2E/Unit-Tests**

## `src/enterprise-os/` — Gesamtumfang

```
src/enterprise-os/
├── components/   (Button, Badge, Card, ScoreGauge, StatusBadge, ...)
├── layout/        (PublicNav, PublicFooter, AppShell)
├── mock/          (data.ts — SCORES, RISKS, WEBSITES)
└── pages/         (16 Dateien, in Phasen organisiert)
    ├── LandingPage.tsx        — Phase 1 (live unter /os)
    ├── AppHomePage.tsx        — Phase 1
    ├── PlaceholderPage.tsx    — Phase 1, Platzhalter für Phase 3
    ├── PricingPage.tsx, AuthPage.tsx, AuditLandingPage.tsx,
    │   AiGovernancePage.tsx, AgenciesPage.tsx, LegalPage.tsx,
    │   CheckoutEntryPage.tsx  — Phase 2 (Public)
    └── WebsitesPage, RisksPage, CompliancePage, EvidencePage,
        MonitoringPage         — Phase 4 (App, Mockdaten)
```

Alle `/os/*`-Routen (Z. 571–677 in App.tsx) sind als eigenständiger Klick-Prototyp mit
Mockdaten gebaut — kein Live-Daten-Zugriff, kein Auth-/Tenant-Gating.

## Tatsächliche offene Punkte

1. **Kein akutes Problem beim Routing** — `/` ist eindeutig `Landing.tsx`. Die Annahme
   "zwei konkurrierende Landings" trifft strukturell nicht zu.
2. **Aber:** `/os` existiert als vollständig ausgebauter Klick-Prototyp (16 Seiten,
   eigenes Designsystem mit Security-Blue statt Petrol) und ist über die direkte URL
   öffentlich erreichbar — auch wenn nicht verlinkt. Das ist potenziell verwirrend für
   Nutzer, die die URL erraten/finden (z. B. über Browser-Historie, Suchmaschinen-Crawling
   falls nicht per robots.txt ausgeschlossen), und zeigt ein anderes Markenbild
   (Security-Blue/Enterprise-OS) als die Live-Landing (Petrol/European Enterprise Trust).
3. **Entscheidungsbedarf liegt nicht bei "welche ist live"**, sondern bei: Was passiert mit
   `/os` und den 16 Prototype-Seiten? Optionen:
   - (a) Perspektivisch Phase 2–4 fertigstellen und `/` darauf migrieren (dann müsste
     `Landing.tsx` das Petrol/European-Enterprise-Trust-Design übernehmen oder das
     Enterprise-OS-Design wird zum neuen Standard)
   - (b) `/os` bleibt internes Klick-Modell für Stakeholder-Reviews, sollte aber per
     `robots.txt`/`noindex` von Suchmaschinen ausgeschlossen werden, falls noch nicht
     geschehen (nicht geprüft in diesem Audit)
   - (c) `/os` wird verworfen, falls die Richtung in `Landing.tsx` final ist

## Offene Frage für Entscheidung

Ist `/os` (Enterprise OS Prototype) die **Zielrichtung**, auf die `Landing.tsx` perspektivisch
migriert werden soll, oder ein abgeschlossenes Experiment, das archiviert/entfernt werden
kann? Diese Entscheidung bestimmt, ob Punkt 2/3 oben überhaupt Handlungsbedarf erzeugen.
