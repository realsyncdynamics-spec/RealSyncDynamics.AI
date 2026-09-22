# ADR — Durable Object Boundary for Tenant Rate Limiting (2026-09)

**Status:** Accepted — security boundary clarification  
**Scope:** Optional Cloudflare Durable Object coordination after tenant authorization

## Decision
**Durable Object = tenant-bound coordination after authorization. Never tenant identity source, never policy authority, never secret store, never evidence vault.**

A Durable Object is a coordination primitive. It does not create another RealSync security boundary and does not replace Postgres/RLS, R2 + hash evidence, Vault/function secrets, or authoritative membership lookup.

## Cloudflare corrections — 2026-09
1. **Concurrency:** one Durable Object ID is single-threaded, but requests are not serialized until request end. Requests on the same ID may interleave across `await fetch()`, R2, or other non-storage I/O. SQLite operations are synchronous; storage gates protect storage access. `blockConcurrencyWhile()` is for initialization/migration, not a general request mutex.
2. **Data Studio / IAM:** users with Worker Editor access can read/write SQLite-backed Durable Object data. Durable Objects have no separate IAM plane. Secrets and policy plaintext must never live in a Durable Object.
3. **Location:** `locationHint: "eeur"` is best-effort only. `jurisdiction("eu")` constrains compute and persistent Durable Object data to the EU, but is still not RealSync `eu_private` (DE VPS/device zone). Durable Object IDs may still appear outside the jurisdiction in billing/debug metadata.
4. **Configuration:** `new_sqlite_classes` is legacy. New classes should use `[exports.ClassName]`, `type = "durable-object"`, `storage = "sqlite"`. Do not mix both models. Either path requires a Worker deploy and is forbidden while policy routes remain frozen under #1510.

## Cost and lifecycle
- A hot ID can remain active and accrue runtime duration.
- An idle hibernation-capable Durable Object incurs no duration while hibernated.
- SQLite storage persists.
- WebSocket hibernation discards in-memory state; the constructor runs again on wake.

## Authoritative identity chain
Allowed chain only:

`verifyJwt -> resolveMembership(auth.uid) -> tenantId = membership.tenantId -> optional TenantRateLimit idFromName(tenantId) / getByName(tenantId) -> policy / execution / evidence`

The Durable Object ID derives only from the tenant ID returned by authoritative membership lookup. Forbidden identity sources are URL/path tenant, JWT custom tenant claim, `body.tenant_id`, tenant header, or other user-controlled key material. The limit comes from the server-side entitlement/plan resolver, never `request.body`.

## Pre-class authorization pattern
Conceptual only; this ADR introduces no call-site.

```ts
const auth = await verifyJwt(request);
const membership = await resolveMembership(auth.userId);

if (!membership) {
  return new Response("Forbidden", { status: 403 });
}

const tenantId = membership.tenantId;
const entitlement = await resolveEntitlement(tenantId);

// Hypothetical binding only. Do not add it while the freeze is active.
const limiter = env.RATE.getByName(tenantId);
const result = await limiter.consume({
  limit: entitlement.requestsPerMinute,
  windowMs: 60_000,
});

if (!result.allowed) {
  return new Response("Too Many Requests", {
    status: 429,
    headers: {
      "Retry-After": String(
        Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000)),
      ),
    },
  });
}
```

## TenantRateLimit design
The object stores counters only: no tenant, policy, secret, evidence, token, document, or authorization columns.

```ts
import { DurableObject } from "cloudflare:workers";

type ConsumeInput = { limit: number; windowMs: number };
type ConsumeResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

export class TenantRateLimit extends DurableObject {
  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS rate_buckets (
          window_start INTEGER PRIMARY KEY,
          count INTEGER NOT NULL
        )
      `);
    });
  }

  consume(input: ConsumeInput): ConsumeResult {
    const limit = Math.trunc(input.limit);
    const windowMs = Math.trunc(input.windowMs);

    if (limit < 1 || limit > 1_000_000) throw new Error("invalid rate limit");
    if (windowMs < 1_000 || windowMs > 86_400_000) {
      throw new Error("invalid rate-limit window");
    }

    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const resetAt = windowStart + windowMs;

    const rows = this.ctx.storage.sql.exec(
      `INSERT INTO rate_buckets (window_start, count)
       VALUES (?, 1)
       ON CONFLICT(window_start) DO UPDATE SET count = count + 1
       RETURNING count`,
      windowStart,
    ).toArray();

    const count = Number(rows[0]?.count ?? 1);
    this.ctx.storage.sql.exec(
      `DELETE FROM rate_buckets WHERE window_start < ?`,
      windowStart - windowMs,
    );

    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt,
    };
  }
}
```

## Freeze / scope
This ADR is documentation only and explicitly out of scope for #1511.

- No Durable Object binding in `wrangler-workers.toml`.
- No `[exports.*]`, `new_sqlite_classes`, or Durable Object migration/configuration.
- No call-site or import in `src/workers/index.ts` or any other worker runtime.
- No KV creation or other infrastructure provisioning.
- No deploy.
- No merge.

Any future implementation requires a separate unfreeze decision and must preserve the membership-derived `tenantId` authority chain above.
