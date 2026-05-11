# hostinger-agent-brief

Generates compact, copy-paste-ready prompts for the four Hostinger Kodee agents
(**north / arrow / quill / scout**) from live production signals.

Read-only against existing tables — no schema changes, no new lead/audit
surface. Each prompt is clamped to **<950 characters** to fit Kodee's ~1000-char
input limit.

## Purpose

Hostinger's in-dashboard Kodee assistant has a hard input-character ceiling.
Operators copy these four pre-rendered prompts into the corresponding Kodee
agent and continue the conversation there. The prompts already contain the
relevant live context (latest-audit summary, lead/brief counts) injected from
`gdpr_audits`, `sales_leads`, `ceo_briefs`.

| Agent  | Role                              |
|--------|-----------------------------------|
| north  | Positioning, ICP, value-prop, 3 offers, 14-day revenue plan |
| arrow  | Outbound sequence for Datenschutz-Kanzleien |
| quill  | Landing-page structure (hero / problem / solution / FAQ) |
| scout  | 10 high-intent DACH SEO keywords |

`execution_order` in the response signals the suggested feeding order.

## Deploy

```bash
supabase functions deploy hostinger-agent-brief --no-verify-jwt
```

(`--no-verify-jwt` because the function takes no client-side auth — it's an
operator tool, returns only aggregate counts + last-audit summary, no PII.)

## Curl test

```bash
curl -sS -X POST \
  -H "Content-Type: application/json" \
  -d '{}' \
  https://<project-ref>.supabase.co/functions/v1/hostinger-agent-brief | jq .
```

For the active project (`ebljyceifhnlzhjfyxup`):

```bash
curl -sS -X POST \
  -H "Content-Type: application/json" \
  -d '{}' \
  https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/hostinger-agent-brief | jq .
```

Expected response shape:

```json
{
  "ok": true,
  "source": {
    "audit_count": 5,
    "latest_audit": { "domain": "...", "score": 84, "severity": "medium" },
    "lead_count": 10,
    "brief_count": 5
  },
  "prompts": {
    "north": "Du bist North. …",
    "arrow": "Du bist Arrow. …",
    "quill": "Du bist Quill. …",
    "scout": "Du bist Scout. …"
  },
  "prompt_lengths": { "north": 824, "arrow": 891, "quill": 862, "scout": 830 },
  "execution_order": ["north", "arrow", "quill", "scout"]
}
```

## Workflow

1. Call the endpoint.
2. Copy each `prompts.<agent>` value.
3. Paste into the corresponding Hostinger Kodee agent slot.
4. Iterate inside Kodee — the agent has the seed context and can answer
   followups (more outreach variants, more keywords, etc.).

## Safety notes

- Service-role read is server-side only; the response never includes lead
  emails, lead names, or audit issue details.
- Only the most-recent audit's `{domain, score, severity}` is returned as
  `source.latest_audit` — already shareable signal (those audits set
  `is_shareable = true` by default in `public.gdpr_audits`).
- If the prompt-build logic later exceeds 950 chars, the function truncates
  with a trailing `…` (see `clamp()` in `index.ts`).
