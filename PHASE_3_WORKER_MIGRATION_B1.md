# Phase 3: Worker Migration B1 — Planning & Implementation

**Status:** 📋 Planned  
**Timeline:** 4 weeks  
**Date:** 2026-07-23  
**Target:** Migrate governance-core functions to Cloudflare Workers

---

## Overview: Why Workers?

Current architecture:
```
Cloudflare Pages (app) → Edge Functions (governance, audit, billing)
```

Target architecture:
```
Cloudflare Pages (app) 
    ↓ (via Workers routing)
Cloudflare Workers (middleware layer)
    ├── Auth check (token validation)
    ├── Rate limiting (per-tenant)
    ├── Request signing (HMAC)
    ├── Logging to KV
    └── Request/response transformation
    ↓ (routed to)
Edge Functions (governance-*, audit-*, billing-*)
    ├── Policy evaluation
    ├── Audit logging
    ├── Cache management (KV)
    └── Evidence storage (R2)
```

**Benefits:**
- Centralized middleware layer (auth, rate-limiting, signing)
- Request/response logging for compliance
- Per-tenant rate limiting (prevent abuse)
- Consistent request signing (HMAC for verification)
- Easier function orchestration

---

## Week 1: Design & Architecture

### Task 1.1: Define Worker Entry Point

Create main Worker entry point:

```typescript
// src/workers/main.ts (new)

import { Router } from "itty-router";
import { authMiddleware } from "./middleware/auth";
import { rateLimitMiddleware } from "./middleware/rate-limit";
import { requestSigningMiddleware } from "./middleware/request-signing";
import { loggingMiddleware } from "./middleware/logging";

const router = Router();

// Apply middleware stack
router.all("*", authMiddleware);
router.all("*", rateLimitMiddleware);
router.all("*", requestSigningMiddleware);
router.all("*", loggingMiddleware);

// Route to edge functions
router.post("/api/governance/*", governanceHandler);
router.post("/api/audit/*", auditHandler);
router.post("/api/billing/*", billingHandler);

export default router;
```

### Task 1.2: Design Middleware Stack

**Order of Execution:**
1. Auth Middleware (validate JWT/API key)
2. Rate Limiting (check tenant quota)
3. Request Signing (calculate HMAC)
4. Logging Middleware (log to KV)
5. Route to handler

### Task 1.3: Plan Function Migration Order

**Priority 1 (Week 2-3):** Core governance functions
- `governance-core` → Workers
- `governance-agent` → Workers
- `governance-approvals` → Workers

**Priority 2 (Week 3-4):** Supporting functions
- `governance-incidents` → Workers
- `governance-dpias` → Workers
- `governance-dsr` → Workers

**Priority 3 (Post-B1):** Other functions
- `audit-*` functions
- `billing-*` functions

---

## Week 2: Middleware Implementation

### Task 2.1: Auth Middleware

```typescript
// src/workers/middleware/auth.ts

export async function authMiddleware(request: Request, env: Env) {
  const authHeader = request.headers.get("Authorization");
  
  if (!authHeader) {
    return new Response("Missing Authorization header", { status: 401 });
  }

  const [scheme, token] = authHeader.split(" ");
  
  if (scheme !== "Bearer") {
    return new Response("Invalid auth scheme", { status: 401 });
  }

  // Validate JWT with Supabase
  try {
    const user = await validateToken(token, env);
    request.user = user;
    request.tenantId = user.tenant_id;
  } catch (error) {
    return new Response("Invalid token", { status: 401 });
  }
}
```

### Task 2.2: Rate Limiting Middleware

```typescript
// src/workers/middleware/rate-limit.ts

const RATE_LIMITS = {
  governance: 100, // per minute
  audit: 50,
  billing: 20,
};

export async function rateLimitMiddleware(request: Request, env: Env) {
  const tenantId = request.tenantId;
  const endpoint = getEndpointType(request.url);
  const limit = RATE_LIMITS[endpoint];

  // Check KV for request count
  const key = `ratelimit:${tenantId}:${endpoint}:${getCurrentMinute()}`;
  const count = await env.GOVERNANCE_CACHE.get(key, "json") || 0;

  if (count >= limit) {
    return new Response("Rate limit exceeded", { 
      status: 429,
      headers: {
        "Retry-After": "60",
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": "0",
      }
    });
  }

  // Increment counter
  await env.GOVERNANCE_CACHE.put(
    key,
    JSON.stringify(count + 1),
    { expirationTtl: 60 }
  );

  request.rateLimit = {
    limit,
    remaining: limit - count - 1,
    resetAt: new Date(getCurrentMinute() * 60000 + 60000),
  };
}
```

### Task 2.3: Request Signing Middleware

```typescript
// src/workers/middleware/request-signing.ts

export async function requestSigningMiddleware(request: Request, env: Env) {
  const timestamp = Date.now();
  const nonce = crypto.randomUUID();
  
  // Calculate HMAC
  const signaturePayload = `${request.method}|${request.url}|${timestamp}|${nonce}`;
  const signature = await calculateHMAC(signaturePayload, env.SIGNING_KEY);

  // Add headers to outgoing request
  request.signingHeaders = {
    "X-Signature": signature,
    "X-Timestamp": String(timestamp),
    "X-Nonce": nonce,
  };
}
```

### Task 2.4: Logging Middleware

```typescript
// src/workers/middleware/logging.ts

export async function loggingMiddleware(request: Request, env: Env) {
  const startTime = Date.now();
  
  // Add request ID
  const requestId = crypto.randomUUID();
  request.id = requestId;

  // Log to KV for audit trail
  const logEntry = {
    id: requestId,
    timestamp: new Date().toISOString(),
    method: request.method,
    url: request.url,
    tenantId: request.tenantId,
    userAgent: request.headers.get("User-Agent"),
    ip: request.headers.get("CF-Connecting-IP"),
  };

  await env.GOVERNANCE_CACHE.put(
    `log:${requestId}`,
    JSON.stringify(logEntry),
    { expirationTtl: 86400 * 7 } // 7 days
  );
}
```

---

## Week 3: Function Migration

### Task 3.1: Migrate Governance-Core

Move `governance-core` logic into Workers:

```typescript
// src/workers/handlers/governance.ts

export async function governanceHandler(request: Request, env: Env) {
  const method = request.method;
  const url = new URL(request.url);
  const path = url.pathname;

  // Route to specific handler
  if (path.includes("evaluate")) {
    return evaluatePolicyHandler(request, env);
  } else if (path.includes("decision")) {
    return getDecisionHandler(request, env);
  }

  return new Response("Not found", { status: 404 });
}

async function evaluatePolicyHandler(request: Request, env: Env) {
  const body = await request.json();
  const { policyId, tenantId } = body;

  // Call edge function
  const response = await fetch("https://realsyncdynamics-ai.pages.dev/api/governance-evaluate", {
    method: "POST",
    headers: {
      ...request.signingHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      policyId,
      tenantId,
      requestId: request.id,
    }),
  });

  return response;
}
```

### Task 3.2: Deploy Workers

```bash
# Create wrangler-workers.toml (separate from Pages config)
cp wrangler.toml wrangler-workers.toml

# Update for Workers deployment
# Then deploy:
wrangler deploy --config wrangler-workers.toml
```

### Task 3.3: Test with Real Traffic

- Route 10% of traffic to Workers
- Monitor error rates
- Check latency impact
- Verify rate limiting works

---

## Week 4: Testing & Rollout

### Task 4.1: Load Testing

```bash
# Test with 1000 RPS
npm run test:load -- --workers --rps 1000
```

### Task 4.2: Canary Deployment

- Route 25% → Workers
- Monitor metrics (latency, errors, cache hits)
- Route 50% → Workers
- Route 100% → Workers

### Task 4.3: Rollback Plan

If issues occur:
- Revert routing to edge functions only
- Analyze logs in KV
- Fix and redeploy

---

## Wrangler Configuration (Workers)

```toml
# wrangler-workers.toml (new file)

name = "realsyncdynamics-ai-workers"
type = "service"
account_id = "YOUR_ACCOUNT_ID"
workers_dev = true
route = "https://realsyncdynamics-ai.pages.dev/api/*"
zone_id = "YOUR_ZONE_ID"

[env.production]
name = "realsyncdynamics-ai-workers-prod"
route = "https://realsyncdynamics-ai.pages.dev/api/*"

# Use existing KV namespace
kv_namespaces = [
  { binding = "GOVERNANCE_CACHE", id = "5bb700e74b83404caee6223533db1e90", preview_id = "..." }
]

# Secrets (for HMAC signing)
[env.production.secrets]
SIGNING_KEY = "YOUR_HMAC_SECRET"
```

---

## Environment Variables Needed

```bash
# Workers signing key (for request HMAC)
wrangler secret put SIGNING_KEY --env production

# Database URL (if calling edge functions via URL)
wrangler secret put SUPABASE_URL --env production
wrangler secret put SUPABASE_KEY --env production
```

---

## Monitoring & Observability

### Metrics to Track

- Request latency (ms)
- Rate limit rejections
- Auth failures
- Cache hit ratio
- Error rates by endpoint
- Tenant request distribution

### Logging to KV

All requests logged with:
- Request ID (UUID)
- Timestamp
- Tenant ID
- User agent
- Source IP
- Response status (post-execution)
- Latency (ms)

---

## Rollback Procedure

If Worker migration fails:

1. Update route to skip Workers:
   ```bash
   # Remove route from wrangler.toml
   # Redeploy
   wrangler publish
   ```

2. Revert to edge functions only
3. Analyze logs in KV bucket for root cause
4. Fix issues
5. Redeploy Workers

---

## Success Criteria

✅ All governance-core functions running on Workers  
✅ Middleware layer functional (auth, rate-limiting, signing)  
✅ <5ms latency overhead from Workers layer  
✅ Zero auth failures in canary phase  
✅ Rate limiting prevents abuse (test with spike)  
✅ Request signing verified on all requests  
✅ Audit logs complete in KV  
✅ Rollback plan tested  

---

## Timeline Summary

| Week | Tasks | Deliverable |
|------|-------|-------------|
| 1 | Design, architecture, middleware stack | `wrangler-workers.toml`, middleware modules |
| 2 | Implement auth, rate-limiting, signing, logging | Middleware layer complete |
| 3 | Migrate governance-core, deploy, test | Workers deployed, 10% traffic |
| 4 | Load test, canary rollout, monitoring | 100% traffic on Workers |

---

## Dependencies

- Phase 3 KV namespace (✅ complete)
- Phase 3 cache invalidation (✅ complete)
- Phase 3 R2 vault (🔄 pending enablement)
- Cloudflare Workers (available)

**Ready to begin:** Once R2 is enabled and evidence vault is configured.
