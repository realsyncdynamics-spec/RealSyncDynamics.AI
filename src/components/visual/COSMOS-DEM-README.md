# COSMOS – lokale DEM-Datenpipeline (Arbeitsstand)

**Status:** Engine/Importer implementiert, aber **kein verifiziertes Höhenbild eingecheckt**.
Keine Behauptung, dass der vorhandene Build bereits reales Gelände darstellt.

## Quelle / Herkunftsnachweis

Verwendetes Format: Terrarium-RGB-Höhenkacheln mit 512 × 512 Pixeln.
Zielkachel bei Mapterhorn: `https://tiles.mapterhorn.com/13/4270/2915.webp`.

- Dokumentation: https://mapterhorn.com/data-access/
- Quellen / Attribution: https://mapterhorn.com/attribution/
- Datengrundlagen je Region verschieden. Für diese Schweizer Region ist
  swisstopo als Ursprungsanbieter explizit zu prüfen.
- swisstopo-Nutzungsbedingungen:
  https://www.swisstopo.admin.ch/de/nutzungsbedingungen-kostenlose-geodaten-und-geodienste

**Nicht** ohne nachweisbaren Download, Prüfsumme, Quellen-/Lizenzprüfung
und Freigabe als Release-Asset verteilen. Dies ist keine Freigabe zur
Drittdatenübertragung oder Änderung der `Content-Security-Policy`.

## Nach Import einer rechtmäßig bezogenen Datei

1. Herkunft, Zeitstempel und SHA-256 verifizieren/dokumentieren.
2. Die Datei als `public/cosmos/dem/matterhorn-z13-x4270-y2915.webp`
   auf einem eigenen Branch ablegen. Keine externen Skripte zur Laufzeit.
3. `/cosmos` öffnen, geografische Erde → `Lokales 3D-Höhenmodell (DEM)`.
4. Auf dem Bildschirm müssen reale min/max Höhenwerte sowie eine
   vertikal überhöhte Topografie erscheinen. Die Werte sind Meter über
   dem jeweiligen Daten-Datum; keine Höhenmessgarantie.
5. Fehlende Asset-Datei oder unzulässige Bildformate müssen einen
   eindeutigen Fehler zeigen, **niemals** fiktive Höhen.

Alternativ kann der Nutzer eine rechtmäßig bezogene 512px-Datei
per Datei-Input lokal in den Browser laden. Diese bleibt im Browser,
ihre Herkunft kann vom Programm **nicht** automatisch geprüft werden.

## Reproduzierbare Prüfungen

```bash
npm run lint
npx vitest run test/visual/cosmosDem.test.ts
npm run build
npx playwright test e2e/cosmos-dem.spec.ts
```

Mindestprüfstand: CI mit TypeScript, Vite-Build, Unit-Tests und
echtem Browser (Chromium sowie Android-Touch). Der Browsertest für den
fehlenden DEM-Asset-Pfad ist nur ein **Negativtest**: Er beweist nicht die
Darstellung realer Höhen. Für GO muss eine verifizierte Datei im
Browser getestet werden.

## Spätere Ausbauschritte

- Quell-validiertes GeoJSON/3D-Gebäude-Modul getrennt vom DEM
- Performance-Limits und LOD für große Regionen
- Auflösung geografischer Tiles und Kameraflug in Meter-Koordinaten
- Integrationsadapter für SiteOS nach Prüfung der vorhandenen Builder-Architektur

Kein Merge oder Cloudflare-Produktivdeploy ohne separate Freigabe.
