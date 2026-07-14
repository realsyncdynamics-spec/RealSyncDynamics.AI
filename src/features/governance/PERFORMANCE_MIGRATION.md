# Governance Views Performance Monitoring Migration

Guide for systematically adding performance monitoring to all governance view components.

## Quick Start

### Option 1: Wrap Existing Component (Recommended for Large Components)

```typescript
// Before
export function GovernanceDashboardView() { ... }

// After
function _GovernanceDashboardView() { ... }

export const GovernanceDashboardView = withPerformanceMonitoring(
  _GovernanceDashboardView,
  'GovernanceDashboardView',
  { threshold: 1000, maxRenders: 5 }
);
```

### Option 2: Use Hook (Recommended for Simple Components)

```typescript
export function SimpleView() {
  usePerformanceMonitor('SimpleView', { threshold: 300 });
  // Component code
}
```

### Option 3: Use Helper Function

```typescript
export const GovernanceDashboardView = createMonitoredComponent(
  _GovernanceDashboardView,
  'GovernanceDashboardView'
);
```

## Priority List

### Tier 1: Critical Path (High Impact) — Week 1

These are used by most users daily and have the highest impact on perceived performance:

1. `GovernanceDashboardView` — main entry point
2. `AuditTrailView` — compliance verification
3. `ComplianceAnalyticsView` — executive reporting
4. `RiskCenterView` — risk monitoring
5. `AiActRiskInventoryView` — AI compliance tracking

**Thresholds:**
- Render time: 1000ms (may include data loading)
- Max re-renders: 5

### Tier 2: Data-Heavy Components (Medium Impact) — Week 2

These components work with large datasets and complex visualizations:

1. `EvidenceVaultView` — large file handling
2. `AuditReportAdvancedView` — report generation
3. `ComplianceReportView` — data aggregation
4. `IsoControlLibraryView` — large data sets
5. `Iso42001CertificationHubView` — complex workflows

**Thresholds:**
- Render time: 2000ms
- Max re-renders: 8

### Tier 3: Admin & Configuration (Lower Impact) — Week 3

These are used less frequently by power users:

1. `PolicyTemplatesView`
2. `ConnectorsView`
3. `IntegrationsView`
4. `GovernanceApiKeysView`
5. `AdminLogView`

**Thresholds:**
- Render time: 500ms
- Max re-renders: 10

## Implementation Steps

For each component following this pattern:

```typescript
// 1. Import the HOC
import { withPerformanceMonitoring } from './withPerformanceMonitoring';

// 2. Rename the original component with underscore prefix
function _MyView(props) {
  // Component logic unchanged
  return <div>...</div>;
}

// 3. Export wrapped version
export const MyView = withPerformanceMonitoring(
  _MyView,
  'MyView',
  { threshold: 500, maxRenders: 10 }
);
```

## Performance Baselines

Once monitoring is live, establish baselines by running for 1 week:

| Component | Expected P95 | Alert Threshold |
|-----------|-------------|-----------------|
| Dashboard | 800ms | 1500ms |
| Data View | 1500ms | 3000ms |
| Admin | 400ms | 800ms |

## Monitoring & Alerts

After implementation:

1. **Week 1-2**: Establish baselines in Sentry
2. **Week 3+**: Set up performance alerts for > 2x baseline
3. **Monthly**: Review top 10 slowest components
4. **Quarterly**: Optimize worst performers

## Gradual Rollout

### Phase 1: Week 1 (Top 5 Critical)
- Merge performance monitoring core (already done ✓)
- Add HOC utility (already done ✓)
- Instrument critical path views
- Gather baseline metrics

### Phase 2: Week 2 (Tier 2 Components)
- Instrument data-heavy views
- Monitor trends
- Identify optimization opportunities

### Phase 3: Week 3+ (Remaining Views)
- Complete coverage
- Create dashboards
- Set up automated alerts

## Optimization Opportunities

Once data collection starts, use metrics to identify:

- ✗ Slow initial renders (>1500ms) → code splitting, lazy loading
- ✗ Frequent re-renders (>10) → memoization, context optimization
- ✗ Large component bundles → tree-shaking, dynamic imports
- ✗ Database queries → caching, query optimization
- ✗ External API calls → batching, memoization

## Tools & Commands

```bash
# View performance metrics
npm run test -- src/features/governance/withPerformanceMonitoring.test.tsx

# Check if component is wrapped correctly
grep -r "withPerformanceMonitoring" src/features/governance/

# Generate performance report
npx claude @performance-report
```

## FAQ

**Q: Will HOC wrapping affect component behavior?**
A: No, the HOC is transparent. It only adds monitoring hooks, doesn't modify props or state.

**Q: Can I wrap lazy-loaded components?**
A: Yes, wrap the original component before the lazy() call:
```typescript
const View = lazy(() => import('./MyView').then(m => ({
  default: withPerformanceMonitoring(m.MyView, 'MyView')
})));
```

**Q: What if a component is already memoized?**
A: Wrap the memoized component:
```typescript
export const MyView = withPerformanceMonitoring(
  memo(_MyView),
  'MyView'
);
```

**Q: How do I exclude certain renders from metrics?**
A: Some renders (e.g., tooltips, modals) shouldn't count. Use conditional monitoring:
```typescript
const shouldMonitor = !isPopoverOpen;
if (shouldMonitor) {
  usePerformanceMonitor('MyView');
}
```

## Checklist

- [ ] Performance monitoring core implemented ✓
- [ ] HOC utility created ✓
- [ ] Tests written ✓
- [ ] Migration guide documented ✓
- [ ] Tier 1 components instrumented
- [ ] Tier 2 components instrumented
- [ ] Tier 3 components instrumented
- [ ] Baselines established
- [ ] Alerts configured
- [ ] Optimization plan created
