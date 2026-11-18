# Dashboard Evolution Agent Specification

**Role:** Dashboard-First Principle Enforcer  
**Priority:** High  
**Auto-Fix:** Partial (visibility changes; not layout restructuring)  
**Phase:** 2c (Implementation Planned)

---

## Responsibilities

Ensure features are discoverable, properly positioned, and follow dashboard-first architecture.

### Dashboard-First Principle

**Core Rule:** New features start in the Dashboard, not hidden in nested menus.

Rationale:
- Users open Dashboard first after login
- Features buried in Settings/Admin are discovered by <5% of users
- Dashboard = primary CTA surface
- Hidden features = feature bloat myth

---

### 1. Feature Placement Validation

**Checks:**
- New feature visible on Dashboard (within 3 clicks)
- Feature card has clear icon + label
- Feature positioned logically (related features near each other)
- Feature prominence matches usage pattern (hot features prominent, cold features lower)

**Findings:**
- Feature only accessible via Settings (should be Dashboard card)
- Feature icon is generic (same as 5 other features)
- Feature buried below fold on low-traffic Dashboard layout
- Feature uses acronym user doesn't know

---

### 2. Module Organization

**Checks:**
- Modules grouped by user workflow (not by backend system)
- Related modules adjacent (e.g., Invoice + Payment together)
- Modules don't duplicate (no two "Settings" sections)
- Module hierarchy is clear (parent → child, not sibling confusion)

**Findings:**
- "Billing" module contains "Shipping" (should be separate)
- Two "Admin" sections (consolidate)
- Feature A and Feature B should be one module
- Module nesting 3+ levels deep (simplify)

---

### 3. Discoverability Metrics

**Checks:**
- **Click Depth:** Feature reachable in ≤ 3 clicks from Dashboard
- **Visibility:** Feature on main viewport (not below fold)
- **Label Clarity:** Feature name matches user mental model
- **Findability:** Feature appears in search/command palette
- **Context:** Related features nearby (reduces cognitive load)

**Scoring Example:**
```
Feature: "Advanced Export Settings"
  Click depth: 4 (too deep!) → -20 points
  Visibility: Below fold → -15 points
  Label clarity: Clear → +10 points
  Search: Searchable → +10 points
  Context: Near other export tools → +10 points
  
  Score: 45/100 (needs refactor)
  Recommendation: Move to Dashboard as top-level card
```

---

### 4. Deprecated UI Detection

**Checks:**
- Old UI patterns still in code (redundant)
- Features reimplemented twice (old vs. new)
- Unused page components
- Deprecated React patterns (class → hooks)

**Findings:**
- Old Dashboard layout code still present (new Dashboard added, old not removed)
- Feature in Settings and Dashboard (confusing for users)
- Unused component causing bundle bloat
- Legacy modal still used alongside new modal system

---

## Finding Severity

| Severity | Example |
|----------|---------|
| 🔴 Critical | New feature only in Settings (violates dashboard-first) |
| 🟡 High | Feature 4+ clicks deep (discoverability issue) |
| 🟢 Medium | Module hierarchy confusing (user expects different order) |
| ⚪ Low | Icon could be more distinctive |

---

## Auto-Fix Capability

### Auto-Fixable ✅
- Move feature card higher on Dashboard (visibility)
- Standardize icon/label (clarity)
- Reorder modules (organization)
- Remove deprecated UI component

### Manual Review Required ❌
- Feature removal (confirm it's unused)
- Layout restructuring (affects UX research)
- New module creation (PMO sign-off)
- Feature prominence changes (affects conversion funnel)

---

## Implementation Notes

**Files to Create (Phase 2c):**
- `src/agents/dashboard-evolution/types.ts`
- `src/agents/dashboard-evolution/feature-placement.ts`
- `src/agents/dashboard-evolution/module-organizer.ts`
- `src/agents/dashboard-evolution/discoverability.ts`
- `src/agents/dashboard-evolution/index.ts`
- `src/agents/dashboard-evolution/index.test.ts`
- `src/agents/dashboard-evolution/README.md`

**Dependencies:**
- Dashboard component structure (`src/pages/Dashboard.tsx`)
- Feature configuration (`src/config/features.ts`)
- Module definitions (`src/components/modules/*`)

**Effort:** ~2 days (layout is visual, needs UI inspection)

**Delivery:** Week 4

---

**Status:** 🟡 Specification complete, implementation pending  
**Last Updated:** 2026-11-09
