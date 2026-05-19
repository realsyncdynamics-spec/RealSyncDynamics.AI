# AI-Gateway / Assistant Runbook

How to get the public `AssistentChip` quick-chat actually answering questions, plus what to do when it stops. Companion to [`production-runtime.md`](production-runtime.md) and [`rollback-runbook.md`](rollback-runbook.md).

This runbook assumes you have:

- Supabase dashboard access to project `ebljyceifhnlzhjfyxup`
- Vault write access (Database → Vault)
- The `gh` CLI authenticated (for log reads if needed)

---

## TL;DR — get the assistant live in 2 minutes

If the chip says **"Der Assistent ist gerade nicht erreichbar"** AND PR #344 (Anthropic cloud-fallback) is merged:

```sql
-- in Supabase SQL Editor, as service_role:
INSERT INTO vault.secrets (name, secret)
VALUES ('anthropic_api_key', 'sk-ant-api03-...');
```

Then verify:

```bash
curl -X POST https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/ai-gateway \
  -H 'Content-Type: application/json' \
  -d '{"op":"health"}'
```

Expected after the secret is set: `{ "ok": true, "primary": {...lm-studio-error...}, "fallback": { "ok": true, "models": ["claude-haiku-4-5-..."] } }`.

The chip starts working immediately — Edge Function picks up the secret on the next cold-start (typically < 1 min).

---

## Decision tree — start here

```
Assistant not answering?
        │
        ▼
What does GET /ai-gateway with op:'health' return?

   ├── ok:true                                        →  §1  False alarm (UI bug?)
   ├── ok:false + LM_STUDIO_NOT_CONFIGURED            →  §2  Set LM_STUDIO_BASE_URL
   ├── ok:false + dns error / connect refused          →  §3  LM Studio unreachable
   ├── ok:false + 401 / invalid x-api-key              →  §4  Anthropic key invalid
   ├── ok:false + RATE_LIMITED                         →  §5  Rate-limit hit
   └── HTTP 5xx / no response                          →  §6  Function down
```

---

## §1 — `ok:true` but chip still fails

Function is healthy. Cause is client-side. Check:

1. Browser DevTools → Network → look for the `/functions/v1/ai-gateway` request
2. Status code in the response?
   - 200 → look at response body, the modal renders `result.message` directly
   - 429 → rate limit — wait or raise `MINUTE_WINDOWS` cap (code change)
3. If the modal shows but is empty: check `AssistentQuickChatModal.tsx` for a recent regression

---

## §2 — `LM_STUDIO_NOT_CONFIGURED`

`LM_STUDIO_BASE_URL` env var isn't set on the function.

```bash
# Set via Supabase dashboard → Edge Functions → ai-gateway → Secrets
LM_STUDIO_BASE_URL=https://lm.realsyncdynamicsai.de
LM_STUDIO_API_KEY=<shared bearer>
```

If you don't have a public LM Studio endpoint and PR #344 is merged, you can skip LM Studio entirely — just set `anthropic_api_key` in Vault and the function will fail-over for every request. Slightly more expensive per request but works without VPS setup.

---

## §3 — DNS error / connection refused

LM Studio is unreachable from Supabase's Deno runtime. Two paths:

### §3a — Cloud-fallback IS wired (PR #344 merged + Vault has `anthropic_api_key`)

No action needed — the function silently routes through Anthropic. Confirm:

```bash
curl -X POST https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/ai-gateway \
  -H 'Content-Type: application/json' \
  -d '{
    "op":"generate",
    "feature":"governance_chat",
    "task_type":"chat",
    "model_profile":"fast-local",
    "input":"ping"
  }'
```

Expected: `{ "ok": true, "provider": "anthropic", "model": "claude-haiku-...", "output": "..." }`. Note `provider: "anthropic"` — that's the fallback engaging.

### §3b — Cloud-fallback NOT wired

Two options:

1. **Quick:** set the Anthropic key in Vault (see TL;DR). Works in < 2 min.
2. **Right:** fix the LM Studio URL. The most common cause is `LM_STUDIO_BASE_URL=http://lmstudio.internal:1234` — `.internal` only resolves inside private networks. Use one of:
   - Public HTTPS: expose LM Studio via Caddy/Traefik on the Hostinger VPS at `https://lm.realsyncdynamicsai.de` + auth-token
   - Tailscale: not directly compatible with Supabase Edge Functions (no Tailscale client in the Deno runtime)

---

## §4 — `invalid x-api-key`

Anthropic key rejected. Two causes:

1. Key was revoked → generate a new one at https://console.anthropic.com/settings/keys
2. Key is for the wrong workspace (e.g. test vs prod)

Update via:

```sql
UPDATE vault.secrets
   SET secret = 'sk-ant-api03-<new key>'
 WHERE name = 'anthropic_api_key';
```

Force a function cold-start by re-deploying the function (or just wait — Supabase recycles isolates every ~15 min).

---

## §5 — `RATE_LIMITED`

The function's per-IP rate limit (defined in `_shared/aiGateway/rateLimit.ts`) is enforcing. This is correct behaviour for an abusive client. If a legitimate visitor hit it:

- Wait the `retry_after_ms` from the response body
- If many users complain: raise `MINUTE_WINDOWS` cap in the Edge Function code (PR-only — no runtime toggle)

---

## §6 — Function down (5xx, timeout, no response)

Last-known-good ai-gateway should still be deployed. Cold-start may be > 5 s on the first request after a long quiet period — that's normal.

If sustained 5xx:

```bash
# Tail recent Edge Function logs:
gh api -X GET \
  "/repos/realsyncdynamics-spec/RealSyncDynamics.AI/contents/supabase/functions/ai-gateway" \
  -q '.sha'
# (then inspect the latest deploy via Supabase dashboard logs)
```

Rollback path: re-deploy the previous known-good `ai-gateway/index.ts` via `supabase functions deploy ai-gateway` from a clean checkout of an earlier main commit.

---

## Verifying the fallback chain is wired (post-#344)

After PR #344 merges + Vault key is set, this single curl tells you the full picture:

```bash
curl -X POST https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/ai-gateway \
  -H 'Content-Type: application/json' \
  -d '{"op":"health"}' | jq
```

Healthy fallback-active response:

```json
{
  "ok":       true,
  "primary":  { "ok": false, "error": "dns error: ..." },
  "fallback": { "ok": true,  "models": ["claude-haiku-4-5-20251001"] }
}
```

Reading: `primary` (LM Studio) is down. `fallback` (Anthropic) is up. `ok:true` overall because the gateway has at least one working provider.

---

## How the assistant flow works (mental model)

```
Visitor clicks chip
   │
   ▼
AssistentChip → AssistentQuickChatModal
   │
   ▼
sendQuickChat({message, history})           ← src/features/assistant/
   │     - client-side rate limit (5/min)
   │     - PII pattern block
   │     - turn-cap (max 10)
   ▼
AiGatewayEdgeClient.generate(...)            ← src/core/ai-gateway/
   │
   ▼
POST /functions/v1/ai-gateway op:'generate'  ← Supabase Edge Function
   │
   ▼
ServerAiGateway.generate(req)                ← _shared/aiGateway/router.ts
   │
   ├── LM Studio (primary)
   │     ├── ok       → return text
   │     └── failure  → isTransportLevelFailure(err)?
   │                       ├── yes → ▼
   │                       └── no  → throw (4xx, validation, etc.)
   │
   └── Anthropic Messages API (fallback)      ← only if anthropic_api_key in Vault
         ├── ok       → return text with provider='anthropic'
         └── failure  → throw to caller
```

If either step throws → frontend renders:

> "Der Assistent ist gerade nicht erreichbar. Direkt-Kanal: support@realsyncdynamicsai.de — oder Audit jetzt starten unter /audit."

(That fallback copy is from PR #328.)

---

## Cost model

- **LM Studio**: $0 per request (self-hosted on Hostinger VPS, EU-lokal)
- **Anthropic fallback** (claude-haiku-4-5): ≈ $0.80/MTok input · $4/MTok output. A typical chip-question is ~200 input + 300 output tokens = **~$0.0014 per question**. 10,000 fallback-requests/month ≈ €13/mo.

The fallback only fires when primary fails, so the steady-state cost is dominated by LM Studio (free). Anthropic is the safety net, not the daily driver.

---

## Related docs

- `docs/runtime/production-runtime.md` — full topology
- `docs/runtime/deployment-topology.md` — DNS + cert chain
- `docs/runtime/rollback-runbook.md` — when things break harder
- `src/core/ai-gateway/router.ts` — the actual fallback logic
- `supabase/functions/ai-gateway/index.ts` — Vault-read + dispatch
