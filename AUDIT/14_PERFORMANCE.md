# 14 — Performance

## 1. Messungen (Produktion, 2026-08-10)

| Metrik | Wert | Bewertung |
|---|---|---|
| HTTP-Version | HTTP/2 (+ h3 via alt-svc) | ✅ |
| Cache | `public, max-age=3600, s-maxage=86400`, `cf-cache-status: DYNAMIC` | ⚠️ Root nicht im Edge-Cache |
| HTML-Größe | 94 081 Bytes | ⚠️ groß für ein SPA-Shell (Prerender aktiv) |
| **`index-*.js` roh** | **4 558 912 Bytes** | ❌ **sehr groß** |
| `index-*.js` Transfer (br/gzip) | 1 101 579 Bytes | ❌ |
| `vendor-recharts-*.js` | 120 260 Bytes | ✅ korrekt gesplittet |
| `vendor-supabase-*.js` | 53 110 Bytes | ✅ |

**~1,1 MB JavaScript-Transfer für die Startseite.** Auf einem 4G-Mobilgerät bedeutet
das mehrere Sekunden bis zur Interaktivität — LCP und INP leiden direkt.

---

## 2. Ursachenanalyse

Der Hauptchunk enthält per Design alle 119 Public Pages (eager imports für SEO,
CLAUDE.md §2). Zusätzlich liegen im Dependency-Set:

| Paket | Beitrag |
|---|---|
| `three` + `@react-three/fiber` + `drei` + `postprocessing` | **sehr groß** — 3D-Rendering |
| `@react-pdf/renderer` | groß — PDF-Erzeugung |
| `framer-motion` + `motion` | **beide** installiert — mutmaßlich redundant |
| `recharts` | ✅ bereits ausgelagert |
| `@supabase/supabase-js` | ✅ ausgelagert |

`vite.config.ts` splittet ausschließlich `recharts` und `supabase-js`; alles andere
landet im Entry-Chunk.

---

## 3. Empfehlungen

1. **`three`/`@react-three/*` aus dem Entry lösen** — größter Einzelhebel. 3D wird
   auf wenigen Seiten gebraucht; `manualChunks` + `React.lazy` an der Verwendungsstelle
   erhält den SEO-Pfad, weil 3D nicht SEO-relevant ist.
2. **`@react-pdf/renderer` lazy laden** — wird nur im Export-Flow benötigt.
3. **`framer-motion` vs. `motion` konsolidieren** — eine der beiden entfernen.
4. **Eager-Import-Regel differenzieren** — SEO braucht den *gerenderten HTML-Inhalt*
   (den liefert der Prerender), nicht zwingend den *eager JS-Import*. Da
   `scripts/prerender.mjs` bereits läuft, ist Route-Level-Code-Splitting für die
   Public Pages ohne SEO-Verlust möglich. Das ist die strukturelle Lösung —
   berührt aber die Architekturregel und braucht eine bewusste Entscheidung.

---

## 4. Nicht gemessen

Ohne authentifizierten Zugang und Live-DB nicht erhebbar (GRAU):
API-Latenz, DB-Query-Latenz, Cold-Start-Zeiten, Scan-Dauer, N+1-Queries,
fehlende Indizes, Memory-Leaks.

Positiv aus der statischen Analyse: die Migrationen legen durchgängig Indizes an
(`idx_*` auf `tenant_id`, Zeitstempeln, Hash-Chain-Walks). `runtime_events` ist
RANGE-partitioniert — für einen Event-Store die richtige Wahl.

| ID | Sev | Kurz |
|---|---|---|
| F-17 | P2 | Hauptbundle 4,5 MB / 1,1 MB Transfer |
| F-P1 | P3 | `framer-motion` und `motion` parallel installiert |
| F-P2 | P3 | Keine Performance-Budgets in CI (kein Lighthouse-/Bundle-Size-Gate) |
