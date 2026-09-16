# App Builder — bolt.diy Engine (Phase 2)

Additive. Überschreibt Puck, Auth, Tenant, Orchestrator **nicht**.

- Protokoll + Mechanik: `./bolt/`
- Herkunft: stackblitz-labs/bolt.diy (MIT) — siehe `bolt/VENDOR.md`
- Plan: `docs/builder/BOLT_DIY_INTEGRATION_PLAN.md`

## Verdrahtung (Phase 3, nicht in dieser Lieferung)

`App.tsx` bleibt unverändert. Nächster Schritt, nach Review:

1. `BoltWorkbench` lazy neben `AppBuilderWorkspacePage`
2. Im Workspace einen dritten Modus `code` neben `edit` | `preview`
3. AI-Stream nur über das bestehende Gateway
4. Evidence-Write über vorhandene Vault-APIs, keine neue Migration

WebContainer, COOP/COEP, wrangler, KV: gesperrt bis explizite Infra-Freigabe.
