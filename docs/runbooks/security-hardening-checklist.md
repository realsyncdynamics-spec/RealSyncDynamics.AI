# Security Hardening Checklist

> Living document. Update with every advisor sweep + every released PR that touches authorisation, RLS, or external interfaces.

Last full sweep: **2026-05-12** (after PR #155 SECURITY INVOKER fix).

## Database

| Item | Status | Notes |
|---|---|---|
| `token_usage_monthly` view runs as `SECURITY INVOKER` | ✅ | Fixed in PR #155, applied live |
| `set_updated_at()` trigger has pinned `search_path` | ✅ | PR #155 |
| `incidents_set_deadline()` trigger has pinned `search_path` | ✅ | PR #155 |
| Every governance table has RLS enabled | ✅ | Verified per PR #152 |
| Every tenant-scoped table has `tenant_id IN (memberships.tenant_id)` policy for authenticated | ✅ | Verified |
| Service role write policies on all governance tables | ✅ | Required for Edge Functions |
| 7 anon-callable SECURITY DEFINER functions reviewed | ⚠️ | Most intentional (audit-share, affiliate signup); per-function audit in follow-up PR |
| 11 authenticated-callable SECURITY DEFINER functions reviewed | ⚠️ | Most check role internally; per-function audit in follow-up PR |
| `pg_trgm`, `vector`, `pg_net` in `extensions` schema | ❌ | Currently in `public`. Move requires coordinated migration of dependent objects |
| `website-rebuilds` storage bucket — narrow SELECT policy | ❌ | Currently allows listing; may be intentional for the website-rebuild product. Confirm + tighten if not |

## Authentication

| Item | Status |
|---|---|
| Supabase Auth Leaked-Password-Protection enabled | ❌ Disable via dashboard (one-click) |
| MFA enforced for owner role | ❌ Not yet — staged for Phase 2 of roadmap |
| Service-role JWT only used server-side | ✅ |
| Anon key only used client-side | ✅ |
| OAuth providers (Google, LinkedIn, GitHub, Microsoft) all on prod redirect URLs | ✅ Verified PR #147 / #148 |

## Edge Functions

| Item | Status |
|---|---|
| All mutating functions verify membership before write | ✅ Pattern in `governance-resources`, `-dpias`, `-incidents`, `-vendors`, `-connectors`, `-agent` |
| Cross-tenant guards on any asset_id input | ✅ PR #152 Codex P2 fixed in `governance-dpias` |
| HMAC signatures on outbound webhooks | ✅ `governance-webhooks` Edge Function |
| Replay protection (timestamp window) | ✅ 5-min window |
| At-least-once delivery + idempotent consumers | ✅ Via `event_id` dedupe |
| CORS allowlist (not `*` in production) | ⚠️ Currently `*` on most functions — tighten to `https://realsyncdynamicsai.de` in follow-up |

## Browser extension

| Item | Status |
|---|---|
| MAIN-world hooks for `fetch`, `XHR`, `document.cookie` | ✅ PR #152 Codex P2 |
| ISOLATED-world content script as bridge | ✅ |
| Origin check on `window.postMessage` bridge | ✅ |
| `host_permissions: ["<all_urls>"]` is intentional (scanner needs broad scope) | ✅ Documented |

## Evidence + audit

| Item | Status |
|---|---|
| Hash-chain insert pattern documented in Blueprint §8 | ✅ |
| Live evidence_records hash chain | ❌ Schema designed (PR #153 §8) but not yet built in migration |
| Audit log append-only via insert-only policy | ✅ |
| Audit log includes `actor_user_id`, `action`, `target_*`, `payload` | ✅ |
| Audit log entries for every Edge Function admin op | ✅ Confirmed PR #152 |

## Webhooks (outbound)

| Item | Status |
|---|---|
| HMAC-SHA256 signature header | ✅ `X-RSD-Signature` |
| `X-RSD-Timestamp` for replay protection | ✅ |
| Exponential backoff + DLQ | ✅ |
| Per-tenant webhook secret stored in `vault.secrets` | ⚠️ Implemented for Stripe; governance webhooks use per-row secret |

## API keys (ingest)

| Item | Status |
|---|---|
| Keys hashed at rest | ✅ `governance_ingest_keys.key_hash` |
| `last_used_at` recorded | ✅ |
| Scopes enforced | ✅ `scopes` column |
| Revocation immediate | ✅ |
| Rotation path documented | ⚠️ Per-tenant UI exists; runbook for emergency rotation TBD |

## Agents

| Item | Status |
|---|---|
| Every agent run logged to `agent_runs` with trace | ✅ PR #154 |
| Agent permissions scoped to tenant | ✅ Enforced in Edge Function membership check |
| Mutating tools require approval gates | ⚠️ Design in Blueprint §6.2.4; not implemented (v0 of agent has only read + escalate tools) |
| Cross-tenant action forbidden | ✅ |
| Replay / forensics from `agent_runs.tool_calls` | ✅ Trace persisted |

## Quarterly review

Schedule the next full sweep for **2026-08-12**. Reviewer: platform lead. Outcome: this checklist updated, advisor re-run, any new findings either fixed or filed.
