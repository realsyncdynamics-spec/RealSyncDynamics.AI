# P0 Publish Gate V2 — Review only (20 Nov 2026)

**NO-GO: not a deployable migration.** These documents are held outside `supabase/migrations/` on purpose.

## What has been verified (read-only)
- Main baseline SHA: `7185bd48b41a0762fdbeba1c8aa95f3e615d34e5`.
- The live queue `distribution_queue_entries` was empty when inspected.
- V1 claim RPC accepts automatic and already-approved work without a durable per-payload human approval receipt.
- V1 RPCs currently require `service_role`, but authenticated tenant INSERT is not draft-only.
- The in-memory `DistributionQueue` may still use `AUTO` status, and its optional persistence path swallows errors.
- The old publisher worker lacks reliable provider receipts for several adapters.

## What the review SQL proposes
- Reuse `distribution_queue_entries` (do not duplicate the outbox).
- Human owner approval + immutable, exact-payload receipt + audit event in one PostgreSQL transaction.
- Strictly scoped, leased V2 claim with stable idempotency key.
- Unknown provider outcome quarantined; no blind re-send.
- Legacy RPC EXECUTE revoked to fail closed. **This breaks V1 publishing until a tested V2 worker exists.**

## Testing
- 19/19 local static checks passed in a separate review package.
- 20 PostgreSQL acceptance cases specified, **0 executed**.
- An isolated pure-JavaScript worker decision core was tested separately with 22/22 local Node tests. It is **not yet committed into this branch**, and no real provider adapter is connected.
- No staging PostgreSQL server, Docker or production-like E2E available in this runtime.

## Required before any merge/deploy
1. Generate a real migration filename with the Supabase CLI in the actual repository; do **not** run the SQL from this docs directory.
2. Complete PostgreSQL integration, RLS, rollback and concurrency tests in a disposable staging environment.
3. Implement and test V2 Worker, provider receipts and reconciliation. Close the alternate AUTO publishing path.
4. Verify secure draft intake / auth, channel permissions and unique delivery semantics.
5. Obtain separate owner GO for merge, migration, deployment and each live channel.

**This PR must stay DRAFT.** No production changes, no DNS/Secrets or live posts.