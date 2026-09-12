# Phase 4: Execution Readiness Checklist

**Start Date**: Post-PR #817 merge (NOW ✅ MERGED)  
**Duration**: 4 weeks  
**Lead**: Performance Engineer + DevOps  
**Status**: Ready to execute

---

## Pre-Execution Setup (Complete These First)

### [ ] 1. Sentry Project & DSN Activation

**Responsibility**: DevOps Lead  
**Timeline**: Day 1 (before Week 1 baseline starts)

**Checklist**:
- [ ] Create Sentry project (free tier: 5k errors/month)
  - Platform: React
  - Name: `realsyncdynamics-ai-frontend`
  - Region: EU (DSGVO compliance)
  - Project type: JavaScript

- [ ] Copy DSN from Sentry project settings
  - Format: `https://<key>@<id>.ingest.de.sentry.io/<project-id>`
  - Verify region is `.ingest.de.sentry.io` (EU)

- [ ] Add to GitHub Actions secrets
  - Name: `VITE_SENTRY_DSN`
  - Value: [DSN from step 2]

- [ ] Verify `.github/workflows/deploy-frontend.yml` includes:
  ```yaml
  - run: npm run build
    env:
      VITE_SENTRY_DSN: ${{ secrets.VITE_SENTRY_DSN }}
  ```

- [ ] Trigger deployment
  - Push dummy commit to main, OR
  - Run: `gh workflow run deploy-frontend.yml`

- [ ] Verify Sentry receives events
  - Wait 30 seconds
  - Open Sentry dashboard
  - Check "Issues" tab for incoming events
  - Smoke test: Browser console → `Sentry.captureMessage('test')`

**Success**: Sentry dashboard shows live performance events from production

---

### [ ] 2. Slack Integration (Alerts)

**Responsibility**: DevOps Lead  
**Timeline**: Day 2 (before alert configuration)

**Checklist**:
- [ ] Create Slack channel `#perf-monitoring`
- [ ] Generate Sentry Slack integration token
  - Sentry → Settings → Integrations → Slack → Install
  - Authorize Sentry bot in your workspace
- [ ] Configure alert route
  - Sentry → Alerts → Add Notification Channel
  - Type: Slack
  - Channel: `#perf-monitoring`
  - Test: Send test notification

**Success**: Test alert notification appears in `#perf-monitoring`

---

### [ ] 3. Team Access & Permissions

**Responsibility**: Engineering Lead  
**Timeline**: Day 1-2

**Checklist**:
- [ ] Sentry project access
  - [ ] Performance Engineer: Admin
  - [ ] DevOps Lead: Admin
  - [ ] Engineering Lead: Admin
  - [ ] Team members: Member (read-only)

- [ ] GitHub secrets access
  - [ ] DevOps can view/update secrets
  - [ ] Performance Eng can trigger deployments

- [ ] Slack access
  - [ ] All team members joined `#perf-monitoring`
  - [ ] Notification permissions configured

**Success**: All team members have required access levels

---

### [ ] 4. Baseline Collection Setup

**Responsibility**: Performance Engineer  
**Timeline**: Day 2-3 (before Week 1)

**Checklist**:
- [ ] Create baseline data collection template
  - [ ] Copy `COMPONENT-PERFORMANCE-BASELINES-TEMPLATE.json`
  - [ ] Prepare for Week 1-2 data entry

- [ ] Set up monitoring dashboard
  - [ ] Bookmark Sentry performance dashboard
  - [ ] Create custom views for each tier
  - [ ] Share dashboard links in `#perf-monitoring`

- [ ] Prepare documentation
  - [ ] Create `docs/PERFORMANCE-BASELINES.md` skeleton
  - [ ] Create `docs/COMPONENT-PERFORMANCE-BASELINES.json` skeleton
  - [ ] Create `docs/API-PERFORMANCE-BASELINES.md` skeleton

**Success**: Baseline collection infrastructure ready for Week 1

---

## Week 1-2: Baseline Collection

### [ ] Week 1 Baseline Tasks

**Days 1-5: Web Vitals Collection**

- [ ] Monitor Sentry Web Vitals data (5+ days of data)
  ```
  Sentry → Performance → Transactions
  Filter: All transactions
  Group by: Transaction name
  Display: LCP, INP, CLS, TTFB, FCP
  ```

- [ ] Record baseline percentiles
  - [ ] p50 (median)
  - [ ] p75 (good percentile)
  - [ ] p95 (needs improvement threshold)
  - [ ] p99 (poor threshold)

- [ ] Identify Web Vitals status
  - [ ] LCP current p95 vs 2.5s (good) threshold
  - [ ] INP current p95 vs 200ms (good) threshold
  - [ ] CLS current p95 vs 0.1 (good) threshold

**Days 1-5: Component Performance Collection**

- [ ] Gather all 54 component render times
  ```
  Sentry → Performance → Transactions
  Filter: withPerformanceMonitoring
  Display: p50, p95, p99 by component
  ```

- [ ] Record per-component metrics
  - [ ] Component name
  - [ ] Current p95 (vs tier threshold)
  - [ ] Re-render frequency (per minute)
  - [ ] Error rate
  - [ ] User impact (daily users hitting component)

- [ ] Calculate tier compliance
  - [ ] Tier 1 (≤200ms): How many in compliance?
  - [ ] Tier 2 (≤350ms): How many in compliance?
  - [ ] Tier 3 (≤500ms): How many in compliance?

**Days 6-7: API & Resource Tracking**

- [ ] Collect API endpoint performance
  ```
  Sentry → Performance → Transactions
  Filter: resource.type = fetch/XHR
  Display: p95, error rate by endpoint
  ```

- [ ] Record for each endpoint
  - [ ] Endpoint URL
  - [ ] p95 latency
  - [ ] Error rate
  - [ ] Call count

**Output**: `docs/PERFORMANCE-BASELINES.md` (Week 1 data)

---

### [ ] Week 2 Baseline Tasks

**Days 1-7: Analysis & Synthesis**

- [ ] Extend collection (additional 2-3 days of data)
  - [ ] Confirm patterns from Week 1
  - [ ] Identify anomalies
  - [ ] Check for day-of-week patterns (weekday vs weekend)

- [ ] Analyze component distribution
  - [ ] Slowest 10 components (identify candidates for Phase 5)
  - [ ] Fastest 10 components (model for optimization)
  - [ ] Most-used vs least-used

- [ ] Compile baseline document
  - [ ] Web Vitals summary table
  - [ ] Component performance by tier
  - [ ] API endpoint rankings
  - [ ] Risk assessment (what's at threshold)

- [ ] Create baseline JSON
  - [ ] `COMPONENT-PERFORMANCE-BASELINES.json` (all 54)
  - [ ] `API-PERFORMANCE-BASELINES.md` (top 20 endpoints)

**Output**: Complete baseline documentation ready for Week 3 alert configuration

---

## Week 2: Alert Configuration

### [ ] Create Sentry Alert Rules (8 total)

**Responsibility**: DevOps Lead + Performance Engineer

#### Tier 1 Alerts (Most Critical)

- [ ] **Alert 1: Tier 1 Component Render Spike**
  ```
  Sentry → Alerts → New Alert Rule
  Name: Tier 1 Component Render Time Spike
  Condition:
    - event.type = transaction
    - environment = production
    - transaction matches GovernanceDashboard|ProtectedLayout
    - duration >= 300ms (1.5x threshold of 200ms)
  Action:
    - Slack: #perf-monitoring
    - Tag: severity:critical
  Test: Should trigger within 5 minutes of slow render
  ```

- [ ] **Alert 2: Tier 1 Re-render Frequency**
  ```
  Name: Tier 1 Excessive Re-renders
  Condition:
    - transaction matches Tier 1 components
    - re_render_frequency > 10/min
  Action:
    - Slack: #perf-monitoring with link to component
  ```

#### Tier 2 Alerts (Medium Priority)

- [ ] **Alert 3: Tier 2 Render Performance**
  ```
  Name: Tier 2 Component Render Degradation
  Condition:
    - transaction matches Tier 2 components
    - duration >= 525ms (1.5x threshold of 350ms)
    - avg(last_10_min)
  Action:
    - Slack: #perf-monitoring
  ```

#### Web Vitals Alerts (User Experience)

- [ ] **Alert 4: LCP Regression**
  ```
  Name: LCP Degradation
  Condition:
    - metric.lcp >= 3500ms (75% of poor threshold)
    - avg(last_10_min)
  Action:
    - Slack: #perf-monitoring
    - Tag: metric:lcp
  ```

- [ ] **Alert 5: INP Spike**
  ```
  Name: INP Degradation
  Condition:
    - metric.inp >= 350ms
    - avg(last_10_min)
  Action:
    - Slack: #perf-monitoring
  ```

- [ ] **Alert 6: CLS Violation**
  ```
  Name: CLS Spike
  Condition:
    - metric.cls >= 0.2
    - avg(last_10_min)
  Action:
    - Slack: #perf-monitoring
  ```

#### API Alerts (Backend Performance)

- [ ] **Alert 7: Slow API Endpoint**
  ```
  Name: Slow API Endpoint
  Condition:
    - resource.type = fetch
    - duration > 2000ms (exceeds p99 baseline)
    - count(last_5_min) >= 3
  Action:
    - Slack: #perf-monitoring
    - Include: endpoint URL, current p95
  ```

- [ ] **Alert 8: API Error Rate Spike**
  ```
  Name: API Error Rate Spike
  Condition:
    - status_code >= 500
    - count(last_5_min) >= 5
  Action:
    - Slack: #perf-monitoring (critical)
    - Escalate: Page team lead if continues
  ```

**Smoke Test Each Alert**:
- [ ] Manually trigger slow component render → Verify Slack notification
- [ ] Artificially increase LCP → Verify alert fires
- [ ] Simulate API error → Verify alert fires
- [ ] Verify no false positives (alert doesn't fire on normal operation)

**Output**: All 8 alert rules active and tested

---

## Week 3: Dashboard & Budgets

### [ ] Build Sentry Performance Dashboard (9 Widgets)

**Responsibility**: Performance Engineer

**Dashboard Setup**:
- [ ] Create new dashboard: "Performance Monitoring (Production)"
- [ ] Set auto-refresh: 5 minutes
- [ ] Set time range: Last 24 hours (default)
- [ ] Pin as default dashboard

**Widgets to Add** (in order):

- [ ] **Widget 1: Web Vitals Summary**
  ```
  Title: Core Web Vitals Status
  Metrics: LCP p95, INP p95, CLS p95, TTFB p95, FCP p95
  Display: Current value + baseline + status color (green/yellow/red)
  Time: Last 24h
  ```

- [ ] **Widget 2: Component Performance by Tier**
  ```
  Title: Component Performance by Tier
  Three cards:
    - Tier 1: avg p95, # components within/exceeding threshold
    - Tier 2: avg p95, # components within/exceeding threshold
    - Tier 3: avg p95, # components within/exceeding threshold
  Click each to drill down to components
  ```

- [ ] **Widget 3: Slowest Components (Top 10)**
  ```
  Title: Top 10 Slowest Components (24h)
  Table:
    - Component name
    - Current p95
    - Baseline p95
    - Δ (delta %)
    - Status icon (✅/⚠️/🔴)
  Sort: Descending by p95
  ```

- [ ] **Widget 4: API Endpoint Performance**
  ```
  Title: API Performance (24h)
  Table:
    - Endpoint URL
    - Call count
    - Error rate
    - p95 latency
    - Baseline p95
    - Status
  Sort: Descending by p95
  ```

- [ ] **Widget 5: Edge Function Timing**
  ```
  Title: Edge Function Performance
  For each Edge Function:
    - Function name
    - p50, p95, p99 duration
    - Error rate
    - Trend (↑/↓/→)
  ```

- [ ] **Widget 6: Recent Alerts (Last 48h)**
  ```
  Title: Alert Activity
  List of triggered alerts:
    - Alert name
    - Time triggered
    - Severity (yellow/orange/red)
    - Status (open/resolved)
  Click to view full context
  ```

- [ ] **Widget 7: Baseline Violations**
  ```
  Title: Components Exceeding Thresholds
  List:
    - Component name
    - Tier + threshold
    - Current p95
    - Violation %
    - Duration of violation
  Highlight: >25% violations
  ```

- [ ] **Widget 8: Performance Trends (7-day)**
  ```
  Title: 7-Day Trends
  Line charts:
    - Web Vitals trends (LCP, INP, CLS)
    - Component render time (avg, p95)
    - API response time
  Shade: Good/needs-improvement/poor zones
  ```

- [ ] **Widget 9: Weekly Summary Stats**
  ```
  Title: Performance Summary
  Metrics:
    - % Components within baseline
    - Web Vitals status
    - API health score
    - Top improving component
    - Most regressed component
    - Recommended actions (text)
  ```

**Verification**:
- [ ] All 9 widgets rendering data
- [ ] No "No data" errors
- [ ] Data updates every 5 min
- [ ] Share link works for team
- [ ] Dashboard is easy to navigate

**Output**: Published Sentry dashboard + team access + training

---

### [ ] Define Performance Budgets (All Pages)

**Responsibility**: Performance Engineer + Engineering Lead

**Create `docs/PERFORMANCE-BUDGETS.json`**:

- [ ] Public pages section
  ```json
  {
    "pages": [
      {
        "route": "/",
        "name": "MainLanding",
        "budgets": {
          "lcp": "2.8s",
          "inp": "200ms",
          "cls": "0.1",
          "ttfb": "600ms",
          "total_js": "250KB",
          "total_css": "50KB"
        },
        "target_percentile": "p75"
      }
    ]
  }
  ```

- [ ] Protected pages section (Tier 1-3 governance)
  ```json
  {
    "route": "/app/governance",
    "name": "GovernanceDashboard",
    "tier": 1,
    "budgets": {
      "render_time": "200ms",
      "lcp": "3.0s",
      "inp": "200ms",
      "rerenders_per_minute": "5"
    }
  }
  ```

- [ ] Validation: All pages have budgets defined

**Output**: `PERFORMANCE-BUDGETS.json` + documentation

---

## Week 4+: Monthly Review Cycle

### [ ] Establish Monthly Performance Review

**Schedule**: 1st Wednesday of each month, 2:00 PM UTC

**Attendees**:
- [ ] Engineering Lead (facilitator)
- [ ] Performance Engineer
- [ ] DevOps Lead
- [ ] Team lead (rotating)

**Preparation** (1 day before meeting):
- [ ] Generate monthly report
  ```bash
  npm run perf:monthly-report --month YYYY-MM
  ```
  Output: `docs/MONTHLY-PERFORMANCE-REPORTS/YYYY-MM.md`

- [ ] Upload report to Slack
  ```bash
  npm run perf:monthly-report --month YYYY-MM --slack
  ```

- [ ] Identify top 3 slowest components
- [ ] Analyze trends vs previous month

**Meeting Agenda** (1 hour):
1. Web Vitals Review (10 min)
   - [ ] Current p95/p99 vs baseline
   - [ ] Trend: improving/stable/degrading?
   - [ ] Action items?

2. Component Performance (20 min)
   - [ ] Top 3 slowest components
   - [ ] Root cause analysis
   - [ ] Optimization strategy

3. API Performance (15 min)
   - [ ] Slowest endpoints
   - [ ] Error rates
   - [ ] Opportunities

4. Budget Compliance (10 min)
   - [ ] Pages exceeding budget
   - [ ] Remediation status
   - [ ] Timeline to fix

5. Next Month Planning (5 min)
   - [ ] Optimization priorities
   - [ ] Baseline updates if needed
   - [ ] Confirm next meeting date

**Output**:
- [ ] Meeting notes
- [ ] Optimization priorities (top 3 for next month)
- [ ] GitHub issues created for Phase 5 candidates
- [ ] Next meeting scheduled

---

## Deployment Readiness Verification

### [ ] Pre-Deployment Checks

- [ ] All code committed and pushed to main
- [ ] PR #817 merged ✅
- [ ] Tests passing (2202/2202)
- [ ] Build successful
- [ ] Cloudflare Pages deployment ✅

### [ ] Production Validation (Post-Deployment)

- [ ] Sentry DSN active in production
  ```bash
  curl https://realsyncdynamics.ai -I | grep sentry
  ```

- [ ] Performance events flowing
  - [ ] Sentry dashboard shows live data
  - [ ] Web Vitals visible
  - [ ] Component metrics visible
  - [ ] API calls tracked

- [ ] Alerts properly configured
  - [ ] 8 alert rules active
  - [ ] Slack integration working
  - [ ] Test alert fires correctly

- [ ] Dashboard accessible
  - [ ] All 9 widgets showing data
  - [ ] Team can view dashboard
  - [ ] Trending data visible

### [ ] Success Criteria ✅

- [x] PR #817 merged into main
- [ ] Sentry DSN activated in production
- [ ] 5-7 days baseline data collected
- [ ] All 8 alert rules configured and tested
- [ ] Performance dashboard published (9 widgets)
- [ ] Performance budgets defined (all pages)
- [ ] First monthly review completed
- [ ] Top 3 optimization candidates identified

---

## Issue Tracking

### Create GitHub Issues for Phase 5

For each of the top 3 slowest components:

**Issue Template**:
```markdown
Title: Perf: Optimize [ComponentName] render time

Body:
## Current Performance
- p95: XXms (baseline: YYms)
- Regression: +ZZms (AAA%)

## Root Cause
[Analysis from Phase 4]

## Optimization Strategy
[Recommended approach]

## Success Criteria
- p95: YYms target
- No error rate increase
- No regressions

## Effort
[Estimated days: N]

## Phase
Phase 5 optimization sprint
```

**Labels**:
- `perf-optimization`
- `tier-1|2|3`
- `priority-critical|high|medium`

---

## Sign-Off

**Phase 4 Execution Complete When**:

- [x] PR #817 merged
- [ ] Sentry DSN activated
- [ ] Baseline data collected (5-7 days)
- [ ] 8 alert rules active and tested
- [ ] Dashboard published and accessible
- [ ] Performance budgets defined
- [ ] Monthly review process established
- [ ] Phase 5 candidates identified

**Approvals**:

- [ ] Performance Engineer: Baseline data quality verified
- [ ] DevOps Lead: Alerts configured and tested
- [ ] Engineering Lead: Ready to begin Phase 5

---

## Next Steps

### Immediate (Today)
1. [ ] DevOps: Activate Sentry DSN
2. [ ] Performance Eng: Set up baseline collection
3. [ ] All: Review PHASE-4-QUICK-START.md

### Week 1-2
1. [ ] Collect baseline data (5-7 days)
2. [ ] Analyze Web Vitals
3. [ ] Analyze component performance
4. [ ] Analyze API performance

### Week 2
1. [ ] Configure 8 alert rules
2. [ ] Test alerts
3. [ ] Verify Slack integration

### Week 3
1. [ ] Build Sentry dashboard (9 widgets)
2. [ ] Define performance budgets
3. [ ] Publish dashboard to team

### Week 4+
1. [ ] First monthly review meeting
2. [ ] Generate monthly report
3. [ ] Identify Phase 5 candidates
4. [ ] Create optimization GitHub issues

---

**Status**: ✅ Ready to Execute  
**Start Date**: Now (post-PR #817 merge)  
**Duration**: 4 weeks  
**Next Phase**: Phase 5 Optimization Sprint (8 weeks)
