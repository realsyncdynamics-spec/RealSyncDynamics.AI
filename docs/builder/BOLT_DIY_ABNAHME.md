# Abnahme — RealSyncDynamics.AI Web App Builder

**Branch:** `feat/bolt-diy-builder-integration`  
**Basis-HEAD vor dieser Lieferung:** `e3c3f06d63806569fe48db48bdf1cc8612a72ab1`  
**Snapshot:** `backup/pre-bolt-diy-2026-09-16` auf `main@7449166d`  
**Kein Merge nach main. Kein Production-Deploy. Keine angewendete Production-Migration.**

## Code fertig, Production-Lauf BLOCKED ohne Infra-Mutation

1. **Server-Persistenz** — Code: `app_builder_projects` Migration + `siteos/code-persist` + `persist-api` + Isolationstests. Freigabe fehlt: Migration anwenden + `siteos` Function deployen. Erst danach Production E2E W/X.
2. **Gateway-Streaming** — Code: `generateStream` auf OpenAI/Anthropic/LM Studio, Router, `op: stream` NDJSON, OpenAI-compat `stream: true`. Freigabe fehlt: `ai-gateway` Function deployen. Erst danach Production Y gegen die Edge.
3. **WebContainer / COOP-COEP** — bewusst deaktiviert.
4. **Policy-Worker / KV** — unverändert gesperrt.

## Kernpfad (kein Mock)

User-Prompt → Auth → Tenant → Entitlement → Context-Pack → RealSync AI Gateway (`app_builder_code`) → Token-Stream → Parser → Gate → FileStore → srcDoc-Preview → `siteos/code-persist`.
