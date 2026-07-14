# Phase 5: Component Optimization Template

Use this template for each of the top 3 slowest components identified during Phase 4 baseline analysis.

---

## Component: [Name]

**Tier**: [1/2/3]  
**Current Status**: Slowest component #[1/2/3]  
**Optimization Week**: [Week 2-7 of Phase 5]

---

## 1. Baseline Performance

### Current Metrics (from Phase 4)
- **p50**: XXms
- **p95**: XXms (⚠️ target: YYms = 30-50% reduction)
- **p99**: XXms
- **Re-renders/min**: NN
- **Error rate**: N.N%
- **Users affected/day**: NNNN

### Regression Analysis
- **Baseline threshold**: [tier threshold]ms
- **Current excess**: +ZZms ([AAA]% over threshold)
- **User impact**: [describe impact on UX/workflow]

### Phase 4 Baseline Data
[Link to Sentry dashboard or performance report]

---

## 2. Root Cause Analysis

### Hypothesis 1: [Primary suspected cause]

**Evidence**:
- [Specific observation from profiling]
- [Performance timeline showing pattern]
- [Code snippet showing the issue]

**Scoring**: [High/Medium/Low likelihood]

**Example**: Excessive Re-renders
```typescript
// Suspected issue in src/features/governance/xyz/XyzView.tsx
// Component re-renders on every parent state change even if
// component-specific data unchanged

useEffect(() => {
  // Missing dependency: should be []
  setLocalState(data);
}, []); // ❌ Missing dependency
```

---

### Hypothesis 2: [Secondary suspected cause]

**Evidence**:
- [Observation]
- [Code pattern]

**Scoring**: [High/Medium/Low likelihood]

**Example**: Slow API Calls
```
API Critical Path:
1. Component mounts → fetch /api/endpoint
2. Response takes 800ms (p95) = 80% of component render time
3. Blocks other operations until resolved

Network timeline:
- DNS: 20ms
- Connect: 50ms
- Request: 10ms
- Server processing: 600ms ⚠️ [bottleneck]
- Transfer: 120ms
```

---

### Hypothesis 3: [Tertiary suspected cause]

**Evidence**:
- [Observation]
- [Bundle analysis]

**Scoring**: [High/Medium/Low likelihood]

---

## 3. Optimization Strategy

### Recommended Approach: [Hypothesis 1 / 2 / 3]

**Rationale**:
- [Why this is likely root cause]
- [Why this optimization has highest ROI]
- [Effort vs. impact analysis]

### Optimization Technique

#### Technique Name: [e.g., "Memoization of expensive computations"]

**Description**:
[Explain what will change and why it helps]

**Code Changes**:
```typescript
// BEFORE (slow)
function XyzView() {
  const filteredData = data.filter(item => item.category === filter);
  return <DataGrid data={filteredData} />;
}

// AFTER (optimized)
function XyzView() {
  const filteredData = useMemo(
    () => data.filter(item => item.category === filter),
    [data, filter]
  );
  return <DataGrid data={filteredData} />;
}
```

**Expected Impact**:
- Render time reduction: [estimate]%
- Re-render frequency: [estimate]% reduction
- User interaction improvement: [describe]

**Risk Assessment**:
- ✅ Low risk: [why this is safe]
- ⚠️ Watch for: [edge cases to test]
- ❌ Breaking changes: [none expected / describe if applicable]

---

### Optimization Technique #2 (if applicable)

[Same structure as above]

---

## 4. Implementation Plan

### Timeline
- **Week 1 (Days 1-2)**: Branch creation, change implementation
- **Week 1 (Days 3-4)**: Local performance testing, profiling
- **Week 2 (Days 1-2)**: Code review, feedback incorporation
- **Week 2 (Days 3-4)**: Merge to main, staging deployment
- **Week 2 (Days 5)**: Production validation, monitoring

### Testing Strategy

#### A. Performance Testing (Local)

**Tools**: React DevTools Profiler, Lighthouse

**Test Cases**:
1. **Baseline measurement**
   ```
   - Open React DevTools Profiler
   - Render component
   - Record: render time, re-renders
   - Take screenshot
   ```

2. **Optimized measurement**
   ```
   - Apply optimization
   - Repeat measurement
   - Compare: [before] vs [after]
   - Calculate improvement %
   ```

3. **Edge cases**
   - Render with [specific props that triggered issue]
   - Rapid prop changes
   - Error conditions

#### B. Functional Testing

**Test Suite**: Vitest

```bash
npm test -- src/features/governance/xyz/
```

**Test Coverage**:
- [ ] Component renders without error
- [ ] All props handled correctly
- [ ] Event handlers work
- [ ] State updates propagate
- [ ] Data transformations correct
- [ ] Edge cases handled

#### C. End-to-End Testing

**Test Suite**: Playwright

```bash
npm run test:e2e
```

**Scenarios**:
- [ ] User can interact with component
- [ ] Data loads and displays
- [ ] Filters/sorting work
- [ ] Export functionality works
- [ ] Error states handled

#### D. Visual Regression Testing

- [ ] Take screenshot (before optimization)
- [ ] Take screenshot (after optimization)
- [ ] Compare: no unintended changes
- [ ] Verify layout/styling unchanged

### Rollback Plan

**If optimization introduces regression**:

```bash
# Identify issue in production
# 1. Revert commit
git revert [commit-hash]

# 2. Create hotfix branch
git checkout -b hotfix/xyz-revert-optimization

# 3. Push and create PR
git push origin hotfix/xyz-revert-optimization

# 4. Merge hotfix to main
# 5. Investigate root cause
# 6. Create new optimization attempt
```

**Conditions for rollback**:
- [ ] Performance worsens (p95 > baseline)
- [ ] Error rate increases significantly
- [ ] Critical functionality broken
- [ ] User complaints in support channel

---

## 5. Code Review Checklist

### Before Submitting PR

- [ ] Changes are focused (single optimization only)
- [ ] No unrelated refactoring
- [ ] Tests added for modified code
- [ ] Performance improvement verified locally
- [ ] No new warnings in console
- [ ] TypeScript strict mode passes
- [ ] Bundle size checked (no increase)

### PR Description Template

```markdown
## Optimization: [Component Name] - [Technique]

### Problem
[2-3 sentences describing the performance issue]

### Solution
[2-3 sentences describing the optimization]

### Performance Impact
- Current p95: XXms
- Target p95: YYms
- Expected improvement: ZZ%

### Testing
- [ ] Local performance testing: +ZZ% improvement
- [ ] Unit tests passing
- [ ] E2E tests passing
- [ ] Visual regression checked
- [ ] Edge cases tested

### Rollback
[Link to rollback plan if issues arise]
```

### Code Review Feedback

**Reviewer checklist**:
- [ ] Optimization technique is sound
- [ ] Code quality maintained
- [ ] No new edge cases introduced
- [ ] Performance claim is realistic
- [ ] Risk assessment is adequate
- [ ] Tests are comprehensive

---

## 6. Production Deployment & Validation

### Pre-Deployment

```bash
# 1. Verify code review approved
# 2. Verify all tests passing
# 3. Verify no performance regressions in CI

npm run build
npm run lint
npm test
npm run check:production
```

### Deployment

```bash
# 1. Merge PR to main (auto-deploys to Cloudflare Pages)
# 2. Monitor deployment in dashboard
# 3. Verify deploy successful
```

### Post-Deployment Monitoring (24-48 hours)

**Metrics to Monitor** (Sentry):

1. **Performance Metrics**
   - Component p95 render time
   - Component p99 render time
   - Re-render frequency
   - Slow render count

2. **Error Metrics**
   - Error rate
   - Exception types
   - User impact

3. **Business Metrics**
   - User session count
   - Feature usage
   - Conversion rate (if applicable)

**Monitoring Dashboard**:
[Link to Sentry dashboard or custom monitor]

**Alert Conditions**:
- [ ] If p95 > baseline: Page team lead
- [ ] If error rate > 1%: Incident escalation
- [ ] If no improvement: Investigation + potential rollback

### Success Criteria Validation

**Target Achievement**:
- [ ] p95 meets target: [XXms vs target YYms]
- [ ] No error rate increase: [current XX% vs baseline]
- [ ] User feedback positive: [survey/support feedback]
- [ ] Business metrics stable: [usage/conversion unchanged/improved]

**Optimization Result**:
- ✅ **Success**: All criteria met → Document in Phase 5 report
- ⚠️ **Partial Success**: Some improvement, investigate further
- ❌ **Regression**: Rollback and investigate root cause

---

## 7. Results Documentation

### Performance Improvement Report

```markdown
## Optimization Result: [Component] - [Technique]

### Baseline vs. Optimized
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| p95 | XXms | YYms | ZZ% ↓ |
| p99 | XXms | YYms | ZZ% ↓ |
| Re-renders/min | N | M | (N-M)/N % ↓ |
| Error rate | X% | Y% | Status |

### User Impact
- [Describe perceived improvement]
- [Estimate users benefited]
- [Related metrics improved]

### Code Changes
- Files modified: [list]
- Lines added/removed: [count]
- Complexity change: [Simple/Moderate/Complex]

### Lessons Learned
1. [Key insight from optimization]
2. [Technique effectiveness]
3. [Future prevention measure]
```

### Lessons Learned

**Questions to answer**:
1. Why was this component slow?
2. How could this have been caught earlier?
3. Will this pattern appear in other components?
4. What linting rule/test could prevent this?

**Document for future reference**:
[Record findings in team knowledge base]

---

## References

- Phase 4 Performance Baselines: `docs/PHASE-4-PERFORMANCE-BASELINES.md`
- Phase 5 Master Plan: `docs/PHASE-5-OPTIMIZATION-SPRINT.md`
- Performance Monitoring Guide: `src/lib/performance/README.md`
- React Performance: https://react.dev/reference/react/useMemo
- Lighthouse Guide: https://developer.chrome.com/en/docs/lighthouse/

---

## Appendix: Performance Profiling Tools

### React DevTools Profiler
```
1. Open browser DevTools
2. React tab → Profiler
3. Click "Record" (⏺️)
4. Interact with component
5. Click "Stop" (⏹️)
6. View render times and re-renders
```

### Chrome DevTools Performance Tab
```
1. Open Chrome DevTools → Performance
2. Record (⏺️) → Interact → Stop (⏹️)
3. Analyze:
   - Main thread activity
   - JavaScript execution
   - Rendering timeline
```

### Lighthouse
```bash
# Generate performance report
npm run build
npx lighthouse https://localhost:3000 --view
```

### Sentry Performance Dashboard
```
1. Open Sentry project
2. Performance → Transactions
3. Search: [component name]
4. View render time distribution
5. Compare: before/after optimization
```

---

**Component**: [Name]  
**Optimization**: [Technique]  
**Estimated Impact**: [ZZ]% performance improvement  
**Status**: Ready for execution
