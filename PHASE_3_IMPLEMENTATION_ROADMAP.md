# Phase 3: Complete Implementation Roadmap

**Status:** 🚀 Ready to Execute  
**Date:** 2026-07-23  
**Timeline:** 4 weeks  
**Owner:** Development Team

---

## STEP 1: Enable R2 in Cloudflare Dashboard ⏱️ ~5 minutes

### Actions

1. **Open Cloudflare Dashboard**
   - URL: https://dash.cloudflare.com
   - Login with account credentials

2. **Navigate to R2**
   - Left sidebar → **R2**
   - Should show "Enable R2" button (or "Create bucket" if already enabled)

3. **Click "Enable R2"**
   - Select pricing plan (as needed)
   - Confirm enablement
   - Wait for activation (usually instant)

4. **Verify Enablement**
   - Dashboard shows "Create bucket" option
   - Ready for Step 2

### Expected Outcome
✅ R2 is enabled and ready for bucket creation

---

## STEP 2: Create Evidence Vault Bucket ⏱️ ~10 minutes

### Actions

1. **Create Bucket**
   - From R2 dashboard → Click "Create bucket"
   - Name: `realsyncdynamics-evidence-vault`
   - Region: **EMEA** (EU data residency for DSGVO)
   - Public access: **Disabled** (private)
   - Click "Create bucket"

2. **Configure Bucket Settings**
   - Go to bucket → Settings
   - Enable **Versioning** (immutable history)
   - Enable **Object Lock** (optional, for compliance)

3. **Set Lifecycle Policy**
   - Settings → Lifecycle rules
   - Create rule:
     - **Name:** Archive Evidence
     - **Apply to:** All objects
     - **Action:** Retain for 7 years
     - **Automatic expiration:** 7 years (2555 days)
     - **Reason:** DSGVO Article 5 (storage limitation) + Article 17 (right to be forgotten)

4. **Create API Token**
   - R2 → API tokens
   - Create token with:
     - Permissions: Read + Write
     - Resources: `realsyncdynamics-evidence-vault`
     - TTL: No expiration

5. **Store Credentials**
   - Note: Account ID
   - Note: API Token
   - Note: Bucket name

### Expected Outcome
✅ R2 bucket created, lifecycle policies configured, credentials stored

---

## STEP 3: Deploy Evidence Vault Edge Function ⏱️ ~20 minutes

### Actions

1. **Create Evidence Upload Function**

```bash
# Create directory
mkdir -p supabase/functions/evidence-vault

# Copy template (see below)
# File: supabase/functions/evidence-vault/index.ts
```

```typescript
// supabase/functions/evidence-vault/index.ts
// Evidence vault upload and retrieval endpoint

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface EvidenceUploadRequest {
  tenant_id: string;
  evidence_type: "audit" | "policy-eval" | "compliance-report";
  year: number;
  month: number;
  filename: string;
  content: string;
  metadata: {
    retention_years: number;
    compliance_class: string;
    encrypted: boolean;
    hash?: string;
  };
}

serve(async (req: Request, { EVIDENCE_VAULT }) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "POST") {
    try {
      const payload: EvidenceUploadRequest = await req.json();

      // Validate input
      if (!payload.tenant_id || !payload.evidence_type || !payload.filename) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Build S3-compatible path
      const path = `tenant/${payload.tenant_id}/${payload.evidence_type}/${payload.year}/${String(payload.month).padStart(2, "0")}/${payload.filename}`;

      // Upload to R2
      await EVIDENCE_VAULT.put(path, payload.content, {
        customMetadata: {
          tenant_id: payload.tenant_id,
          retention_years: String(payload.metadata.retention_years),
          compliance_class: payload.metadata.compliance_class,
          encrypted: String(payload.metadata.encrypted),
          uploaded_at: new Date().toISOString(),
          hash: payload.metadata.hash || "",
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          path,
          size: payload.content.length,
          timestamp: new Date().toISOString(),
        }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Upload error:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : "Upload failed",
        }),
        { status: 500, headers: corsHeaders }
      );
    }
  }

  if (req.method === "GET") {
    try {
      const url = new URL(req.url);
      const path = url.searchParams.get("path");

      if (!path) {
        return new Response(JSON.stringify({ error: "Missing path parameter" }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      // Retrieve from R2
      const object = await EVIDENCE_VAULT.get(path);
      if (!object) {
        return new Response(JSON.stringify({ error: "Not found" }), {
          status: 404,
          headers: corsHeaders,
        });
      }

      return new Response(await object.text(), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "private, no-cache",
        },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: "Retrieval failed" }),
        { status: 500, headers: corsHeaders }
      );
    }
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
});
```

2. **Update wrangler.toml**

Add R2 binding to `wrangler.toml`:

```toml
[[r2_buckets]]
binding = "EVIDENCE_VAULT"
bucket_name = "realsyncdynamics-evidence-vault"
jurisdiction = "eu"
```

3. **Deploy Function**

```bash
supabase functions deploy evidence-vault
```

4. **Test Upload**

```bash
curl -X POST https://realsyncdynamics-ai.supabase.co/functions/v1/evidence-vault \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPABASE_KEY" \
  -d '{
    "tenant_id": "test-123",
    "evidence_type": "audit",
    "year": 2026,
    "month": 7,
    "filename": "audit-scan-2026-07-23.json",
    "content": "{\"scan\": \"data\"}",
    "metadata": {
      "retention_years": 7,
      "compliance_class": "DSGVO_CRITICAL",
      "encrypted": true
    }
  }'
```

### Expected Outcome
✅ Evidence vault edge function deployed and tested

---

## STEP 4: Begin Worker Migration Sprint ⏱️ 4 weeks

### Week 1: Architecture & Design

**Tasks:**
- [ ] Set up `wrangler-workers.toml` (separate from Pages config)
- [ ] Design middleware stack (auth, rate-limiting, signing, logging)
- [ ] Create middleware modules directory
- [ ] Define routing architecture
- [ ] Document API contracts

**Deliverables:**
- `wrangler-workers.toml` configured
- Middleware module stubs created
- Route definition document

### Week 2: Middleware Implementation

**Tasks:**
- [ ] Implement auth middleware (JWT validation with Supabase)
- [ ] Implement rate-limiting middleware (per-tenant quotas)
- [ ] Implement request signing middleware (HMAC)
- [ ] Implement logging middleware (KV audit trail)
- [ ] Unit test all middleware
- [ ] Deploy to staging

**Deliverables:**
- All middleware modules complete
- Unit tests passing
- Staging deployment ready

### Week 3: Function Migration

**Tasks:**
- [ ] Migrate governance-core functions to Workers
- [ ] Update edge functions to accept signed requests
- [ ] Implement request routing in Workers
- [ ] Deploy to staging
- [ ] Route 10% production traffic to Workers
- [ ] Monitor error rates and latency

**Deliverables:**
- governance-core functions migrated
- 10% traffic on Workers
- Metrics dashboard set up

### Week 4: Testing & Rollout

**Tasks:**
- [ ] Load test (1000 RPS)
- [ ] Canary deployment: 25% traffic
- [ ] Canary deployment: 50% traffic
- [ ] Full rollout: 100% traffic
- [ ] Performance validation
- [ ] Documentation update
- [ ] Rollback plan verification

**Deliverables:**
- 100% traffic on Workers
- All metrics green
- Rollback plan tested
- Documentation updated

### Success Criteria

✅ All governance-core functions running on Workers  
✅ <5ms latency overhead  
✅ 0 auth failures in production  
✅ Rate limiting working (test with spike)  
✅ Request signing verified  
✅ Audit logs complete in KV  
✅ Rollback tested  

---

## Detailed Week-by-Week Execution Plan

### Week 1 Checklist

**Monday-Tuesday: Architecture**
- [ ] Create `wrangler-workers.toml` from template
- [ ] Define middleware stack order
- [ ] Create middleware module structure

**Wednesday-Thursday: Design**
- [ ] Document API contracts
- [ ] Design routing rules
- [ ] Plan function migration order

**Friday: Setup & Review**
- [ ] Review design with team
- [ ] Set up staging environment
- [ ] Prepare deployment pipeline

### Week 2 Checklist

**Monday-Wednesday: Auth Middleware**
- [ ] Implement JWT validation
- [ ] Integrate with Supabase
- [ ] Unit tests
- [ ] Error handling

**Wednesday-Friday: Other Middleware**
- [ ] Rate limiting (Redis/KV-based)
- [ ] Request signing (HMAC)
- [ ] Logging (KV audit trail)
- [ ] Unit tests for all

### Week 3 Checklist

**Monday-Tuesday: Function Migration**
- [ ] Identify governance-core functions
- [ ] Create Workers handlers for each
- [ ] Route requests to handlers
- [ ] Testing

**Wednesday-Thursday: Staging Deploy**
- [ ] Deploy to staging
- [ ] Full integration testing
- [ ] Performance baseline

**Friday: Canary (10%)**
- [ ] Deploy to production
- [ ] Route 10% traffic
- [ ] Monitor metrics
- [ ] Check error logs

### Week 4 Checklist

**Monday-Tuesday: Load Testing**
- [ ] Run 1000 RPS load test
- [ ] Analyze results
- [ ] Fix any bottlenecks

**Wednesday: Canary (50%)**
- [ ] Route 50% traffic to Workers
- [ ] Monitor latency, errors
- [ ] Verify rate limiting

**Thursday-Friday: Full Rollout**
- [ ] Route 100% traffic to Workers
- [ ] Final validation
- [ ] Update documentation
- [ ] Celebrate! 🎉

---

## Deployment Checklist

### Before Starting Week 1
- [ ] R2 bucket created and configured (Step 2 ✅)
- [ ] Evidence vault function deployed (Step 3 ✅)
- [ ] KV namespace ready (Phase 3A ✅)
- [ ] Team briefed on 4-week timeline
- [ ] Staging environment ready

### Before Staging Deploy (End of Week 2)
- [ ] All middleware unit tests pass
- [ ] Code review completed
- [ ] Documentation reviewed
- [ ] Staging secrets configured

### Before Production Deploy (End of Week 3)
- [ ] Staging validation passed
- [ ] Rollback plan tested
- [ ] Monitoring dashboard set up
- [ ] On-call schedule arranged

### Before Full Rollout (End of Week 4)
- [ ] Load test passed
- [ ] Canary metrics green
- [ ] Documentation complete
- [ ] Team trained on new system

---

## Monitoring & Alerting

### Metrics to Track

During canary deployment:
```
- Request latency (p50, p95, p99)
- Error rate (% failed requests)
- Rate limit rejections
- Auth failures
- Cache hit ratio
- Tenant request distribution
```

### Alert Thresholds

- Latency p99 > 100ms → Page on-call
- Error rate > 1% → Page on-call
- Auth failures > 10/min → Page on-call
- Rate limit spikes → Log and analyze

---

## Rollback Procedure

If Worker migration fails at any point:

1. **Immediate Actions**
   ```bash
   # Pause Workers routing
   # All traffic goes back to edge functions
   # Run: revert wrangler.toml route config
   ```

2. **Diagnosis**
   - Check KV audit logs for request patterns
   - Analyze error logs
   - Review middleware logs

3. **Fix & Redeploy**
   - Fix identified issues
   - Deploy to staging
   - Verify fix works
   - Redeploy to production

4. **Resume Canary**
   - Route 10% traffic again
   - Monitor for same errors
   - Proceed if clean

---

## Files to Create/Update

**Week 1:**
- `wrangler-workers.toml` (new)
- `src/workers/middleware/auth.ts` (new)
- `src/workers/middleware/rate-limit.ts` (new)
- `src/workers/middleware/request-signing.ts` (new)
- `src/workers/middleware/logging.ts` (new)

**Week 3:**
- `src/workers/handlers/governance.ts` (new)
- `src/workers/routes.ts` (new)

**Week 4:**
- Update documentation
- Update deployment pipeline

---

## Questions & Support

For questions during implementation, refer to:
- `PHASE_3_WORKER_MIGRATION_B1.md` — Detailed technical guide
- `PHASE_3_CLOUDFLARE_OPTIMIZATION.md` — Overall strategy
- `CLEANUP_STATUS.md` — Current progress

---

## Timeline Summary

| Step | Duration | Status |
|------|----------|--------|
| 1: Enable R2 | 5 min | 📋 To Do |
| 2: Create Bucket | 10 min | 📋 To Do |
| 3: Deploy Evidence Function | 20 min | 📋 To Do |
| 4: Worker Migration Sprint | 4 weeks | 📋 To Do |

**Total time to completion:** ~4 weeks + 35 minutes

**Status:** Ready to execute. All documentation, code templates, and planning complete.

🚀 **Proceed to Step 1 when ready.**
