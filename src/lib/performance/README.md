# Performance Monitoring

Comprehensive performance monitoring system for the RealSyncDynamics.AI platform. Measures Core Web Vitals, tracks API/Edge Function performance, monitors resource usage, and reports issues to Sentry.

## Quick Start

Initialize on app startup in `main.tsx`:

```typescript
import { initPerformanceMonitoring } from './lib/performance';
initPerformanceMonitoring();
```

## Monitoring Systems

### 1. Web Vitals Tracking (`webVitals.ts`)

Measures Core Web Vitals and related performance metrics:
- **LCP** (Largest Contentful Paint): when the largest element renders (good ≤2.5s)
- **INP** (Interaction to Next Paint): input responsiveness (good ≤200ms)
- **CLS** (Cumulative Layout Shift): visual stability (good ≤0.1)
- **TTFB** (Time to First Byte): server response time (good ≤600ms)
- **FCP** (First Contentful Paint): when first element renders (good ≤1.8s)
- **DCL** (DOMContentLoaded): DOM ready time

Automatically reports poor/needs-improvement metrics to Sentry (10% sampling of good metrics).

```typescript
// Manual reporting (optional)
import { reportWebVital } from './lib/performance';
reportWebVital({
  name: 'LCP',
  value: 2300,
  rating: 'good',
  id: 'lcp-1'
});
```

### 2. Timing Utilities (`timing.ts`)

Measure and report operation durations. Automatically reports operations >1s to Sentry.

```typescript
import { startTimer, measureAsync, markStart, markEnd } from './lib/performance';

// Simple timer
const timer = startTimer('data-load');
// ... do work ...
const result = timer.end({ category: 'api', status: 'success' });
console.log(result.duration); // milliseconds
console.log(result.isSlow);   // true if > 1000ms

// Async operations
const data = await measureAsync('fetch-data', 
  () => fetch('/api/data').then(r => r.json())
);

// Performance marks (standard browser API)
markStart('route-change');
// ... navigate ...
markEnd('route-change');
```

### 3. Resource Monitoring (`resourceMonitoring.ts`)

Tracks fetch/XHR resource performance, including API calls and Edge Functions.

```typescript
import { trackedFetch, getSlowestResources, getFailedResources } from './lib/performance';

// Use wrapped fetch that tracks performance
const response = await trackedFetch('/api/data');

// Get performance metrics
const slowest = getSlowestResources(10);
const failed = getFailedResources();

slowest.forEach(r => {
  console.log(`${r.url} took ${r.duration}ms`);
});
```

Reports automatically:
- Slow resources (>3s)
- Failed requests (4xx, 5xx)
- Large payloads (>512 KB)

### 4. React Component Monitoring (`usePerformanceMonitor.ts`)

Hooks for monitoring component performance and re-renders.

```typescript
import { 
  usePerformanceMonitor, 
  usePerformanceSection,
  useRenderCount,
  useMemoryMonitor 
} from './lib/performance';

function MyComponent() {
  // Monitor render time (reports to Sentry if >50ms)
  usePerformanceMonitor('MyComponent', { threshold: 50 });

  // Monitor a specific section
  const stopMonitoring = usePerformanceSection('data-fetch');
  
  // Track excessive re-renders
  useRenderCount('MyComponent', 10); // warns if >10 renders
  
  // Monitor memory usage (Chrome only)
  useMemoryMonitor('MyComponent', 50 * 1024 * 1024); // 50 MB threshold

  return <div>...</div>;
}
```

### 5. Performance Analytics (`analytics.ts`)

Collect and analyze performance metrics over time.

```typescript
import { 
  MetricsCollector,
  recordMetric,
  getMetricStats,
  generatePerformanceReport,
  exportMetricsAsJson
} from './lib/performance';

// Record measurements
recordMetric('api-response-time', 150);
recordMetric('api-response-time', 200);
recordMetric('api-response-time', 180);

// Get statistics
const stats = getMetricStats('api-response-time');
console.log(stats);
// {
//   count: 3,
//   min: 150,
//   max: 200,
//   mean: 176.7,
//   median: 180,
//   p95: 200,
//   p99: 200,
//   stdDev: 22.1
// }

// Generate report
console.log(generatePerformanceReport());

// Export for analysis
const json = exportMetricsAsJson();
```

## Sentry Integration

All performance metrics automatically report to Sentry when configured:

1. **Web Vitals**: Each metric sent with rating (good/needs-improvement/poor)
2. **Slow Operations**: Operations >1s automatically reported as warnings
3. **Resource Performance**: Slow/failed requests tracked with context
4. **Component Performance**: Slow renders reported as debug-level messages

Reports include:
- Duration in milliseconds
- Category (api, render, database, component, route)
- Status (success, error, timeout)
- Custom tags and context for filtering

## Performance Thresholds

| Metric | Good | Needs Improvement | Poor |
|--------|------|------|------|
| LCP | ≤2.5s | 2.5s-4s | >4s |
| INP | ≤200ms | 200-500ms | >500ms |
| CLS | ≤0.1 | 0.1-0.25 | >0.25 |
| TTFB | ≤600ms | 600-1200ms | >1.2s |
| FCP | ≤1.8s | 1.8-3s | >3s |
| Operations | <1s | 1-3s | >3s |
| Resources | <3s | 3-10s | >10s |

## Privacy & DSGVO

- ✅ No user IDs or PII collected
- ✅ No IP addresses tracked
- ✅ Text content masked by default
- ✅ No session replays (can enable with explicit consent)
- ✅ Only errors and slow operations reported (good metrics sampled)

## Testing

Unit tests located in `test/performance/`:

```bash
npm test -- test/performance/
```

Tests cover:
- Timing accuracy
- Statistics computation (mean, median, p95, p99)
- Metrics collection and export
- Edge cases (empty data, outliers)

## Browser Support

Requires modern browser APIs:
- PerformanceObserver (Chrome 52+, Firefox 57+, Safari 14+)
- Navigation Timing API (all modern browsers)
- Resource Timing API (all modern browsers)

Gracefully degrades in older browsers (no-op if APIs unavailable).

## Common Patterns

### Measure API Call
```typescript
const timer = startTimer('fetch-users');
try {
  const users = await fetch('/api/users').then(r => r.json());
  timer.end({ category: 'api', status: 'success' });
  return users;
} catch (error) {
  timer.end({ category: 'api', status: 'error' });
  throw error;
}
```

### Measure Rendering
```typescript
import { usePerformanceMonitor } from './lib/performance';

function DataGrid({ items }) {
  usePerformanceMonitor('DataGrid', { 
    threshold: 100,
    extra: { itemCount: items.length }
  });
  return <div>{items.map(item => <div key={item.id}>{item.name}</div>)}</div>;
}
```

### Custom Analytics
```typescript
const collector = new MetricsCollector();

// Record each transaction
collector.record('transaction-time', 234);
collector.record('transaction-time', 178);
collector.record('transaction-time', 456);

// Analyze
const stats = collector.getStats('transaction-time');
if (stats.p95 > 500) {
  alert('P95 response time exceeds SLA');
}
```

## Monitoring Dashboard

Access performance data:
- **Sentry**: realsyncdynamicsai.sentry.io (error trends, slow operations)
- **Browser DevTools**: Performance tab, Network tab
- **Console**: `getMetricsCollector().generateReport()`
- **Export**: `exportMetricsAsJson()` for external analysis

## Future Enhancements

- [ ] Custom threshold configuration per environment
- [ ] Performance budgets enforcement
- [ ] Automated performance regression detection
- [ ] Field vs Lab metrics comparison
- [ ] Real User Monitoring (RUM) dashboard
- [ ] Third-party script impact analysis
