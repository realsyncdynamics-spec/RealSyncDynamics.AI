---
owner: Dominik Steiner
reviewed: 2026-11-25
status: entwurf
---

# Builder-Einstiege: Inventar und Vorschlag (Weg A)

Stand: 25.11.2026, Basis `main` @ `3a58095`. Quelle: `src/App.tsx`, `src/features/build-studio/README.md`, `src/product/implementation-status.ts`. Rein dokumentarisch, keine Codeänderung.

## Inventar (Routen → Komponente → Speicher → Status)

| Route | Komponente | Speicher / Backend | Status laut Registry |
|---|---|---|---|
| `/build` | `BuildStudioPage` | lokaler SiteOS-Blueprint, keine Tabelle | Entscheidung dokumentiert (Builder-01/02) |
| `/builder/:slug` | `AppBuilderWorkspacePage` (Puck) | `siteos_blueprints` | SiteOS-Workspace |
| `/builder/:slug/code` | `BoltCodeBuilderPage` | `app_builder_projects` | Code-Workbench, additiv |
| `/unified-entry/transformation` | `SiteOsBuilderPage` | `siteos_blueprints` | Alt-Einstieg, parallel |
| `/app-builder` | `ProductLanding` (`app-builder`) | — (Marketing) | Produktkatalog, Status `web-builder` |
| `/landingpage-builder` | `ProductLanding` (`landingpage-builder`) | — (Marketing) | Website-Modus, kein eigenes Kernprodukt |
| `/frontend-builder` | `FrontendBuilderLanding` | — (Marketing) | nicht im Produktkatalog |
| `/app/siteos` | `SiteOsDashboardView` | `siteos_blueprints` | App-Bereich, hinter `AppGate` |
| `/app/siteos/modernize[/:projectId]` | `FmtModernizeWizard` | — | App-Bereich |
| `/app/siteos/claim` | `SiteOsClaimView` | Anonymer Entwurf → Mandant | App-Bereich |
| `/app/bots/:botId` | `BotBuilderView` | Bots | App-Bereich, nicht Builder im engeren Sinn |

Weiterleitungen: `/builder` und `/app/bauen` → `/build`; `/app/siteos/builder` → `LegacySiteOsBuilderRedirect`.

Eigenständige Speicher, bewusst getrennt: `siteos_blueprints` und `app_builder_projects`. Der Mandant kommt aus der Sitzung, nicht aus der URL.

## Befund

1. **Vier Einstiege, zwei Speicher.** Für einen Besucher sind `/build`, `/app-builder`, `/landingpage-builder` und `/frontend-builder` Marketingseiten oder Einstiege, die in verschiedene Engines führen. Eine klare Zuordnung fehlt.
2. **`/frontend-builder` ist nicht im Produktkatalog** (`#2388`, Definition A). Die Route existiert trotzdem.
3. **Der Landingpage-Builder ist intern Fokus, auf der Startseite aber kein Kernprodukt.** Das ist die Entscheidung aus Definition A (Owner, 21.11.) und bleibt unverändert.
4. **Vorschau-Worker `siteos-preview` ist nicht deployt** (KV existiert, Worker fehlt). Vorschauen aus dem Builder haben deshalb noch keine eigene Herkunft.

## Vorschlag für Weg A (zur Entscheidung, nicht umgesetzt)

- **Ein Einstieg:** `/build` bleibt der einzige Eingang. Er fragt nach der Art (Landing/Website → SiteOS, Web-App/Dashboard/SaaS → Code-Workbench), wie in `src/features/build-studio/README.md` beschrieben.
- **Marketingseiten** `/landingpage-builder` und `/app-builder` verlinken auf `/build?kind=…` statt eigener Pfade. Keine Löschung, Weiterleitung oder Umbau ohne Einzelfreigabe.
- **`/frontend-builder`** klären: Route behalten und als Alias führen, oder schließen. Entscheidung: Owner.
- **Vorschau-Worker** vor jedem Live-Schalten deployen (eigene Herkunft, siehe `workers/siteos-preview/README.md`).

Nicht Teil dieses Dokuments: Preise, Rechtstexte, Claims, Deploy, Migrationen.

## Offene Punkte

- [ ] Owner-Entscheidung: `/frontend-builder` behalten oder schließen?
- [ ] Owner-Entscheidung: Weg A wie oben, oder anders?
- [ ] `siteos-preview` deployen (Owner, lokal mit wrangler)
- [ ] Ob `/app/bots/:botId` zum Builder-Begriff zählt

## Nachweise

| Befehl | Ergebnis | Status |
|---|---|---|
| `grep -n 'path="/…' src/App.tsx` | Alle Routen oben bestätigt | vollständig (statische Prüfung) |
| `gh api …/actions/runs/33459724778` | Vorschau-Deploy am 01.09. übersprungen (Secrets fehlen) | vollständig |
| App im Browser geöffnet | nicht ausgeführt | TEILWEISE |
| `npm run check:context` | nicht ausgeführt | TEILWEISE |
