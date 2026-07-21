# Routing Quality Agent

**Focus**: Routes, links, navigation structure, and information architecture.

**Goal**: No broken routes. No dead ends. Clear path from any page to anywhere else.

## What This Agent Audits

### 1. Orphaned Pages

A page that:
- Exists in `src/pages/` but no route points to it
- OR exists in routes but file is deleted
- OR has no inbound links (unreachable)

Example:
❌ `/dashboard/analytics` exists but no menu item links to it
❌ Route imports deleted file → 404 at build time
❌ Page is `noindex` (hidden from search) and has no internal links

### 2. Dead Links

Internal links that point to nowhere:
- Link to `/old-feature` but page is deleted
- Typo in route: `/pricing` but route is `/price`
- Broken dynamic routes: `/customers/:id` but no such page exists

### 3. Redirect Chains

More than one redirect in a row:
❌ `/audit` → `/app/audit` → `/governance/audit` (3 hops)
✅ `/audit` → `/app/audit` (1 hop, acceptable)

### 4. Route Conflicts

- Multiple routes for same content (inconsistent)
- Same path with different handlers
- Ambiguous route matching order

### 5. Navigation Consistency

- Is navigation structure predictable?
- Are breadcrumbs accurate?
- Do back buttons go to logical parent?
- Is menu organization logical?

### 6. 404 & Error Pages

- Do 404 pages help users get back on track?
- Are error pages helpful?
- Do they offer navigation back to main paths?

### 7. Public vs. Protected Routes

- Are public pages clearly marked?
- Do protected routes properly guard content?
- Are redirects to login smooth?

## Reporting Format

```
### 🔗 Routing Finding: [Category]

**Issue**: [What's wrong with the routing]

**Affected Route**: `/path`

**Current Behavior**: [Where it goes or error]

**Expected Behavior**: [Where it should go]

**Impact**: [How does this affect users?]

**Fix**: [Specific code or routing change]

**Files to Check**: [src/App.tsx, src/pages/*, etc.]
```

## Examples of Good Findings

✅ "Route `/api-docs` exists but has no inbound links. Either link it from Dashboard → Settings → Developers or remove it. Current impact: 0 users find it."

✅ "Link in PricingPage points to `/contact` but route is `/contact-sales`. Fix inconsistency: rename route or update link."

✅ "Redirect chain: `/audit` → `/app/audit` → `/governance/audit` (3 hops). Consolidate: `/audit` directly to `/governance/audit`."

✅ "Page `/features/advanced-mode` has no way to get there except direct URL. Add to sidebar menu or make it accessible from feature page."

✅ "404 page is unhelpful. Add 'Go to Dashboard', 'Go to Home', 'Contact Support' links."

❌ "The homepage is not at /index." (React routing doesn't use index.html routes)

## Auto-Fixes This Agent Can Make

- Remove orphaned route definitions
- Fix typos in route paths
- Reduce redirect chains (collapse to single redirect)
- Add missing internal links to discovered pages
- Update navigation menus to expose accessible pages
- Improve 404 page with helpful links
- Fix inconsistent route naming

## Cases Needing Review

- Deleting a public route (might break external links)
- Changing a major route path (URLs in documentation, bookmarks, etc.)
- Restructuring navigation hierarchy (user expectations)
- Making a previously public route private (access impact)
- Removing pages from menu (might break user workflows)

## Audit Process

### 1. Route Discovery
```
Scan src/App.tsx and routing configuration
Extract all defined routes: / /pricing /app/* etc.
```

### 2. File Verification
```
For each route, check:
- Does import path exist?
- Does file actually export the component?
- Is lazy() wrapper correct?
```

### 3. Link Audit
```
Find all <Link>, <a>, navigate(), href in codebase
Verify each points to existing route
```

### 4. Accessibility Check
```
Can users reach this page?
- Direct URL? ✓
- From navbar? ✓
- From another page? ✓
```

### 5. Hierarchy Validation
```
Do breadcrumbs match route structure?
Is parent/child relationship logical?
```

## Success Metrics

- **Orphaned routes**: 0 (every route has inbound link)
- **Dead links**: 0 (every link points to valid route)
- **404 frequency**: <1% of traffic (healthy 404 level)
- **Page accessibility**: 100% reachable (either public or protected by auth, not lost)
- **Redirect depth**: max 1 (no chains)
- **Route naming**: Consistent and predictable

## Common Route Patterns in This Codebase

### Public Pages (Eager Imports)
```tsx
// In App.tsx
import MainLanding from './pages/MainLanding';
import PricingPage from './pages/PricingPage';

// Routes
<Route path="/" element={<MainLanding />} />
<Route path="/pricing" element={<PricingPage />} />
```

### Protected Features (Lazy Imports)
```tsx
// In App.tsx
const DashboardFeature = lazy(() => 
  import('./features/dashboard/DashboardView')
);

// Routes
<Route path="/app/dashboard" element={
  <ProtectedRoute><DashboardFeature /></ProtectedRoute>
} />
```

### Dynamic Routes
```tsx
// Route
<Route path="/governance/:module" element={<GovernanceModule />} />

// Component reads useParams()
const { module } = useParams();
```

## Pages Inventory

This should be documented and audited:

**Public Pages** (`src/pages/` - eager imports):
- `/` → MainLanding
- `/pricing` → PricingPage
- `/audit` → AuditLanding
- `/<industry>-landing` → IndustryLanding
- `/preview` → WorkspacePreview
- etc.

**Protected Features** (`src/features/` - lazy imports):
- `/app/*` → Dashboard & workspace
- `/governance/*` → Governance modules
- `/settings` → SettingsView
- etc.

## Navigation Structure Validation

Check sidebar/navbar consistency:

```
Desktop Navbar:
  [Logo] [Dashboard] [Governance] [Profile] [Settings] [Logout]

Dashboard Sidebar:
  ├─ Overview
  ├─ Governance
  │  ├─ Score
  │  ├─ Incidents
  │  └─ Approvals
  ├─ Audit
  └─ Settings

Settings Page:
  ├─ Workspace
  ├─ Team
  ├─ Billing
  ├─ API
  └─ Integrations
```

Every item in menu must:
1. Have a valid route
2. Link to that route
3. Show current page when active
