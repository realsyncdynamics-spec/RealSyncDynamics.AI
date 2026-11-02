# Phase 2b Staging & Production Rollout Runbook

**Timeline**: Days 13-21 (August 10-18, 2026)  
**Owner**: Engineering Team  
**Escalation**: On-Call Engineer → Manager → VP Eng

---

## Overview

This runbook guides deployment of Phase 2b Cloudflare Workers optimization through three stages:
1. **Staging Validation** (Days 13-15): Full load testing in staging environment
2. **Production Canary** (Days 16-18): 5% traffic routing to new Workers
3. **Graduated Rollout** (Days 19-21): Scale from 5% → 100% with monitoring

**Success Criteria**: All metrics stable for 48+ hours at each stage before advancing.

---

## Prerequisites

- [ ] PR #1004 merged to `main`
- [ ] Cloudflare Workers development environment configured
- [ ] Staging environment databases synced from production
- [ ] Monitoring dashboards created (Sentry + Cloudflare Analytics)
- [ ] On-call rotation notified of 8-day rollout window
- [ ] k6 load testing environment available
- [ ] Slack channels ready for automated alerts

---

## Stage 1: Staging Validation (Days 13-15)

### Day 13: Environment Setup & Deployment

**Morning (08:00-09:00 UTC)**

1. **Verify staging environment**
   ```bash
   # Check staging Workers environment exists
   wrangler environments list --env staging
   
   # Verify KV namespace bindings
   wrangler kv:namespace list --env staging
   # Expected: POLICY_CACHE, SESSION_CACHE, ANALYTICS_ENGINE
   
   # Verify R2 bucket bindings
   wrangler r2 bucket list --env staging
   # Expected: EVIDENCE_VAULT staging bucket
   ```

2. **Deploy to staging**
   ```bash
   # Build Workers
   wrangler publish --env staging
   
   # Verify deployment
   wrangler deployments list --env staging
   # Expected: Latest deployment timestamp matches current time
   ```

3. **Health check**
   ```bash
   curl -X GET https://staging-workers.realsyncdynamicsai.de/health
   # Expected: 200 OK with endpoint list
   ```

4. **Verify observability setup**
   - [ ] Sentry project created (Staging environment)
   - [ ] SENTRY_DSN secret set in Cloudflare
   - [ ] Cloudflare Analytics Engine enabled
   - [ ] Alert rules configured (non-production)

**Afternoon (14:00-16:00 UTC)**

5. **Prime cache in staging**
   ```bash
   # Pre-load KV cache with 100 sample policies
   npm run scripts:cache-preload -- --env staging
   
   # Verify cache entries
   wrangler kv:key list --env staging --namespace-id POLICY_CACHE | head -10
   ```

6. **Create test data in staging Supabase**
   - [ ] 5 test tenants with 20 policies each
   - [ ] Sample evidence vault objects (R2)
   - [ ] JWT test tokens (valid + expired)

**Log Check**: No errors in Cloudflare Workers logs
- [ ] Deployments succeeded
- [ ] Health check returned 200
- [ ] Cache pre-load completed

---

### Day 14: Load Testing

**Morning (08:00-12:00 UTC)**

1. **JWT Verification Load Test**
   ```bash
   # 100 req/sec sustained, 80% valid / 20% error cases
   k6 run scripts/k6-verify-jwt-load.js \
     --vus 50 \
     --duration 10m \
     --env BASE_URL=https://staging-workers.realsyncdynamicsai.de \
     --env BEARER_TOKEN=$(cat .env.staging | grep JWT_TOKEN | cut -d= -f2)
   
   # Success criteria
   # - p50 latency: <30ms ✓
   # - p95 latency: <50ms ✓
   # - p99 latency: <100ms ✓
   # - Error rate: <0.5% ✓
   ```

   **If failures**:
   - [ ] Check Sentry for error patterns
   - [ ] Review Cloudflare analytics: any 5xx errors?
   - [ ] Verify JWT_SECRET matches production
   - [ ] Check token expiry logic

2. **KV Cache Load Test**
   ```bash
   # 50 VUs, 85% reads / 10% invalidate / 5% bulk
   k6 run scripts/k6-kv-cache-load.js \
     --vus 50 \
     --duration 10m \
     --env BASE_URL=https://staging-workers.realsyncdynamicsai.de \
     --env BEARER_TOKEN=$(cat .env.staging | grep JWT_TOKEN | cut -d= -f2)
   
   # Success criteria
   # - Cache hit rate: >80% ✓
   # - Hit latency p95: <20ms ✓
   # - Miss latency p95: <1000ms ✓
   # - Error rate: <0.5% ✓
   ```

   **If hit rate <80%**:
   - [ ] Cache entries expired? (Check TTL = 5 min)
   - [ ] Invalidation triggering too often?
   - [ ] Pre-load cache again if needed

3. **R2 Evidence Vault Load Test**
   ```bash
   # 30 VUs, 80% ingest / 10% retrieve / 10% export
   k6 run scripts/k6-evidence-vault-load.js \
     --vus 30 \
     --duration 10m \
     --env BASE_URL=https://staging-workers.realsyncdynamicsai.de \
     --env BEARER_TOKEN=$(cat .env.staging | grep JWT_TOKEN | cut -d= -f2)
   
   # Success criteria
   # - R2 write latency p95: <100ms ✓
   # - Dual-write latency p95: <500ms ✓
   # - R2 success rate: >99% ✓
   # - Compliance hold rate: >95% ✓
   ```

   **If R2 writes slow**:
   - [ ] Check R2 bucket region (should be eu-central-1)
   - [ ] Verify IAM permissions on R2 bucket
   - [ ] Check Cloudflare R2 status page

**Afternoon (14:00-18:00 UTC)**

4. **Multi-tenant isolation verification**
   ```bash
   # Run 5 concurrent tenants, verify no cache collisions
   k6 run --script multi-tenant-isolation-test.js \
     --vus 25 \
     --env BASE_URL=https://staging-workers.realsyncdynamicsai.de
   
   # Expected result:
   # ✓ No cross-tenant cache hits
   # ✓ Each tenant sees only own policies
   # ✓ RLS enforced at Supabase layer
   ```

5. **Webhook invalidation verification**
   ```bash
   # Trigger cache invalidation webhook
   curl -X DELETE \
     https://staging-workers.realsyncdynamicsai.de/api/cache/invalidate/tenant-1/policy-1 \
     -H "X-Webhook-Secret: $(cat .env.staging | grep WEBHOOK_SECRET | cut -d= -f2)"
   
   # Verify cache was cleared
   # - Subsequent GET should hit Supabase (MISS)
   # - Latency should be ~300-500ms (RPC call)
   ```

**Report**: Document all k6 results in `staging-results-day14.json`

---

### Day 15: Stability & Security Verification

**Morning (08:00-10:00 UTC)**

1. **Sentry alert verification**
   - [ ] Test JWT error capture: trigger invalid token, verify in Sentry
   - [ ] Test cache error capture: make bad cache key, verify error logged
   - [ ] Test R2 error capture: try to write to non-existent bucket, verify captured
   - Check Sentry dashboard: all alerts should be routing to #engineering Slack

2. **Cloudflare Analytics Engine queries**
   ```bash
   # Verify metrics are flowing to Analytics Engine
   curl -X POST https://api.cloudflare.com/client/v4/graphql/ \
     -H "Authorization: Bearer $CF_API_TOKEN" \
     -d '{"query": "query { viewer { zones(filter: {zoneTag: \"staging.realsyncdynamicsai.de\"}) { analyticsEngine { query(sql: \"SELECT COUNT(*) as total FROM Httplog WHERE Timestamp > now() - interval 1 hour\") } } } }"}'
   
   # Expected: COUNT > 100 (requests from load tests)
   ```

3. **Security audit**
   - [ ] JWT tokens: no plaintext in logs?
   - [ ] Cache keys: properly namespaced by tenant_id?
   - [ ] R2 objects: have immutable lock enabled?
   - [ ] Webhook signature: validating X-Webhook-Secret correctly?

**Afternoon (14:00-16:00 UTC)**

4. **Performance baseline capture**
   ```bash
   # Save staging metrics as baseline for production comparison
   cat > staging-baseline.json <<EOF
   {
     "date": "2026-08-15",
     "jwt_p95_ms": $(k6 ... | grep p95),
     "cache_hit_rate": 0.85,
     "r2_write_p95_ms": 85,
     "dual_write_p95_ms": 420,
     "error_rate": 0.002
   }
   EOF
   
   # Commit to repo
   git add staging-baseline.json
   git commit -m "Baseline: Phase 2b staging metrics (Day 15)"
   git push origin main
   ```

5. **Readiness decision**

   **GO/NO-GO DECISION (16:00 UTC)**

   **GO Criteria** (all must be met):
   - [ ] JWT verification: p95 <50ms ✓
   - [ ] Cache hit rate: >80% ✓
   - [ ] R2 write latency: p95 <100ms ✓
   - [ ] Dual-write latency: p95 <500ms ✓
   - [ ] Error rate: <0.5% ✓
   - [ ] Zero RLS violations detected ✓
   - [ ] Sentry alerts routing correctly ✓
   - [ ] All webhooks working ✓

   **NO-GO Triggers**:
   - Any metric below threshold
   - Sentry alerts not routing
   - RLS violations detected
   - Webhook signature failures

   **Decision**: 
   - [ ] **GO**: Proceed to Production Canary (Day 16)
   - [ ] **NO-GO**: Debug failures, repeat load tests (add 1-2 days)

---

## Stage 2: Production Canary (Days 16-18)

### Day 16: 5% Canary Deployment

**Morning (08:00-09:00 UTC)**

1. **Final staging validation**
   ```bash
   # One more quick health check
   curl -X GET https://staging-workers.realsyncdynamicsai.de/health
   # Expected: 200 OK
   ```

2. **Production environment pre-checks**
   ```bash
   # Verify production Workers config
   wrangler environments list --env production
   
   # Verify production KV/R2 bindings
   wrangler kv:namespace list --env production
   wrangler r2 bucket list --env production
   ```

3. **Canary routing configuration**
   ```toml
   # wrangler-workers.toml - verify canary config
   [env.production.routes]
   # 5% traffic to new Workers route
   pattern = "api.realsyncdynamicsai.de/api/*"
   zone_name = "realsyncdynamicsai.de"
   
   [[env.production.routes.canary]]
   percentage_split = 5  # 5% to new Workers, 95% to origin
   ```

4. **Deploy to production**
   ```bash
   wrangler publish --env production
   
   # Verify deployment
   wrangler deployments list --env production
   ```

5. **Verify canary is active**
   ```bash
   # Make 20 requests, verify ~1 goes through Workers (5%)
   for i in {1..20}; do
     curl -v https://api.realsyncdynamicsai.de/api/auth/verify-jwt \
       -H "Authorization: Bearer test-token" \
       2>&1 | grep -E "X-Canary-Routing|X-Worker-Latency"
   done
   
   # Expected: Some requests show X-Canary-Routing: verify-jwt@5pct
   ```

**Afternoon (14:00-16:00 UTC)**

6. **Real-time monitoring setup**
   - [ ] Sentry dashboards pinned in #engineering Slack
   - [ ] Cloudflare Analytics pinned
   - [ ] On-call engineer monitoring Sentry/Analytics continuously
   - [ ] Alert channels verified (PagerDuty + Slack)

7. **Initial traffic observation (1 hour)**
   ```
   Monitor these metrics every 5 minutes:
   - JWT error rate (target: <0.5%)
   - Cache hit rate (target: >80%, watch for drift)
   - R2 write latency p95 (target: <100ms)
   - Dual-write latency p95 (target: <500ms)
   - Overall 5xx error rate (target: <0.1%)
   ```

   **If metrics look good**: Proceed to 48-hour soak test

**Evening (18:00 UTC onwards)**

8. **Hands-off soak test begins**
   - [ ] Monitor continuously but don't intervene unless critical alert
   - [ ] Rotate on-call engineer every 4 hours
   - [ ] Check metrics every hour: compare vs. staging baseline

---

### Day 17: 48-Hour Soak Test (Continued)

**Throughout Day 17**

1. **Hourly checks** (automated or manual)
   ```bash
   # Every hour, log metrics to file
   cat > canary-metrics-day17.json <<EOF
   {
     "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
     "jwt_error_rate": 0.001,
     "cache_hit_rate": 0.84,
     "r2_write_p95_ms": 82,
     "dual_write_p95_ms": 410,
     "server_error_rate": 0.0005
   }
   EOF
   ```

2. **Alert response procedure**
   
   **IF: JWT error rate >1%**
   - Check Sentry for error patterns
   - Verify JWT_SECRET hasn't changed
   - Check if Supabase token format changed
   - If systematic: **ROLLBACK** (see Rollback section)

   **IF: Cache hit rate drops <70%**
   - Check recent policy updates (invalidation trigger working?)
   - Verify KV namespace still exists
   - Check Supabase RLS policies (were they changed?)
   - Manually warm cache if needed

   **IF: R2 write failures spike >5/5min**
   - Check Cloudflare R2 status page
   - Verify EVIDENCE_VAULT bucket exists
   - Check Supabase RLS on writes
   - If Cloudflare issue: wait for platform recovery
   - If RLS issue: rollback

3. **Success signal** (end of Day 17)
   - [ ] 24+ hours of metrics stable
   - [ ] No Sentry alerts exceeding baseline
   - [ ] All dashboards green
   - [ ] Ready to expand to Day 18 decision point

---

### Day 18: Canary Complete → Decision Point

**Morning (08:00 UTC)**

1. **48-hour aggregate review**
   ```bash
   # Pull all metrics from Cloudflare Analytics
   # Calculate:
   # - p50 / p95 / p99 latency (should match staging)
   # - Error rate trend (should be stable, not increasing)
   # - Cache hit rate trend (should warm up to >80%)
   
   # Save report
   cat > canary-report-48h.md <<EOF
   # 48-Hour Canary Report (5% Traffic)
   
   ## Latency Metrics
   - JWT p95: 48ms (target: <50ms) ✓
   - Cache hit p95: 12ms (target: <20ms) ✓
   - R2 write p95: 88ms (target: <100ms) ✓
   
   ## Reliability
   - Error rate: 0.2% (target: <0.5%) ✓
   - JWT errors: 0 (target: <1%) ✓
   - R2 failures: 0/2000 (target: >99%) ✓
   
   ## Recommendation: GO for graduated rollout
   EOF
   ```

2. **Readiness decision for graduated rollout**

   **GO Criteria** (all must be met for 48+ hours):
   - [ ] Error rate stable and <0.5% ✓
   - [ ] Latency stable and meets targets ✓
   - [ ] No unexpected spikes or patterns ✓
   - [ ] Sentry alert count within normal range ✓
   - [ ] Cache hit rate warmed to >80% ✓
   - [ ] No RLS violations ✓

   **NO-GO Decision**: If any metric unstable, extend canary 1-2 days and debug

**Decision**: 
- [ ] **GO**: Proceed to Graduated Rollout (Day 19)
- [ ] **NO-GO**: Extend canary, fix issues, repeat 48-hour test

---

## Stage 3: Graduated Rollout (Days 19-21)

### Day 19: 5% → 10% → 25%

**Morning (08:00 UTC)** — Scale to 10%

1. **Update wrangler config**
   ```toml
   [[env.production.routes.canary]]
   percentage_split = 10  # 10% to new Workers
   ```

2. **Deploy & verify**
   ```bash
   wrangler publish --env production
   
   # Quick verification: make 10 requests, ~1 should be canary
   for i in {1..10}; do
     curl https://api.realsyncdynamicsai.de/api/health | grep -q X-Worker-Latency && echo "✓ canary"
   done
   ```

3. **Monitor for 2 hours**
   - Watch error rate, cache hit rate, latency p95
   - Any spikes: reverse back to 5% and investigate
   - If stable: proceed to 25%

**Afternoon (14:00 UTC)** — Scale to 25%

4. **Update canary percentage**
   ```toml
   percentage_split = 25  # 25% to new Workers
   ```

5. **Deploy & monitor for 2 hours**

**Evening (18:00 UTC)** — Checkpoint

- [ ] Error rate still <0.5%?
- [ ] Latency still stable?
- [ ] No unexpected patterns in Sentry?

**Checkpoint Decision**:
- [ ] **GO** for next tier tomorrow
- [ ] **HOLD** at 25% if any concerns, debug overnight

---

### Day 20: 25% → 50% → 75%

**Morning (08:00 UTC)** — Scale to 50%

1. **Update canary percentage**
   ```toml
   percentage_split = 50  # 50% to new Workers (load balanced)
   ```

2. **Deploy & monitor 2 hours**
   - This is the first 50-50 split; watch closely
   - Any latency spike >10% vs baseline: rollback
   - Any error rate increase: rollback

**Afternoon (14:00 UTC)** — Scale to 75%

3. **Update canary percentage**
   ```toml
   percentage_split = 75  # 75% to new Workers
   ```

4. **Deploy & monitor 2 hours**

**Evening (18:00 UTC)** — Checkpoint

- [ ] 24+ hours at >50% traffic all stable?
- [ ] Ready for final 100% push tomorrow?

**Checkpoint Decision**:
- [ ] **GO** for 100% tomorrow
- [ ] **HOLD** at 75% if any concerns

---

### Day 21: 100% Rollout → Production Complete

**Morning (08:00 UTC)** — Final scale to 100%

1. **Update canary percentage to 100%**
   ```toml
   percentage_split = 100  # Full production rollout
   ```

2. **Deploy**
   ```bash
   wrangler publish --env production
   
   # Verify all traffic routes through Workers
   for i in {1..5}; do
     curl https://api.realsyncdynamicsai.de/api/health \
       | grep -q X-Worker-Latency && echo "✓ worker routing"
   done
   
   # Expected: All 5 show X-Worker-Latency header
   ```

3. **Monitor intensively for 4 hours**
   - On-call engineer watching Sentry/Analytics
   - Alert channels monitored
   - Any issues: IMMEDIATE ROLLBACK (see section below)

**Afternoon (14:00 UTC)** — Victory lap

4. **Final validation**
   ```bash
   # Pull 24-hour production metrics
   # Verify against staging baseline:
   # - Latency within 5% of staging? ✓
   # - Error rate trending down? ✓
   # - Cache hit rate >85%? ✓
   ```

5. **Celebration & documentation**
   - [ ] Archive all load test results
   - [ ] Update on-call runbook with production Workers procedures
   - [ ] Document any optimizations discovered
   - [ ] Post victory message in #engineering

**Phase 2b Complete** ✅

---

## Rollback Procedure (Any Day)

**IF CRITICAL ISSUES**:

### Immediate Rollback (< 5 minutes)

1. **Stop canary immediately**
   ```toml
   # wrangler-workers.toml
   [[env.production.routes.canary]]
   percentage_split = 0  # Send 0% to new Workers (fallback to origin)
   ```

2. **Deploy rollback**
   ```bash
   wrangler publish --env production
   
   # Verify rollback: all traffic should see origin latency (~300-500ms)
   curl https://api.realsyncdynamicsai.de/api/health | grep X-Worker-Latency
   # Expected: NOT present (origin response)
   ```

3. **Notify on-call team**
   ```
   @on-call: Phase 2b rollback initiated. Impact: <X> minutes of <Y>% traffic affected.
   Cause: <root cause>
   Status: All traffic restored to origin.
   ```

### Post-Mortem (Within 24 hours)

1. **Investigate root cause**
   - Check Sentry error logs
   - Review Cloudflare analytics
   - Identify which component failed (JWT / KV / R2)

2. **Fix in development**
   - Create hotfix branch
   - Write test reproducing issue
   - Fix code
   - Verify locally

3. **Retest in staging**
   - Deploy to staging
   - Run same load test that exposed issue
   - Verify fix resolves problem

4. **Retry production**
   - Deploy hotfix to production
   - Start canary again at 2-3% (conservative)
   - Monitor 4+ hours before expanding

---

## Monitoring & Alerting (During Rollout)

### Key Dashboards

**Sentry Dashboard**
- JWT verification errors: [sentry.io dashboard](#)
- R2 write failures: [sentry.io dashboard](#)
- Error rate trend: [sentry.io dashboard](#)

**Cloudflare Analytics Engine**
- JWT latency distribution: [cloudflare.com dashboard](#)
- Cache hit rate by hour: [cloudflare.com dashboard](#)
- R2 write latency p95: [cloudflare.com dashboard](#)

### Alert Thresholds (Override if Needed)

| Alert | Threshold | Action | Escalation |
|-------|-----------|--------|------------|
| JWT error rate >1% | 1% for 5 min | Page on-call | Page manager if persists >15 min |
| Cache hit rate <70% | <70% for 15 min | Investigate churn | Page on-call if <50% |
| R2 write latency p95 >500ms | >500ms | Check Cloudflare status | Escalate if continues >30 min |
| R2 failures >5/5min | >5 failures | Check RLS policies | ROLLBACK if >10 failures |
| 5xx error rate >1% | >1% for 5 min | Check error type | ROLLBACK if no clear cause |

### On-Call Rotation

**Days 16-18** (Canary soak): Every 4 hours  
**Days 19-21** (Graduated): Every 2 hours  
**Day 21 evening**: Best effort until 100% stable

---

## Success Criteria & Sign-Off

**Phase 2b is COMPLETE when**:

✅ **Latency**: JWT p95 <50ms (vs. 100-300ms RPC)  
✅ **Reliability**: Error rate <0.5%, SLA 99.99%  
✅ **Cache**: Hit rate >80%, p95 latency <20ms (hits)  
✅ **Evidence Vault**: R2 <100ms, dual-write <500ms  
✅ **Multi-tenant**: Zero cross-tenant collisions  
✅ **Monitoring**: Sentry + Analytics Engine capturing all metrics  
✅ **Documentation**: Runbooks + alert rules in place  

**Sign-Off**:
- [ ] Engineering Lead: _________________ Date: _______
- [ ] On-Call Engineer: ________________ Date: _______
- [ ] Product: ______________________ Date: _______

---

## References

- Architecture: `docs/phase-2b-cloudflare-optimization.md`
- JWT Deployment: `docs/phase-2b-workers-jwt-canary.md`
- Cache Layer: `docs/phase-2b-kv-cache-layer.md`
- Observability: `docs/phase-2b-observability.md`
- Load Tests: `scripts/k6-*.js`

---

**Generated**: 2026-08-10  
**Version**: 1.0  
**Status**: Ready for staging validation
