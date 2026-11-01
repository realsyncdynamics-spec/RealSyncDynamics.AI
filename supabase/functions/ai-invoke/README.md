# AI Invoke

Calls a registered AI tool with optionally cached system prompts, hard-quota
gating against `limit.ai_*_monthly`, and per-call audit + cost logging.

## Setup

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set GEMINI_API_KEY=AIza...        # optional, for google tools
supabase secrets set GEMINI_PAID_TIER_CONFIRMED=true  # Pflicht, sobald Gemini genutzt wird
#   ^ Bestaetigt aktives Billing im Google-Cloud-Projekt. Ohne dieses Flag
#     lehnt providers.ts jeden Gemini-Aufruf mit PROVIDER_UNPAID_TIER_BLOCKED ab:
#     Die unbezahlte Gemini-API-Quota erlaubt Google laut den Gemini-API-Terms,
#     Prompts und Antworten zum Modelltraining zu nutzen und von Menschen
#     pruefen zu lassen ("Do not submit sensitive, confidential, or personal
#     information to the Unpaid Services"). Das widerspricht der Garantie in
#     § 6a Abs. 2 des AVV. Erst Billing aktivieren, dann das Flag setzen.
supabase secrets set OPENAI_API_KEY=sk-...         # optional, for openai tools
supabase functions deploy ai-invoke
```

`SUPABASE_*` is auto-injected.

## Request

```http
POST /functions/v1/ai-invoke
Authorization: Bearer <user JWT>
Content-Type: application/json

{
  "tenant_id": "<uuid>",
  "tool_key":  "code_explain",
  "input":     "function add(a, b) { return a + b; }",
  "metadata":  { "source": "vscode-extension" }
}
```

## Responses

- **200** success
  ```json
  {
    "ok": true,
    "run_id": "...",
    "output": "Diese Funktion …",
    "tokens": { "input": 142, "output": 88, "cached": 130 },
    "cost_usd": 0.001746,
    "duration_ms": 612,
    "warning": false
  }
  ```
- **402 QUOTA_EXCEEDED** — call or token quota would be exceeded.
- **403 FORBIDDEN** — not a tenant member, or `ai.tool.<key>` not entitled.
- **404 NOT_FOUND** — unknown or disabled tool.
- **501 PROVIDER_NOT_IMPLEMENTED** — reserved for future providers.
- **502 PROVIDER_ERROR** — model API failed.
- **503 PROVIDER_NOT_CONFIGURED** — env key missing for the tool's provider
  (`ANTHROPIC_API_KEY` / `GEMINI_API_KEY` / `OPENAI_API_KEY`).
- **503 MODEL_PRICE_MISSING** — no purchase price in `shared/model-prices.ts`
  for the tool's provider/model; nothing was reserved or called. The response
  names neither; provider and model are in the log (`scope:
  model_price_missing`) and in an `ai_tool_runs` error row.

## Pipeline

```
JWT
 └→ membership check (RLS)
     └→ load ai_tools.<key>
         └→ gateFeature(ai.tool.<key>)
             └→ pre-check call & token quotas (limit.ai_*_monthly)
                 └→ providers.callProvider(...)
                     ├── ai_tool_runs INSERT (success or error)
                     └── recordUsage  ai_calls / ai_tokens / ai_cost_cents
```

`recordUsage` is non-throwing on purpose: the provider call already cost
money; we'd rather over-record than silently lose accounting. Quota state is
re-evaluated on the next request.

## Prompt caching (guarded rollout)

**Default OFF:** The server-side flag `ANTHROPIC_PROMPT_CACHE_ENABLED`
(corresponds to `anthropic_prompt_cache_enabled`) must be explicitly
set to `true` or `1` in the Supabase Edge Function environment.
Unset, `false`, or malformed values leave Anthropic requests without
`cache_control`. This is intentionally a change from the previously
unconditional cache markings; measure the cost impact before deploying.

The flag controls the stable system prompt in `_shared/providers.ts`,
the Anthropic AI-Gateway adapter (through `serverFromEnv.ts`),
and the Governance Agent's stable system prompt/tool catalogue.
Dynamic user messages and tenant data must **not** be included in a
shared cache prefix. There is no cache prewarming, and no 1-hour TTL:
the gated path uses only Anthropic's standard 5-minute ephemeral TTL.

Caching requires a sufficiently long identical prefix for the model
(e.g. at least 512 tokens for supported 5.5 models). A `cache_control`
marker on a short prompt does not guarantee a write or a hit. A live
API test is necessary to confirm effectiveness.

Usage monitoring: `ai_tool_runs.cached_tokens` records read tokens;
`ai_tool_runs.metadata.cache_metrics` separates
`cache_read_input_tokens`, `cache_creation_input_tokens` and
`cache_hit`. The existing cost calculation
(`providerCostUsd` / `result.pricedUsage`) accounts for input, output,
cache writes and reads when settling the cost cap / ledger. Gateway
responses also expose both cache counters in `usage`, including SSE
streams, but the gateway's usage quota is **not** a standalone billing ledger.

Rollout: check CI and model price coverage; explicitly enable only in
a controlled nonproduction Edge environment; compare cost and
`cache_hit` across repeated identical prompts, then obtain separate
approval for a production deployment. Roll back by unsetting the flag
and redeploying the affected Edge Functions. Do not put this flag in
a `VITE_*` browser variable.


### Synthetic Anthropic API cache-hit probe (isolated from RSD)

`node scripts/probe-anthropic-cache.mjs --dry-run` performs a local,
network-free payload check. To execute the **two billed** API calls,
provide an Anthropic test-workspace key through the local process
environment (do not commit, paste or log it), set
`RSD_CACHE_PROBE_CONFIRM=YES`, then run
`node scripts/probe-anthropic-cache.mjs`. Optional:
`ANTHROPIC_PROBE_MODEL=claude-sonnet-5-5` (default; check model access in the test workspace).

The script sends only synthetic non-tenant content. It uses an identical
`cache_control: ephemeral` system prefix on two **sequential** requests,
with distinct user messages. Accept only when first
`cache_creation_input_tokens > 0` and second
`cache_read_input_tokens > 0`. The randomly seeded prefix guarantees
that this probe measures a new write instead of reusing an unrelated
earlier cache entry. The script never prints the key or prompt text.

**Scope:** This checks the Anthropic API cache mechanism, not RealSync's
deployed Edge Functions, tenant quotas, or cost ledger. Full end-to-end
approval still requires a separate staging Edge deployment with
`ANTHROPIC_PROMPT_CACHE_ENABLED=true` and real metering checks.
Supabase preview branches can incur compute charges; do not provision
one automatically for this probe.

## Tool registry

Add or change tools by `INSERT … ON CONFLICT (key) DO UPDATE SET …` on
`public.ai_tools`. Required columns: `key`, `name`, `model_provider`,
`model_id`. The purchase price comes only from `shared/model-prices.ts`
(`npm run sync:model-prices` after a change); a cloud tool whose
`(model_provider, model_id)` has no price there fails with
`503 MODEL_PRICE_MISSING` before any budget is reserved or provider called.
`cost_input_per_million_usd` / `cost_output_per_million_usd` are deprecated
and no longer read.
A new tool key automatically requires the matching `ai.tool.<key>`
entitlement to exist; bind it to plans via `product_entitlements`.
