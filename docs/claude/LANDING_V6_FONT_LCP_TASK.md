# Auftrag: Schriftladen und LCP auf Landing v6

Folgeauftrag aus PR #1986 (Tastatur, Fokus, Kontraste).

**Stand 26.10.2026:** #1984 wurde ohne Merge geschlossen; es gilt der Schriftstand
auf `main`. Schritt 2 (Ersatzschrift für Source Serif 4) ist umgesetzt. Offen und
außerhalb dieses Auftrags (eigener Auftrag, betrifft `src/main.tsx` bzw.
`vite.config.ts`):

- `createRoot` ersetzt das vorgerenderte HTML erst nach dem vollständigen JS
  (~7,5 s mobil gedrosselt). `hydrateRoot` würde die Knoten behalten, setzt aber
  hydrationsfreies Markup auf allen vorgerenderten Seiten voraus.
- Vites Preload-Helfer (`__vitePreload`) liegt im manuellen Chunk `vendor-viz`
  (three/recharts, ~395 KiB übertragen, 1,45 MB entpackt). `index.js` importiert
  ihn statisch, daher lädt jede Seite `vendor-viz` vorab. Ein eigener Chunk für
  `vite/preload-helper` in `manualChunks` würde das lösen.

## Voraussetzung

- PR #1984 (Typografie) ist entschieden: gemergt oder verworfen.
- Branch basiert auf dem danach gültigen `main`. Vorher keine Umsetzung, weil
  #1984 dieselben Dateien und den Schriftstand ändert.

## Ausgangslage (gemessen in #1986, Basis `b4f8a2f` und PR `6f859f3`)

- Mobile LCP ≈ 8,06 s auf beiden Ständen (Lighthouse 13.5, simulierte Drosselung).
- CLS streut zwischen 0, 0,0159 und 0,1681. Kontrollversuch: Werden die
  WOFF2-Antworten bis nach dem ersten Layout zurückgehalten, springt der
  Haupt-CTA bei 360×640 auf beiden Ständen um −52,3 px; bei blockierten
  Schriften 0 px.
- Lighthouse meldet ca. 526 KiB ungenutztes JS und ca. 600 ms blockierende
  Ressourcen.

## Ist-Stand Schriften

- Source Serif 4: `@font-face` in `src/styles/landing-v6.css`, `font-display: swap`.
- Inter, JetBrains Mono: `@font-face` in `src/index.css`, `font-display: swap`.
- Obere Leiste: `'JetBrains Mono Optional'` mit `font-display: optional` und
  Preload in `src/pages/LandingV6.tsx` (früherer CLS-Fix, nicht zurückbauen).

## Schritte

1. **LCP-Analyse:** LCP-Element und Aufschlüsselung (TTFB, Ladeverzögerung,
   Ladedauer, Renderverzögerung) aus den Lighthouse-Traces. Anteil von
   Schriften, JS-Einstieg und blockierenden Ressourcen getrennt ausweisen.
2. **Ersatzschriftmaße:** je Schrift eine Fallback-`@font-face` mit
   `size-adjust`, `ascent-override`, `descent-override` (ggf.
   `line-gap-override`), passend zum lokalen Fallback. Ziel: CTA-Verschiebung
   im Kontrollversuch nahe 0 px.
3. **Preload nur wenn belegt:** gezieltes Vorladen der Schrift im oberen
   Seitenbereich. Ein früherer Preload-Versuch ohne Wirkung wurde in #1986
   verworfen.
4. JS-Einstieg/Bundles nur analysieren und berichten; Umbau ist ein eigener Auftrag.

## Messmethode (wie #1986)

- Je fünf mobile Lighthouse-Läufe pro Stand, Reihenfolge abwechselnd
  (A B B A A B B A A B), neues Chrome-Profil pro Lauf, gleiche URL/Port.
- Kontrollversuch mit zurückgehaltenen und blockierten Schriften (CTA-y).
- Zusätzlich gegen den vorgerenderten Build, wie Cloudflare ihn ausliefert.
- Ergebnis als Median und Spannweite; keine Aussage aus Einzelläufen.

## Umfang

- Erlaubt: `src/styles/landing-v6.css`, `src/index.css` (nur `@font-face`),
  `src/pages/LandingV6.tsx` (nur Preload). Weil v6 die Schriftstapel inline
  setzt, zusätzlich die Stapel-Literale in `LandingV6View.tsx`/`useLandingV6.ts`
  und der Vertragstest `test/landing/landing-v6-font-stability.test.tsx`.
- Unverändert: Texte, Preise, Claims, Schriftfamilien, CTA-Ziele.

## Ablauf

Lokal prüfen → Draft-PR → remote nachprüfen → Pflicht-CI abwarten.
Merge und Deploy jeweils nur mit separater Freigabe.
