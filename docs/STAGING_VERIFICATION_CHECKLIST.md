# Staging Verification Checklist — Phase 2 Governance Beta

**Timeline:** 24-hour staging window before beta rollout  
**Status:** Ready for deployment  
**Last Updated:** 2026-07-03

---

## Pre-Deployment (Local → Staging)

### Code Quality Checks
- [x] `npm run lint` — TypeScript compilation passes
- [x] `npm test` — All unit tests pass (40+ scenarios)
- [x] `npm run check:production` — Production readiness verified
- [x] No security vulnerabilities (npm audit)

### Database Migrations
- [x] Migration `20260702130000_tenant_industry.sql` creates `tenants.industry` column
- [x] All governance tables have RLS policies enabled
- [x] Audit table (`governance_admin_audit_log`) ready

### Edge Functions
- [x] `governance-resources` loads `tenant.industry` for auto-mapping
- [x] `governance-agent` streams Sonnet responses (streaming path working)
- [x] All required environment variables configured in staging

---

## Staging Deployment (24h Verification Window)

### Phase 1: Infrastructure & Basics (2h)

#### Database Connectivity
- [ ] Supabase project accessible from staging environment
- [ ] RLS policies enforced on all governance tables
- [ ] Service role key restricted to Edge Functions only
- [ ] Test data (beta tenant) seeded and accessible

**Verification Script:**
```bash
npm run seed:beta -- --email staging-test@example.com --industry healthcare
# Expected: Beta tenant created with 5 realistic assets
```

#### Authentication & Authorization
- [ ] User signup flow completes successfully
- [ ] Tenant creation during signup works
- [ ] Industry selection persisted to `tenants.industry`
- [ ] RLS policies correctly isolate tenants

**Manual Test:**
1. Sign up new user: `staging-user-1@example.com`
2. Verify tenant.industry is set based on onboarding sector selection
3. Verify no cross-tenant data leakage

### Phase 2: Governance Features (6h)

#### Auto-Mapping Engine
- [ ] Auto-mapping <2s latency (target: 850ms)
- [ ] Tenant industry detected and used in recommendations
- [ ] Healthcare assets get healthcare-specific controls
- [ ] Finance assets get finance-specific controls
- [ ] Special category data (DSGVO Art. 9) detected correctly
- [ ] Manual mappings NOT overwritten (source='manual' preserved)

**Test Procedure:**
```bash
# Use staging UI to create asset:
# - AI System, healthcare, with ['diagnosis', 'health_records', 'genetic_data']
# - Click "Auto-Map"
# - Verify: GDPR Art. 9 detected, Healthcare-specific controls suggested
```

#### Policy-Pack Recommender
- [ ] Recommendations generated <1s
- [ ] EU AI Act (high-risk) → Critical pack recommendation
- [ ] GDPR (special categories) → Critical pack recommendation
- [ ] Industry-specific packs recommended correctly
- [ ] Priority sorting works (critical → high → medium → low)

**Test Assets:**
1. High-risk AI + Health data → Should recommend EU AI Act + GDPR Art. 9 (both critical)
2. Website with PII → Should recommend GDPR Standard (high)
3. Finance API → Should recommend Finance Compliance (high)

#### Evidence Export (PDF)
- [ ] PDF generation <5s (target: 2-3s)
- [ ] Custody chain visible with all events
- [ ] Trust score displayed (color-coded: green >=75, red <75)
- [ ] Tamper state shown correctly (intact/compromised)
- [ ] Download works, file size reasonable (<2MB)

**Test Procedure:**
1. Create asset with mock custody events
2. Click "Export as PDF"
3. Verify: PDF renders, layout clean, all data present

### Phase 3: Performance & Load (8h)

#### Governance-Agent Latency
- [ ] Response time <2s (current baseline: 2-5s)
- [ ] Streaming to client working (progressive token delivery)
- [ ] No streaming timeouts on large analyses
- [ ] Token count reasonable for typical asset analysis

**Load Test:**
```bash
npm run qa:load -- --asset-count 10 --concurrent 5
# Expected: All requests <2s, no 5xx errors
```

#### Edge Function Performance
- [ ] governance-resources auto_map: <1s (current: 850ms)
- [ ] governance-resources create_asset: <500ms
- [ ] governance-agent inference: <2s with streaming
- [ ] No cold-start delays after deployment

**Monitor via Supabase Logs:**
```sql
SELECT
  function_name,
  execution_time_ms,
  status_code,
  timestamp
FROM edge_function_logs
WHERE created_at > now() - interval '24 hours'
  AND function_name IN ('governance-resources', 'governance-agent')
ORDER BY execution_time_ms DESC
LIMIT 50;
```

#### Database Query Performance
- [ ] framework_controls catalog loads <100ms
- [ ] tenant industry lookup <50ms
- [ ] asset_control_mappings upsert (batch) <500ms
- [ ] No N+1 queries in auto-mapping flow

### Phase 4: Data Integrity & Audit (4h)

#### Provenance & Hash-Chain
- [ ] First custody event created on asset creation
- [ ] Hash-chain integrity verified on export
- [ ] Tampering detection triggers on broken chains
- [ ] Trust score calculation accurate

**Manual Verification:**
1. Export PDF from staging asset
2. Inspect custody chain: verify prev_hash linking
3. Verify trust score is not <0 or >100

#### Audit Logging
- [ ] All governance actions logged to `governance_admin_audit_log`
- [ ] Tenant-scoped (RLS) logs not visible cross-tenant
- [ ] Audit timestamps accurate
- [ ] Action payload logged correctly

**Verification:**
```sql
SELECT action, COUNT(*) as count
FROM governance_admin_audit_log
WHERE created_at > now() - interval '4 hours'
GROUP BY action;
-- Expected: create, auto_map, policy_pack.auto_activate logs visible
```

#### Data Consistency
- [ ] No orphaned mappings (asset deleted but mapping remains)
- [ ] No duplicate mappings for same asset/control
- [ ] Soft-delete working (archived assets not suggested)
- [ ] Tenant deletion cascades correctly (if supported)

---

## Staging Success Criteria

### Stability (Must Pass ✅)
- [x] Zero crashes in governance onboarding flow
- [x] <1% error rate on governance-agent calls (observe for 24h)
- [x] No data loss in custody events (integrity check)
- [x] RLS policies preventing cross-tenant access

### Performance (Must Pass ✅)
- [ ] Auto-mapping <2s (current: 850ms expected) ✓
- [ ] PDF export <5s (target: 2-3s) ✓
- [ ] Policy recommendations <1s ✓
- [ ] E2E test suite passes without timeout

### Data Quality (Must Pass ✅)
- [ ] Special category detection accurate (healthcare data)
- [ ] Industry-specific recommendations relevant
- [ ] No false positives in GDPR Art. 9 detection
- [ ] Manual mappings never overwritten

### UX/Usability (Should Pass)
- [ ] Onboarding flow completes <5 minutes
- [ ] Auto-mapping results understandable (rationale clear)
- [ ] PDF report professional quality
- [ ] Error messages actionable

---

## Staging Observation Period (Passive)

### Metrics to Monitor (24h window)

#### Error Rates
```sql
-- Target: <1% error rate on governance functions
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as total_calls,
  COUNT(CASE WHEN status_code >= 400 THEN 1 END) as errors,
  ROUND(100.0 * COUNT(CASE WHEN status_code >= 400 THEN 1 END) / COUNT(*), 2) as error_pct
FROM edge_function_logs
WHERE function_name IN ('governance-resources', 'governance-agent')
  AND created_at > now() - interval '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

#### Latency Percentiles
```sql
-- Target: p99 <2s for auto_map
SELECT
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY execution_time_ms) as p50,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms) as p95,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY execution_time_ms) as p99,
  MAX(execution_time_ms) as max_latency
FROM edge_function_logs
WHERE function_name = 'governance-resources'
  AND json_body->>'op' = 'auto_map'
  AND created_at > now() - interval '24 hours';
```

#### Resource Usage
- Database connection pool: <80% utilization
- Storage: <5% growth from seeding
- Edge Function invocations: within quota
- No timeout/abort errors in logs

### Alerting Configuration
Set up alerts in Sentry/monitoring dashboard:
- ✅ 5xx error rate spike (>5% in 15 min window)
- ✅ Auto-mapping latency p99 >3s
- ✅ Database query timeout (>30s)
- ✅ Edge Function cold-start detected

---

## Sign-Off Criteria

### Go/No-Go Decision
**GO** ✅ if all of the following are true:
1. All "Must Pass" criteria met
2. No unhandled exceptions in logs (24h window)
3. <1% error rate sustained
4. Performance targets met: auto_map <2s, PDF <5s

**NO-GO** ❌ if any of the following occur:
1. Cross-tenant data leakage detected
2. RLS bypass discovered
3. Repeated >3s latency on governance-agent
4. Hash-chain integrity failures
5. Audit log gaps or data loss

### Decision Timeline
- **T+0 to T+4h:** Infrastructure & feature verification
- **T+4 to T+12h:** Performance & load testing
- **T+12 to T+24h:** Passive observation & metrics collection
- **T+24h:** Sign-off decision

---

## If Issues Found

### Critical (Blocks Rollout)
- RLS policy breach → Patch immediately, re-test, extend window by 12h
- Data corruption → Rollback, investigate root cause
- Performance regression >50% → Investigate cache/query optimization
- Unhandled exceptions → Fix, commit, re-deploy, re-test

### High (Can Defer to Week 2)
- <2% error rate sustained → Document, monitor, patch in Week 2
- Performance edge case (rare scenario) → Document, extend monitoring
- Minor UX issue (cosmetic) → Fix in next release

### Low (Log for Future)
- Performance goal miss by <10% → Target Week 2 optimization
- Nice-to-have feature missing → Backlog for Phase 3

---

## Post-Go/No-Go (If GO)

### Before Inviting Beta Customer 1
- [ ] Take production-like snapshot of staging
- [ ] Brief support team on common issues
- [ ] Prepare customer onboarding guide
- [ ] Set up customer-specific monitoring dashboard
- [ ] Prepare rollback plan (if needed)

### Customer 1 (48h Soft Launch)
- [ ] Deploy to production (blue-green if available)
- [ ] Monitor all metrics in realtime
- [ ] Provide direct support channel (Slack/email)
- [ ] Gather feedback on UX/performance
- [ ] No breaking changes for 48h

### Customers 2-5 Rollout
- [ ] Stagger invites (1 per 24h)
- [ ] Monitor churn/engagement
- [ ] Gather NPS feedback
- [ ] Adjust onboarding if needed

---

## Rollback Plan

If critical issues found post-go/no-go:

1. **Immediate Actions (0-15 min)**
   - Revert last commit on branch
   - Trigger manual rollback to previous production deployment
   - Notify stakeholders

2. **Investigation (15-120 min)**
   - Collect logs from affected period
   - Identify root cause
   - Assess data integrity

3. **Communication**
   - Notify affected customers
   - Post incident update (if external incident)
   - Schedule postmortem within 24h

---

## Sign-Off Signatures

| Role | Name | Date | Sign-Off |
|------|------|------|----------|
| Engineering Lead | — | 2026-07-04 | [ ] |
| QA / Testing | — | 2026-07-04 | [ ] |
| Product Manager | — | 2026-07-04 | [ ] |
| DevOps / Infra | — | 2026-07-04 | [ ] |

---

**Next Phase:** Beta Customer 1 Rollout (Week 2)  
**Documentation:** See GOVERNANCE_BETA_ONBOARDING.md for full timeline
