# Entscheidung: Option C — zwei Geschäftsbereiche klar trennen

- **Datum:** 2026-10-29
- **Entschieden von:** Dominik Steiner (Eigentümer)
- **Status:** gültig

## Entscheidung

1. **RealSyncDynamics.AI** bleibt das zentrale Governance- und KI-SaaS-Produkt
   (Positionierung gemäß `AGENTS.md` / `docs/PRODUCT_PRIORITIZATION.md`).
2. Parallel entsteht das **Creative Web Studio** für individuelle Websites, 3D-Erlebnisse,
   KI-generierte Medien und automatisierte Website-Produktion.
3. Das Studio darf Komponenten und Infrastruktur technisch wiederverwenden
   (z. B. `packages/siteos-core`, Puck-Editor, `workers/siteos-preview`, R3F/Drei/three),
   besitzt aber **eigene Angebote, Workflows, Designs und Kalkulationen**.

## Implikationen

| Bereich | SaaS | Creative Web Studio |
|---|---|---|
| Design | Hard-Edge-UI laut `AGENTS.md` | Eigenes Design-System je Kundenseite |
| Preise | nur `shared/pricing.ts` / Stripe | eigene Kalkulation; nicht in `shared/pricing.ts` oder Stripe ohne ausdrückliches Go |
| Repos | dieses Repo | Kundenprojekte in eigenen (privaten) Repos; wiederverwendbare Bausteine hier nur nach Freigabe |
| Hero-Botschaft | KI-Produkt mit eingebauter Governance | Studio-eigene Botschaft, keine Vermischung |

## Freigabegrenzen

Kein Merge nach `main`, kein Production-Deploy, keine Preisänderung, keine kostenpflichtige
Bestellung und keine Credits ohne separate Freigabe.
