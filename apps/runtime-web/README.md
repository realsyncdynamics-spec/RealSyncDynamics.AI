# RealSync Runtime — Produktfrontend

**Unternehmen:** RealSync Dynamics AI (`realsyncdynamicsai.de`)  
**Produkt:** RealSync Runtime  
**Sprache:** Deutsch (`html lang=de`)  
**Status:** Design-Quelle. Product Surface in der Root-SPA: `/runtime`.

## Positionierung

Die Root-SPA in diesem Monorepo ist die **Firmenwebsite** (Governance OS, Scan, Stripe, Self-Service).

Dieses Verzeichnis bleibt die **cinematische Design-Quelle** des verkaufbaren Produkts:

- Control Loop: Beobachten → Verstehen → Bewerten → Entscheiden → Freigabe → Handeln → Prüfen → Nachweis → Lernen
- Drei Domain Packs: KI & Agenten, Software, Industrie
- Verkauf über Richtpreise + Architektur-Review (kein Checkout in dieser Surface)
- Engine-Namen bleiben Englisch (Event Engine, Copilot, SDK)

Die Root-SPA hängt dasselbe Produkt nativ ein:

| Surface | Ort |
|---|---|
| Product Landing | `src/pages/RuntimePage.tsx` (`/runtime`) |
| Copy / SKUs | `src/content/runtimeProduct.ts` |
| Homepage-Band | `src/components/landing/RuntimeProductBand.tsx` |
| Nav | `Navbar` Produkt → `/runtime`; Startseite ergänzt Link `Runtime` |

Dieses Tree überschreibt **nicht** den Scan-Trichter und **nicht** `/pricing`.

## Richtpreise (nicht bindend)

| Paket | Richtpreis |
|---|---|
| Runtime Core | ab 4.900 € / Monat |
| Runtime + Domain Pack | ab 6.800 € / Monat |
| Enterprise | auf Anfrage |

Verbindliches Angebot nach Architektur-Review. Getrennt von Free / Monitoring / Governance.

## Inhalt

```
apps/runtime-web/
├── src/components/   Hero, Control Loop, Simulation, Copilot, Pricing, …
├── src/data/         Brand, Runtime-Schichten, Simulation, Preise
├── src/routes/       Produktseiten (Plattform, Lösungen, Branchen, Pakete, …)
├── src/styles.css    Graphite / Stahl / Cyan, IBM Plex
└── public/images/    Photorealistische Leitstand-Assets
```

## Nächster Integrationsschritt

1. Subdomain `runtime.realsyncdynamicsai.de` für die volle cinematische Surface, oder
2. Weitere Inner Pages aus diesem Tree nach `src/pages/` portieren

Kein Auth, keine Datenbank, keine Stripe-Anbindung in diesem Tree.
