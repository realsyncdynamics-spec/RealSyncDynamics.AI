# Cloudflare MCP + Wrangler Runbook

## Architecture

- Pages: `realsyncdynamicsai.de`
- Worker API: `api.realsyncdynamicsai.de`
- Worker: `realsyncdynamics-workers`
- KV: `POLICY_CACHE`, `SESSION_CACHE`
- R2: `realsyncdynamics-evidence-vault-prod`
- Primary relational store: Supabase Postgres

## Cloudflare API MCP

Official MCP endpoint:

`https://mcp.cloudflare.com/mcp`

The Cloudflare API MCP uses OAuth for interactive clients. Grant only the account and zone permissions required for inspection and deployment.

Example MCP client configuration:

```json
{
  "mcpServers": {
    "cloudflare-api": {
      "url": "https://mcp.cloudflare.com/mcp"
    }
  }
}
```

## First inspection

Before any production write, inspect:

1. Cloudflare account(s)
2. Zone `realsyncdynamicsai.de`
3. Pages project `realsyncdynamics-ai`
4. Worker `realsyncdynamics-workers`
5. Existing KV namespaces matching the policy/session cache purpose
6. Existing R2 bucket `realsyncdynamics-evidence-vault-prod`
7. DNS/custom-domain state for `api.realsyncdynamicsai.de`
8. Existing Worker versions/deployments
9. Required Worker secrets

Do not reuse the historical IDs from `wrangler-workers.toml`; they are not verified account resource IDs.

## Wrangler

Check the installed version:

```bash
npx wrangler --version
```

Validate the Worker configuration:

```bash
npx wrangler check --config wrangler-workers.jsonc
npx wrangler types --config wrangler-workers.jsonc
```

Create a deployment artifact without making it live:

```bash
npx wrangler deploy --config wrangler-workers.jsonc --dry-run
```

After Cloudflare resources and secrets are verified:

```bash
npx wrangler versions upload --config wrangler-workers.jsonc --message "RealSyncDynamics Governance Runtime"
```

Then use a gradual deployment rather than immediately sending 100% of traffic to a new Worker version:

```bash
npx wrangler versions list --name realsyncdynamics-workers
npx wrangler versions deploy --name realsyncdynamics-workers
```

Promote only after health, authentication, policy-cache, and evidence-vault smoke tests pass.

## Secrets

Required secrets are declared in `wrangler-workers.jsonc`:

- `SUPABASE_JWT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Set them with Wrangler only after verifying the target Worker/environment:

```bash
npx wrangler versions secret put SUPABASE_JWT_SECRET --config wrangler-workers.jsonc
npx wrangler versions secret put SUPABASE_URL --config wrangler-workers.jsonc
npx wrangler versions secret put SUPABASE_SERVICE_ROLE_KEY --config wrangler-workers.jsonc
```

Never commit secret values to Git.

## Rollback

If the new version fails validation, roll back to the last known-good deployment:

```bash
npx wrangler rollback --name realsyncdynamics-workers
```

## Safety rule

The existing `wrangler-workers.toml` is retained as historical configuration but must not be used for deployment until its resource IDs and routing have been reconciled with the real Cloudflare account.
