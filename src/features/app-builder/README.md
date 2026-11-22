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

## Spike Laufzeit-Vorschau (22.11.2026, Draft, Flag aus)

`/builder/:slug/code` → Reiter „Laufzeit“ nur mit `VITE_APP_BUILDER_SANDBOX_PREVIEW=true`;
Server `siteos/code-preview` nur mit `APP_BUILDER_SANDBOX_PREVIEW=true` und angebundenem Anbieter.
Kern: `supabase/functions/_shared/preview-sandbox/`. Nur gegen Fake getestet, kein Anbieter, kein Deploy.
Bericht: `docs/builder/SPIKE_SANDBOX_PREVIEW_2026-11-22.md`.
