# Phase 3C: Cloudflare Workers Migration — 4-Week Implementation Plan

**Objective**: Migrate governance-core Edge Functions to Cloudflare Workers with middleware stack

**Timeline**: 4 weeks (after Phase 3B complete)

**User Request**: Structured sequential execution ("1 dann 2 dann 3 dann 4")

---

## Overview

### Why Migrate to Workers?
- Better performance (native Cloudflare execution environment)
- Native KV integration (no extra API calls)
- Request signing and audit logging at edge
- Rate-limiting enforced before function invocation
- Unified middleware stack across all governance endpoints

### Scope
Functions to migrate:
- `supabase/functions/governance-policy-evaluate`
- `supabase/functions/governance-audit-log`
- `supabase/functions/cache-invalidate`
- `supabase/functions/evidence-vault`

Target: 100% traffic on Workers by end of Week 4

---

## Week 1: Architecture & Planning (Days 1-5)

### Day 1-2: Design Phase

**Task 1.1**: Define Worker Routing Strategy
```toml
# Target routing in wrangler-workers.toml
[[routes]]
pattern = "https://api.realsyncdynamicsai.de/api/governance/*"
zone_name = "realsyncdynamicsai.de"

[[routes]]
pattern = "https://api.realsyncdynamicsai.de/api/audit/*"
zone_name = "realsyncdynamicsai.de"

[[routes]]
pattern = "https://api.realsyncdynamicsai.de/api/evidence/*"
zone_name = "realsyncdynamicsai.de"

[[routes]]
pattern = "https://api.realsyncdynamicsai.de/api/cache/*"
zone_name = "realsyncdynamicsai.de"
```

**Task 1.2**: Middleware Stack Architecture
```
Request Flow:
1. Request arrives at Worker
2. Auth Middleware (JWT validation)
   ↓
3. Rate-Limit Middleware (per-tenant KV check)
   ↓
4. Request Signing Middleware (HMAC validation + timestamp)
   ↓
5. Logging Middleware (KV audit trail)
   ↓
6. Function Handler (governance logic)
   ↓
7. Response Logging Middleware
   ↓
8. Response to client
```

**Task 1.3**: KV Schema Design
```
// Audit logs (7-day retention)
Key: audit:{request_id}
TTL: 604800 (7 days)
Value: {
  request_id: string,
  timestamp: ISO8601,
  method: string,
  path: string,
  tenant_id: string,
  user_id: string,
  status: number,
  latency_ms: number,
  error?: string
}

// Rate-limit buckets
Key: ratelimit:{tenant_id}:{endpoint}
TTL: 60 (1 minute)
Value: {
  count: number,
  reset_at: ISO8601
}

// Request signing nonce cache (replay protection)
Key: nonce:{nonce}
TTL: 300 (5 minutes)
Value: { used: true }
```

**Deliverable**: Architecture.md document with routing, middleware flow, and KV schema

### Day 3-5: Implementation Planning

**Task 1.4**: Function Migration Order
```
Priority 1 (No dependencies):
- cache-invalidate (stateless, simple)

Priority 2 (Depends on Priority 1):
- governance-policy-evaluate (uses cache)

Priority 3 (Depends on Priority 2):
- governance-audit-log (logs all governance calls)
- evidence-vault (independent, uses R2)
```

**Task 1.5**: Middleware Interface Design
```typescript
// middleware/types.ts
export interface MiddlewareContext {
  request: Request;
  env: Env;
  kv: KVNamespace;
  userId?: string;
  tenantId?: string;
  requestId: string;
  timestamp: number;
}

export type MiddlewareHandler = (
  ctx: MiddlewareContext
) => Promise<Response | null>;

export interface MiddlewareChain {
  use(handler: MiddlewareHandler): MiddlewareChain;
  execute(ctx: MiddlewareContext): Promise<Response>;
}
```

**Task 1.6**: Pricing & Performance Targets
```
Cloudflare Workers Pricing:
- Free: 100,000 requests/day
- Bundled: $0.50/million requests
- Target: Sub-1ms Cold Start, <5ms Warm

Success Metrics:
- Auth latency: <1ms
- Rate-limit check: <1ms
- Request signing: <2ms
- Total overhead: <5ms
- Error rate: <0.1%
- Cache hit rate: >90% (governance policies)
```

**Deliverables**:
- [ ] Architecture.md with routing and middleware flow
- [ ] middleware/types.ts with interface definitions
- [ ] workers/routing.toml with endpoint mapping
- [ ] Performance targets documented
- [ ] Canary/rollout strategy documented

**Success Criteria**: All architectural decisions documented, middleware interfaces defined, no unknowns remaining

---

## Week 2: Middleware Stack Implementation (Days 1-5)

### Day 1: Auth Middleware

**Task 2.1**: JWT Validation with Supabase

```typescript
// middleware/auth.ts
import { jwtVerify } from "https://cdn.jsdelivr.net/npm/jose@5.0.0";

interface Env {
  SUPABASE_JWT_SECRET: string;
}

export async function authMiddleware(
  ctx: MiddlewareContext
): Promise<Response | null> {
  const authHeader = ctx.request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({
        error: "Missing or invalid Authorization header",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const token = authHeader.slice(7);

  try {
    const secret = new TextEncoder().encode(ctx.env.SUPABASE_JWT_SECRET);
    const verified = await jwtVerify(token, secret);

    ctx.userId = verified.payload.sub as string;
    ctx.tenantId = verified.payload.tenant_id as string;

    return null; // Continue to next middleware
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired token" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }
}
```

**Test**:
```bash
# Generate test JWT (valid for 1 hour)
curl -X POST https://your-project.supabase.co/auth/v1/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "password",
    "email": "test@example.com",
    "password": "test-password"
  }'

# Use token in Worker request
curl https://api.realsyncdynamicsai.de/api/governance/evaluate \
  -H "Authorization: Bearer $TOKEN"
```

### Day 2-3: Rate-Limiting Middleware

**Task 2.2**: Per-Tenant, Per-Endpoint Rate Limiting

```typescript
// middleware/rate-limit.ts
export interface RateLimitConfig {
  endpoint: string;
  limit: number; // requests per window
  window_seconds: number;
}

const RATE_LIMITS: RateLimitConfig[] = [
  { endpoint: "/api/governance/evaluate", limit: 1000, window_seconds: 60 },
  { endpoint: "/api/governance/audit-log", limit: 10000, window_seconds: 60 },
  { endpoint: "/api/cache/invalidate", limit: 100, window_seconds: 60 },
  { endpoint: "/api/evidence/upload", limit: 50, window_seconds: 60 },
  { endpoint: "/api/evidence/retrieve", limit: 500, window_seconds: 60 },
];

export async function rateLimitMiddleware(
  ctx: MiddlewareContext
): Promise<Response | null> {
  const path = new URL(ctx.request.url).pathname;
  const config = RATE_LIMITS.find((c) => path.startsWith(c.endpoint));

  if (!config || !ctx.tenantId) {
    return null; // No limit configured or no tenant
  }

  const key = `ratelimit:${ctx.tenantId}:${config.endpoint}`;
  const current = (await ctx.kv.get(key, "json")) || {
    count: 0,
    reset_at: new Date(ctx.timestamp + config.window_seconds * 1000),
  };

  if (current.count >= config.limit) {
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded",
        retry_after: Math.ceil(
          (new Date(current.reset_at).getTime() - ctx.timestamp) / 1000
        ),
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": Math.ceil(
            (new Date(current.reset_at).getTime() - ctx.timestamp) / 1000
          ).toString(),
        },
      }
    );
  }

  current.count++;
  await ctx.kv.put(
    key,
    JSON.stringify(current),
    {
      expirationTtl: config.window_seconds,
    },
    "json"
  );

  return null; // Continue
}
```

**Test**:
```bash
# Generate 1001 requests to trigger limit
for i in {1..1001}; do
  curl https://api.realsyncdynamicsai.de/api/governance/evaluate \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-Tenant-ID: org_test"
done

# Request 1001 should return 429 with Retry-After header
```

### Day 4: Request Signing Middleware

**Task 2.3**: HMAC-SHA256 Request Validation

```typescript
// middleware/signing.ts
export function generateSignature(
  method: string,
  path: string,
  timestamp: string,
  nonce: string,
  secret: string
): string {
  const data = `${method}:${path}:${timestamp}:${nonce}`;
  const encoder = new TextEncoder();
  const hmac = new crypto.subtle.sign(
    "HMAC",
    crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    ),
    encoder.encode(data)
  );
  return btoa(String.fromCharCode(...new Uint8Array(hmac)));
}

export async function signingMiddleware(
  ctx: MiddlewareContext
): Promise<Response | null> {
  const signature = ctx.request.headers.get("X-Signature");
  const timestamp = ctx.request.headers.get("X-Timestamp");
  const nonce = ctx.request.headers.get("X-Nonce");

  if (!signature || !timestamp || !nonce) {
    return new Response(
      JSON.stringify({ error: "Missing signing headers" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Check timestamp (within 5 minutes)
  const requestTime = parseInt(timestamp);
  if (Math.abs(ctx.timestamp - requestTime) > 300000) {
    return new Response(
      JSON.stringify({ error: "Request timestamp too old" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Check nonce (replay protection)
  const nonceKey = `nonce:${nonce}`;
  if (await ctx.kv.get(nonceKey)) {
    return new Response(
      JSON.stringify({ error: "Nonce already used (replay attack)" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Verify signature
  const path = new URL(ctx.request.url).pathname;
  const expectedSignature = generateSignature(
    ctx.request.method,
    path,
    timestamp,
    nonce,
    ctx.env.REQUEST_SIGNING_SECRET
  );

  if (signature !== expectedSignature) {
    return new Response(
      JSON.stringify({ error: "Invalid signature" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Mark nonce as used (5 minute TTL)
  await ctx.kv.put(nonceKey, "true", { expirationTtl: 300 }, "text");

  return null; // Continue
}
```

### Day 5: Logging Middleware

**Task 2.4**: KV-Based Audit Trail (7-day retention)

```typescript
// middleware/logging.ts
export async function loggingMiddleware(
  ctx: MiddlewareContext
): Promise<Response | null> {
  // Store request start time for latency calculation
  const startTime = performance.now();

  // Attach cleanup function to be called after response
  ctx.logStartTime = startTime;

  return null; // Continue to handler
}

export async function loggingResponseMiddleware(
  ctx: MiddlewareContext,
  response: Response,
  startTime: number
): Promise<void> {
  const latency = performance.now() - startTime;

  const logEntry = {
    request_id: ctx.requestId,
    timestamp: new Date(ctx.timestamp).toISOString(),
    method: ctx.request.method,
    path: new URL(ctx.request.url).pathname,
    tenant_id: ctx.tenantId || "unknown",
    user_id: ctx.userId || "unknown",
    status: response.status,
    latency_ms: Math.round(latency),
    ip: ctx.request.headers.get("cf-connecting-ip"),
  };

  const key = `audit:${ctx.requestId}`;
  await ctx.kv.put(
    key,
    JSON.stringify(logEntry),
    {
      expirationTtl: 604800, // 7 days
    },
    "json"
  );
}
```

**Test**:
```bash
# Make request
curl https://api.realsyncdynamicsai.de/api/governance/evaluate \
  -H "Authorization: Bearer $TOKEN"

# Retrieve audit log (via API or KV directly)
# Key format: audit:{request_id}
# Should show latency, status, tenant_id, etc.
```

**Deliverables**:
- [ ] middleware/auth.ts with JWT validation
- [ ] middleware/rate-limit.ts with per-tenant limits
- [ ] middleware/signing.ts with HMAC validation
- [ ] middleware/logging.ts with audit trail
- [ ] Unit tests for each middleware
- [ ] Integration tests for middleware chain

**Success Criteria**: All 4 middleware pieces compile, unit tests pass (>90% coverage), KV operations verified

---

## Week 3: Function Migration & Canary Deployment (Days 1-5)

### Day 1-2: Migrate Core Functions

**Task 3.1**: Port Cache Invalidation

```typescript
// workers/cache-invalidate.ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "POST") {
      const { event_type, pattern } = await request.json();

      if (event_type === "policy.updated") {
        // Invalidate matching keys
        const keys = await env.GOVERNANCE_CACHE.list({
          prefix: `governance:policy:${pattern.tenant_id}:`,
        });

        for (const key of keys.keys) {
          await env.GOVERNANCE_CACHE.delete(key.name);
        }

        return new Response(
          JSON.stringify({
            success: true,
            invalidated: keys.keys.length,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  },
};
```

**Task 3.2**: Port Governance Policy Evaluate

```typescript
// workers/governance-policy-evaluate.ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { tenant_id, policy_id, version, data } = await request.json();
    const cacheKey = `governance:policy:${tenant_id}:${policy_id}:${version}`;

    // Check cache
    const cached = await env.GOVERNANCE_CACHE.get(cacheKey, "json");
    if (cached) {
      return new Response(
        JSON.stringify({
          decision: cached.decision,
          cached: true,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Evaluate policy (simplified)
    const decision = evaluatePolicy(policy_id, data);

    // Cache result (1 hour TTL)
    await env.GOVERNANCE_CACHE.put(
      cacheKey,
      JSON.stringify({ decision }),
      { expirationTtl: 3600 },
      "json"
    );

    return new Response(
      JSON.stringify({
        decision,
        cached: false,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  },
};

function evaluatePolicy(
  policyId: string,
  data: Record<string, unknown>
): boolean {
  // Governance evaluation logic
  return true; // Simplified
}
```

**Task 3.3**: Port Evidence Vault (already prepared)

### Day 3-4: Deploy 10% Canary

**Task 3.4**: Routing Configuration

```toml
# wrangler-workers.toml
name = "realsyncdynamics-workers"
main = "src/index.ts"

[[env.canary.routes]]
pattern = "https://api.realsyncdynamicsai.de/api/governance/*"
zone_name = "realsyncdynamicsai.de"

[[env.canary.routes]]
pattern = "https://api.realsyncdynamicsai.de/api/cache/*"
zone_name = "realsyncdynamicsai.de"

[[env.canary.routes]]
pattern = "https://api.realsyncdynamicsai.de/api/evidence/*"
zone_name = "realsyncdynamicsai.de"

# Canary KV bindings
[[env.canary.kv_namespaces]]
binding = "GOVERNANCE_CACHE"
id = "5bb700e74b83404caee6223533db1e90"

[[env.canary.kv_namespaces]]
binding = "AUDIT_LOG"
id = "audit_log_namespace_id"

# Secrets
[env.canary.vars]
SUPABASE_JWT_SECRET = "your_secret"
REQUEST_SIGNING_SECRET = "your_secret"
```

**Task 3.5**: Canary Deployment

```bash
# Deploy to canary environment (10% traffic)
wrangler deploy --env canary

# Monitor error rates
curl https://api.realsyncdynamicsai.de/api/governance/evaluate \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: org_test"

# Check Cloudflare Analytics for:
# - Error rate (target: <0.1%)
# - Latency (target: <5ms overhead)
# - Request count (should be ~10% of total)
```

**Task 3.6**: Monitoring Checklist

| Metric | Target | Check |
|--------|--------|-------|
| Error Rate | <0.1% | Analytics dashboard |
| Latency P95 | <5ms overhead | Cloudflare metrics |
| Cache Hit Rate | >85% | KV stats |
| Auth Failures | 0 | Audit logs |
| Rate Limit Triggers | <1% | KV rate-limit entries |

**Day 5: Validation**

**Task 3.7**: Load Test (1000 RPS for 5 minutes)

```bash
# Using Apache Bench
ab -n 5000 -c 100 \
  -H "Authorization: Bearer $TOKEN" \
  https://api.realsyncdynamicsai.de/api/governance/evaluate

# Expected results:
# - Requests per second: 1000+
# - Failed requests: 0
# - Mean latency: <50ms
# - Max latency: <200ms
```

**Deliverables**:
- [ ] workers/cache-invalidate.ts (migrated)
- [ ] workers/governance-policy-evaluate.ts (migrated)
- [ ] workers/evidence-vault.ts (migrated)
- [ ] wrangler-workers.toml (10% canary routing)
- [ ] Load test report (1000 RPS, 5 min)
- [ ] Error analysis (zero auth failures)
- [ ] Cache hit rate report (>85%)

**Success Criteria**: Canary at 10%, zero errors, latency <5ms overhead, audit logs clean

---

## Week 4: Progressive Rollout & Cutover (Days 1-5)

### Day 1: 25% Traffic

```bash
# Update routing to 25%
# Method: Cloudflare Load Balancer or weighted routing

# Monitor for 2 hours
# Check:
# - Error rate stays <0.1%
# - Latency remains <5ms
# - No KV quota issues
# - Auth/rate-limit working

# Success: Proceed to 50%
```

### Day 2: 50% Traffic

```bash
# Update routing to 50%
# Run secondary load test (2000 RPS)
ab -n 10000 -c 200 https://...

# Verify cache hit rates (should be >90% now)
# Check memory usage, KV operations/sec
# Validate audit logs for anomalies
```

### Day 3: 75% Traffic

```bash
# Update routing to 75%
# Monitor for 4 hours
# Prepare rollback plan:
#   - Revert wrangler.toml routing
#   - Redeploy: wrangler deploy
#   - Instant rollback to Edge Functions
```

### Day 4: 100% Traffic

```bash
# Update routing to 100%
# Final 8-hour monitoring window
# Check:
# - Zero errors for 8 consecutive hours
# - Consistent latency (<5ms overhead)
# - KV performance remains stable
# - All audit logs clean

# Success: Proceed to decommissioning
```

### Day 5: Post-Deployment

```bash
# Decommission Edge Functions
# - Keep in place for 1 week as fallback
# - After 1 week: delete supabase/functions/*

# Update deployment docs
# - Remove Edge Functions references
# - Document Workers-based architecture
# - Update troubleshooting guides

# Final smoke tests
curl https://api.realsyncdynamicsai.de/api/governance/evaluate
curl https://api.realsyncdynamicsai.de/api/cache/invalidate
curl https://api.realsyncdynamicsai.de/api/evidence/upload
```

**Deliverables**:
- [ ] Traffic routing at 100% Workers
- [ ] Zero errors maintained throughout
- [ ] All edge functions tested post-deployment
- [ ] Deployment documentation updated
- [ ] Rollback procedure documented and tested

**Success Criteria**: 100% traffic on Workers, zero errors, <5ms overhead maintained, full decommissioning complete

---

## Rollback Procedure

If issue detected at any point:

```bash
# 1. Immediate: Revert routing
wrangler deploy  # Redeploy to reset routing
# This instantly routes back to Edge Functions

# 2. Investigate: Check KV audit logs
curl https://api.realsyncdynamicsai.de/api/audit/logs \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"since": "1 hour ago"}'

# 3. Fix: Identify and correct the issue
# Update middleware or function code

# 4. Re-deploy: Test in canary again
wrangler deploy --env canary
# Resume from Week 3 Day 5 (validation)

# 5. Resume: Gradual rollout
# 10% → 25% → 50% → 75% → 100%
```

**Rollback Triggers**:
- Error rate exceeds 0.5%
- Latency overhead exceeds 10ms
- Auth failures increase
- KV quota exceeded
- Memory/CPU issues detected

---

## Success Metrics (Final)

| Metric | Target | Status |
|--------|--------|--------|
| Functions Migrated | 4/4 | ✅ |
| Traffic on Workers | 100% | ✅ |
| Error Rate | <0.1% | ✅ |
| Latency Overhead | <5ms | ✅ |
| Cache Hit Rate | >90% | ✅ |
| Audit Log Coverage | 100% | ✅ |
| Edge Functions | Decommissioned | ✅ |

---

## Next Steps After Completion

1. **Optimization** (Phase 4)
   - Worker analytics deep dive
   - Cache strategy refinement
   - Rate-limit tuning per endpoint

2. **Scaling** (Phase 5)
   - Durable Objects for stateful operations
   - Service bindings for inter-worker communication
   - Analytics Engine for governance metrics

3. **Security Hardening** (Phase 6)
   - Mutual TLS for internal routes
   - Request encryption for sensitive payloads
   - Enhanced audit trail retention (90 days)
