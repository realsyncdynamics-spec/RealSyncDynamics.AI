# Creative Studio — Live Storage & Usage Read-only Audit

Date: 2026-11-16. Scope: Supabase project `RealSyncDynamicsLive`. No schema, bucket or policy changes.

## Verified bucket metadata

| Bucket | Public | Max file size | Allowed MIME types | Objects at audit |
| --- | --- | --- | --- | --- |
| `bilder` | no | not configured | not configured | 0 |
| `creatorseal-content` | no | 52,428,800 bytes | JPEG, PNG, WebP, GIF, MP4, WebM | 0 |

## Verified storage.objects policies

- `creatorseal-content`: SELECT, INSERT and DELETE are constrained to first path segment = `auth.uid()` (user-scoped). No UPDATE policy seen.
- `bilder`: no matching `storage.objects` policy found in the inspected `pg_policies` listing. This does **not** authorize public access; it means ordinary authenticated direct reads/writes are not currently established.
- `audit-evidence`: existing tenant-scoped SELECT policy uses `memberships` and the first path segment as tenant ID. Do not copy policy without verifying membership model and operation needs.

## Implementation gate

**Do not use `bilder` or `creatorseal-content` for tenant-shared Creative media without an explicit storage-policy design and approval.** Propose a tenant-scoped private media bucket or a clearly isolated prefix and policy set. Never return a public object URL; use short-lived signed URLs after tenant authorization.

## Usage schema observations

- `usage_events`: `tenant_id`, `entitlement_key`, `delta`, `metadata`, `created_at`.
- `usage_counters`: fixed monthly counters, no dedicated Creative units.
- `bot_usage_reservations`: tenant-scoped, but also `bot_id` and `resource`; unsuitable to reuse blindly for images.
- `bot_usage_ledger`: tenant/resource/event-key ledger, semantics require audit before extension.

## Remaining gates

1. Validate current pricing/entitlement key and concurrency-safe reservation function.
2. Confirm xAI image request and response schema against current official docs.
3. Implement authorized job creation with idempotency and atomic reservation before any provider call.
4. Apply approved RLS and Storage policy in a **separately approved** migration.
5. Only then connect provider adapter to a callable Edge Function.

Security advisor emitted `rls_enabled_no_policy` informational findings across unrelated tables; investigate separately rather than treating them as permission to weaken RLS. See https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy.
