# Performance Monitoring Integration Guide

Strategic guide for integrating performance monitoring into key application areas.

## Priority Areas for Integration

### Tier 1: Critical User Paths (High Priority)

These paths are used by most users and directly impact perception of app performance:

#### 1. Authentication & Login
- **File**: `src/features/auth/`, `src/features/supabase/`
- **Metrics to Track**:
  - Sign-up API call duration
  - Login/auth verification time
  - OAuth callback processing
- **Integration Pattern**:
  ```typescript
  const token = await measureAsync('oauth-exchange', 
    () => exchangeAuthCode(code)
  );
  ```

#### 2. Dashboard Loading (DashboardRouter)
- **File**: `src/features/governance/dashboard/DashboardRouter.tsx`
- **Metrics to Track**:
  - Initial data fetch duration
  - Component render time
  - Chart rendering time
- **Integration Pattern**:
  ```typescript
  function DashboardRouter() {
    usePerformanceMonitor('DashboardRouter', { threshold: 500 });
    // ... component code
  }
  ```

#### 3. Data Grid / Table Rendering
- **File**: `src/features/governance/*View.tsx`
- **Metrics to Track**:
  - Data fetch time
  - Row rendering time (per 100 rows)
  - Filter/sort operations
- **Integration Pattern**:
  ```typescript
  const filteredData = await measureAsync('filter-data', 
    () => applyFilters(data, filters)
  );
  ```

#### 4. Scan Operations (Audit/Cookie Scanner)
- **File**: `src/pages/CookieScanner.tsx`, `src/unified-entry/pages/ScanEntryPage.tsx`
- **Metrics to Track**:
  - Scan job submission time
  - Scan completion polling
  - Result processing time
- **Integration Pattern**:
  ```typescript
  const results = await measureAsync('scan-process', 
    () => processScanResults(rawResults),
    { category: 'api', tags: { scanType: 'cookie' } }
  );
  ```

### Tier 2: Performance-Critical Components (Medium Priority)

Components with significant computation or large data sets:

#### 1. Governance Analytics Dashboard
- **File**: `src/features/governance/analytics/DashboardAnalyticsView.tsx`
- **Focus**: Chart rendering, data aggregation
- **Monitoring**: Component render time, data processing time

#### 2. Evidence Vault
- **File**: `src/features/governance/evidence/EvidenceVaultView.tsx`
- **Focus**: Large file handling, visualization
- **Monitoring**: PDF generation, asset loading, render time

#### 3. AI System Registry
- **File**: `src/features/governance/ai-registry/AiSystemRegistryView.tsx`
- **Focus**: Complex data model, nested relationships
- **Monitoring**: Data fetch, filtering, sorting

#### 4. Runtime Visualization Components
- **File**: `src/components/runtime/*`
- **Focus**: SVG/Canvas rendering
- **Monitoring**: Render time, re-render frequency

### Tier 3: API & Edge Function Integration (Ongoing)

Automatically track all API calls:

#### 1. Supabase Calls
- **Pattern**: Wrap Supabase client calls with `measureAsync()`
- **Example**:
  ```typescript
  const data = await measureAsync('fetch-policies', 
    () => supabase.from('policies').select()
  );
  ```

#### 2. Edge Functions
- **Pattern**: Use `trackedFetch()` wrapper
- **Example**:
  ```typescript
  const result = await trackedFetch(
    '/functions/v1/ai-invoke',
    { method: 'POST', body: JSON.stringify(payload) }
  );
  ```

#### 3. External APIs
- **Pattern**: Wrap with `measureAsync()` and error handling
- **Example**:
  ```typescript
  const data = await measureAsync('stripe-api-call',
    () => fetch('https://api.stripe.com/...'),
    { category: 'api', tags: { provider: 'stripe' } }
  );
  ```

## Integration Patterns

### Pattern 1: Measure a Single Operation

```typescript
import { startTimer } from '@/lib/performance';

const timer = startTimer('operation-name');
try {
  const result = await doSomething();
  timer.end({ status: 'success', category: 'api' });
  return result;
} catch (error) {
  timer.end({ status: 'error' });
  throw error;
}
```

### Pattern 2: Measure Async Operations

```typescript
import { measureAsync } from '@/lib/performance';

const result = await measureAsync(
  'fetch-user-data',
  () => fetchUserData(userId),
  { category: 'api', tags: { endpoint: '/users' } }
);
```

### Pattern 3: Monitor Component Performance

```typescript
import { usePerformanceMonitor, useRenderCount } from '@/lib/performance';

function MyDashboard() {
  // Monitor render time (reports if >100ms)
  usePerformanceMonitor('MyDashboard', { threshold: 100 });
  
  // Warn if renders more than 5 times
  useRenderCount('MyDashboard', 5);
  
  return <div>...</div>;
}
```

### Pattern 4: Track Resource Performance

```typescript
import { trackedFetch, getSlowestResources } from '@/lib/performance';

// Use for automatic resource tracking
const response = await trackedFetch('/api/data');

// Later: analyze performance
const slowest = getSlowestResources(10);
console.log('Slowest resources:', slowest);
```

### Pattern 5: Custom Metrics Collection

```typescript
import { recordMetric, getMetricStats } from '@/lib/performance/analytics';

// Record individual measurements
recordMetric('api-response-time', 245);
recordMetric('api-response-time', 312);

// Get statistics
const stats = getMetricStats('api-response-time');
console.log(`Mean: ${stats.mean.toFixed(0)}ms, P95: ${stats.p95.toFixed(0)}ms`);
```

## Implementation Checklist

### Phase 1: Core Paths (Week 1)
- [ ] Add `usePerformanceMonitor` to DashboardRouter
- [ ] Instrument auth flow with `measureAsync`
- [ ] Wrap Supabase queries with timing
- [ ] Set up resource monitoring for API calls

### Phase 2: Components (Week 2)
- [ ] Add monitoring to data grid components
- [ ] Instrument chart rendering in analytics
- [ ] Monitor scan operations
- [ ] Track PDF generation performance

### Phase 3: Analysis (Week 3)
- [ ] Create performance dashboard
- [ ] Set up Sentry alerts for SLA violations
- [ ] Document performance baselines
- [ ] Identify optimization opportunities

## Sentry Dashboard Queries

Once metrics are flowing, use these queries in Sentry:

### Find Slow Operations
```
tag:perf.slow:true order:timestamp
```

### Track Specific Endpoint Performance
```
contexts.performance.url:/api/users AND tag:resource.error:false
```

### Monitor Component Render Times
```
message:"Slow component render" tag:component.name:DashboardRouter
```

## Performance Budgets

Recommended thresholds by component type:

| Component | Metric | Good | Warning | Alert |
|-----------|--------|------|---------|-------|
| Dashboard | Load | <2s | 2-4s | >4s |
| Data Grid | Render 100 rows | <500ms | 500-1000ms | >1000ms |
| API Call | Response | <1s | 1-3s | >3s |
| Component | Render | <50ms | 50-100ms | >100ms |
| Chart | Initial Render | <1s | 1-2s | >2s |

## Best Practices

### ✅ DO
- Measure user-visible operations (render, API calls)
- Use meaningful operation names (`fetch-user-data` not `op1`)
- Include context (category, tags) for filtering
- Sample good metrics (10% default) to reduce noise
- Report errors to investigate failures

### ❌ DON'T
- Measure every single function call (too noisy)
- Use generic names that don't describe the operation
- Leave hard-coded thresholds (use configurable budgets)
- Forget error handling in monitored code
- Over-sample metrics (impacts performance)

## Monitoring Checklist

For each instrumented area:

- [ ] Operation completes (either success or error)
- [ ] Measurement sent to Sentry
- [ ] Can filter by category in Sentry
- [ ] Can identify slow outliers (p95/p99)
- [ ] Alert threshold defined
- [ ] Baseline established
- [ ] Regular review of metrics

## Resources

- [Web Vitals Guidance](https://web.dev/vitals/)
- [Performance API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Performance)
- [Sentry Performance Monitoring](https://docs.sentry.io/product/performance/)
- [React Performance Optimization](https://react.dev/learn/render-and-commit)
