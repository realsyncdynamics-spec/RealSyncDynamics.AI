# Hero-Texturen Landing v4 „Klassisch"

Genutzt von `src/components/landing/v4/heroEarthScene.ts` (Route `/design/classical`).
Self-hosted statt CDN, weil die CSP keine Fremd-Hosts für Bilder der Szene vorsieht und die
Seite sonst von jsDelivr abhinge. Dateien unverändert übernommen (gleiche Bytes wie in der
Design-Referenz), damit die Szene deckungsgleich bleibt.

| Datei | Auflösung | Quelle | Lizenz |
|---|---|---|---|
| `earth-blue-marble.jpg` | 4096×2048 | three-globe `example/img/` (NASA Blue Marble) | NASA-Bildmaterial, gemeinfrei; Repo MIT |
| `earth-night.jpg` | 4096×2048 | three-globe `example/img/` (NASA Earth at Night) | NASA-Bildmaterial, gemeinfrei; Repo MIT |
| `earth_normal_2048.jpg` | 2048×1024 | three.js r160 `examples/textures/planets/` | three.js MIT |
| `earth_specular_2048.jpg` | 2048×1024 | three.js r160 `examples/textures/planets/` | three.js MIT |
| `earth_clouds_1024.png` | 1024×512 | three.js r160 `examples/textures/planets/` | three.js MIT |
| `moon_1024.jpg` | 1024×512 | three.js r160 `examples/textures/planets/` | three.js MIT |

Gesamt ≈ 3,2 MB. Mars, Milchstraße, Sonne und ISS erzeugt die Szene prozedural.
