# /unternehmen/ — statische Unternehmensseite

Eigenständige Seite „RealSync Dynamics & AI“ (Governance OS, Voice Agent, Landingpage Builder).
Sie ist kein Teil der SPA: Cloudflare Pages liefert `public/unternehmen/index.html` vor dem
`/* /index.html 200`-Fallback aus. Sie ersetzt nicht die Startseite `/`.

## Regeln für Änderungen

- **CSP:** `public/_headers` erlaubt `script-src 'self'` ohne `'unsafe-inline'`. Kein Inline-Skript,
  keine Importmap, keine `on…=`-Attribute. Logik gehört in `unternehmen.js` (klassisch) bzw.
  `globe.js` (Modul).
- **Keine Drittanbieter-Requests:** Schriften aus `/fonts/`, Texturen aus `/textures/`,
  three.js lokal in `vendor/`.
- **Status und Preise:** Produktstatus nur nach `src/product/implementation-status.ts`
  (Voice = `coming-soon` → „geplant“, Builder = `preview`). Beträge nur aus `shared/pricing.ts`.
  Die CI-Claim-Prüfungen scannen `src/`, nicht diese Datei — bei Textänderungen selbst gegenprüfen.
- **Demos** sind Browser-Simulationen und als solche gekennzeichnet; sie erzeugen keine Hashes
  oder Kennzahlen, die wie Messwerte aussehen.
- **Kontaktformular:** `POST` an die Edge Function `sales-lead` mit `source: 'company-landing'`.

## Herkunft der Assets

| Datei | Quelle | Lizenz |
|---|---|---|
| `vendor/three.module.min.js` | three.js 0.160.0 (npm, `build/three.module.min.js`) | MIT, siehe `vendor/LICENSE` |
| `img/moon-1k.jpg` | three.js r160 `examples/textures/planets/moon_1024.jpg` | three.js examples (MIT) |
| Erde (`/textures/*.webp`) | Repo-Bestand | siehe `public/textures/README.md` |
| `/fonts/cormorant-garamond-*-300-*.woff2` | Google Fonts, Cormorant Garamond (variable Datei, deckt 300–600) | OFL, siehe `public/fonts/OFL-CormorantGaramond.txt` |

Entwurfsquelle: hochgeladene Datei `RealSync_Dynamics_v5.html`, überarbeitet zu v6
(Claims, Preise, Status, externe Abhängigkeiten).
