# SYNC – Integrationsprüfung der sechs weißen Produktseiten

**Basis:** Draft-PR #2350 (`feat/white-product-landings-higgsfield-hero-20261120`). Dieser Integrationsbranch ist **gestapelt**, verändert weder `main` noch das produktive Backend.

## Was wirklich implementiert ist

- Die SYNC-Masterdatei `public/models/sync-mascot.glb` und das Fallback-Foto `public/landing-v3/sync-still.jpg` stammen bytegleich aus PR #2338/#2340 (Git-Blob-SHA: `5a142939fa33da844d26b91833bc20312498f6b2` und `c0ed69704092a685dc0e497426d9975207397242`).
- Der vorhandene, per dynamischem `import()` geladene Three.js-Renderer mit Einmal-Winken und Neustart-/Cleanup-Logik wird wiederverwendet.
- `SyncStage` ist die gemeinsame Figur für `/` und **alle sechs** weißen Produkt-Landingpages. Unterschiedliche Kamerawinkel, Posen und dekorative Produkt-Bühnenobjekte – aber dieselbe Figur.
- Bei reduzierter Bewegung, schwachem Gerät, Datensparmodus, fehlendem WebGL oder GLB-Ladefehler bleibt ein **SYNC-Standbild** sichtbar. Keine neue Figur als Fallback.
- Bei einem **ausdrücklich als SYNC freigegebenen**, selbst gehosteten Higgsfield-Video kann die Hauptseite den MP4-/WebM-Export anstelle der interaktiven Bühne abspielen. Andere URLs und nicht genehmigte Medien fallen auf dieselbe SYNC-Bühne zurück.

## Vor Freigabe erforderliche Higgsfield-Einstellungen

| Variable | Zweck |
|---|---|
| `VITE_HIGGSFIELD_BOT_VIDEO_URL` | öffentliche, **same-origin**, mit `/` beginnende MP4-/WebM-URL unter der Produktivdomain |
| `VITE_HIGGSFIELD_BOT_VERIFIED_SYNC` | ausschließlich nach visueller und rechtlicher Abnahme als `true` setzen |

Diese Felder sind öffentlich sichtbare **Frontend-Konfiguration**, keine Secrets und **kein** Echtheits- oder Rechtsnachweis an sich. Der Verantwortliche muss sicherstellen, dass das Video **exakt dieselbe** SYNC-Figur aus dem Mastermodell zeigt, bevor die zweite Variable gesetzt wird. Die Video-Datei liegt diesem PR nicht bei und wurde nicht gerendert.

## Abnahme-Matrix

| Gate | Nachweiskriterium | Stand |
|---|---|---|
| Source-Fidelity | GLB-/JPG-Blob-SHA mit Original identisch | geprüft |
| Brand-Fidelity | derselbe SYNC in Startseite und sechs Produkt-Heros | Quelltext integriert |
| Fallback | kein Video oder reduziertes Motion-Signal zeigt SYNC-Still | im Code vorgesehen; Browser-Test offen |
| Video | freigegebenes lokales Higgsfield-Original und Mobiltest | **offen** |
| Voice | reales deutsches E2E-Gespräch mit nachgewiesener Übergabe | **offen**; der Film aus PR #2351 bleibt Demo |
| Backend-Screencast | Daten bereinigt, identifizierbarer Vorgang mit Audit-Evidence | **offen** |
| Marketingclaims | Live/Preview/Geplant aus Implementierungs-Registry und Runtime | Registry-Einbindung aus #2350 unverändert |
| Tests | Vitest/Lint/Build, Playwright Mobil/Desktop, WebGL/RM/Fallback | **nicht vollständig ausgeführt** |
| Deployment | explizite Merge-/Deploy-Freigabe | **nicht erteilt** |

## Browser-Abnahme – vorbereiteter Playwright-Prüfpfad

`e2e/brand/sync-seven-routes.spec.ts` enthält eine Matrix für **Startseite + sechs Produktseiten** auf Desktop (1280 × 800) und Mobile (390 × 844), außerdem drei gezielte Szenarien für reduzierte Bewegung, blockierte GLB-Quelle und nicht freigegebenes Higgsfield-Video: insgesamt **17 Testfälle**. Die Datei ist eingecheckt, **aber ihre Playwright-Tests wurden noch nicht ausgeführt**.

Die Cloudflare-Git-Integration hat nach dem ersten CI-Lauf eine **Branch-Preview** bereitgestellt, nicht die Produktivdomain. Die Preview-URL wird aus dem GitHub-Check `Cloudflare Pages: realsyncdynamics-ai` abgeleitet; die Verfügbarkeit und Browserdarstellung sind separat zu prüfen. Kein externes Voice-/Video-Medium ist freigegeben.

Lokaler Test nach eigenem autorisiertem Build:

```bash
npm run build:full
npm run e2e -- e2e/brand/sync-seven-routes.spec.ts
```

Test auf eine **explizit verifizierte** Preview-URL:

```bash
TEST_BASE_URL=https://<geprüfter-preview-host> npm run e2e -- e2e/brand/sync-seven-routes.spec.ts
```

## Testpfad

```bash
npm run lint
npx vitest run test/landing/sync-unified-stage.test.tsx test/landing/white-product-landings.test.tsx test/landing/landing-v3.test.tsx
npm run build
npm run check:landing-claims
npm run check:sitemap
```

Zusätzlich Screenshots/Video prüfen auf 390×844 und 1280×800 sowie mit `prefers-reduced-motion: reduce`, deaktiviertem WebGL, Datensparmodus und absichtlich ungültiger GLB-/Video-URL. Siebenfacher visueller Abgleich derselben Figur und der abweichenden Bühnenmotive.

## Was nicht verändert wird

Keine neue Figur, keine automatisch generierten Bilder, keine neue Subscription, keine Änderung an Voice-Backend, Stripe, Supabase, RLS, API-Keys, Kundenrouten außerhalb des #2350-Basis-PR und keine produktive Veröffentlichung.

**Abhängigkeiten:** PR #2350 zuerst reviewen; dieser Branch wird als **Draft-PR gegen #2350** geöffnet. Erst nach sicherer Zusammenführung der Überschneidungen aus #2338, #2340, #2331 und ggf. #2344 sowie einer separaten Deploy-Freigabe darf die Integration auf `main` gelangen. Das Storyboard-/Medienkit ist in PR #2351.
