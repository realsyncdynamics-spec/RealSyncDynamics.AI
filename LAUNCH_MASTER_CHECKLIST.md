# Launch Master Checklist: Phase 4-6 Execution

**Target Launch Date**: 2026-08-01  
**Team Coordination Document**: Single source of truth for all team tasks  
**Status**: Ready for execution

---

## Quick Reference Links

- **PR**: #844 (Phase 4-6 Operational Documentation)
- **Feature Branch**: `claude/smb-experience-layer-e8zj1d`
- **Launch Readiness Report**: `LAUNCH_READINESS_REPORT.md`
- **Deployment Script**: `scripts/deploy-phase4.sh`

---

## Phase 4a: Staging Setup (2-3 days)

**Owner**: DevOps Lead  
**Reference Document**: `STAGING_SETUP_TEMPLATE.md`  
**Success Criteria**: All 12 verification items checked

### Task Breakdown

- [ ] **1.1 Supabase Staging Project**
  - [ ] Create project via Supabase CLI or Console
  - [ ] Save project credentials to `.env.staging.local`
  - [ ] Document project URL and keys

- [ ] **1.2 Database Migrations**
  - [ ] Link Supabase CLI to staging project
  - [ ] Push all migrations: `supabase db push --linked`
  - [ ] Verify 25 tables created (including social_* tables)
  - [ ] Verify RLS policies enabled on all social_* tables

- [ ] **1.3 Edge Function Deployment**
  - [ ] Deploy function: `supabase functions deploy social-orchestrator-persistence`
  - [ ] Test DLQ enqueue operation via curl
  - [ ] Verify function logs clean (no errors)

- [ ] **1.4 API Credentials in Vault**
  - [ ] LinkedIn access token
  - [ ] X API key + API secret
  - [ ] Meta access token
  - [ ] TikTok access token
  - [ ] SendGrid API key
  - [ ] WordPress API token (if applicable)
  - [ ] Ghost admin API key (if applicable)
  - [ ] Verify vault access: `SELECT vault.decrypted_secret(...)`

- [ ] **1.5 Monitoring Setup**
  - [ ] Enable pg_stat_statements extension
  - [ ] Create monitoring views (5 views from MONITORING_SETUP.md Section 13.1)
  - [ ] Configure Sentry DSN in staging
  - [ ] Configure Slack webhook (optional but recommended)

- [ ] **1.6 Test Data**
  - [ ] Create test tenant
  - [ ] Create sample queue entries for each channel

- [ ] **1.7 Verification Checklist** (12 items from STAGING_SETUP_TEMPLATE.md Section 7)
  - [ ] Staging project created ✓
  - [ ] Migrations deployed ✓
  - [ ] Social-* tables exist with RLS ✓
  - [ ] pg_cron extension enabled ✓
  - [ ] Cron jobs scheduled ✓
  - [ ] Edge Function deployed & tested ✓
  - [ ] All 7 API credentials in Vault ✓
  - [ ] Vault secrets verified ✓
  - [ ] Monitoring views created ✓
  - [ ] Sentry configured ✓
  - [ ] Slack webhook tested ✓
  - [ ] Team access granted ✓

**Sign-Off**: DevOps Lead — [ ] Ready to proceed to Phase 4b

---

## Phase 4b: Staging Tests (8-12 hours continuous)

**Owner**: QA Lead + QA Engineer  
**Reference Document**: `STAGING_TEST_GUIDE.md`  
**Success Criteria**: All 5 test suites pass, sign-off obtained

### Test Suite 1: Basic Publishing (All 9 Channels)

- [ ] **1.1 LinkedIn Enterprise** — Post published, latency recorded, audit log verified
- [ ] **1.2 LinkedIn Legal (DPO)** — Post published, signature applied, audit log verified
- [ ] **1.3 X (Twitter)** — Tweet posted, character count validated
- [ ] **1.4 Instagram Reel** — Caption posted, hook format verified
- [ ] **1.5 TikTok** — Post published, caption length validated
- [ ] **1.6 WordPress Blog** — Blog post published, tags applied
- [ ] **1.7 Ghost Blog** — Blog post published, markdown conversion verified
- [ ] **1.8 Email Newsletter** — Email delivered, tracking pixels verified
- [ ] **1.9 Webhook Custom** — Webhook payload received, format verified

**Result**: [ ] ALL PASS [ ] SOME FAIL

### Test Suite 2: Failure Scenarios & Retry Logic

- [ ] **2.1 Rate Limit Error (LinkedIn)** — DLQ entry created, exponential backoff verified
- [ ] **2.2 Authentication Error** — Auth error logged, no infinite retry loop
- [ ] **2.3 Network Timeout** — Timeout error triggers retry with backoff, recovery succeeds
- [ ] **2.4 Partial Failure (Multi-Channel)** — Failed channels isolated, successful channels unblocked

**Result**: [ ] ALL PASS [ ] SOME FAIL

### Test Suite 3: Metrics & Observability

- [ ] **3.1 Metrics Recording** — All publishes recorded, row counts match, latency populated
- [ ] **3.2 Hourly Rollup Aggregation** — Hourly rollup creates aggregated rows correctly
- [ ] **3.3 Error Rate Calculation** — Error rate calculated correctly vs manual calculation
- [ ] **3.4 Audit Trail Completeness** — Complete audit trail for each publish, sequence correct

**Result**: [ ] ALL PASS [ ] SOME FAIL

### Test Suite 4: Load Testing (Optional)

- [ ] **4.1 Bulk Publish Performance** — 1,000 publishes tested, P95 latency < 5 seconds
- [ ] **4.2 DLQ Under Load** — 500+ DLQ entries, list query < 100ms, batch retry < 1s
- [ ] **4.3 Metrics Storage Growth** — Storage estimate within budget (< 500MB for 6 months)

**Result**: [ ] COMPLETED [ ] SKIPPED

### Test Suite 5: Integration Scenarios

- [ ] **5.1 End-to-End Compliance Flow** — Audit trail exported, CSV format valid
- [ ] **5.2 Channel-Specific Configuration** — Wrong credentials tested, correct error returned
- [ ] **5.3 Graceful Degradation** — One channel failure doesn't block others

**Result**: [ ] ALL PASS [ ] SOME FAIL

### Infrastructure Verification

- [ ] Edge Function logs clean (no errors)
- [ ] Database size reasonable (< 500MB)
- [ ] No slow queries (all < 1s)
- [ ] Cron jobs executed successfully
- [ ] Connection pool healthy

### Issue Tracking

| Issue | Severity | Root Cause | Resolution | Status |
|-------|----------|-----------|-----------|--------|
| | [ ] P1 [ ] P2 [ ] P3 | | | [ ] RESOLVED [ ] OPEN |

### Test Result Summary

**Overall Result**: [ ] PASS [ ] FAIL [ ] PARTIAL  
**Test Duration**: ___ hours  
**Blockers**: [ ] None [ ] Minor [ ] Major  
**Ready for Production**: [ ] YES [ ] NO

### Sign-Off

| Role | Name | Date | Approved |
|------|------|------|----------|
| QA Lead | _____ | _____ | [ ] YES [ ] NO |
| Engineering Lead | _____ | _____ | [ ] YES [ ] NO |
| DevOps Lead | _____ | _____ | [ ] YES [ ] NO |
| Product Lead | _____ | _____ | [ ] YES [ ] NO |

**QA Sign-Off**: [ ] Ready to proceed to Phase 4c

---

## Phase 4c: Pre-Launch Preparation (T-24 hours)

**Owner**: Engineering Lead  
**Reference Document**: `PHASE_4_LAUNCH_CHECKLIST.md`  
**Success Criteria**: All 12 pre-launch items verified

### Pre-Launch Verification Checklist (Execute T-24h)

- [ ] All staging tests passed (sign-off obtained)
- [ ] No open critical issues in staging
- [ ] Monitoring dashboards live and verified
- [ ] On-call team trained and ready
- [ ] API credentials rotated (fresh tokens)
- [ ] Database backups current
- [ ] Edge Function logs clean (last 24h)
- [ ] Slack alerts configured
- [ ] PagerDuty escalation policy active
- [ ] Team briefed and ready
- [ ] Go/no-go meeting completed
- [ ] Customer communication approved

**Engineering Lead Sign-Off**: [ ] GO / [ ] NO-GO

---

## Phase 4d: Production Deployment (T-0 to T+24h)

**Owner**: DevOps Lead + On-Call Engineer  
**Reference Document**: `PHASE_4_LAUNCH_CHECKLIST.md` Section 6  
**Execution Script**: `scripts/deploy-phase4.sh production`

### Deployment Timeline

#### T-60min: Final Verification
- [ ] Review monitoring dashboard
- [ ] Check Edge Function logs
- [ ] Verify database connectivity
- [ ] Confirm all credentials in Vault

#### T-30min: Go/No-Go Decision
- [ ] Team alignment on launch
- [ ] Acknowledge any remaining risks
- [ ] Final approval from Engineering Lead

**Decision**: [ ] GO / [ ] NO-GO

#### T-0: Production Deployment (5-10 min execution)
- [ ] Run: `./scripts/deploy-phase4.sh production`
- [ ] Verify output matches expected
- [ ] Wait for completion

**Deployment Status**: [ ] SUCCESS [ ] FAILURE

#### T+5min: Smoke Test
- [ ] Publish one post to each of 9 channels
- [ ] Verify all publish successfully
- [ ] Check metrics recorded

**Smoke Test Result**: [ ] ALL GREEN [ ] ISSUES FOUND

#### T+30min: Initial Monitoring
- [ ] Error rate (target: < 5%)
- [ ] DLQ depth (target: 0-5)
- [ ] Latency p95 (target: < 5s)
- [ ] Cron jobs executed

**Status**: [ ] GREEN [ ] YELLOW [ ] RED

#### T+1h: Escalate Monitoring
- [ ] Review all 9 channels independently
- [ ] Check for any channel-specific issues
- [ ] Verify audit log entries
- [ ] Monitor connection pool

**Status**: [ ] GREEN [ ] YELLOW [ ] RED

#### T+4h: Extended Monitoring
- [ ] Review 4-hour trend
- [ ] Verify hourly rollup executed
- [ ] Check storage growth
- [ ] Confirm no slow queries

**Status**: [ ] GREEN [ ] YELLOW [ ] RED

#### T+24h: Post-Launch Review
- [ ] Full system health review
- [ ] Document any issues
- [ ] Begin normal on-call rotation
- [ ] Publish launch day summary

**Status**: [ ] LAUNCH SUCCESSFUL [ ] ISSUES ENCOUNTERED

**On-Call Lead Sign-Off**: [ ] Launch complete

---

## Phase 5: Post-Launch Operations (Day 2+)

**Owner**: On-Call Team + DevOps + Engineering  
**Reference Document**: `POST_LAUNCH_OPERATIONS.md`

### Phase 5a: First 24 Hours (Already Covered Above in T+24h)

### Phase 5b: First Week (Days 2-7)

**Daily Tasks** (5 min each):
- [ ] System Health Check
  - [ ] DLQ depth < 50?
  - [ ] Error rate < 5%?
  - [ ] No P1 alerts?
  - [ ] All channels green?

- [ ] Sentry Review
  - [ ] New error types? Note for investigation
  - [ ] Error rate trend?
  - [ ] Unhandled exceptions?

- [ ] On-Call Handoff
  - [ ] Summarize overnight issues
  - [ ] Alert thresholds appropriate?
  - [ ] Any credential rotations needed?

**Weekly Meeting** (End of Week 1):
- [ ] Deployment Success Review
- [ ] System Stability Analysis
- [ ] Operational Learnings
- [ ] First Optimizations Planning

**Week 1 Sign-Off**: [ ] Ready for Week 2-4

### Phase 5c: First Month (Days 8-31)

**Weekly Tasks** (Monday, Wednesday, Friday):

**Monday (Weekly Standup)**:
- [ ] Review error logs from past week
- [ ] Check DLQ patterns
- [ ] Review Sentry trends
- [ ] Update on-call handoff notes

**Wednesday (Mid-week Check)**:
- [ ] Verify cron jobs executed
- [ ] Check database size growth
- [ ] Review slow query logs
- [ ] Monitor connection pool usage

**Friday (Weekly Report)**:
- [ ] Compile performance metrics
- [ ] Document any incidents + resolutions
- [ ] Update runbooks with lessons learned
- [ ] Plan next week priorities

**Monthly Review Meeting** (End of Month):
- [ ] Launch Retrospective
- [ ] System Performance Analysis
- [ ] Operational Health Check
- [ ] Optimization Plan
- [ ] Next Month Priorities

**Month 1 Sign-Off**: [ ] Ready for Months 2-3

### Phase 5d: Months 2-3 (Days 32-90)

**Key Milestones**:

- [ ] **Day 30**: First Major Retrospective
  - Are we on track?
  - Any systemic issues to fix?
  - Runbooks effective?

- [ ] **Day 60**: Mid-Cycle Review
  - Performance trending positively?
  - Team confidence in operations?
  - Ready for optimization phase?

- [ ] **Day 90**: End of Phase 5
  - System stable and predictable?
  - Team fully trained?
  - Optimization backlog ready?
  - Transition to steady-state operations?

**Phase 5 Sign-Off**: [ ] Transition to steady-state (Day 91+)

---

## Phase 6: Optimization Roadmap

**Owner**: Engineering Lead + Product Lead  
**Reference Document**: `PHASE_6_ROADMAP.md`  
**Timeline**: Weeks 1-12+ (after Phase 5 completion)

### Phase 6a: Quick Wins (Weeks 1-2, Post-Launch)

- [ ] Query Optimization
- [ ] Connection Pool Tuning
- [ ] Cron Job Optimization

**Target**: 20-30% latency reduction, improved reliability

### Phase 6b: Medium-Term (Weeks 3-6)

- [ ] Webhook Alerts for DLQ Entries
- [ ] Adaptive Backoff Strategy
- [ ] Cross-Channel Failover

**Target**: Reduced MTTR, improved retry success rate

### Phase 6c: Long-Term (Weeks 7-12)

- [ ] Metrics Export to External Systems
- [ ] Manual Retry Dashboard
- [ ] Machine Learning Anomaly Detection

**Target**: Unified monitoring, self-service support, proactive alerting

### Phase 6d: Scaling (Weeks 13+)

- [ ] Database Scaling & Partitioning
- [ ] Edge Function Regional Deployment
- [ ] Multi-Region Redundancy

**Target**: Support 12-month growth, global redundancy

---

## Reference Documents Quick Map

| Document | Purpose | Owner |
|----------|---------|-------|
| STAGING_SETUP_TEMPLATE.md | Staging environment setup | DevOps |
| STAGING_TEST_GUIDE.md | Test procedures & scenarios | QA |
| STAGING_TEST_RESULTS.md | Test result tracking | QA |
| PHASE_4_LAUNCH_CHECKLIST.md | Week-by-week deployment timeline | Eng Lead |
| PERSISTENCE.md | Architecture & schema reference | Backend |
| MONITORING_SETUP.md (Sec 13) | Phase 4 monitoring setup | DevOps |
| ON_CALL_RUNBOOK.md | 5-min triage & procedures | On-Call |
| INCIDENT_RESPONSE_PLAYBOOK.md | Detailed incident scenarios | On-Call |
| POST_LAUNCH_OPERATIONS.md | 90-day operational guide | All |
| PHASE_6_ROADMAP.md | Optimization roadmap | Eng Lead |
| scripts/deploy-phase4.sh | Automated deployment script | DevOps |

---

## Success Criteria

### Phase 4 Success (Deployment)
- ✅ All staging tests pass
- ✅ Production deployment successful
- ✅ All 9 channels publishing
- ✅ Error rate < 5%
- ✅ P95 latency < 5s
- ✅ Zero unhandled exceptions

### Phase 5 Success (Operations)
- ✅ Error rate consistently < 5%
- ✅ P95 latency consistently < 5s
- ✅ DLQ depth < 50 (except platform outages)
- ✅ On-call team confident with procedures
- ✅ Runbooks accurate and complete
- ✅ Incident response < 15min for P1
- ✅ Team capacity sustainable

### Phase 6 Success (Optimization)
- ✅ P95 latency < 2s
- ✅ Error rate < 1%
- ✅ DLQ depth < 50 (normal operations)
- ✅ Webhook alerts operational
- ✅ Adaptive backoff implemented
- ✅ Manual retry dashboard live
- ✅ Metrics exported to external systems

---

## Communication Channels

| Role | Channel | Contact |
|------|---------|---------|
| On-Call Lead | Slack #incident-response | [@on-call-lead] |
| Engineering Lead | Slack #engineering | [@eng-lead] |
| DevOps Lead | Slack #infrastructure | [@devops-lead] |
| QA Lead | Slack #qa | [@qa-lead] |
| Product Lead | Slack #product | [@product-lead] |
| VP Engineering | Slack #leadership | [@vp-eng] |

---

## Escalation Path

### P1 (15 min response)
- Error rate > 10% OR DLQ > 500 OR all channels failing
- On-Call Engineer investigates
- Page Engineering Lead if unresolved after 10 min

### P2 (30 min response)
- Error rate 5-10% OR DLQ 100-500 OR multiple channels failing
- On-Call Engineer investigates
- Escalate to Engineering Lead if unresolved after 20 min

### P3 (1 hour response)
- Error rate 1-5% OR single channel issue
- Triage and document
- Escalate only if pattern emerging

### P4 (Next business day)
- Log in issue tracker
- Address during normal work

---

## Go-Live Approval

| Role | Approval | Date | Sign-Off |
|------|----------|------|----------|
| DevOps Lead | Staging Ready | _____ | [ ] |
| QA Lead | Tests Pass | _____ | [ ] |
| Engineering Lead | Pre-Launch Ready | _____ | [ ] |
| VP Engineering | Launch Approved | _____ | [ ] |

---

**Document Status**: Ready for Team Execution  
**Last Updated**: 2026-07-20  
**Next Review**: 2026-08-02 (Post-launch)

