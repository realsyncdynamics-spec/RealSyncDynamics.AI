# App Builder — bolt.diy Engine

Additive. Überschreibt Puck, Auth, Tenant, Orchestrator **nicht**.

- Protokoll + Mechanik: `./bolt/`
- Herkunft: stackblitz-labs/bolt.diy (MIT) — siehe `bolt/VENDOR.md`
- Plan: `docs/builder/BOLT_DIY_INTEGRATION_PLAN.md`

## Verdrahtung

| Pfad | Oberfläche |
|---|---|
| `/builder/:slug` | SiteOS / Puck (unverändert) |
| `/builder/:slug/code` | RealSyncDynamics.AI Web App Builder |

Ablauf:

1. Session (Supabase Auth) und Mandant (`TenantProvider`) — `tenant_id` nie aus der URL.
2. Entitlement `siteos.builder` über `useEntitlements` / `canOpenAppBuilder`.
3. Prompt → RealSync AI Gateway (`processAIGatewayRequest`, keine Browser-Keys).
4. bolt.diy Parser → Governance-Gate → FileStore → sandboxed srcDoc-Preview.
5. Persistenz: tenant-namespacedter Browser-Store. Server-Persistenz in `siteos_blueprints` ist **nicht** verdrahtet — die Tabelle trägt Puck-Blueprints, keine Dateibäume. Edge Function `siteos/code-persist` fehlt (externer Blocker, kein Mock).

WebContainer, COOP/COEP, wrangler, KV: gesperrt bis explizite Infra-Freigabe.
