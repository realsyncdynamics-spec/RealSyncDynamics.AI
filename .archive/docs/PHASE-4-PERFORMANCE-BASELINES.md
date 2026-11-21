# Phase 4: Performance Baselines & Alerts (Post-PR #817)

## Overview

Phase 4 establishes production performance baselines in Sentry, configures threshold-violation alerts with auto-escalation, builds a custom performance dashboard, and defines page-level performance budgets. This phase begins after PR #817 (performance monitoring infrastructure) merges into main.

**Status**: Ready to execute after PR #817 merge  
**Components instrumented**: 54 governance views (Phase 3)  
**Baseline collection period**: 2 weeks (production data)  
**Target completion**: Before Q4 2026 launch

---

## Phase 4.1: Sentry Baseline Establishment (Week 1-2)

### Objective
Collect 2 weeks of production performance data to establish statistical baselines for all 54 instrumented components and define healthy vs. problematic ranges.

### Prerequisites
- PR #817 merged into main
- Sentry project created and DSN configured in GitHub secrets
- `VITE_SENTRY_DSN` deployed to Cloudflare Pages
- `initPerformanceMonitoring()` running in production

### Tasks

#### 1.1 Activate Sentry Integration (Day 1)

**Action**: Ensure Sentry DSN is active in production
```bash
# Verify DSN is set in GitHub secrets
gh secret list | grep VITE_SENTRY_DSN

# Verify production deployment has DSN
# Check Sentry project dashboard for incoming events
```

**Verification**:
- [ ] Sentry receives Web Vitals events (LCP, INP, CLS, etc.)
- [ ] React component render times visible in Sentry
- [ ] API/Edge Function timings tracked
- [ ] Error events flowing normally

#### 1.2 Establish Web Vitals Baselines (Days 2-8)

Monitor Core Web Vitals across all pages for **5 days**:

**Metrics to collect**:
- **LCP** (Largest Contentful Paint) - page interactivity
- **INP** (Interaction to Next Paint) - input responsiveness
- **CLS** (Cumulative Layout Shift) - visual stability
- **TTFB** (Time to First Byte) - server response
- **FCP** (First Contentful Paint) - visual completeness
- **DCL** (DOMContentLoaded) - DOM ready

**Query in Sentry**:
```
transactions.[web vitals] | avg(lcp), avg(inp), avg(cls), avg(ttfb), avg(fcp)
Grouped by: transaction (page route)
Time period: Last 5 days
```

**Baseline Thresholds** (from PR #817 README):

| Metric | Good | Needs Improvement | Poor |
|--------|------|---|---|
| LCP | ≤2.5s | 2.5-4s | >4s |
| INP | ≤200ms | 200-500ms | >500ms |
| CLS | ≤0.1 | 0.1-0.25 | >0.25 |
| TTFB | ≤600ms | 600-1.2s | >1.2s |
| FCP | ≤1.8s | 1.8-3s | >3s |

**Action**: Document baseline percentiles for each metric:
- p50 (median)
- p75
- p90
- p95
- p99

Store in `docs/PERFORMANCE-BASELINES.md` (created in task 1.3).

#### 1.3 Establish Component Render Baselines (Days 4-10)

Collect render times for all 54 governance components (wrapped in Phase 3):

**Sentry Query** (performance dashboard):
```
transactions.withPerformanceMonitoring
Duration by: component name
Time period: Last 7 days
Sample: All (not sampled)
```

**Baseline Data to Record**:
- **Tier 1 Components** (threshold: 200ms, max 5 re-renders)
  - Mean, p50, p95, p99 render times
  - Re-render frequency
  - Slowest 3 components
  
- **Tier 2 Components** (threshold: 350ms, max 8 re-renders)
  - Mean, p50, p95, p99 render times
  - Re-render frequency
  
- **Tier 3 Components** (threshold: 500ms, max 10 re-renders)
  - Mean, p50, p95, p99 render times
  - Re-render frequency

**Store baseline data** in:
```
docs/COMPONENT-PERFORMANCE-BASELINES.json
{
  "tier1": {
    "components": [
      {
        "name": "GovernanceDashboard",
        "render_ms": { "p50": 45, "p95": 120, "p99": 180 },
        "rerender_freq": "0.3/min",
        "status": "healthy"
      }
    ]
  },
  "tier2": { ... },
  "tier3": { ... }
}
```

#### 1.4 Establish API/Edge Function Baselines (Days 6-12)

Track timing for all Edge Functions and API calls:

**Sentry Query**:
```
transactions.api
Resource type: fetch, XHR
Grouped by: Resource URL
Duration: p50, p95, p99
Time period: Last 7 days
```

**Baseline Thresholds**:
- **API Calls**: <500ms (p95), <1s (p99)
- **Edge Functions**: <1s (p95), <2s (p99)
- **Database Queries**: <200ms (p95), <500ms (p99)

**Action**: Identify top 10 slowest API endpoints:
```
docs/API-PERFORMANCE-BASELINES.md
- Endpoint URL
- Current p95/p99
- Recommended optimization
```

---

## Phase 4.2: Sentry Alert Configuration (Week 2)

### Objective
Define threshold-violation alerts with auto-escalation for performance degradation.

### Tasks

#### 2.1 Define Alert Rules for Tier 1 Components (Days 8-10)

**Tier 1 Components** (highest priority):
- GovernanceDashboard
- ProtectedLayout
- AuthGate wrapper

**Alert Condition**:
```
IF transaction.duration > 300ms (1.5x baseline of 200ms)
AND avg(last_5_min) > threshold
THEN create alert
```

**Escalation**:
1. **Level 1** (yellow): p95 exceeds threshold for 5 min → Slack #perf-monitoring
2. **Level 2** (orange): p99 exceeds threshold for 5 min → Page team lead
3. **Level 3** (red): p99 exceeds 2x threshold for 2 min → Incident (PagerDuty)

**Sentry Configuration**:
```
Alert Rule Name: "Tier 1 Component Render Time Spike"
Conditions:
  - event.type = "transaction"
  - environment = "production"
  - transaction matches "GovernanceDashboard"
  - duration >= 300ms
  - count(last 5 minutes) >= 5

Actions:
  1. Create Slack notification in #perf-monitoring
  2. Tag alert with severity:critical
  3. Auto-attach to project board as "Performance Regression"
```

#### 2.2 Define Alert Rules for Tier 2 Components (Days 10-11)

**Tier 2 Components** (medium priority):
- Risk management views
- Scan detail views
- Security signals aggregation

**Alert Condition**:
```
IF transaction.duration > 500ms (1.5x baseline of 350ms)
AND avg(last_10_min) > threshold
THEN create alert
```

**Escalation**:
1. **Level 1** (yellow): p95 exceeds threshold for 10 min → Slack #perf-monitoring
2. **Level 2** (orange): p99 exceeds threshold for 10 min → Team notification
3. **Level 3** (red): Not auto-escalated (manual review)

#### 2.3 Define Alert Rules for Web Vitals (Day 11)

**Core Web Vitals Thresholds**:

```
Alert Rule: "LCP Regression"
Condition: avg(lcp, last_10_min) > 3.5s (75% of poor threshold)
Action: Slack notification, tag as "web-vitals-regression"

Alert Rule: "INP Degradation"
Condition: avg(inp, last_10_min) > 350ms
Action: Slack notification

Alert Rule: "CLS Spike"
Condition: avg(cls, last_10_min) > 0.2
Action: Slack notification
```

#### 2.4 Define API Performance Alerts (Day 12)

```
Alert Rule: "Slow API Endpoint"
Condition:
  - resource.url matches "/api/*" OR "/functions/*"
  - duration > 2000ms (exceeds p99 baseline)
  - count(last_5_min) >= 3

Action: Slack notification with endpoint, current p95, recommended action

Alert Rule: "API Error Rate Spike"
Condition:
  - status_code >= 500
  - count(last_5_min) >= 5

Action: PagerDuty incident (critical), Slack notification
```

---

## Phase 4.3: Sentry Performance Dashboard (Week 3)

### Objective
Build a custom Sentry dashboard for real-time performance monitoring across all components.

### Dashboard Configuration

#### 3.1 Main Performance Overview

**Widget 1: Web Vitals Summary** (top of dashboard)
```
Display:
- LCP: current p95 (vs. baseline)
- INP: current p95 (vs. baseline)
- CLS: current p95 (vs. baseline)
- TTFB: current p95 (vs. baseline)
Color coding:
- Green: within normal range
- Yellow: 1.2x baseline
- Red: >1.5x baseline
Time range: Last 24 hours
```

**Widget 2: Component Performance by Tier**
```
Cards for each tier:
- Tier 1: 3 components, avg render time, status
- Tier 2: 12 components, avg render time, status
- Tier 3: 39 components, avg render time, status

Click to expand → detailed per-component chart
```

**Widget 3: Slowest Components** (last 24h)
```
Top 10 components by render time:
- Component name
- Current p95
- Baseline p95
- Δ (delta from baseline)
- Status (healthy/warning/critical)
```

#### 3.2 API & Edge Function Performance

**Widget 4: API Endpoints Performance**
```
Sortable table:
- Endpoint URL
- Calls (last 24h)
- Current p95
- Baseline p95
- Δ
- Top 3 slowest calls (with context)
```

**Widget 5: Edge Function Timing**
```
For each Edge Function:
- Function name
- p50, p95, p99 duration
- Error rate
- Trend (↑/↓/→)
```

#### 3.3 Alerts & Incidents

**Widget 6: Recent Alerts** (last 48h)
```
List of triggered alerts:
- Alert type (component/api/web-vitals)
- Time triggered
- Severity (yellow/orange/red)
- Auto-resolution status
Click to view full context in Sentry
```

**Widget 7: Baseline Violations** (threshold breaches)
```
Components exceeding thresholds:
- Component
- Threshold
- Current value
- Duration of violation
- Action (manual investigation link)
```

#### 3.4 Trends & Historical

**Widget 8: Performance Trends** (last 7 days)
```
Line charts:
- Web Vitals trends (LCP, INP, CLS)
- Component render time trends
- API response time trends
Highlight baseline, good/needs-improvement/poor zones
```

**Widget 9: Weekly Summary**
```
Metrics:
- Components within baseline (%)
- Web Vitals status
- API health score
- Fastest improving component
- Most regressed component
- Recommended actions
```

### Dashboard Creation Steps

1. **Log into Sentry** → Project → Dashboards
2. **Create New Dashboard**: "Performance Monitoring (Production)"
3. **Add Widgets** (order as above)
4. **Set Auto-Refresh**: 5 minutes
5. **Pin to Top**: Make it the default dashboard
6. **Share Link**: `#perf-monitoring` Slack channel

---

## Phase 4.4: Performance Budgets (Week 3)

### Objective
Define page-level performance budgets aligned with tier thresholds.

### Page Budget Definitions

#### 4.1 Public Pages (Public Landing, Pricing, Audit)

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
        "total_css": "50KB",
        "total_images": "500KB"
      },
      "target_percentile": "p75"
    }
  ]
}
```

#### 4.2 Protected Pages (Auth-gated)

```json
{
  "pages": [
    {
      "route": "/app/governance",
      "name": "GovernanceDashboard",
      "tier": 1,
      "budgets": {
        "render_time": "200ms",
        "lcp": "3.0s",
        "inp": "200ms",
        "rerenders_per_minute": "5"
      },
      "target_percentile": "p95"
    }
  ]
}
```

#### 4.3 Governance Subdirectory Views

```json
{
  "pages": [
    {
      "route": "/governance/scans",
      "name": "ScansListView",
      "tier": 3,
      "budgets": {
        "render_time": "500ms",
        "list_render": "100ms",
        "api_timeout": "3000ms"
      },
      "target_percentile": "p95"
    }
  ]
}
```

**Storage**: `docs/PERFORMANCE-BUDGETS.json`

### Budget Enforcement

1. **CI/CD Check**: Add performance budget validation to CI pipeline
   ```bash
   npm run check:performance-budgets
   Fails if: any page exceeds budget by >10%
   ```

2. **Weekly Review**: Automated report in Slack
   ```
   📊 Performance Budget Summary (Weekly)
   ✅ 42 pages within budget
   ⚠️ 8 pages exceeding budget by 10-20%
   🔴 4 pages exceeding budget by >20%
   ```

3. **Remediation Process**:
   - Violation detected → Auto-create GitHub issue
   - Assign to team lead
   - Set deadline: fix within 2 weeks
   - Escalate to incident if critical tier

---

## Phase 4.5: Monthly Performance Review Cycle (Week 4+)

### Objective
Establish a recurring process to identify, prioritize, and optimize underperforming components.

### Process

#### 5.1 Monthly Review Meeting (every 1st Wednesday)

**Agenda** (1 hour):
1. **Web Vitals Review** (10 min)
   - Current p95 vs. baseline
   - Improvements/regressions
   - Action items

2. **Component Performance** (20 min)
   - Top 3 slowest components
   - Analysis: cause (code/resources/api calls)
   - Optimization strategy

3. **API Performance** (15 min)
   - Slowest endpoints
   - Error rates
   - Database query optimization opportunities

4. **Budget Review** (10 min)
   - Pages exceeding budgets
   - Remediation status
   - Timeline for fixes

5. **Next Month Planning** (5 min)
   - Optimization priorities
   - Baseline updates if needed

#### 5.2 Data Preparation Script

Create `scripts/generate-performance-report.ts`:

```typescript
async function generateMonthlyReport() {
  // Query Sentry for:
  // 1. Web Vitals trends
  // 2. Component render times (all 54)
  // 3. API/Edge Function performance
  // 4. Budget violations
  
  // Generate markdown report
  // Save to: docs/MONTHLY-PERFORMANCE-REPORTS/2026-08.md
  // Post summary to: #perf-monitoring Slack
}
```

**Usage**:
```bash
npm run perf:monthly-report
```

#### 5.3 Optimization Priorities

**Scoring Criteria** (highest priority first):
1. **Impact** (10 pts): Component usage frequency
2. **Severity** (8 pts): How much exceeds threshold
3. **Fix Effort** (5 pts): Estimated days to optimize (inverse)
4. **Business Value** (7 pts): Revenue/customer impact

**Top 3 Components Selected**: Generate GitHub issues with:
- Current performance metrics
- Recommended optimizations
- Estimated effort
- Success metrics (target p95)

---

## Implementation Checklist

### Pre-Execution (Merge PR #817)
- [ ] PR #817 merged into main
- [ ] Cloudflare Pages deployed successfully
- [ ] All 54 components instrumented and tested

### Week 1 (Days 1-7)
- [ ] Activate Sentry DSN in production
- [ ] Collect 5 days Web Vitals baseline data
- [ ] Collect 5 days component render baseline
- [ ] Collect 5 days API performance baseline
- [ ] Document baselines in `docs/PERFORMANCE-BASELINES.md`

### Week 2 (Days 8-14)
- [ ] Complete Web Vitals baseline analysis
- [ ] Complete component render baseline analysis
- [ ] Create Tier 1 alert rules in Sentry
- [ ] Create Tier 2 alert rules in Sentry
- [ ] Create Web Vitals alert rules
- [ ] Create API performance alert rules
- [ ] Verify alerts trigger correctly (smoke test)

### Week 3 (Days 15-21)
- [ ] Build performance overview widget
- [ ] Build component performance by tier widget
- [ ] Build slowest components widget
- [ ] Build API performance widget
- [ ] Build Edge Functions widget
- [ ] Build alerts/incidents widget
- [ ] Build trends widget
- [ ] Build weekly summary widget
- [ ] Publish dashboard to team
- [ ] Define performance budgets (all pages)
- [ ] Document budgets in `PERFORMANCE-BUDGETS.json`

### Week 4+ (Days 22+)
- [ ] Schedule first monthly review meeting
- [ ] Create performance report script
- [ ] Establish monthly optimization process
- [ ] Monitor baseline compliance
- [ ] Iterate on alert sensitivity
- [ ] Document learnings in runbook

---

## Success Metrics

✅ **Phase 4 Complete When**:
1. Sentry baselines established for all 54 components
2. All alert rules active and tested
3. Performance dashboard published to team
4. Performance budgets defined for all pages
5. First monthly review completed with optimization priorities
6. Top 3 components selected for optimization in Phase 5

---

## Phase 5 Preview (Post-Phase 4)

After Phase 4 baseline completion, Phase 5 will focus on:
- **Optimization Sprint**: Fix top 3 slowest components
- **Custom Metrics**: Add business-specific performance tracking
- **RUM Dashboard**: Real User Monitoring visualization
- **Performance Budgets Enforcement**: CI/CD integration
- **Quarterly Reviews**: Trend analysis and capacity planning

---

## References

- Performance Monitoring README: `src/lib/performance/README.md`
- Sentry Documentation: https://docs.sentry.io/product/performance/
- Web Vitals Guide: https://web.dev/vitals/
- Performance Budgets: https://web.dev/performance-budgets/
