# Routing Quality Agent Specification

**Role:** Navigation & Routing Auditor  
**Priority:** Medium  
**Auto-Fix:** Enabled (for dead links, orphaned routes)  
**Phase:** 2d (Implementation Planned)

---

## Responsibilities

Validate routing infrastructure, detect orphaned pages, and fix dead links.

### 1. Orphaned Page Detection

**Checks:**
- Pages in `src/pages/*.tsx` but not routed in `src/App.tsx`
- Routes defined but pages don't exist
- Pages removed but routes still point to them

**Findings:**
```
[CRITICAL] Orphaned page: src/pages/AdminPanel.tsx
  → Not routed in src/App.tsx
  → Route would be: /admin-panel
  → Recommendation: Add route or delete file

[CRITICAL] Route points to non-existent page: /old-dashboard
  → Route: <Route path="/old-dashboard" element={<OldDashboard />} />
  → File doesn't exist: src/pages/OldDashboard.tsx
  → Recommendation: Delete route or restore file
```

---

### 2. Dead Link Detection

**Checks:**
- `<Link to="/path">` points to non-existent route
- Anchor `<a href="/path">` points to non-existent route
- Redirect chains: A → B → C (should be A → C)
- Relative paths that resolve to nowhere

**Findings:**
```
[HIGH] Dead link in src/components/Header.tsx:42
  → Link: <Link to="/features/old">Features</Link>
  → Route doesn't exist: /features/old
  → Route exists: /features (did you mean this?)
  → Recommendation: Update link to /features or add route

[HIGH] Redirect chain detected
  → /old-path → /new-path → /final-path
  → User experience: 2 redirects (performance hit)
  → Recommendation: Update /old-path directly to /final-path
```

---

### 3. Navigation Consistency

**Checks:**
- Links in Header, Footer, Sidebar are all routable
- No typos in route names (case-sensitive!)
- Query parameters are documented
- Deep links (e.g., `/profile?tab=settings`) work correctly

**Findings:**
```
[MEDIUM] Inconsistent route reference
  → src/components/Menu.tsx: <Link to="/PROFILE">
  → src/components/Header.tsx: <Link to="/profile">
  → Route defined as: /profile (lowercase)
  → Recommendation: Standardize to /profile everywhere

[MEDIUM] Query parameter not handled
  → URL: /dashboard?feature=analytics
  → No component reads ?feature parameter
  → Recommendation: Add route handler for query params
```

---

### 4. 404 Handling

**Checks:**
- Fallback route (404 page) defined
- Users redirected helpfully when lost
- 404 page offers navigation options

**Findings:**
```
[MEDIUM] No 404 fallback route
  → User visits non-existent /random-page
  → App crashes or shows blank page
  → Recommendation: Add <Route path="*" element={<NotFound />} />
```

---

## Finding Severity

| Severity | Example |
|----------|---------|
| 🔴 Critical | Orphaned page that's still getting traffic |
| 🟡 High | Dead link in primary navigation |
| 🟢 Medium | Inconsistent route naming |
| ⚪ Low | Missing 404 page (can be added) |

---

## Auto-Fix Capability

### Auto-Fixable ✅
- Delete orphaned page + remove unused imports
- Fix dead link (suggest correct route)
- Consolidate redirect chains
- Add fallback 404 route
- Standardize route naming (kebab-case)

### Manual Review Required ❌
- Route behavior changes (might affect auth)
- Page deletion (confirm not in use)
- Route parameter changes (migration complexity)

---

## Implementation Notes

**Files to Create (Phase 2d):**
- `src/agents/routing-quality/types.ts`
- `src/agents/routing-quality/route-parser.ts`
- `src/agents/routing-quality/dead-link-detector.ts`
- `src/agents/routing-quality/orphan-detector.ts`
- `src/agents/routing-quality/index.ts`
- `src/agents/routing-quality/index.test.ts`
- `src/agents/routing-quality/README.md`

**Dependencies:**
- Route definitions (`src/App.tsx`)
- Page files (`src/pages/*`)
- Link components (`src/components/*`)
- TypeScript AST parsing (to detect routes + links)

**Effort:** ~2 days (AST parsing is involved)

**Delivery:** Week 5

---

**Status:** 🟡 Specification complete, implementation pending  
**Last Updated:** 2026-11-09
