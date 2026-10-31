# RealSync COSMOS 3.0 — integrierter Architektur- und QA-Stand

## Architektur und Datenflüsse

```
src/App.tsx  (/cosmos, lazy)
  └─ pages/CosmosExplorer.tsx
      ├─ Three.js / react-three-fiber: Sonne, acht Planeten, Erde, Mond
      ├─ visual/CosmosGeographicGlobe.tsx: WGS84-Anflüge, Ländergrenzen
      │   ├─ visual/CosmosDemInspector.tsx: lokaler Terrarium-Höhenrasterimport
      │   └─ visual/CosmosBuildingInspector.tsx: lokaler GeoJSON-Gebäudeimport
      └─ visual/CosmosWalkableWorld.tsx: *fiktive* Landschaft
```

**Three.js / R3F / Drei** und React/Vite sind bereits im Repository.
Kein neuer API-Host, kein Runtime-CDN, keine neue npm-Abhängigkeit,
keine Stripe-/Supabase-Änderungen.

Das importierte **Terrarium-Raster** wird auf 97 × 97 Punkte reduziert und
vertikal überhöht dargestellt. Rasterfarben werden in Meter umgerechnet,
nicht visuell als echte Höhen geschätzt. Ohne gültiges Raster gibt es
**keine vermeintlich echte DEM-Darstellung**.

Der **GeoJSON-Viewer** unterstützt WGS84 Polygon/MultiPolygon.
Gebäudeflächen werden für lokale kleine Ausschnitte auf Meterkoordinaten
projiziert und auf einer **flachen** Grundebene extrudiert; noch kein
Terrain-Draping und keine weltweite Streaming-Geometrie. Höhenangaben,
die aus Gebäudeetagen oder dem Visualisierungsstandard abgeleitet wurden,
sind **Schätzungen**, keine gemessenen Höhen.

Die **fiktive Landschaft** mit Bäumen, See und Häusern gehört
ausdrücklich nicht zu den realen geografischen Daten.

## SiteOS-Builder: geprüft, aber nicht aktiviert

Der reale Builder ist Puck:
`src/features/siteos/editor/puckConfig.tsx` verwendet
`packages/siteos-core/src/index` / `renderBlockHtml`.
Preview und Veröffentlichungsrenderer müssen synchron bleiben.
`cosmosBuilderContract.ts` ist **nur ein Design- und Validierungsvertrag**
mit sechs Modultypen, **kein registrierter SiteOS-Block**.

Vor der Freischaltung braucht es einen eigenen genehmigten PR mit:

1. kanonischem Server-BlockKind, Datenmodell und Publish-Validierung;
2. identischem Preview-/Publish-Renderer oder bewusster Fallback-Ausgabe;
3. Autorisierung, Tenant-Isolation, Entitlements und Budget-Gates;
4. erlaubten lokalen GLB-/Textur-Assets, CSP und Lizenznachweisen;
5. Visual-/Mobile- und Veröffentlichungstests.

## Datenherkunft und Nutzungsrechte

- Tag/Wolken: vorhandene Assets, Quelle/Lizenz in `public/textures/README.md`
  (Solar System Scope CC BY 4.0).
- Ländergrenzen: vorhandenes Natural-Earth-110m-Dataset,
  siehe `public/textures/README.md`.
- DEM-Format: Mapterhorn Terrarium WebP
  <https://mapterhorn.com/data-access/> und
  <https://mapterhorn.com/attribution/>.
  Ursprungsdaten (Schweiz swisstopo) und jeweilige Lizenz müssen vor einer
  realen Datenpublikation anhand der Kachel geprüft werden.
- Gebäude: Der lokale Nutzerimport **beweist keine Datenherkunft**.
  Wenn OpenStreetMap verwendet wird, Attribution + ODbL:
  <https://www.openstreetmap.org/copyright>.

**Die Matterhorn-Kachel ist im aktuellen PR NICHT enthalten.**
Der lokale Höhen-Importer wurde bisher ohne authentische Quelldatei
entwickelt. Es ist damit weder ein echter Matterhorn-Render-Smoketest noch
eine Datenqualitätsabnahme erfolgreich dokumentiert.

## Prüfpfad

```bash
npm run lint
npx vitest run test/visual/cosmosData.test.ts \
  test/visual/cosmosTerrainMath.test.ts \
  test/visual/cosmosGeography.test.ts \
  test/visual/cosmosDem.test.ts \
  test/visual/cosmosBuildings.test.ts \
  test/visual/cosmosBuilderContract.test.ts
npm run build
npx playwright test \
  e2e/cosmos-geography.spec.ts \
  e2e/cosmos-dem.spec.ts \
  e2e/cosmos-buildings.spec.ts
```

**Zusätzliche Pflichtprüfungen im echten WebGL-Browser:**
Sonnensystem → Erde → geografischer Anflug → lokaler DEM-Import;
GeoJSON-Gebäudeimport, Geometrieorientierung, Performance, Tastatur,
Touch, WebGL-Kontextverlust, fehlende Asset-Datei, kaputte GeoJSON-Datei
und sichtbare Attributionshinweise. Ein grüner Typecheck/Build ersetzt
diese Prüfungen nicht.

## GO/NO-GO

- **GO** für isolierte Implementierung, funktionale Vorprüfung und Draft-PR.
- **NO-GO** für Produktiv-Merge/-Deploy, solange echte DEM-/Gebäudedaten,
  Datenprovenienz, unabhängiger Review und Browsertests fehlen.
- **NO-GO** für das Versprechen einer vollständigen geografischen
  3D-Streaming-Kartenengine oder eines aktivierten SiteOS-Builder-Moduls.

MapLibre-/Kachelserver-Integration ist ein eigener Security-/Lizenz-
und Datenschutz-Prüfpfad. `public/_headers` wird hier nicht verändert.

## Pull-Request-Topologie

- #2109 Sonnensystem → main (Draft)
- #2110 fiktive Welt → #2109 (Draft)
- #2111 WGS84 Globe → #2109 (Draft)
- #2112 DEM → #2111 (Draft)
- #2113 Integration inkl. fiktiver Welt und Gebäudeviewer → #2112 (Draft)

**Wichtig:** #2110 und #2113 enthalten teils dieselben Landschaftsdateien.
Nicht beide unkoordiniert mergen. Keiner dieser PRs wird automatisch
gemergt, rebased oder geschlossen.
