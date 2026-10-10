# App Builder — bolt.diy Engine

Additive. Überschreibt Puck, Auth, Tenant, Orchestrator **nicht**.

- Protokoll + Mechanik: `./bolt/`
- Herkunft: stackblitz-labs/bolt.diy (MIT) — siehe `bolt/VENDOR.md`
- Freeze: kein Merge nach `main`, kein Production-Deploy, keine Production-Migration. PR #1429 nur Review. srcDoc = HTML/CSS/local JS.

## Verdrahtung

| Pfad | Oberfläche |
|---|---|
| `/builder/:slug` | SiteOS / Puck (unverändert) |
| `/builder/:slug/code` | RealSyncDynamics.AI Web App Builder |

Ablauf:

1. Session (Supabase Auth) und Mandant (`TenantProvider`) — `tenant_id` nie aus der URL.
2. Entitlement `siteos.builder` über `canOpenAppBuilder` (kein fail-open OR).
3. Prompt → Context-Pack → RealSync AI Gateway `feature: app_builder_code` (`op: stream` NDJSON, keine Browser-Keys).
4. bolt.diy Parser → Governance-Gate → FileStore → sandboxed srcDoc-Preview (lokales CSS/JS wird inlined).
5. Persistenz: `POST siteos/code-persist` → Tabelle `app_builder_projects` (nicht `siteos_blueprints`). Browser-Store nur Cache.

## Production-Freigabe (extern)

- Migration `supabase/migrations/20260917000000_app_builder_projects.sql` anwenden.
- Edge Function `siteos` (Router, inkl. `code-persist`) und `ai-gateway` (`op: stream`) deployen.
- Kein KV. Kein Merge nach main aus diesem Stand.

WebContainer, COOP/COEP, wrangler, KV: gesperrt bis explizite Infra-Freigabe.

## Opt-in React-Vorschau (Sandpack)

- Build-Flag `VITE_APP_BUILDER_SANDPACK=true`; fehlt sie oder hat sie einen anderen Wert, bleibt ausschließlich srcDoc aktiv. Ausschalten erfordert einen neuen Build.
- Nur React/JSX-Projekte wechseln in den Sandpack-Pfad. HTML/CSS/local-JS-Landingpages behalten srcDoc. „Skripte in der Vorschau“ ausschalten deaktiviert auch Sandpack.
- Bei expliziten App-/Dashboard-/SaaS-Aufträgen erlaubt die Flag einen React-Prompt (`package.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, CSS). Landingpage-Aufträge und der bestehende manuelle AI-/Governance-Ablauf bleiben unverändert.
- Erst **React-Vorschau starten** lädt Sandpack und übermittelt lokale Projektquellen an den externen CodeSandbox-Bundler. Keine vertraulichen Projekte verwenden. Keine Gateway-Keys, Tenant-Kontexte, `.env`, Paket-Scripts oder Builder-Metadaten werden übergeben.
- Preview-only: Der Adapter bündelt lokale React-/TSX-/JSX-/CSS-Dateien mit React und React DOM. Vite-artige Entry-Dateien werden adaptiert; Vite-Konfiguration, Plugins, beliebige npm-Abhängigkeiten, Node, Shell, Backend, Auth, Billing, Persistenz und Production-Deploy werden **nicht** ausgeführt. Ein App-only-Projekt erhält nur in der Vorschau einen Bootstrap.
- Der Sandpack-Rahmen nutzt die feste externe Herkunft `https://2-19-8-sandpack.codesandbox.io/` mit Scripts und eigener Herkunft für Bundler-Kommunikation/Storage, ohne Form-, Popup-, Download-, Top-Navigation- oder Gerätefreigaben. Das ist keine same-origin srcDoc-Ausnahme.
- Die globale CSP und die bestehende srcDoc-CSP bleiben unverändert. Die aktuelle App-CSP (auch lokal) erlaubt diesen externen Rahmen **nicht**: dort bleibt der srcDoc-Fallback, in dem React nicht ausgeführt wird. Die Flag allein hebt diese Grenze nicht auf; der opt-in Runtime-Pfad ist für separate Preview-Umgebungen gedacht, die den Rahmen bereits erlauben.
- Bei CSP-Block, Ladefehler, Timeout oder nicht unterstützter Entry-Struktur fällt die Vorschau auf srcDoc zurück; auch manuell über **srcDoc verwenden**. React/ESM erscheinen bei verfügbarer Flag als `partial`, nicht als vollständige Runtime.
