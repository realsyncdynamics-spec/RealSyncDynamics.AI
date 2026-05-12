# Governance Agent Activation Runbook

> Pairs with PR #154 (Edge Function), PR #156 (Widget), PR #157 P0 runbook.

## Goal

The conversational compliance agent at `/governance` (chat widget mounted in `GovernanceDashboardView`) returns real answers via tool-use loop instead of `LLM_NOT_CONFIGURED` or `US_ROUTING_NOT_ACKNOWLEDGED`.

## Pre-flight checklist

| Item | Status check |
|---|---|
| `governance-agent` Edge Function deployed | `mcp__supabase__list_edge_functions` includes `governance-agent` v≥1, ACTIVE |
| `agent_sessions` + `agent_runs` tables exist | `SELECT to_regclass('public.agent_sessions'), to_regclass('public.agent_runs')` returns two non-null OIDs |
| RLS on agent tables | both `pg_class.relrowsecurity = true` |
| `governance-agent` widget mounted on `/governance` | `<AgentWidget />` import in `GovernanceDashboardView.tsx` |
| `anthropic_api_key` in Vault | `SELECT name FROM vault.secrets WHERE name = 'anthropic_api_key'` returns one row |

If the last item is empty, the function returns `503 LLM_NOT_CONFIGURED` — the widget surfaces a banner; users see a clean message, not a crash.

## Provisioning the LLM key

### Option A — Anthropic direct (US routing)

```bash
curl -X POST 'https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/vault-set-secret' \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"name":"anthropic_api_key","secret":"sk-ant-..."}'
```

The function ALSO returns `412 US_ROUTING_NOT_ACKNOWLEDGED` until either:
- env `AGENT_ALLOW_US_ROUTING=true` is set on the Edge Function, OR
- each request carries `acknowledge_us_routing: true` (widget does this automatically after the user clicks the in-panel banner)

### Option B — Mistral La Plateforme (EU-resident, recommended)

Not yet wired in the function. Tracked in Blueprint §10.7. When wired:

```bash
curl -X POST 'https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/vault-set-secret' \
  -d '{"name":"mistral_api_key","secret":"..."}'
```

And set Edge env: `AGENT_LLM_PROVIDER=mistral`, `AGENT_LLM_MODEL=mistral-large-latest`.

### Option C — Anthropic via AWS Bedrock EU

Also not yet wired. Requires AWS IAM role + Bedrock-EU enablement.

## Smoke test

1. Login as a user who is a member of a real tenant
2. Open `/governance` — Dashboard renders
3. Click the floating amber button bottom-right
4. Panel opens with welcome message
5. Click quick-action **Risiko-Übersicht**
6. Expect tool-call sequence in the response badges:
   ```
   list_assets → get_risk_summary
   ```
7. Final message names the count + top-3 by score

If the panel shows the US-routing banner: click "Verstanden, fortfahren" — that persists `acknowledge_us_routing: true` for the session.

If the panel shows "Der Agent ist noch nicht aktiv": go back to provisioning above.

## Verification SQL

```sql
-- Recent runs
SELECT id, llm_model, outcome, iterations, input_tokens, output_tokens, cost_usd, duration_ms, created_at
FROM public.agent_runs
ORDER BY created_at DESC
LIMIT 10;

-- Session count per tenant
SELECT tenant_id, COUNT(*) AS sessions, MAX(last_turn_at) AS most_recent
FROM public.agent_sessions
GROUP BY tenant_id;

-- Audit trail
SELECT actor_email, action, target_id, payload, created_at
FROM public.governance_admin_log
WHERE action = 'agent.chat'
ORDER BY created_at DESC LIMIT 20;
```

## Tuning the agent

Environment overrides on the Edge Function (set via Supabase dashboard → Edge Functions → governance-agent → Secrets):

| Var | Default | Effect |
|---|---|---|
| `AGENT_LLM_PROVIDER` | `anthropic` | `anthropic` / `mistral` / `openai` |
| `AGENT_LLM_MODEL` | `claude-sonnet-4-6` | any provider-valid model id |
| `AGENT_ALLOW_US_ROUTING` | unset | `true` skips the 412 gate |

Constants (require redeploy): `MAX_ITERATIONS = 8`, `MAX_HISTORY_TURNS = 20`, `MAX_TOKENS_PER_TURN = 4096`.

## Cost ceiling

`agent_runs.cost_usd` is a best-effort estimate per turn. To enforce a per-tenant daily budget, add a `BEFORE INSERT` trigger on `agent_runs` that aggregates the rolling 24h sum and refuses the insert (deferred to a follow-up PR — currently no live tenant has burned through anything material).

Typical costs for the default `claude-sonnet-4-6`:

| Use | Approx |
|---|---|
| 1 simple chat (1 tool call, ~2k tokens) | $0.005 |
| 1 complex chat (4 tool calls, ~10k tokens) | $0.025 |
| 100 chats/day | $0.50–$2.50 |
| 1000 chats/day | $5–$25 |

## Failure surface in the widget

| HTTP from function | Widget shows |
|---|---|
| 200 + `ok:true` | normal response with tool badges |
| 200 + `ok:false` + `outcome='llm_error'` | inline error message |
| 412 | EU-routing banner with confirm button |
| 503 | "Agent noch nicht aktiv" with hint to provision key |
| 403 | "Kein Zugriff auf diesen Tenant" (membership check failed) |
| any other 5xx | "Verbindungsfehler: <message>" |

## What NOT to do

- Don't paste the API key in chat, commits, or screenshots
- Don't set `AGENT_ALLOW_US_ROUTING=true` if a customer needs strict EU residency — keep the per-call ack model so the choice is logged in `agent_runs`
- Don't disable the membership check in `handleChat` — even read tools touch tenant-scoped data
