# AI Invoke

Calls a registered AI tool with prompt-cached system prompts, hard-quota
gating against `limit.ai_*_monthly`, and per-call audit + cost logging.

## Setup

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set GEMINI_API_KEY=AIza...        # optional, for google tools
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
- **501 PROVIDER_NOT_IMPLEMENTED** — e.g. `openai` in v1.
- **502 PROVIDER_ERROR** — model API failed.
- **503 PROVIDER_NOT_CONFIGURED** — env key missing.

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

## Prompt caching

Anthropic system prompts are sent with `cache_control: ephemeral`. Repeated
invocations with the same `system_prompt` (i.e. the same `ai_tools.key`)
get the prompt-cache discount: ~10× cheaper input tokens for cached
content, see Anthropic docs.

The `tokens.cached` field exposes the cached portion so you can verify in
the audit log that caching is actually hitting.

## Tool registry

Add or change tools by `INSERT … ON CONFLICT (key) DO UPDATE SET …` on
`public.ai_tools`. Required columns: `key`, `name`, `model_provider`,
`model_id`, `cost_input_per_million_usd`, `cost_output_per_million_usd`.
A new tool key automatically requires the matching `ai.tool.<key>`
entitlement to exist; bind it to plans via `product_entitlements`.
