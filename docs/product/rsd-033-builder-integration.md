# RSD-033-A — Builder-Integration und Bestand

Stand: 13. November 2026. Paket 033-A. Nur Dokumentation und Klarstellung.
Kein neues Laufzeitverhalten, keine Migration, kein Deploy.

Dieses Dokument hält fest, was der Code auf dem Theme-Stack
`#2205` → `#2206` → `#2216` → `#2229` (`cursor/realsync-light-frontend-6f14`)
bereits tut, und wo ältere Texte in `docs/SITEOS_ARCHITECTURE.md` und
`src/config/frontend-entry-modes.ts` daneben lagen. Es ersetzt keine
Spec und schaltet nichts scharf.

## Einordnung in die sechs Module

Die Zielarchitektur auf diesem Branch (`src/components/platform/platformArchitecture.ts`)
hat sechs Module. Der Builder ist eines davon, keine siebte Plattform
und kein zweites Projektregister.

| Modul | Öffentliche Route | Bereich der App-Hülle | Status aus `implementation-status.ts` |
|---|---|---|---|
| Governance OS | `/governance-runtime` | `governance` | Live (`governance-runtime-core`) |
| AI Agent Studio | `/chatbot/start` | `agent-studio` | Demo (`channel-bots`, Preview) |
| AI Creative Studio | `/app/ai-systems` | `ai-studio` | geplant (kein eigener Eintrag) |
| Website & App Builder | `/build` | `website-builder` | Demo (`web-builder`, Preview) |
| AI Operations | `/automations` | `automationen` | Demo (`automation-n8n`, Preview) |
| Command Center | `/app/dashboard` | `dashboard` | Live (`command-center`) |

Die acht Bereiche aus `src/app/areas.ts` bleiben das Navigationsregister.
`website-builder` hat die Heimroute `/app/siteos`. Die sechs Module sind die
Karten der Zielarchitektur; sie löschen die acht Bereiche nicht.

**Annahme:** Die Badges oben folgen `getImplementation` auf diesem Branch.
Ein Live-Abgleich der betriebenen Function ist nicht erfolgt.

## Eine Studio-Identität, zwei vorhandene Engines

Vertrag: `src/features/build-studio/README.md`. Keine Tabelle `build_projects`.
DesignOS bekommt kein Backend.

| Einstieg | Engine | Speicher |
|---|---|---|
| `/build`, `/builder/:slug` | SiteOS, deterministischer Prompt-zu-Blueprint-Kern, Puck | `siteos_blueprints` |
| `/builder/:slug/code` | bestehende Code-Workbench | `app_builder_projects` |

`landing` und `website` bleiben bei SiteOS. `web_app`, `dashboard` und
`saas_app` bleiben bei der Code-Workbench. `published` deployt nicht.
Der Mandant kommt aus der Sitzung, nicht aus der URL.

Weitere vorhandene Routen, unverändert: `/app/siteos`,
`/app/siteos/builder` (leitet um), `/app/siteos/claim`,
`/app/siteos/modernize`, `/unified-entry/transformation`, `/frontend-builder`.

## Ist-Stand SiteOS

Der Kern `@realsync/siteos-core` bleibt frameworkfrei (Browser, Edge, Vitest).
`supabase/functions/siteos/handlers/builder.ts` ruft kein Modell auf. Die
Synthese lässt aus der Anreicherung nur `name`, `summary`, `services` und
`locality` zu. Gleiche Eingabe, gleicher Blueprint, gleicher Hash.

Der Editor ist Puck unter `src/features/siteos/editor/`. Seiten anlegen,
umbenennen und löschen hängen im Workspace:
`PagesPanel` in `src/features/siteos/workspace/panels.tsx`, aufgerufen aus
`AppBuilderWorkspacePage.tsx` über `persist(ops)` und `siteos/edit`.

Veröffentlichen im Code, nicht als zweiter Stack:

- `supabase/functions/siteos/handlers/publish-gate.ts`
- `supabase/functions/siteos/handlers/publish-preview.ts`
- `supabase/functions/siteos/handlers/publish-production.ts`
- `supabase/functions/siteos/cloudflare-pages.ts`

Preview verlangt `confirm_preview_deploy === true` und die Rollen
`owner` oder `admin`. Ohne Cloudflare-Konfiguration antwortet der Handler
`503` mit `CLOUDFLARE_NOT_CONFIGURED`. Production verlangt eine geprüfte
Preview und `confirm_go`. In `publish-production.ts` ist kein DNS-Schnitt.
Die Workspace-Oberfläche ruft diese Handler auf.

**Annahme, nicht geprüft:** Ob `CLOUDFLARE_API_TOKEN` und
`CLOUDFLARE_ACCOUNT_ID` in der betriebenen Function gesetzt sind, welche
Version der Function `siteos` deployt ist, und ob `website_projects` Zeilen
hat. Bis dahin bleibt der kundensichtbare Satz in
`FRONTEND_DELIVERY_LIMIT_NOTE` bei der Vorschau. Diesen Satz auf
„veröffentlichbar“ umzustellen wäre eine Zusage ohne belegten Lauf.

Die teilbare Vorschau liegt in `workers/siteos-preview/`. `wrangler.jsonc`
bindet `PREVIEWS` an eine konkrete Namespace-Id. `docs/product/siteos-anonymous-build.md`
§6a führt die Secrets weiterhin als offen. Dieser Stand wurde hier nicht
neu gemessen.

Die Inline-Vorschau bleibt `SandboxedPreviewFrame`. `allow-scripts` und
`allow-same-origin` dürfen nicht gemeinsam gesetzt sein. Default für
SiteOS-HTML ist `static`.

## `app_builder_projects` — REVIEW ONLY

Migration `supabase/migrations/20260917000000_app_builder_projects.sql`,
Kopfkommentar: „REVIEW ONLY — do not apply until production release is
explicitly approved.“ Die Tabelle ist nicht `siteos_blueprints` und nicht
Cloudflare KV. Mitglieder dürfen laut Kommentar nur lesen; Schreiben ist
`siteos/code-persist` mit `service_role` vorbehalten.

Dieses Paket wendet die Migration nicht an, ändert sie nicht und schaltet
sie nicht live. **Annahme:** Ob die Tabelle in der betriebenen Datenbank
bereits existiert, ist unbekannt.

## Theme-Stack und die Lücke zum Renderer

Auf diesem Branch liegen semantische Tokens, `ThemeProvider` und der
Generator (`generateTheme`, `publishTheme`, `remixTheme`) unter
`src/app/theme/`. Der SiteOS-Renderer kennt davon noch nichts: `SiteTheme`
in `packages/siteos-core/src/types.ts` bleibt `mode`, `accent`, `surface`,
`foreground`, `fontDisplay`, `fontBody`, `radiusPx`. Unsichere CSS-Werte
verwirft `safeColor` / `safeFontStack`.

Ein zweiter Distanzalgorithmus wird nicht angelegt. Die Bindung ist Paket
033-B und läuft nur, wenn ein Blueprint ein DNA-JSON trägt. Ohne dieses
Feld bleiben Hash und gerendertes Gerüst.

Der offene Draft `#2197` (Branchen-Themes) wird hier nicht geschlossen und
nicht geändert. Seine Startfarben gehen in 033-B als Eingabe des bestehenden
Generators auf, nicht als dritte Palette im Default-Pfad von `synthesize`.

## Was an den alten Texten korrigiert wurde

| Stelle | Alter Satz | Stand im Code |
|---|---|---|
| `docs/SITEOS_ARCHITECTURE.md` §5b | „Es gibt keinen Publish-Knopf.“ | Gate plus `publish-preview` und `publish-production` liegen im Repo. Der Betrieb ist nicht belegt. |
| dieselbe Datei §5d | Veröffentlichen und Seitenoperationen „PLANNED“ | Workspace ruft die Handler auf. `PagesPanel` hängt an `siteos/edit`. |
| dieselbe Datei §6 | Upload fehle noch vollständig | Upload-Code liegt neben dem Gate. Zugangsdaten und ein belegter Lauf fehlen. Domain bleibt draussen. |
| `src/config/frontend-entry-modes.ts` | Kommentar „keinen Publish-Handler“ | Der Kommentar nennt jetzt die vorhandenen Handler. `FRONTEND_DELIVERY_LIMIT_NOTE` bleibt bei der Vorschau. |
| `test/config/frontend-entry-modes.test.ts` | suchte nur `handlers/publish.ts` | Diese Datei gibt es nicht. Der Modus `frontend_for_existing_backend` bleibt aus, weil die fremde API fehlt. |

Nicht angefasst: `src/components/landing/v6/LandingV6View.tsx`. Nicht
umgestellt: `from_own_media`, `from_reference`, `frontend_for_existing_backend`
(`available: false`).

## Abhängigkeiten

033-A hängt an keinem Code-PR. Gelesen wurde der Branch
`cursor/realsync-light-frontend-6f14` (`#2229`), der auf `#2216` liegt.
033-B setzt denselben Branch voraus und ändert den Default-Renderer nicht.

Nicht in 033-A und nicht in 033-B: DNA-Editor, Publish-Betrieb, Secrets,
DNS, Stripe, Auth, eine neue Tabelle, ein Modellaufruf im Website-Builder.

## Offene Punkte

- Q1, Q4 und Q5 der Modul-Spec bleiben offen (Modellschritt für Websites,
  öffentliche Anbieter-Nennung, kundeneigene Domain).
- Q3 (Live-Secrets, deployte Function, `website_projects`, Anwendung von
  `app_builder_projects`) ist nicht gemessen.
- Der Kontrast-Analysator behandelt `theme.accent` heute als Linkfarbe.
  Das stimmt für Blueprints ohne DNA. Die Umschaltung für ein DNA-JSON
  gehört zu 033-B, nicht zu diesem Text.

## Rollback

Diesen Dokument-Commit zurücknehmen. Es gibt keinen Datenzustand und
keinen gerenderten Stand, der davon abhängt.
