# Phase 5: Performance Optimization Sprint & Custom Metrics

**Status**: Planning | **Start Date**: After Phase 4 Week 1-2 (baseline analysis complete)  
**Duration**: 8 weeks | **Target**: Optimize top 3 slowest components  
**Outcome**: 30-50% performance improvement on priority components

---

## Overview

Phase 5 begins after Phase 4 baseline data is collected (Week 1-2). Using production performance metrics, identify the top 3 slowest components and execute targeted optimizations. Simultaneously, build custom metrics infrastructure for business-specific KPIs and Real User Monitoring dashboard.

---

## Phase 5.1: Performance Analysis & Prioritization (Week 1-2 of Phase 5)

### Objective
Analyze Phase 4 baseline data to identify optimization candidates and quantify improvement potential.

### 1.1 Top 3 Slowest Components Identification

**Data Source**: Sentry performance dashboard (Phase 4 Week 1-2)

**Analysis Questions**:
1. Which 3 components have highest p95 render times?
2. Are slowdowns consistent or intermittent?
3. What's the improvement potential? (target: p95 < 50% of current)
4. What's the root cause? (code/API calls/bundle size/re-renders)

**Scoring Criteria**:
```
Priority Score = (Impact × Severity × FixEffort⁻¹) + BusinessValue

Impact (0-10):
  - Number of daily users who hit component
  - Criticality to user workflows
  
Severity (0-10):
  - How much exceeds threshold (1.5x = 5pts, 2x = 8pts, 3x+ = 10pts)
  - Consistency of slowness

FixEffort (1-5 days):
  - Code complexity analysis
  - API call count
  - Bundle size contribution
  
BusinessValue (0-10):
  - Revenue impact if optimized
  - Customer satisfaction
  - Competitive advantage
```

### 1.2 Root Cause Analysis Template

For each top 3 component, document:

```markdown
## Component: [Name]

### Baseline Performance
- Current p95: XXms (target: YYms)
- Current p99: XXms
- Regression: +ZZms from baseline
- Impact: NN users/day affected

### Root Cause Analysis

**Hypothesis 1**: Excessive re-renders
- Current render count: N/min
- Expected: M/min
- Evidence: [React DevTools profiles]

**Hypothesis 2**: Slow API calls
- Critical path call: /api/endpoint
- Current latency: XXms (p95)
- Expected: YYms
- Evidence: [Network tab screenshot]

**Hypothesis 3**: Large bundle contribution
- Component bundle: XXkB (N% of page)
- Could split: [list possible code splits]
- Evidence: [bundle analysis]

### Recommended Optimization Strategy

1. **Priority**: [Hypothesis 1/2/3]
2. **Approach**: [specific technique]
3. **Effort**: [N days]
4. **Expected Result**: [p95 target]
5. **Risk**: [what could go wrong]
6. **Rollback Plan**: [how to revert safely]
```

### 1.3 Optimization Prioritization Meeting

**Timing**: End of Phase 4 Week 2 / Start of Phase 5 Week 1

**Attendees**: Engineering Lead, Performance Engineer, Component Owners

**Output**: 
- Top 3 components selected
- Root cause identified
- Optimization approach approved
- Timeline committed
- GitHub issues created

---

## Phase 5.2: Optimization Execution (Week 2-7)

### Objective
Implement targeted optimizations for top 3 components with measurable p95 improvements.

### Optimization Techniques by Root Cause

#### A. Excessive Re-renders
**Symptoms**: Component renders >10/min, p95 >350ms

**Optimization Approaches**:
1. **Memoization**
   ```typescript
   // Wrap expensive computations
   const memoizedData = useMemo(() => expensiveCalculation(props), [props]);
   ```

2. **useCallback for event handlers**
   ```typescript
   const handleClick = useCallback(() => { /* ... */ }, [deps]);
   ```

3. **React.memo for child components**
   ```typescript
   export const OptimizedChild = React.memo(({ data }) => <div>{data}</div>);
   ```

4. **Code splitting with React.lazy**
   ```typescript
   const HeavyComponent = lazy(() => import('./HeavyComponent'));
   ```

**Expected Improvement**: 40-60% render time reduction

#### B. Slow API Calls
**Symptoms**: Component waits for API response, critical path >1s

**Optimization Approaches**:
1. **Parallel requests**
   ```typescript
   const [data1, data2] = await Promise.all([fetch1(), fetch2()]);
   ```

2. **Request caching**
   ```typescript
   const cache = new Map();
   // Avoid redundant calls within same render
   ```

3. **Early data fetching**
   - Start fetch on route change, not on component mount
   - Use React Router loaders

4. **GraphQL query optimization**
   - Request only needed fields
   - Batch related queries

5. **API endpoint optimization**
   - Add caching headers (Cache-Control, ETag)
   - Implement pagination for large datasets
   - Consider database query optimization

**Expected Improvement**: 30-50% latency reduction

#### C. Large Bundle Contribution
**Symptoms**: Component adds >100kB to bundle, slow first render

**Optimization Approaches**:
1. **Code splitting at route level**
   ```typescript
   const GovernanceDashboard = lazy(() => import('./GovernanceDashboard'));
   ```

2. **Dynamic imports for optional features**
   ```typescript
   const AdvancedCharts = await import('./AdvancedCharts');
   ```

3. **Tree-shaking unused code**
   - Remove dead code paths
   - Replace lodash with ES6 equivalents
   - Check for duplicate dependencies

4. **Image optimization**
   - Use next-gen formats (WebP)
   - Lazy load images
   - Optimize SVGs

5. **Library alternatives**
   - Replace recharts with lightweight chart library for simple cases
   - Consider preact for UI-heavy components

**Expected Improvement**: 20-40% bundle size reduction + 50%+ slower first render

### 2.1 Implementation Workflow

For each component:

**Week 1: Optimization**
- [ ] Create optimization branch (`perf/optimize-[component]`)
- [ ] Implement changes (1-3 techniques)
- [ ] Run performance profiling (React DevTools, Lighthouse)
- [ ] Verify p95 improvement locally

**Week 2: Testing & QA**
- [ ] Run full test suite
- [ ] E2E tests for affected features
- [ ] Manual QA (functionality, visual regression)
- [ ] Performance comparison (before/after)

**Week 3: Code Review & Merge**
- [ ] PR review with team
- [ ] Address feedback
- [ ] Merge to main
- [ ] Monitor Sentry for regressions

**Week 4: Production Validation**
- [ ] Monitor production metrics
- [ ] Compare p95 vs baseline (target: 30-50% improvement)
- [ ] Measure user impact (page load time, interaction latency)
- [ ] Document results

### 2.2 Performance Improvement Measurement

**Baseline** (from Phase 4):
```
Component A:
- p95: 450ms
- p99: 680ms
- Error rate: 0.2%
```

**Target** (30-50% improvement):
```
Component A:
- p95: 225-315ms (30-50% reduction)
- p99: 340-476ms
- Error rate: 0% (no regressions)
```

**Success Criteria**:
- [ ] p95 meets target within 5% tolerance
- [ ] No increase in error rate
- [ ] No significant memory increase
- [ ] User satisfaction improves (survey/feedback)

---

## Phase 5.3: Custom Metrics Implementation (Week 3-6)

### Objective
Extend performance monitoring with business-specific KPIs and custom metrics.

### 3.1 Custom Metrics Strategy

Beyond Core Web Vitals, measure:

#### Business Metrics
```typescript
// Record business-critical operations
recordMetric('checkout-duration', checkoutTimeMs);
recordMetric('form-submission-time', submitTimeMs);
recordMetric('data-export-size', sizeBytes);
recordMetric('search-result-count', resultCount);
```

#### User Experience Metrics
```typescript
// Interaction quality
recordMetric('first-interaction-delay', delayMs);
recordMetric('interaction-duration', durationMs);
recordMetric('page-transition-time', transitionMs);
```

#### Feature-Specific Metrics
```typescript
// Governance-specific
recordMetric('vvt-generation-time', durationMs);
recordMetric('scan-completion-time', durationMs);
recordMetric('risk-heatmap-render-time', durationMs);
recordMetric('webhook-delivery-latency', latencyMs);
```

### 3.2 Custom Metrics Implementation

Create `src/lib/performance/customMetrics.ts`:

```typescript
import * as Sentry from '@sentry/react';

interface CustomMetricOptions {
  category?: string;
  tags?: Record<string, string>;
  sampling?: number;
  threshold?: number;
}

export function recordCustomMetric(
  name: string,
  value: number,
  options?: CustomMetricOptions
): void {
  const { category, tags = {}, sampling = 1.0, threshold } = options || {};

  // Only report if exceeds threshold
  if (threshold && value < threshold) return;

  // Sample based on value (report all "bad" metrics, sample "good" ones)
  if (Math.random() > sampling) return;

  Sentry.captureMessage(`Custom Metric: ${name}`, 'info', {
    tags: {
      metric_name: name,
      category: category || 'custom',
      ...tags,
    },
    contexts: {
      metric: {
        name,
        value,
        unit: 'ms',
        ...options,
      },
    },
    level: value > (threshold || 1000) ? 'warning' : 'info',
  });
}

// Helper for timing operations
export function measureCustomOperation<T>(
  name: string,
  fn: () => T | Promise<T>,
  options?: CustomMetricOptions
): T | Promise<T> {
  const start = performance.now();
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.finally(() => {
        const duration = performance.now() - start;
        recordCustomMetric(name, duration, options);
      });
    }
    const duration = performance.now() - start;
    recordCustomMetric(name, duration, options);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    recordCustomMetric(name, duration, { ...options, tags: { error: 'true' } });
    throw error;
  }
}
```

### 3.3 Integration Points

Add custom metrics to critical paths:

**A. Governance VVT Generation**
```typescript
// src/features/governance/vvt/RuntimeVvtView.tsx
const entries = await measureCustomOperation(
  'vvt-entry-generation',
  () => fetchVvtEntries(tenantId),
  { category: 'governance', threshold: 2000 }
);
```

**B. Scan Completion**
```typescript
// src/features/governance/scans/ScansListView.tsx
const handleScan = async (site) => {
  await measureCustomOperation(
    'scan-completion',
    () => triggerTenantAudit(tenantId, url),
    { category: 'scans', tags: { site_id: site.id } }
  );
};
```

**C. API Calls**
```typescript
// Wrap fetch globally
const wrappedFetch = (url, options) => {
  return measureCustomOperation(
    `api-${new URL(url).pathname}`,
    () => fetch(url, options),
    { category: 'api', threshold: 1000 }
  );
};
```

---

## Phase 5.4: Real User Monitoring Dashboard (Week 5-7)

### Objective
Build Sentry dashboard for Real User Monitoring (RUM) showing field performance data from production users.

### 4.1 RUM Data Collection

Leverage existing Sentry integration to collect field data:

```
Production Users
    ↓
Performance Events (Sentry)
    ↓
Web Vitals + Custom Metrics
    ↓
Sentry Dashboard + Alerts
```

### 4.2 RUM Dashboard Widgets

**Widget 1: Field vs Lab Comparison**
```
Metric     Lab (Lighthouse)  Field (Sentry)  Status
LCP        2.8s              3.2s            ⚠️ +14%
INP        180ms             195ms           ✅ +8%
CLS        0.08              0.12            ⚠️ +50%
```

**Widget 2: User Experience Metrics**
```
- Interaction to Next Paint (INP)
- First Input Delay (FID) [deprecated]
- Time to Interactive (TTI)
- User interactions by type (click, scroll, input)
```

**Widget 3: Business Metrics Trends**
```
- Checkout duration (weekly)
- Form submission success rate
- Search result load time
- Export completion time
```

**Widget 4: Geographic Performance**
```
Performance by region/country
- Browser type distribution
- Network type impact
- Device type breakdown
```

**Widget 5: Performance Anomalies**
```
- Sudden slowdowns (auto-detected)
- Error rate spikes
- Resource failures
- User impact assessment
```

### 4.3 Dashboard Configuration

```
RUM Performance Dashboard (Production)
├─ Field vs Lab Comparison (top)
├─ Web Vitals Trends (7-day)
├─ Custom Metrics (business KPIs)
├─ User Experience Breakdown
├─ Geographic Performance
└─ Anomalies & Alerts
```

**Setup Steps**:
1. Log into Sentry
2. Dashboards → New Dashboard
3. Add RUM-specific widgets
4. Set time range: Last 7 days (default)
5. Enable auto-refresh: 5 min
6. Share with team

---

## Phase 5.5: Quarterly Performance Review Process (Week 8+)

### Objective
Establish recurring quarterly performance reviews to track trends and capacity planning.

### 5.1 Quarterly Review Meeting

**Schedule**: Quarterly (Jan, Apr, Jul, Oct)  
**Duration**: 2 hours  
**Attendees**: Engineering Lead, DevOps, Performance Engineer, Team

**Agenda**:

1. **Performance Trends** (30 min)
   - How did metrics trend over 3 months?
   - p95/p99 comparison vs baseline
   - Best performing components
   - Worst performing components

2. **Optimization Impact** (20 min)
   - Measure Phase 5 improvements
   - Did top 3 components hit targets?
   - What was the user impact?
   - ROI: Development time vs performance gain

3. **Capacity Planning** (20 min)
   - User growth vs performance
   - Is current performance sustainable?
   - Forecast: Where will performance be in 3 months?
   - Scaling concerns?

4. **Strategic Priorities** (20 min)
   - Next quarter optimization targets
   - Identify emerging bottlenecks
   - Plan infrastructure improvements
   - Risk assessment

5. **Action Items** (10 min)
   - Assign owners for next quarter
   - Set performance targets/SLOs
   - Schedule monthly reviews
   - Document decisions

### 5.2 Quarterly Performance Report Template

```markdown
# Q3 2026 Performance Review

## Executive Summary
- Overall performance trend: ↑ Improving / ↓ Degrading / → Stable
- User impact: XX% improved / degraded
- Business value created: $XXX

## Key Metrics
| Metric | Q2 | Q3 | Δ | Status |
|--------|----|----|---|--------|
| LCP p95 | 3.2s | 2.9s | -10% | ✅ |
| Component render p95 | 280ms | 185ms | -34% | ✅ |
| API latency p95 | 450ms | 380ms | -16% | ✅ |

## Phase 5 Results
- Top 3 optimizations: 35% average improvement
- Custom metrics: 8 new business KPIs tracked
- RUM dashboard: Deployed, 12 dashboards created

## Capacity Analysis
- Users: 5,000 → 6,200 (+24%)
- Performance: Slight degradation due to growth
- Forecast: Will exceed target in Q4 if unaddressed

## Q4 Planning
- Increase caching layer
- Implement CDN for static assets
- Optimize database queries (batch requests)

## Sign-off
- Engineering Lead: [signature] Date: [date]
- DevOps Lead: [signature] Date: [date]
```

### 5.3 Continuous Improvement Culture

**Establish Norms**:
1. **Weekly Performance Check** (5 min)
   - Any alerts? Regressions?
   - Quick troubleshoot and assign

2. **Monthly Performance Review** (from Phase 4)
   - Deep dive into trends
   - Optimization prioritization

3. **Quarterly Strategic Review** (Phase 5)
   - Capacity planning
   - Roadmap alignment

4. **Annual Performance Summit**
   - Retrospective on year
   - Lessons learned
   - Setting next year's targets

---

## Success Metrics

### Phase 5 Complete When:

✅ **Optimization Sprint**:
- Top 3 components optimized (30-50% p95 improvement)
- Zero regressions introduced
- All changes merged and deployed
- User satisfaction improved (measurable)

✅ **Custom Metrics**:
- 8+ business-specific KPIs tracked
- Integrated into Sentry
- Used in decision-making

✅ **RUM Dashboard**:
- Published and accessible to team
- 5+ dashboard widgets operational
- Field data flowing from production

✅ **Review Process**:
- First quarterly review completed
- Trends documented
- Next quarter priorities set
- Team trained on process

---

## Timeline

### Week 1-2: Analysis & Planning
- [ ] Collect Phase 4 baseline data
- [ ] Identify top 3 slowest components
- [ ] Root cause analysis
- [ ] Prioritization meeting
- [ ] Optimization plan approved

### Week 2-4: Component 1 Optimization
- [ ] Implement optimizations
- [ ] Performance testing
- [ ] Code review
- [ ] Merge to main
- [ ] Production validation

### Week 4-6: Component 2 & 3 Optimization
- [ ] Parallel optimization efforts
- [ ] Same testing/review process
- [ ] Production validation

### Week 3-6: Custom Metrics Implementation
- [ ] Extend metrics.ts
- [ ] Integration points
- [ ] Sentry configuration
- [ ] Testing

### Week 5-7: RUM Dashboard
- [ ] Widget design
- [ ] Sentry dashboard setup
- [ ] Team training
- [ ] Documentation

### Week 8+: Quarterly Review Process
- [ ] Schedule first review
- [ ] Prepare report
- [ ] Conduct review
- [ ] Set Q4 targets

---

## Risk Assessment

### Low Risk ✅
- Optimization techniques are battle-tested
- Custom metrics use existing Sentry
- Dashboard is read-only monitoring

### Mitigation
- A/B test performance improvements if possible
- Gradual rollout of major optimizations
- Rollback plan for each optimization
- Monitor production closely after deploy

---

## Files to Create

### Code
```
src/lib/performance/
├── customMetrics.ts      # Custom metrics recording
├── rumDashboard.ts       # RUM configuration
└── optimizations/
    ├── Component1.optimization.md
    ├── Component2.optimization.md
    └── Component3.optimization.md
```

### Documentation
```
docs/
├── PHASE-5-OPTIMIZATION-SPRINT.md (this file)
├── PHASE-5-COMPONENT-OPTIMIZATIONS/
│   ├── Component1-optimization-plan.md
│   ├── Component2-optimization-plan.md
│   └── Component3-optimization-plan.md
└── QUARTERLY-PERFORMANCE-REVIEWS/
    ├── Q3-2026-review.md
    └── Q4-2026-plan.md
```

---

## References

- Phase 4 Baselines: `docs/PHASE-4-PERFORMANCE-BASELINES.md`
- Performance Monitoring: `docs/PERFORMANCE-MONITORING-PROGRAM.md`
- Web Vitals Optimization: https://web.dev/vitals/
- React Performance: https://react.dev/reference/react/useMemo
- Sentry RUM: https://docs.sentry.io/product/rum/

---

**Phase 5 Timeline**: 8 weeks (starts after Phase 4 Week 1-2)  
**Expected Outcome**: 30-50% performance improvement on priority components + custom metrics + RUM dashboard  
**Success**: Measurable improvement in user experience and business KPIs
