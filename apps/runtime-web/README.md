# RealSync Runtime — Produktfrontend

**Unternehmen:** RealSync Dynamics AI (`realsyncdynamicsai.de`)  
**Produkt:** RealSync Runtime  
**Sprache:** Deutsch (`html lang=de`)  
**Status:** Design-Quelle / eigenständige Product Surface. Noch nicht in die Root-SPA gemountet.

## Positionierung

Die Root-SPA in diesem Monorepo ist die **Firmenwebsite** (Governance OS, Scan, Stripe, Self-Service).

Dieses Verzeichnis ist das **verkaufbare Produkt** im Ökosystem:

- Control Loop: Beobachten → Verstehen → Bewerten → Entscheiden → Freigabe → Handeln → Prüfen → Nachweis → Lernen
- Drei Domain Packs: KI & Agenten, Software, Industrie
- Verkauf über Richtpreise + Angebot (kein Checkout in dieser Surface)
- Engine-Namen bleiben Englisch (Event Engine, Copilot, SDK)

Es überschreibt **nicht** `/src/pages/RuntimePage.tsx` (Compliance-Runtime der Root-SPA).

## Richtpreise (nicht bindend)

| Paket | Richtpreis |
|---|---|
| Runtime Core | ab 4.900 € / Monat |
| Runtime + Domain Pack | ab 6.800 € / Monat |
| Enterprise | auf Anfrage |

Verbindliches Angebot nach Architektur-Review.

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

1. Entweder als eigene App deployen (Cloudflare Pages / Subdomain `runtime.realsyncdynamicsai.de`)
2. Oder die Surfaces nach `src/pages/` der Root-SPA portieren (`react-router-dom`)
3. Firmen-Nav um den Einstieg „Runtime“ ergänzen, ohne die Self-Service-CTAs der Root-SPA zu ersetzen

Kein Auth, keine Datenbank, keine Stripe-Anbindung in diesem Tree.
