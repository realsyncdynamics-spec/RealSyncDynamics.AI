# LM Studio + AI Gateway runbook

This runbook walks through bringing the **AI Gateway** with the **LM Studio
inference runtime** online. The AI Gateway is a provider-neutral seam
between product code and inference. LM Studio is the first adapter —
the same gateway will route to OpenAI / Anthropic / EU providers via
the `cloud-fallback` profile in a follow-up PR.

> **Important.** Product code MUST NOT call LM Studio directly. The
> browser MUST NOT call LM Studio directly. The only public surface is
> `POST /functions/v1/ai-gateway`.

---

## 1. Start LM Studio locally

1. Install LM Studio (`https://lmstudio.ai`) or run the headless
   `lms` CLI on the inference host.
2. Load a model (e.g. `qwen2.5-7b-instruct-q4_k_m`). For embeddings,
   load `nomic-embed-text-v1.5` alongside.
3. Start the **Local Server** on `localhost:1234` (or `0.0.0.0:1234`
   on an internal host so the Edge Function can reach it).
4. Verify:
   ```bash
   curl http://localhost:1234/v1/models
   ```
   You should see a JSON list with `data: [{ id: "<model-id>" }]`.

## 2. Set Supabase secrets

```bash
supabase secrets set \
  LM_STUDIO_BASE_URL=http://lmstudio.internal:1234/v1 \
  LM_STUDIO_API_KEY=lm-studio \
  AI_GATEWAY_DEFAULT_PROFILE=fast-local \
  AI_GATEWAY_CLOUD_FALLBACK_ENABLED=false
```

| Var | Purpose |
|---|---|
| `LM_STUDIO_BASE_URL` | Reachable LM Studio HTTP endpoint. **Never use `localhost` from Edge Functions** — they run in a remote Deno worker and cannot reach the developer's machine. Put LM Studio on an internal host reachable from Supabase. |
| `LM_STUDIO_API_KEY` | Bearer token the Edge Function sends. LM Studio accepts any non-empty value by default. |
| `AI_GATEWAY_DEFAULT_PROFILE` | Default model profile when callers omit it. |
| `AI_GATEWAY_CLOUD_FALLBACK_ENABLED` | Stub — the cloud-fallback adapter lands in a follow-up PR. |

## 3. Deploy the Edge Function

```bash
supabase functions deploy ai-gateway --no-verify-jwt
```

`verify_jwt = false` is pinned in `supabase/config.toml` (`[functions.ai-gateway]`),
so the deploy uses that flag automatically once the per-function deploy
loop in `.github/workflows/deploy.yml` picks it up.

## 4. Health-check

```bash
curl -X POST "$SUPABASE_URL/functions/v1/ai-gateway" \
  -H 'content-type: application/json' \
  -d '{"op":"health"}'
```

Expected:
```json
{ "ok": true, "models": ["qwen2.5-7b-instruct-q4_k_m"] }
```

If `ok: false`:
- `error: HTTP 404` → LM Studio is up but `/models` endpoint missing → wrong baseUrl.
- `error: timeout` / fetch fail → LM Studio host unreachable from Supabase.
- `error: LM_STUDIO_NOT_CONFIGURED` → secret not set.

## 5. Generate

```bash
curl -X POST "$SUPABASE_URL/functions/v1/ai-gateway" \
  -H 'content-type: application/json' \
  -d '{
    "op": "generate",
    "feature": "governance_chat",
    "task_type": "chat",
    "model_profile": "fast-local",
    "input": "Erkläre Runtime Governance in einem Satz."
  }'
```

Response shape:
```json
{
  "ok": true,
  "provider": "lm_studio",
  "model": "<resolved model id>",
  "profile": "fast-local",
  "output": "...",
  "usage": { "input_tokens": 23, "output_tokens": 41, "total_tokens": 64 },
  "trace_id": "<uuid>",
  "latency_ms": 612
}
```

## 6. Extract JSON

```bash
curl -X POST "$SUPABASE_URL/functions/v1/ai-gateway" \
  -H 'content-type: application/json' \
  -d '{
    "op": "extract_json",
    "feature": "ai_act_classify",
    "task_type": "extract_json",
    "model_profile": "strict-json",
    "system_prompt": "Classify the use case. Return JSON with field risk_class.",
    "input": "Lead scoring with semi-supervised gradient boosting"
  }'
```

`output` arrives parsed (`{ risk_class: "limited" }`). If LM Studio
returns non-JSON, the function returns `500 INFERENCE_ERROR` with
message `LM Studio returned invalid JSON`.

## 7. Cloud-fallback behaviour

Not yet wired. The `fallbackProfile` field in `aiGatewayConfig` is
defined for future use. Errors from the primary adapter propagate as
`500 INFERENCE_ERROR` for now.

## 8. Failure modes (decision matrix)

| Symptom | Likely cause | Fix |
|---|---|---|
| `LM_STUDIO_NOT_CONFIGURED` | Secret missing | `supabase secrets set LM_STUDIO_BASE_URL=…` |
| Health returns `ok: false, error: …` | LM Studio unreachable from Supabase Edge | Move LM Studio behind a public-tunnel (Tailscale, Cloudflare Tunnel) or a managed VM with a stable IP |
| `No LM Studio model available` | LM Studio is up but no model loaded | Load a model in LM Studio UI / `lms` |
| `LM Studio returned invalid JSON` | Model freelanced markdown | Tighten the system prompt or switch to a smaller, more obedient JSON-fine-tuned model |
| 404 from `/functions/v1/ai-gateway` | Function not deployed | `supabase functions deploy ai-gateway --no-verify-jwt` |

## 9. Architectural contract

- Product code → Edge Function → `ServerAiGateway` → `LMStudioAdapter` → LM Studio.
- The browser path is identical: it talks to the **Edge Function only**.
- The `src/core/ai-gateway/` tree mirrors the server contract for type
  safety in product code; the `LMStudioAdapter` there is **not** invoked
  in production (the browser guard warns at module load if it ends up
  in a `window` context).
- Every prompt comes from the **prompt registry** (`promptRegistry.ts`),
  versioned by date so audit logs can replay model outputs.

## 10. Where to add a second provider

1. New adapter at `supabase/functions/_shared/aiGateway/<provider>Adapter.ts`
   implementing `AiProviderAdapter`.
2. Mirror in `src/core/ai-gateway/providers/<provider>Adapter.ts`
   (type-safety only; not invoked at runtime).
3. Wire `PROVIDER_BY_PROFILE` in `ServerAiGateway` to route the relevant
   profile to the new adapter.
4. Add the secret to `supabase secrets`.
5. Update this runbook.
