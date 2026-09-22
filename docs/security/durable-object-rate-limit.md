# ADR — Durable Object Boundary for Tenant Rate Limiting (2026-09)

**Status:** Accepted (boundary clarification)  
**Scope:** Security boundary for optional Cloudflare Durable Object tenant coordination

## Verdict
Durable Object = tenant-bound coordination **after authorization**. A Durable Object is **never** the tenant identity source, **never** policy authority, **never** secret store, and **never** evidence vault.

## 2026-09 Cloudflare corrections (binding)
1. **Concurrency:** Durable Objects are single-threaded, but request handling is **not strictly serialized until request end**. Requests on the same ID may interleave across `await fetch()`/R2/non-storage I/O. SQLite operations are sync; storage gates protect storage access. `blockConcurrencyWhile()` is for init/migration phases, not a general request mutex.
2. **Data Studio access:** Users with Worker Editor can read/write SQLite-backed Durable Object data. Durable Objects have no separate IAM plane. Therefore secrets and policy plaintext must not be stored in a Durable Object.
3. **EU location semantics:** `locationHint = "eeur"` is best-effort only. `jurisdiction("eu")` constrains compute and persistent Durable Object data to EU, but this is still **not** RealSync `eu_private` (DE VPS/device zone). Durable Object IDs may still surface in billing/debug logs outside jurisdiction.
4. **Config model:** `new_sqlite_classes` is legacy. New classes should use declarative `[exports.ClassName]` with `type = "durable-object"` and `storage = "sqlite"`. Do not mix legacy and declarative models. Either path still requires a Worker deploy, which is forbidden while policy routes are frozen (`#1510`).

## Cost boundary
- A hot Durable Object ID can stay awake.
- An idle hibernation-capable Durable Object has no duration charges while hibernated.
- SQLite-backed Durable Object storage persists.
- WebSocket hibernation drops in-memory state and re-runs the constructor on wake.

## Allowed call chain (only)
`verifyJwt -> resolveMembership(auth.uid) -> tenantId = membership.tenantId -> optional TenantRateLimit.idFromName(tenantId)/getByName(tenantId) -> policy/execution/evidence`

**Forbidden tenant identity sources:** URL tenant, JWT custom tenant claim, `body.tenant_id`, header tenant.  
**Limit source:** entitlement/plan lookup server-side, never `request.body`.

## Pre-class auth snippet (authoritative pattern)
```ts
const auth = await verifyJwt(request, env);
if (!auth.ok) return json({ error: 'unauthorized' }, { status: 401 });

const membership = await resolveMembership(auth.uid, env);
if (!membership) return json({ error: 'forbidden' }, { status: 403 });

const tenantId = membership.tenantId;
const limit = await getTenantEntitlementLimit(tenantId, env); // server-side only

// Hypothetical binding usage only. Not wired in wrangler-workers.toml in this issue.
const limiter = env.TENANT_RATE_LIMIT.getByName(tenantId);
const decision = await limiter.consume({
  bucket: 'policy_route',
  limit,
  windowSeconds: 60,
});

if (!decision.allowed) {
  return json({ error: 'rate_limited', retryAfter: decision.retryAfterSeconds }, { status: 429 });
}
```

## TenantRateLimit example (SQLite-backed Durable Object)
```ts
export class TenantRateLimit extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS rate_buckets (
        bucket TEXT PRIMARY KEY,
        window_start_ms INTEGER NOT NULL,
        count INTEGER NOT NULL
      )
    `);
  }

  async consume(input: {
    bucket: string;
    limit: number;
    windowSeconds: number;
  }): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    const now = Date.now();
    const windowMs = input.windowSeconds * 1000;
    const row = this.ctx.storage.sql
      .exec(
        `SELECT window_start_ms, count FROM rate_buckets WHERE bucket = ?`,
        input.bucket,
      )
      .one<{ window_start_ms: number; count: number }>();

    const sameWindow = row && now - row.window_start_ms < windowMs;
    const baseStart = sameWindow ? row.window_start_ms : now;
    const baseCount = sameWindow ? row.count : 0;
    const nextCount = baseCount + 1;

    this.ctx.storage.sql.exec(
      `INSERT INTO rate_buckets (bucket, window_start_ms, count)
       VALUES (?, ?, ?)
       ON CONFLICT(bucket) DO UPDATE SET
         window_start_ms = excluded.window_start_ms,
         count = excluded.count`,
      input.bucket,
      baseStart,
      nextCount,
    );

    if (nextCount <= input.limit) return { allowed: true, retryAfterSeconds: 0 };

    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - baseStart)) / 1000));
    return { allowed: false, retryAfterSeconds };
  }
}
```

## Out of scope for #1511
- No `wrangler-workers.toml` binding change.
- No `[[exports]]` / declarative export rollout in this issue.
- No migration entry.
- No call-site in `/home/runner/work/RealSyncDynamics.AI/RealSyncDynamics.AI/src/workers/index.ts`.
- No deploy.
