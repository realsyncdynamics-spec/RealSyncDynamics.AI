# Runbook: Website Generation Failure

**Severity:** High  
**Component:** `website-operations-agent` Edge Function  
**SLA:** Recovery within 30 minutes  

---

## Symptoms

Users report:
- Website generation stuck at "Generating..." for >20 seconds
- "Generation failed" error message
- No project created in dashboard
- Deployment logs showing `build: failed` status

Metrics:
- Error rate > 5% over 5-minute window
- `website-generation` circuit breaker in OPEN state
- P95 response time > 15 seconds

---

## Root Causes

### 1. Claude AI API Timeout (Most Common — 60%)
- Anthropic API rate limiting
- Network latency > 10 seconds
- Model overload during peak hours

**Check:** Sentry dashboard → `website-operations-agent` → Recent errors

### 2. Database Connection Failure (20%)
- PostgreSQL connection pool exhausted
- RLS policy blocking query
- Supabase instance down

**Check:** Supabase dashboard → Database → Connection Pool

### 3. Invalid Input Data (10%)
- Malformed JSON in request
- Missing required fields
- Unicode/encoding issues

### 4. Cloudflare Deployment Error (10%)
- R2 bucket full
- Pages project limits exceeded
- API authentication expired

---

## Diagnosis

### Step 1: Check Sentry for Error Logs
```bash
# Visit: https://sentry.io/dashboard/
# Project: RealSyncDynamics.AI
# Filter: web operations-agent
# Look for: Stack trace, context.userId, details
```

**What to look for:**
- `ANTHROPIC_API_TIMEOUT` — AI provider issue
- `DB_CONNECTION_TIMEOUT` — Database issue
- `INVALID_REQUEST` — Input validation issue
- `CLOUDFLARE_ERROR` — Deployment issue

### Step 2: Check Circuit Breaker Status
```typescript
// In browser console or monitoring dashboard:
const status = globalErrorMonitor.checkThreshold('website-generation');
// Should return: { exceeded: false, threshold: ... }
// If exceeded: true, circuit breaker is OPEN
```

### Step 3: Check Supabase Health
```sql
-- Verify database connection pool
SELECT
  datname, usename, application_name, state, state_change
FROM pg_stat_activity
WHERE datname = 'postgres'
ORDER BY state_change DESC
LIMIT 10;

-- Check RLS policies
SELECT schemaname, tablename, policyname, qual
FROM pg_policies
WHERE tablename = 'website_projects'
ORDER BY policyname;
```

### Step 4: Test API Manually
```bash
curl -X POST https://api.example.com/functions/v1/website-operations-agent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "tenant_id": "test-tenant-uuid",
    "industry": "tattoo-studio",
    "company_name": "Test Studio",
    "description": "Test description"
  }'

# Expected response (success):
# { "success": true, "data": { "project_id": "...", "html": "...", ... } }

# Expected response (failure):
# { "error": "...", "requestId": "...", "timestamp": "..." }
```

### Step 5: Check Claude API Status
```bash
# Visit: https://status.anthropic.com/
# Look for incidents or degraded service
# Check API key validity: https://console.anthropic.com/

# Or call Claude API directly:
curl https://api.anthropic.com/v1/models \
  -H "x-api-key: $ANTHROPIC_API_KEY" 2>&1 | head -20
```

---

## Resolution

### If Circuit Breaker is OPEN (failureThreshold=5 reached)

**Immediate action:**
```typescript
// In Edge Function or admin tool:
const breaker = new CircuitBreaker(...);
breaker.reset(); // Transitions to: CLOSED
```

**Root cause analysis:**
1. ✓ Fix underlying issue (see below)
2. ✓ Reset circuit breaker
3. ✓ Test with single request
4. ✓ Monitor for 30 minutes

### If AI API is Timing Out

**Option 1: Increase Timeout (5 min)**
```typescript
// supabase/functions/website-operations-agent/index.ts
const AI_TIMEOUT_MS = 30000; // was 10000
await Promise.race([
  generateWithAI(body),
  timeoutPromise(AI_TIMEOUT_MS)
]);
```

**Option 2: Use Fallback Template (Immediate)**
```typescript
// If AI times out, generate from template instead
const html = await withFallback(
  () => generateWithAI(body),
  () => loadTemplateHTML(body.industry)
);
```

**Option 3: Queue Generation Request**
```typescript
// Defer generation to background job
await queue.add(
  () => generateWithAI(body),
  { priority: 'normal' }
);
return { success: true, queued: true, projectId };
```

### If Database Connection is Failing

**Check connection pool:**
```sql
-- Increase max connections
ALTER SYSTEM SET max_connections = 300;
SELECT pg_reload_conf();

-- Kill idle connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
AND query_start < now() - interval '10 minutes';
```

**Verify RLS policies:**
```sql
-- Test RLS with specific user
SET ROLE "authenticated";
SET claim.sub = 'user-uuid';

SELECT * FROM website_projects
WHERE tenant_id = 'tenant-uuid'
LIMIT 1;
```

### If Input Validation is Failing

**Test input validation:**
```typescript
import { sanitizeProjectName, validateDomain } from '@/lib/security';

const { value, error } = sanitizeProjectName(input);
if (error) console.error('Validation error:', error);
```

**Add detailed error logging:**
```typescript
if (!body.tenant_id) {
  logOperation('error', 'Missing tenant_id', context, {
    receivedBody: sanitizeForLogging(body),
  });
  return errorResponse(400, 'tenant_id required');
}
```

### If Cloudflare Deployment is Failing

**Check Cloudflare status:**
```bash
# Visit: https://www.cloudflarestatus.com/
# Check: Pages, R2, API

# Test Cloudflare API:
curl -X GET https://api.cloudflare.com/client/v4/user \
  -H "Authorization: Bearer $CF_API_TOKEN"
```

**Check R2 bucket:**
```bash
# List R2 bucket size
wrangler r2 bucket list --binding R2_BUCKET

# Check quota
# Cloudflare dashboard → R2 → Settings → Billing
```

---

## Verification

**After applying fix:**

1. ✓ Circuit breaker status: `closed`
2. ✓ Recent error count: 0 for >5 min
3. ✓ Manual API test: Success
4. ✓ P95 response time: <2 seconds
5. ✓ Error rate: <1% over 5 minutes

**Test with sample request:**
```bash
curl -X POST $BASE_URL/functions/v1/website-operations-agent \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"tenant_id":"...","industry":"tattoo-studio",...}'

# Should return 200 with generated website
```

---

## Prevention

### Short-term (This Sprint)
- ✓ Add circuit breaker logging to Sentry
- ✓ Set error rate alerts at 3% threshold
- ✓ Add timeout monitoring to dashboard

### Medium-term (Next Sprint)
- ✓ Implement request queue with priority
- ✓ Add database connection pooling
- ✓ Cache generated templates for fast fallback

### Long-term (Roadmap)
- ✓ Multi-region deployment (CDN edge generation)
- ✓ Alternative AI providers (fallback to Llama/Mistral)
- ✓ Machine learning-based anomaly detection
- ✓ Predictive scaling based on load patterns

---

## Related Runbooks

- [Cloudflare Deployment Stuck](cloudflare-deployment-stuck.md)
- [Domain SSL Not Provisioning](domain-ssl-not-provisioning.md)
- [Rate Limit Exceeded](rate-limit-exceeded.md)

---

## Contacts & Escalation

**On-call Engineer:** Check PagerDuty rotation  
**Claude AI Support:** https://www.anthropic.com/support  
**Cloudflare Support:** https://support.cloudflare.com/  
**Supabase Support:** https://supabase.com/support

---

**Last Updated:** 2026-07-17  
**Owner:** Platform Team  
**Review Date:** 2026-08-17
