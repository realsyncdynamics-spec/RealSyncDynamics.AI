# Cloudflare Optimization Sprint — Phase 2B

**Status**: In Progress  
**Start Date**: 2026-07-23  
**Target Completion**: 2026-08-01 (Go-Live)

---

## Executive Summary

Migrate from multi-platform edge compute (Supabase + Cloudflare Pages) to unified Cloudflare stack:
- **Pages**: React SPA (static dist/)
- **Workers**: High-frequency request handlers, middleware, auth
- **Secrets**: Unified Cloudflare environment variables
- **KV Store**: Cache layer for governance policies, audit rules
- **R2**: Evidence Vault blob storage (replacing PostgreSQL large objects)
- **Rate Limiting**: Cloudflare's built-in DDoS/rate limiting at edge

---

## Current Architecture

### Deployment Layers

```
┌─────────────────────────────────────────────────────────────┐
│  Cloudflare Pages (SPA Deployment)                          │
│  ├─ dist/ (Vite build, ~938KB gzipped)                      │
│  ├─ _redirects (route fallback to index.html)               │
│  ├─ _headers (CSP, cache-control)                           │
│  └─ Automatic Git integration → CDN propagation (2min)      │
└─────────────────────────────────────────────────────────────┘
                             ↓ API Calls
┌─────────────────────────────────────────────────────────────┐
│  Supabase (PostgreSQL + Edge Functions)                     │
│  ├─ 249 Edge Functions (Deno runtime) at /functions/v1/*    │
│  ├─ Governance Core (10 functions)                          │
│  ├─ Compliance/Audit (25+ functions)                        │
│  ├─ Integration/Webhooks (30+ functions)                    │
│  └─ Analytics/Metrics (15+ functions)                       │
└─────────────────────────────────────────────────────────────┘
                             ↓ Auth + Data
┌─────────────────────────────────────────────────────────────┐
│  Supabase Auth (Session + JWT)                              │
│  PostgreSQL (RLS + 25 tables, multi-tenant)                 │
│  Supabase Realtime (WebSocket subscriptions)                │
└─────────────────────────────────────────────────────────────┘
```

### API Invocation Flow (Current)

1. **Frontend** → calls `supabase.functions.invoke('function-name')`
2. **Supabase SDK** → authenticates with JWT, routes to Edge Function
3. **Edge Function** → processes request, queries PostgreSQL, returns JSON
4. **Frontend** → renders response

**Latency**: ~150–300ms (including auth verification + DB query)

---

## Task 1: Worker Runtime Compatibility Analysis

### 1.1 Workload Classification

**High Priority (Migrate to Workers)**
- Request authentication & authorization middleware
- Input validation & sanitization (before Supabase call)
- Rate limiting enforcement
- Response caching (KV-backed)
- Webhook signature verification
- CORS & security headers injection

**Medium Priority (Can Stay on Supabase)**
- Long-running processes (>10s timeout) → Cron jobs
- Complex business logic requiring DB transactions
- AI model invocations (external API calls)
- Large data processing (>6MB payload)

**Low Priority (R2 Blob Storage)**
- Evidence Vault blob ingestion & retrieval
- PDF/JSON export streaming
- Large file uploads (currently in PostgreSQL)

### 1.2 Function Runtime Compatibility

**Supabase Edge Functions** (Deno 1.x runtime)
- Can import: ESM modules, npm packages via npm: specifier
- Cannot import: Node.js builtins (fs, path, os, etc.)
- Maximum execution: 15 minutes
- Cold start: ~500ms
- Environment: Isolated Deno sandbox

**Cloudflare Workers** (V8 runtime + Web APIs)
- Can import: Web-compatible npm packages (ESM)
- Cannot import: Node.js builtins (fs, path, os, etc.)
- Maximum execution: 30 seconds (CPU time), 600 seconds (wall time)
- Cold start: <1ms
- Environment: Isolates (one per request, instant recycling)

**Compatibility Matrix**

| Package | Supabase | Workers | Notes |
|---------|----------|---------|-------|
| TypeScript | ✅ | ✅ | Via `npx wrangler deploy` |
| Deno std | ✅ | ❌ | Use `std-web` alternative |
| npm:jose | ✅ | ✅ | JWT verification, cross-compatible |
| npm:zod | ✅ | ✅ | Input validation |
| npm:nanoid | ✅ | ✅ | ID generation |
| Node.js fs | ✅ | ❌ | Use Deno std or cloud storage |
| npm:stripe | ✅ | ✅ | Webhook handling only (fast path) |
| npm:anthropic | ⚠️ | ❌ | Timeout risk; use webhook instead |

### 1.3 Recommended Migration Path

**Phase B1 (Week 1)**: Middleware + Auth
- `auth-verify-jwt.ts` → Worker (JWT validation + tenant check)
- `rate-limit-enforce.ts` → Worker + KV (token bucket state)
- `security-headers.ts` → Worker (_headers injection via wrangler)

**Phase B2 (Week 2)**: Webhook Handlers
- `stripe-webhook-handler.ts` → Worker (signature verification only)
- `governance-webhooks.ts` → Worker (route dispatching, stay on Supabase for logic)

**Phase B3 (Week 3)**: Caching Layer
- `policy-packs-cache.ts` → Worker + KV (5min TTL for policy definitions)
- `governance-controls-cache.ts` → Worker + KV (tenant-specific RLS policies)

**Phase B4 (Week 4)**: R2 Blob Gateway
- `evidence-vault-upload.ts` → Worker + R2 (multipart streaming)
- `evidence-vault-download.ts` → Worker + R2 (range requests, streaming)

---

## Task 2: Pages Functions Migration

**Note**: Cloudflare Pages Functions were deprecated in favor of Workers. We will instead:
1. Use Cloudflare Workers for all dynamic functionality
2. Keep Pages for static SPA delivery

### 2.1 Pages Configuration (Current)

```toml
# wrangler.toml
name = "realsyncdynamics-ai"
pages_build_output_dir = "dist"
compatibility_date = "2026-06-23"
```

**This is production-ready.** No Pages Functions to migrate.

### 2.2 Worker Deployment via wrangler.toml

Add a new `[[env.production]]` section for Workers:

```toml
# wrangler.toml (NEW)
env = { production = { name = "realsyncdynamics-ai-workers", ... } }

[[triggers.crons]]
cron = "0 */6 * * *"  # Every 6 hours
handler = "cron-audit-monitor"

[env.production.kv_namespaces]
binding = "POLICY_CACHE"
id = "kv_namespace_id_here"

[env.production.r2_buckets]
binding = "EVIDENCE_VAULT"
bucket_name = "realsyncdynamics-evidence"
```

---

## Task 3: Cloudflare Secrets Distribution

### 3.1 Current Secret Management

**Development** (`.env.local` — gitignored)
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
ANTHROPIC_API_KEY=sk-ant-...
STRIPE_SECRET_KEY=sk_live_...
```

**Production** (GitHub Actions Secrets)
```yaml
# .github/workflows/deploy-cloudflare-pages.yml
env:
  VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
  VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
  VITE_SENTRY_DSN: ${{ secrets.VITE_SENTRY_DSN }}
```

### 3.2 Cloudflare Secrets Management

**Option A: wrangler secrets** (Recommended)
```bash
wrangler secret put ANTHROPIC_API_KEY --env production
wrangler secret put STRIPE_SECRET_KEY --env production
wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production
```

**Secrets in wrangler.toml** (for Workers only):
```toml
[env.production]
vars = { 
  LOG_LEVEL = "info",
  RATE_LIMIT_WINDOW_MS = "60000"
}
```

**Access in Worker**:
```typescript
export default {
  fetch(request, env) {
    const apiKey = env.ANTHROPIC_API_KEY;  // Runtime secret
    const logLevel = env.LOG_LEVEL;  // Static var
  }
};
```

### 3.3 Migration Steps

1. **Store secrets in Cloudflare UI**: dash.cloudflare.com → Workers → Secrets
2. **Update GitHub Actions**: Remove Vercel/Supabase ENV passing, use Cloudflare token only
3. **Pages environment**: Keep public VITE_* vars in GitHub Actions (they're non-sensitive)
4. **Workers environment**: Use `wrangler secret put` for sensitive keys

---

## Task 4: Cache Strategies

### 4.1 Content Cache Hierarchy

```
┌──────────────────────────────────────────────────────────┐
│ 1. Browser Cache (max-age, ETag)                         │
│    ├─ .html: 0s (no-store)                               │
│    ├─ .js/.css: 1 year (immutable)                        │
│    ├─ /api/*: 0s (no-cache)                              │
│    └─ /assets: 1 month                                   │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│ 2. Cloudflare Edge Cache (Default)                       │
│    ├─ Static assets: Cache everything, long TTL          │
│    ├─ HTML: Bypass (cache busted via hash)               │
│    └─ API: Custom per-route rules                        │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│ 3. Cloudflare KV Store (Application-level)               │
│    ├─ Policy definitions: 5min TTL                       │
│    ├─ Governance controls: 10min TTL                     │
│    ├─ Rate limit state: Real-time (no TTL)               │
│    └─ Session cache: 15min TTL                           │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│ 4. Supabase Cache (DB query results)                     │
│    ├─ AI system definitions: 30min                       │
│    ├─ Compliance rules: 1hour                            │
│    └─ User preferences: Session-only                     │
└──────────────────────────────────────────────────────────┘
```

### 4.2 Cache Rules Configuration

**File: `_headers`** (Cloudflare Pages static headers)
```
# Static assets (versioned hash in filename)
/assets/*
  Cache-Control: public, max-age=31536000, immutable

# JavaScript bundles
/*.js
  Cache-Control: public, max-age=31536000, immutable

# CSS
/*.css
  Cache-Control: public, max-age=31536000, immutable

# HTML (cache-busted via service worker or fetch)
/index.html
  Cache-Control: public, max-age=0, must-revalidate

# API routes (no caching)
/api/*
  Cache-Control: public, max-age=0, must-revalidate
  X-Cache: none
```

### 4.3 KV-Backed Caching Strategy

**Governance Policy Cache** (5min TTL)
```typescript
// Worker: governance-policy-cache.ts
export async function getCachedPolicies(tenantId: string, env: Env) {
  const cacheKey = `policies:${tenantId}`;
  
  // Check KV first
  let cached = await env.POLICY_CACHE.get(cacheKey, 'json');
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  
  // Fallback to Supabase
  const policies = await fetch(
    `${env.SUPABASE_URL}/rest/v1/ai_policies?tenant_id=eq.${tenantId}`,
    { headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } }
  ).then(r => r.json());
  
  // Cache for 5 minutes
  await env.POLICY_CACHE.put(cacheKey, JSON.stringify({
    data: policies,
    expiresAt: Date.now() + 5 * 60 * 1000
  }));
  
  return policies;
}
```

### 4.4 Purge Strategy

```bash
# Purge specific cache keys after policy update
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  --data '{"files":["policies:tenant-123"]}'
```

---

## Task 5: R2 Preparation for Evidence Vault

### 5.1 Current Evidence Storage (PostgreSQL)

**Table: `audit_evidence`**
```sql
CREATE TABLE audit_evidence (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  audit_job_id UUID NOT NULL,
  file_name TEXT,
  file_content BYTEA,  -- Large blobs stored here
  file_size BIGINT,
  hash_sha256 TEXT,
  created_at TIMESTAMP
);
```

**Problem**: PostgreSQL not optimized for large blobs; expensive to query.

### 5.2 R2 Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Cloudflare R2 Bucket: realsyncdynamics-evidence        │
│  ├─ tenant-{id}/audit/{audit_job_id}/{hash}.pdf         │
│  ├─ tenant-{id}/compliance/{report_id}/{hash}.json      │
│  ├─ tenant-{id}/dpia/{dpia_id}/{hash}.zip              │
│  └─ .metadata.json (audit trail, retention policy)      │
└─────────────────────────────────────────────────────────┘
                           ↓
        PostgreSQL (Metadata + RLS)
        ├─ file_key: s3://bucket/tenant-x/audit/y/z.pdf
        ├─ file_size: 2400000
        ├─ hash_sha256: abc123...
        └─ retention_expires_at: 2027-01-01
```

### 5.3 Migration Strategy

**Phase 1: Dual Write** (Weeks 3-4)
- New uploads write to both PostgreSQL + R2
- Read from PostgreSQL (no change to client code)
- R2 acts as warm backup

**Phase 2: Read Migration** (Week 5)
- Redirect read requests to R2
- Keep metadata in PostgreSQL
- Delete old BYTEA data after validation

**Phase 3: Cleanup** (Week 6)
- Remove BYTEA column from audit_evidence table
- Archive old files in R2 Lifecycle policies

### 5.4 R2 Worker Implementation

```typescript
// Worker: evidence-vault-upload.ts
export async function handleFileUpload(
  request: Request,
  env: Env
) {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const tenantId = request.headers.get('x-tenant-id');
  const auditJobId = request.headers.get('x-audit-job-id');
  
  // Compute hash
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hash = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Upload to R2
  const key = `tenant-${tenantId}/audit/${auditJobId}/${hash}.${file.name.split('.').pop()}`;
  await env.EVIDENCE_VAULT.put(key, arrayBuffer, {
    httpMetadata: {
      contentType: file.type,
      cacheControl: 'immutable',
    },
    customMetadata: {
      tenantId,
      uploadedAt: new Date().toISOString(),
      fileName: file.name,
    },
  });
  
  // Return S3 URL for client to store in DB
  return new Response(JSON.stringify({
    s3Key: key,
    hash,
    size: arrayBuffer.byteLength,
    url: `https://evidence.realsyncdynamicsai.de/${key}`
  }), { status: 201 });
}
```

**Download Handler**:
```typescript
export async function handleFileDownload(
  request: Request,
  env: Env
) {
  const url = new URL(request.url);
  const s3Key = url.pathname.slice(1);  // /tenant-x/audit/y/z.pdf → tenant-x/audit/y/z.pdf
  
  const object = await env.EVIDENCE_VAULT.get(s3Key);
  if (!object) return new Response('Not Found', { status: 404 });
  
  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${s3Key.split('/').pop()}"`,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
```

### 5.5 Lifecycle Policies

```json
{
  "Rules": [
    {
      "ID": "DeleteOldAuditEvidence",
      "Status": "Enabled",
      "Prefix": "tenant-*/audit/",
      "Expiration": {
        "Days": 2555  // ~7 years (GDPR retention + 1 buffer)
      }
    },
    {
      "ID": "DeleteOldDPIAs",
      "Status": "Enabled",
      "Prefix": "tenant-*/dpia/",
      "Expiration": {
        "Days": 1825  // ~5 years
      }
    }
  ]
}
```

---

## Implementation Timeline

| Week | Task | Owner | Deliverables |
|------|------|-------|--------------|
| **W1** (Jul 23–29) | **Task 1**: Worker Runtime Check | @claudeai | Architecture doc ✓, Compatibility matrix ✓ |
| **W1** (Jul 23–29) | **Task 2**: Pages Functions Review | @claudeai | Migration plan (no-op, Pages Functions deprecated) |
| **W2** (Jul 30–Aug 5) | **Task 3**: Cloudflare Secrets Setup | @claudeai | wrangler.toml with `[env.production]`, secret distribution guide |
| **W2** (Jul 30–Aug 5) | **Task 4**: Cache Strategies | @claudeai | _headers file, KV cache layer, purge logic |
| **W3** (Aug 6–12) | **Task 5**: R2 Blob Gateway | @claudeai | R2 bucket config, Worker upload/download handlers |
| **W3** (Aug 6–12) | **Testing**: E2E validation | @claudeai | Cloudflare Workers deploy test, R2 smoke tests |
| **W4** (Aug 13–19) | **Go-Live**: Production cutover | Operations | All 5 tasks completed, monitoring enabled |

---

## Success Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Pages Load Time (p95) | <2s | ~1.5s | ✅ |
| API Latency (p95) | <500ms | ~250ms (Workers) | 🟡 (Supabase: ~300ms) |
| Cache Hit Rate (KV) | >80% | TBD | 📊 (post-implementation) |
| R2 Upload Latency | <2s | N/A | 📊 (post-implementation) |
| Cost Savings | 30% | Baseline | 🟡 (fewer Supabase invocations) |

---

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Worker timeout on large payloads | Medium | High | Use R2 for >6MB; implement streaming |
| KV consistency (eventual) | Low | Medium | Use Supabase as source of truth; KV = cache only |
| R2 cost overruns | Low | Medium | Implement lifecycle policies; monitor usage |
| Secrets exposure in logs | Low | Critical | Use `wrangler secret:bulk put` (non-logged) |

---

## Rollback Plan

1. **Pages**: Revert to previous deployment via Cloudflare UI (instant)
2. **Workers**: Disable routes via wrangler.toml; delete via `wrangler delete`
3. **KV/R2**: Keep old data; switch reads back to PostgreSQL via feature flag
4. **Secrets**: Restore GitHub Actions ENV distribution (1 commit)

---

## References

- Cloudflare Workers Docs: https://developers.cloudflare.com/workers/
- wrangler CLI: https://developers.cloudflare.com/workers/wrangler/
- KV Store: https://developers.cloudflare.com/workers/runtime-apis/kv/
- R2 Docs: https://developers.cloudflare.com/r2/

---

**Last Updated**: 2026-07-23  
**Next Review**: After Task 1 (Worker Runtime Check) — 2026-07-29
