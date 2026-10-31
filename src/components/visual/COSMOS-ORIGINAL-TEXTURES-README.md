# COSMOS – Original-Planetentexturen und visuelle Skalierung

## Ziel

Die Planeten in `/cosmos` sind weiterhin echte Three.js-Sphären, aber können
statt einfarbiger Materialien hochwertige equirectangulare **Originalkarten
von Solar System Scope** darstellen. Das bisherige Bild einer Planetenparade
dient als Designreferenz; es ist keine sphärische Kartentextur.

### Quellen und Lizenz

- Originalautor: Solar System Scope, https://www.solarsystemscope.com/textures/
- Lizenz: Creative Commons Attribution 4.0 International
  https://creativecommons.org/licenses/by/4.0/
- Die Texturen sind aus Raumfahrtbildern kartografisch aufbereitet.
  Einige unbekannte Regionen enthalten stilisierte/fiktive Ergänzungen.
  Deshalb nicht als unveränderte wissenschaftliche NASA-Rohaufnahmen bezeichnen.
- GitHub-Mirror mit Quellenhinweis:
  https://github.com/Sanghel/solar-system-3d/tree/47c8bbc6b63f4c6c2310911238c2c4b6bff6d20b/public/textures
- Fester Mirror-Commit:
  `47c8bbc6b63f4c6c2310911238c2c4b6bff6d20b`.
- Dateien: Sonne, Merkur, Venus, Mars, Jupiter, Saturn, Uranus, Neptun
  und Mond. **Erde:** schon vorhandene lokale 2K-Solar-System-Scope-Textur
  mit separater Wolkenschicht.
- **Attribution in der UI:** © Solar System Scope, CC BY 4.0.

### Kein stiller Drittanbietertransfer

Die 2K-Bilddateien sind derzeit **nicht auf der eigenen Domain abgelegt**,
sondern können optional von `cdn.jsdelivr.net` geladen werden.
Dadurch können IP-Adresse und Browserdaten beim CDN anfallen.
Deshalb stehen sie **standardmäßig aus** und werden erst durch aktive
Auswahl der Checkbox geladen. Die vorhandene CSP erlaubt `img-src https:`;
`connect-src` wird nicht verändert. Wenn Bilder nicht geladen werden
können (z. B. CORS, Netzwerk, Content-Blocking), nutzt die Szene weiterhin
einfarbige Kugeln.

**Vor produktiver Aktivierung / standardmäßigem Einschalten:**
- Original-2K-Dateien als freigegebene, versions-/checksumgeprüfte,
  **selbst gehostete WebP-Assets** einchecken;
- Runtime-URLs auf `/textures/cosmos/` umstellen;
- Attribution und Privacy-/Lizenznachweis prüfen, Datenübertragungen minimieren;
- WebGL-Rendering, Texturorientierung, Saturnringe, Mond, Kamera, mobile
  Speichernutzung und GPU-Kontextverlust im Browser prüfen.

## Skalierung und Performance

- Größenregler 60–180 % über `clampPlanetScale` und `scaledRadius`.
- Orbitradii bleiben unverändert, die Darstellung bleibt schematisch.
- Die Fokus-Kamera korrigiert ihren Abstand nach Größeneinstellung.
- Energiesparqualität deaktiviert externe Originaltexturen und verwendet
  einfarbige Kugeln; Standard/Hoch laden maximal die 2K-Karten.
- Texturen werden bei Abwahl/Szenenwechsel freigegeben.

## Reproduzierbare Prüfungen

```bash
npm run lint
npx vitest run test/visual/cosmosOriginalTextures.test.ts
npm run build
npx playwright test --config=playwright.catalog.config.ts tests/e2e/cosmos-original-textures.spec.ts
```

Der Playwright-DOM-Test bestätigt die Auswahl und Skalierung, **nicht** den
visuellen WebGL-Texture-Upload oder externe CDN-Verfügbarkeit. Vor dem
Produktiv-GO ist ein unabhängiger visueller Browsertest obligatorisch.
