# Phase 3: Cloudflare Infrastructure Modernization — Step-by-Step Roadmap

**Status**: Ready for execution (Sequential steps 1→2→3→4)

User instruction: _"1 dann 2 dann 3 dann 4"_ (execute in order, no parallelization)

---

## STEP 1: Enable R2 in Cloudflare Dashboard (5 minutes)

### Action
Navigate to Cloudflare Dashboard → Storage → R2 → **Create bucket**

### Confirmation Checklist
- [ ] R2 service is now active (dashboard shows "R2" in Storage menu)
- [ ] No service enablement errors
- [ ] Ready to proceed to Step 2

---

## STEP 2: Create Evidence Vault Bucket (10 minutes)

### Bucket Configuration
```
Name:              realsyncdynamics-evidence-vault
Region:            EMEA (EU Compliance)
Versioning:        Enabled
Lifecycle Policy:  7-year retention (DSGVO compliance)
```

### Lifecycle Rule Configuration
In R2 bucket settings → Lifecycle rules:
```
Condition: Object age > 2557 days (7 years)
Action: Delete the object
```

### Required Tokens
- [ ] Create API token with R2 read/write permission
- [ ] Token name: `realsyncdynamics-evidence-vault-api`
- [ ] Store token securely (will be used in Step 3)

### Folder Structure
Evidence uploaded to bucket will follow:
```
tenant/{tenant_id}/{evidence_type}/{year}/{month}/{filename}
```

### Confirmation Checklist
- [ ] Bucket created with correct name
- [ ] Versioning enabled
- [ ] Lifecycle rule set (7-year deletion)
- [ ] API token generated and stored
- [ ] Ready to proceed to Step 3

---

## STEP 3: Deploy Evidence Vault Edge Function (20 minutes)

### Function Implementation
Create `supabase/functions/evidence-vault-r2/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface UploadRequest {
  tenant_id: string;
  evidence_type: string;
  filename: string;
  content: string;
  mime_type: string;
}

interface EvidenceResponse {
  success: boolean;
  message: string;
  object_url?: string;
  error?: string;
}

async function uploadToR2(
  request: UploadRequest,
  r2Bucket: R2Bucket
): Promise<EvidenceResponse> {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");

    const key = `tenant/${request.tenant_id}/${request.evidence_type}/${year}/${month}/${request.filename}`;

    const buffer = new TextEncoder().encode(request.content);

    await r2Bucket.put(key, buffer, {
      httpMetadata: {
        contentType: request.mime_type,
      },
      customMetadata: {
        "uploaded-at": new Date().toISOString(),
        "tenant-id": request.tenant_id,
      },
    });

    return {
      success: true,
      message: `Evidence stored at ${key}`,
      object_url: `https://realsyncdynamics-evidence-vault.r2.cloudflarestorage.com/${key}`,
    };
  } catch (error) {
    return {
      success: false,
      message: "Failed to upload evidence",
      error: error.message,
    };
  }
}

async function retrieveFromR2(
  tenant_id: string,
  evidence_type: string,
  filename: string,
  r2Bucket: R2Bucket
): Promise<EvidenceResponse> {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");

    const key = `tenant/${tenant_id}/${evidence_type}/${year}/${month}/${filename}`;

    const object = await r2Bucket.get(key);

    if (!object) {
      return {
        success: false,
        message: "Evidence not found",
        error: "Object does not exist",
      };
    }

    const content = await object.text();

    return {
      success: true,
      message: "Evidence retrieved",
      object_url: `https://realsyncdynamics-evidence-vault.r2.cloudflarestorage.com/${key}`,
    };
  } catch (error) {
    return {
      success: false,
      message: "Failed to retrieve evidence",
      error: error.message,
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const r2Bucket = Deno.env.get("EVIDENCE_VAULT_BUCKET") as unknown as R2Bucket;

  if (!r2Bucket) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "R2 bucket binding not configured",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const url = new URL(req.url);

    if (req.method === "POST" && url.pathname === "/api/evidence/upload") {
      const payload = (await req.json()) as UploadRequest;
      const result = await uploadToR2(payload, r2Bucket);
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET" && url.pathname === "/api/evidence/retrieve") {
      const tenant_id = url.searchParams.get("tenant_id");
      const evidence_type = url.searchParams.get("evidence_type");
      const filename = url.searchParams.get("filename");

      if (!tenant_id || !evidence_type || !filename) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Missing required query parameters",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const result = await retrieveFromR2(
        tenant_id,
        evidence_type,
        filename,
        r2Bucket
      );
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: false, error: "Endpoint not found" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
```

### Update wrangler.toml
Add R2 binding:
```toml
[[r2_buckets]]
binding = "EVIDENCE_VAULT_BUCKET"
bucket_name = "realsyncdynamics-evidence-vault"
```

### Deploy Function
```bash
supabase functions deploy evidence-vault
```

### Test Upload (curl)
```bash
curl -X POST https://your-project.supabase.co/functions/v1/evidence-vault/api/evidence/upload \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "tenant_id": "org_test",
    "evidence_type": "governance_decision",
    "filename": "decision_2026_09_27.pdf",
    "content": "Base64EncodedPDFContent...",
    "mime_type": "application/pdf"
  }'
```

### Test Retrieval (curl)
```bash
curl "https://your-project.supabase.co/functions/v1/evidence-vault/api/evidence/retrieve?tenant_id=org_test&evidence_type=governance_decision&filename=decision_2026_09_27.pdf" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### Confirmation Checklist
- [ ] Edge function created at `supabase/functions/evidence-vault-r2/index.ts`
- [ ] R2 binding added to wrangler.toml
- [ ] Function deployed successfully
- [ ] Upload endpoint tested (curl returns success)
- [ ] Retrieval endpoint tested (curl returns object_url)
- [ ] Ready to proceed to Step 4

---

## STEP 4: Cloudflare Workers Migration Sprint (4 weeks)

### Week 1: Architecture & Planning
**Days 1-2: Design Phase**
- [ ] Define worker routing strategy (governance-core functions)
- [ ] Document middleware stack (auth, rate-limiting, request signing, logging)
- [ ] Plan function-by-function migration order (start with least-critical)
- [ ] Review Cloudflare Workers pricing model vs Edge Functions

**Days 3-5: Implementation Planning**
- [ ] Create workers/* directory structure
- [ ] Draft middleware architecture (TypeScript interfaces)
- [ ] Define KV schema for audit logging (7-day retention)
- [ ] Plan rate-limiting buckets per endpoint

**Success Criteria**: Architecture document approved, middleware interfaces defined

### Week 2: Middleware Stack Implementation
**Days 1-2: Auth Middleware**
```typescript
// middleware/auth.ts
export async function authMiddleware(
  request: Request,
  context: ExecutionContext
): Promise<Response | null> {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }
  // Validate JWT with Supabase
  const verified = await verifyJWT(token);
  if (!verified) return new Response("Invalid token", { status: 403 });
  return null; // Continue to next middleware
}
```

**Days 2-3: Rate-Limiting Middleware**
```typescript
// middleware/rate-limit.ts
interface RateLimitBucket {
  endpoint: string;
  tenant_id: string;
  limit: number;
  window_seconds: number;
}

export async function rateLimitMiddleware(
  request: Request,
  kv: KVNamespace,
  buckets: RateLimitBucket[]
): Promise<Response | null> {
  const bucket = buckets.find(
    (b) => b.endpoint === new URL(request.url).pathname
  );
  if (!bucket) return null;

  const key = `ratelimit:${bucket.tenant_id}:${bucket.endpoint}`;
  const current = (await kv.get(key, "json")) || { count: 0 };

  if (current.count >= bucket.limit) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
    });
  }

  current.count++;
  await kv.put(
    key,
    JSON.stringify(current),
    { expirationTtl: bucket.window_seconds },
    "json"
  );

  return null;
}
```

**Days 4-5: Request Signing & Logging Middleware**
```typescript
// middleware/signing.ts
import { hmac } from "https://deno.land/std@0.168.0/crypto/mod.ts";

export function generateRequestSignature(
  method: string,
  path: string,
  timestamp: string,
  nonce: string,
  secret: string
): string {
  const data = `${method}:${path}:${timestamp}:${nonce}`;
  return btoa(hmac("sha256", secret, data));
}

// middleware/logging.ts
export async function loggingMiddleware(
  request: Request,
  kv: KVNamespace,
  requestId: string
): Promise<void> {
  const logEntry = {
    request_id: requestId,
    method: request.method,
    path: new URL(request.url).pathname,
    timestamp: new Date().toISOString(),
    ip: request.headers.get("cf-connecting-ip"),
  };

  await kv.put(
    `audit:${requestId}`,
    JSON.stringify(logEntry),
    { expirationTtl: 604800 }, // 7 days
    "json"
  );
}
```

**Success Criteria**: All middleware compiles, unit tests pass, KV operations verified

### Week 3: Function Migration & Canary Deployment
**Days 1-2: Migrate governance-core functions**
- [ ] Port `functions/governance-policy-evaluate` → `workers/governance-policy-evaluate.ts`
- [ ] Port `functions/governance-audit-log` → `workers/governance-audit-log.ts`
- [ ] Port `functions/cache-invalidate` → `workers/cache-invalidate.ts`
- [ ] Add middleware chain to each worker function

**Days 3-4: Deploy 10% Canary**
```toml
# wrangler-workers.toml
[[env.canary.routes]]
pattern = "https://api.realsyncdynamicsai.de/api/governance/*"
zone_name = "realsyncdynamicsai.de"
custom_domain = false

# Route 10% traffic to workers
```

- [ ] Deploy workers with 10% traffic split
- [ ] Monitor error rates (target: <0.1%)
- [ ] Monitor latency (target: <5ms overhead)
- [ ] Check KV audit logs for anomalies

**Days 5: Validation**
- [ ] Generate load test report (1000 RPS for 5 minutes)
- [ ] Verify auth failures = 0
- [ ] Verify rate limiting triggers correctly
- [ ] Document edge cases found

**Success Criteria**: Canary at 10%, no errors, latency <5ms, audit logs clean

### Week 4: Progressive Rollout & Cutover
**Days 1: Increase to 25%**
- [ ] Update routing rule: 25% traffic
- [ ] Monitor for 2 hours
- [ ] Check dashboards (Cloudflare Analytics, KV logs)

**Days 2: Increase to 50%**
- [ ] Update routing rule: 50% traffic
- [ ] Run secondary load test (2000 RPS)
- [ ] Verify cache hit rates

**Days 3: Increase to 75%**
- [ ] Update routing rule: 75% traffic
- [ ] Monitor for 4 hours
- [ ] Prepare rollback plan (revert routing, revert wrangler.toml)

**Days 4: Go to 100%**
- [ ] Update routing rule: 100% traffic
- [ ] Final monitoring (8 hours)
- [ ] Document any issues

**Day 5: Post-Deployment**
- [ ] Decommission Edge Functions (keep for 1 week as fallback)
- [ ] Archive old function code
- [ ] Update deployment docs
- [ ] Run final smoke tests

### Rollback Procedure
If any issue detected:
```bash
# Revert routing to Edge Functions (instant)
wrangler deployments rollback

# Check KV audit logs for the failure
curl https://api.realsyncdynamicsai.de/api/audit-logs \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"since": "1 hour ago"}'

# Fix the issue in workers code
# Re-deploy and resume progressive rollout
```

**Success Criteria**:
- [ ] 100% traffic on Workers (governance functions)
- [ ] Error rate remains <0.1%
- [ ] Latency remains <5ms overhead
- [ ] All 7-day audit logs clean
- [ ] Edge Functions fully decommissioned

---

## Overall Status

| Phase | Status | Timeline |
|-------|--------|----------|
| 1: Enable R2 | ⏳ Ready | 5 min |
| 2: Create Bucket | ⏳ Ready | 10 min |
| 3: Deploy Function | ⏳ Ready | 20 min |
| 4: Worker Migration | 📋 Planned | 4 weeks |

**Total Path to Completion**: ~4 weeks + 35 minutes

---

## Approval Gate

✅ **User approved sequential execution** ("1 dann 2 dann 3 dann 4")

Next action: Execute Step 1 (Enable R2)
