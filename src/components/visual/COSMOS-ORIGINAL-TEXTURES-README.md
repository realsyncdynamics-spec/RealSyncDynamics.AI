# COSMOS 3.0 – lokal gehostete, originale 360°-Planetentexturen

## Ergebnis

Die visuellen Himmelskörper in `/cosmos` bleiben Three.js-Sphären
mit skalierbarem Radius. Ihre equirectangularen (2:1) Originalkarten
liegen jetzt im Git-Repository unter `public/textures/cosmos/`.

**Kein CDN zur Laufzeit.** Die Planetentexturen werden nur von derselben
Origin wie der RealSync-Explorer geladen. Erst bei einem späteren
externen Datenanbieter wären zusätzliche Datenschutzprüfungen erforderlich.

- Sonne, Merkur, Venus, Mars, Jupiter, Saturn, Uranus, Neptun: originale
  **2K-JPEG-Texturen** aus dem Solar System Scope-Paket.
- Mond: 1024px-JPEG aus `mrdoob/three.js`, Beispieltextur `moon_1024.jpg`.
  Diese kleinere Datei wurde anstelle einer über der 1-MB-API-Grenze
  liegenden Monddatei verwendet; der eigenständige Herkunftsnachweis
  dieses Bildes bleibt ein Punkt des finalen Lizenzreviews.
- Erde: vorhandene `public/textures/earth-day-2k.webp` mit Wolkenschicht,
  Lizenzhinweis in `public/textures/README.md`.

**WebP-Status:** Die acht neuen Originalkarten und die Mondkarte liegen
aktuell im unveränderten JPEG-Ausgangsformat, **nicht in WebP**.
Dies erhält einen bytegenauen SHA-Nachweis. WebP-Konvertierung bleibt
eine weitere Performanceoptimierung mit separaten Decode-/GPU-Tests.

## Quellen und Rechte

- Solar System Scope: https://www.solarsystemscope.com/textures/
- CC BY 4.0 (kommerzielle Nutzung mit Attribution):
  https://creativecommons.org/licenses/by/4.0/
- Fixierter öffentlicher Source-Mirror:
  https://github.com/Sanghel/solar-system-3d/tree/47c8bbc6b63f4c6c2310911238c2c4b6bff6d20b/public/textures
- Mond (Three.js-Beispiel):
  https://github.com/mrdoob/three.js/blob/dev/examples/textures/planets/moon_1024.jpg

Solar System Scope weist darauf hin, dass unkartierte Planetenregionen
künstlerisch ergänzt sind. Daher keine Behauptung, es handele sich
um ungeänderte NASA-Rohdaten.

Alle JPEGs wurden mit GitHub-Git-Blob-API kopiert, ohne Rekodierung.
Die Git-Hashwerte von Quelle und Ziel sind gleich:

| Datei | Originaler Git-Blob-SHA-1 |
|---|---|
| `sun.jpg` | `9d787d85bb457aa5d6f1e4cacbd09bb187907e53` |
| `mercury.jpg` | `eebaed96c2a7fbae4f3effd97a345ac84e8aca99` |
| `venus.jpg` | `a26a410bd6856804a056d7c5c7b7771cc8499328` |
| `moon.jpg` | `6963a34dab0af17acfe90e3299263e52d27c6df4` |
| `mars.jpg` | `b3654a9b2d21c2910c38a0287423862650d54e1f` |
| `jupiter.jpg` | `21f1951026dc8e539f751ef55b559fa683869c63` |
| `saturn.jpg` | `d8b23dfe7d959aae965be0ece559a25c75651b6b` |
| `uranus.jpg` | `d0abf4c1c95315a3168f5342712a8dfd3357160d` |
| `neptune.jpg` | `30e7ac5540e5afb7d997034f5c51bc44a0d8d321` |

**Attribution in der UI:** Solar System Scope (CC BY 4.0),
Mond zusätzlich über Three.js-Quellenlink.

## Benutzeroberfläche / Lastbegrenzung

- Originalkarten sind für Standard/Hoch standardmäßig **eingeschaltet**.
- Im Energiesparmodus rendert die App nur Farbflächen.
- Schalter ermöglicht das Abschalten der Karten auf leistungsschwachen Geräten.
- Größenregler 60–180 %, Kameraabstand folgt der Skalierung; die
  Planetbahnen sind bewusst nicht maßstabsgetreu.
- Fehler in einer Bilddatei führen zu sichtbarem Farb-Fallback.
- Ressourcenfreigabe beim Wechsel und beim Unmount.

## Reproduzierbare Checks

```bash
npm run lint
npx vitest run test/visual/cosmosOriginalTextures.test.ts
npm run build
npx playwright test --config=playwright.catalog.config.ts \
  tests/e2e/cosmos-original-textures.spec.ts
```

Die beiden Playwright-Tests prüfen Steuerung und alle neun lokalen
Bildassets einschließlich HTTP-Status, MIME-Typ und equirectangularem
Bildseitenverhältnis von 2:1. Ein echter WebGL-GPU- und Android-Touchtest
bleibt ein zusätzlicher Freigabeschritt.

Kein Merge nach `main` oder Live-Rollout aus diesem Draft-PR.
