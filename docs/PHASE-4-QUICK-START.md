# Phase 4 Quick Start (After PR #817 Merge)

> ⏱️ **Timeline**: 4 weeks | **Start Date**: After PR #817 merges | **Target**: August 2026

## What is Phase 4?

Establish production performance baselines, configure alerts, and build a monitoring dashboard for the 54 performance-instrumented components deployed in Phase 3.

---

## Week 1: Baseline Collection (Days 1-7)

### Day 1: Activate Sentry
```bash
# Verify DSN is set in production
curl https://realsyncdynamics.ai -I | grep -i sentry

# Check Sentry dashboard
# https://sentry.io/projects/realsyncdynamicsai/
```

**Success**: Sentry dashboard shows incoming performance events

### Days 2-7: Collect Data
```bash
# Let production run normally for 5-7 days
# Monitor in Sentry dashboard:
#  - Web Vitals chart
#  - Transaction performance
#  - Component render times
```

---

## Week 2: Alert Configuration (Days 8-14)

### Create Tier 1 Alerts (Day 8)
Log into Sentry → Alerts → New Alert Rule:

**Alert 1: Component Render Time Spike**
```
Name: Tier 1 Component Render Time Spike
Condition:
  - event.type = transaction
  - environment = production
  - transaction matches GovernanceDashboard|ProtectedLayout
  - duration >= 300ms
Actions:
  - Slack: #perf-monitoring
  - Tag: severity:critical
```

**Alert 2: Web Vitals Regression**
```
Name: LCP Degradation
Condition:
  - metric.lcp >= 3500ms (75% of poor threshold)
  - avg(last_10_min)
Actions:
  - Slack: #perf-monitoring
```

### Create Tier 2 & 3 Alerts (Days 9-10)
Follow same pattern for Tier 2 (threshold: 500ms) and Tier 3 (threshold: 750ms)

### Create API Alerts (Days 11-12)
```
Name: Slow API Endpoint
Condition:
  - resource.type = fetch
  - duration > 2000ms
  - count(last_5_min) >= 3
Actions:
  - Slack: #perf-monitoring
```

### Smoke Test Alerts (Day 13)
```bash
# Trigger each alert type once to verify notifications work
curl -X POST https://realsyncdynamics.ai/api/test/slow-endpoint

# Verify Slack notifications received
```

---

## Week 3: Dashboard & Budgets (Days 15-21)

### Build Performance Dashboard (Days 15-18)
Log into Sentry → Dashboards → New Dashboard:

**Widgets to Add** (in order):
1. **Web Vitals Summary** (LCP, INP, CLS, TTFB, FCP)
2. **Component Performance by Tier** (3 cards: Tier 1/2/3)
3. **Slowest Components** (top 10)
4. **API Endpoint Performance** (sortable table)
5. **Recent Alerts** (last 48h)
6. **Performance Trends** (7-day chart)

**Configuration**:
- Auto-refresh: 5 minutes
- Time range: Last 24 hours (default)
- Save as "Performance Monitoring (Production)"
- Pin as default dashboard

### Define Performance Budgets (Days 18-20)
Create `docs/PERFORMANCE-BUDGETS.json`:

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
        "inp": "200ms"
      }
    }
  ]
}
```

**Template Available**: Reference existing `src/lib/performance/README.md`

### Document Baselines (Day 21)
Create `docs/PERFORMANCE-BASELINES.md`:

```markdown
# Production Performance Baselines

Generated: [date]

## Web Vitals
- LCP p95: 3200ms (baseline: 2500ms)
- INP p95: 220ms (baseline: 200ms)
- ...

## Component Performance
See COMPONENT-PERFORMANCE-BASELINES.json
```

**Scripts to Help**:
```bash
npm run perf:monthly-report --month 2026-07
```

---

## Week 4+: Recurring Process (Days 22+)

### Monthly Review Meeting
**Schedule**: 1st Wednesday of each month, 2:00 PM  
**Duration**: 1 hour  
**Attendees**: Team Lead, Performance Ops, Engineers  

**Agenda**:
1. Web Vitals Review (10 min)
2. Component Performance (20 min)
3. API Performance (15 min)
4. Budget Review (10 min)
5. Next Month Planning (5 min)

**Generate Report**:
```bash
npm run perf:monthly-report --month 2026-08 --slack
```

This creates: `docs/MONTHLY-PERFORMANCE-REPORTS/2026-08.md`  
And posts summary to `#perf-monitoring` Slack channel

### Optimization Priorities
From monthly review, select top 3 slowest components:

**Create GitHub issues** with:
```
Title: "Perf: Optimize [ComponentName] render time"
Body:
- Current p95: XXms (baseline: YYms)
- Regression: +Zms (AAA%)
- Estimated effort: [1-5] days
- Target: [new target time]
- Success metric: [criteria]
```

Label: `perf-optimization`, `tier-1|2|3`, `priority-critical`

---

## Verification Checklist

### End of Week 1
- [ ] Sentry receives performance events
- [ ] Web Vitals data visible (LCP, INP, CLS)
- [ ] Component render times tracked
- [ ] API calls monitored

### End of Week 2
- [ ] Tier 1 alerts configured and tested
- [ ] Tier 2 & 3 alerts configured and tested
- [ ] API alerts configured and tested
- [ ] Slack notifications verified
- [ ] No false positives

### End of Week 3
- [ ] Performance dashboard published
- [ ] All 9 widgets functioning
- [ ] Performance budgets defined (all pages)
- [ ] Baselines documented
- [ ] Team has dashboard access

### End of Week 4
- [ ] First monthly review completed
- [ ] Top 3 slowest components identified
- [ ] Optimization issues created
- [ ] Monthly report script tested
- [ ] Next month's review scheduled

---

## Common Commands

```bash
# View monthly report (interactive)
npm run perf:monthly-report

# Generate report for specific month
npm run perf:monthly-report --month 2026-08

# Generate + send to Slack
npm run perf:monthly-report --month 2026-08 --slack

# View performance baselines in console
npm run test -- src/lib/performance/
```

---

## Troubleshooting

### "Sentry shows no events"
1. Check `VITE_SENTRY_DSN` is set in GitHub secrets
2. Verify deployment includes DSN (check JS console)
3. Trigger test error: `console.error(new Error('test'))`
4. Wait 30 seconds and refresh Sentry

### "Alerts not triggering"
1. Verify alert rule conditions in Sentry
2. Check Slack webhook is configured
3. Manually trigger test condition
4. Review alert logs in Sentry → Alerts → Rules

### "Dashboard widgets show 'No data'"
1. Wait 24h for sufficient data
2. Verify query conditions match transaction names
3. Check time range (should be last 24h minimum)
4. Review Sentry documentation: https://docs.sentry.io/product/dashboards/

---

## Resources

- **Phase 4 Full Plan**: `docs/PHASE-4-PERFORMANCE-BASELINES.md`
- **Performance Monitoring README**: `src/lib/performance/README.md`
- **Sentry Docs**: https://docs.sentry.io/product/performance/
- **Web Vitals**: https://web.dev/vitals/
- **PR #817**: Performance monitoring infrastructure (Phase 1-3)

---

## Next Phase (Phase 5)

After Phase 4 baselines established:
1. **Optimization Sprint**: Fix top 3 slowest components
2. **Custom Metrics**: Add business-specific tracking
3. **RUM Dashboard**: Real User Monitoring visualization
4. **Quarterly Reviews**: Trend analysis and capacity planning
