# SiteOS — AI Rebuild Workflow

`DISCOVER → ASSESS → REBUILD → REFINE → PUBLISH → AUTOMATE → GOVERN`

Der Nutzer gibt eine bestehende Website-URL ein. Das System liest die reale
Seite, bewertet sie mit Belegen, erzeugt zwei bis drei gestaltete Richtungen,
lässt sie per Klartext und Komponenten-Editor verfeinern, prüft die
Veröffentlichungsreife und schlägt danach die nächsten Schritte im
RealSync-Betriebssystem vor.

Einstieg: `/build/rebuild` (Konto + `siteos.builder`). Link aus dem Studio
(`/build`, „Bestehende Website neu bauen").

## Bausteine

| Schicht | Ort | Aufgabe |
| --- | --- | --- |
| Kern | `packages/siteos-core/src/rebuild/` | abhängigkeitsfrei, deterministisch; läuft in Browser, Deno, Vitest |
| Server | `supabase/functions/siteos/handlers/rebuild.ts` | Abruf (SSRF-Schutz in `fetch-source.ts`), Persistenz, Gate, GO |
| Tabelle | `supabase/migrations/20261003155529_siteos_rebuilds.sql` | Workflow-Zustand je Rebuild, RLS: Mitglieder lesen, nur service_role schreibt |
| Oberfläche | `src/features/siteos/rebuild/` | Stepper, Bewertung mit Belegen, Richtungs-Karten, Refine-Studio, Publish, Automate, Govern |
| Tests | `test/siteos/rebuild-core.test.ts` | Import, Bewertung, Richtungen, Revision, Reife, GO |

### Kern-Module

- `extract.ts` — DISCOVER. HTML → `SiteImport`: Navigation, Sitemap, Texte,
  CTAs, Formulare, Bilder/Logo, Farben, Schriften, Trust-Signale,
  Positionierung, SEO, Drittanbieter. Jeder Fund trägt einen `Evidence`-Eintrag
  (Quelle, Auszug, Zeitpunkt, SHA-256, `ref`). Unsicheres ist `null`/`unknown`.
- `assess.ts` — ASSESS. Acht Kriterien (Hero-Klarheit, CTA-Struktur,
  Trust-Signale, Mobile UX, Textverständlichkeit, visuelle Hierarchie,
  SEO-Basics, Conversion-Fokus). Jeder Befund verweist auf Belege; ein Befund
  ohne Beleg ist ein Programmierfehler und wirft.
- `design-system.ts` — Token-Set aus der Marke: Primärfarbe WCAG-geprüft
  (4.5:1 Text, 3:1 Fläche; auf hellem Grund abgedunkelt, auf dunklem
  aufgehellt), Akzent, Neutrale, Typografie (nur bekannte Web-Schriften mit
  System-Fallback), Spacing, Radien, Buttons, Karten, Formulare, Breakpoints,
  Bewegung. Hell ist Default; dunkel nur bei dunkler Quelle **und** passender
  Richtung. `designSystemToTheme` bridgt auf `SiteTheme`.
- `components.ts` — zwölf feste Komponenten mit Varianten-Katalog; Editor-
  Operationen (Text, Reihenfolge, Sichtbarkeit, Variante, CTA, Media,
  Formularziel) werden geprüft und Ablehnungen benannt.
- `directions.ts` — REBUILD. Richtungen je Branche (`clean-enterprise`,
  `conversion-focus`, `local-trust`, `premium-advisory`, `governance-first`).
  Copy stammt aus dem Import; Referenzen, Preise, Kennzahlen ohne Beleg
  bleiben `placeholder: true`.
- `revise.ts` — REFINE. Klartext-Absichten („seriöser", „mehr Vertrauen",
  „weniger Startup, mehr Mittelstand", „mehr lokal", „CTA stärker", „Hero
  kürzer", „mehr wie Premium-Beratung", „für Handwerker", „für Steuerberater",
  „für KI-Governance", hell/dunkel, runder/eckiger, `#hex`) → benannte Bündel
  aus Copy-, Struktur- und Design-Operationen. Nichts wird neu gewürfelt.
- `render.ts` — Vorschau-Dokument aus Richtung + Design-System. Keine
  Drittanbieter, genau eine H1, Pflichtlinks, Platzhalter sichtbar markiert.
- `blueprint-bridge.ts` — Richtung → `SiteBlueprint` (Platzhalter ausgelassen),
  damit Analyse, Gate, Claim und Puck-Editor unverändert laufen.
- `publish.ts` — Reifeprüfung: Vorschau, Viewport/Breakpoints/Tap-Ziele,
  SEO, Performance-Basics, Formularziel, Platzhalter, Pflichtseiten, Gate.
  Fail-closed; `approvalRequired` immer `true`.
- `next-steps.ts` — AUTOMATE. Vorschläge mit Belegen, Route und
  `connection: none | requires-setup` — nie „verbunden".
- `workflow.ts` — Zustandsmaschine; `recordApproval` verlangt Nutzer-ID und
  passenden Artefakt-Hash.

### Endpunkte (`siteos`-Router)

| Endpunkt | Body | Wirkung |
| --- | --- | --- |
| `rebuild-start` | `tenant_id, url` | Abruf, Import, Bewertung, Richtungen; Zeile in `siteos_rebuilds` |
| `rebuild-get` | `tenant_id, rebuild_id` | Zustand lesen |
| `rebuild-refine` | `tenant_id, rebuild_id, base_sha256, instruction \| operations \| select` | neue Version; 409 bei veraltetem `base_sha256` |
| `rebuild-readiness` | `tenant_id, rebuild_id` | Reifeprüfung inkl. Publish Gate (mit realem Backend-Vergleich gegen die Quelle) |
| `rebuild-approve` | `tenant_id, rebuild_id, artifact_sha256, reason` | GO (owner/admin/dpo), Blueprint via `persistBlueprintVersion`, Vorschläge, Governance-Summary |

Mandant und Rolle kommen aus `requireAuthAndTenant`. URL-Parameter und
localStorage sind nie Autorität.

## Qualitätsregeln (durch Tests abgesichert)

- Keine erfundenen Referenzen, KPIs oder Preise — Platzhalter statt Behauptung.
- Jeder Befund hat Belege; derselbe Import ergibt denselben Hash.
- Jede Automation ist ein Vorschlag mit Freigabepflicht.
- Veröffentlichung nur nach GO mit Begründung, gebunden an den Artefakt-Hash;
  jede spätere Änderung verfällt Reife und Freigabe.

## Grenzen

- Kein JavaScript-Rendering: SPA-Inhalte, die erst im Browser entstehen,
  sieht der Import nicht (die Bewertung meldet `text.too-little`).
- Eine Seite je Import (die Startseite). Unterseiten werden als Sitemap
  erfasst, nicht gelesen.
- Kein Sprachmodell beteiligt; `origin.model` bleibt `null`, kein KI-Hinweis
  in der Vorschau. Ein Modell darf später Klartext in Absichten übersetzen —
  es darf die Richtung nicht selbst schreiben.
- Deploy: HTML-Export verfügbar; Cloudflare Pages und eigene Domain bleiben
  `requires-setup` bzw. `coming-soon`, wie im Studio.
