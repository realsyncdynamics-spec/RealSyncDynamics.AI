# Platform Intelligence System v1.0

**Status**: Foundation Phase (Phase 1) ✅  
**Go-Live**: 2026-08-15  
**Branch**: `claude/platform-intelligence-agent-11tcgd`

---

## Overview

The **Platform Intelligence System** is an autonomous, multi-agent framework that continuously analyzes and optimizes the RealSyncDynamics.AI platform from the **customer perspective**.

Instead of waiting for feedback, the system proactively identifies:
- 🎨 UX friction and inconsistencies
- 🛣️ Customer journey bottlenecks
- 📊 Feature placement and discoverability issues
- 🔗 Broken routes and navigation problems
- 💳 Pricing/feature misalignments

Every finding is tied to **customer impact**, not technical preferences.

---

## Architecture

```
Platform Intelligence Orchestrator
    ├─ UX Optimization Agent
    ├─ Customer Journey Agent
    ├─ Dashboard Evolution Agent
    ├─ Routing Quality Agent
    └─ Stripe Business Agent
```

### Orchestrator Role
- Schedules and coordinates agents
- Aggregates findings by severity
- Creates GitHub issues
- Posts summaries to Slack
- Applies auto-fixes for low-risk items

### Sub-Agents
Each agent specializes in one domain:

| Agent | Focuses On | Can Auto-Fix |
|-------|-----------|--------------|
| **UX** | Colors, buttons, labels, accessibility | ✅ Yes |
| **Journey** | Signup, onboarding, checkout, conversion | ⚠️ Partial |
| **Dashboard** | Feature placement, discoverability, modules | ✅ Yes |
| **Routing** | Routes, links, navigation, 404s | ✅ Yes |
| **Stripe** | Pricing, features, checkout, billing logic | ⚠️ Careful |

---

## How It Works

### Schedule

- **Daily**: 06:00 UTC (automated)
- **On Push**: When code is pushed to `main` (immediate)
- **Manual**: Trigger via GitHub Actions or API

### Process

1. **Analyze** — Each agent runs independently
2. **Aggregate** — Findings combined and sorted by severity
3. **Report** — Summary posted to Slack + GitHub
4. **Fix** — Auto-fixable items applied to a PR
5. **Review** — Critical findings require manual review

### Severity Levels

```
🔴 CRITICAL
  ├─ Blocks customer goal (signup, checkout, first value)
  ├─ Revenue leak (broken billing, price mismatch)
  ├─ Security issue (exposed features, data access)
  └─ Requires: Human review + approval before fix

🟠 HIGH
  ├─ Adds 3+ steps to customer journey
  ├─ Major UX confusion (inconsistent labels)
  ├─ Feature undiscoverable (orphaned page)
  └─ Requires: Human review + approval before fix

🟡 MEDIUM
  ├─ Adds 1-2 steps or minor friction
  ├─ Small inconsistency (typo, color)
  ├─ Optimization opportunity
  └─ Can auto-merge if tests pass

🟢 LOW
  ├─ Nice-to-have improvement
  ├─ Non-blocking issue
  ├─ Code quality enhancement
  └─ Can auto-apply

```

---

## Configuration

### Main Config: `src/config/agent-policies.ts`

Controls:
- **Schedule** — When agents run
- **Autonomy** — What agents can do without approval
- **Restrictions** — What always needs approval
- **Notifications** — Where reports go
- **Scope** — What parts of codebase to analyze
- **Thresholds** — When to escalate

### Agent Definitions: `.claude/agents/*.md`

Each agent has a detailed prompt file:
- `platform-intelligence-agent.md` — Main orchestrator
- `ux-optimization-agent.md` — UX & accessibility
- `customer-journey-agent.md` — Signup, onboarding, checkout
- `dashboard-evolution-agent.md` — Dashboard-first principle
- `routing-quality-agent.md` — Routes & navigation
- `stripe-business-agent.md` — Pricing & billing

---

## Key Principles

### 1. Customer-First Analysis
Every finding must answer: **"How does this affect the customer?"**

Not: "This code could be more efficient"  
Yes: "This adds 2 steps to signup, increasing form abandonment by 5%"

### 2. Dashboard Evolution
New features should live in the Dashboard first, then be moved elsewhere only if:
- They're admin-only (Settings, API Management)
- They're rare-use (Integrations setup)
- They're intentionally separate (Public landing pages)

### 3. Autonomous but Controlled
- Agent can fix typos and improve UX automatically
- Agent cannot change prices or deployments without approval
- Medium-risk items need human review

### 4. Focused Reporting
Only report top 5-10 issues per category to avoid noise. Rank by impact.

---

## Getting Started

### Phase 1: Foundation (Current) ✅

**Status**: Complete
- ✅ Config system defined
- ✅ Agent specifications written
- ✅ Orchestrator structure created
- ✅ Documentation complete

**Next**: Implement individual agent logic

### Phase 2: Implementation (Next)

**Timeline**: August 1-15, 2026

1. **UX Agent** (2 days)
   - Color contrast checker
   - Button label analyzer
   - Form validation checker

2. **Journey Agent** (3 days)
   - Signup flow analyzer
   - Onboarding step counter
   - Checkout validator

3. **Dashboard Agent** (2 days)
   - Feature placement checker
   - Module organization analyzer
   - Discoverability validator

4. **Routing Agent** (2 days)
   - Orphaned page finder
   - Dead link detector
   - Route consistency checker

5. **Stripe Agent** (3 days)
   - Price accuracy checker
   - Feature mapping validator
   - Checkout flow tester

6. **Integration** (2 days)
   - GitHub API integration
   - Slack notifications
   - Auto-fix mechanism

### Phase 3: Refinement (Post-Go-Live)

- Tune severity thresholds based on real findings
- Add more sophisticated analysis (A/B testing data, user session analysis)
- Expand to include performance monitoring
- Integrate with customer feedback (support tickets, surveys)

---

## Understanding Each Agent

### 🎨 UX Optimization Agent

**Watches For**:
- Button labels inconsistent ("Start" vs "Begin" vs "Continue")
- Color contrast violations (text hard to read)
- Form labels unclear or missing
- Navigation structure confusing

**Can Auto-Fix**:
- Typos in labels
- Missing alt text
- Inconsistent button styling
- Accessibility attributes

**Examples of Findings**:
- ✅ "Button says 'Click Here'. Should say 'Connect Stripe'."
- ✅ "Text color #666 on background #EEE fails WCAG AA contrast."
- ✅ "3 different forms use different validation messages. Standardize."

---

### 🛣️ Customer Journey Agent

**Watches For**:
- Signup taking >3 minutes
- Onboarding >5 steps before user sees result
- Checkout not clear on what's included
- Dead ends in flow (user can't proceed)

**Can Auto-Fix**:
- Reorder form fields (optional → required)
- Consolidate duplicate CTAs
- Improve error messages
- Add "Next Step" guidance

**Examples of Findings**:
- ✅ "Signup requires company industry selection. Make optional (can ask in onboarding)."
- ✅ "After signup, show 4 options. 70% users get lost. Lead with 'Dashboard' or 'Setup Guide'."
- ✅ "Checkout doesn't explain what 'Professional' includes. Link to pricing details."

---

### 📊 Dashboard Evolution Agent

**Watches For**:
- Features that aren't in Dashboard (buried in Settings)
- Features users paid for but can't discover
- Dashboard modules poorly organized
- New feature announcements only in email (no in-app visibility)

**Key Principle**: **If users pay for it, it should be visible in their Dashboard.**

**Examples of Findings**:
- ✅ "Vendor Management is available but not in Dashboard. Add card showing 'Connected Vendors (5)' with link to full list."
- ✅ "Automation Rules exist but only in Settings → Advanced. Users don't know about feature. Move to Dashboard or add prominent notification."
- ✅ "New feature 'Incident Priority Levels' added but no card in Dashboard. Add to Governance section."

---

### 🔗 Routing Quality Agent

**Watches For**:
- Pages that exist but aren't reachable
- Links that go nowhere
- Redirect chains (A → B → C instead of A → C)
- Route naming inconsistent (/audit vs /audits)

**Examples of Findings**:
- ✅ "Route `/api-docs` exists but no menu item links to it. Either link it or delete it."
- ✅ "Link in PricingPage points to `/contact` but route is `/contact-sales`. Fix inconsistency."
- ✅ "Redirect chain: /audit → /app/audit → /governance/audit. Consolidate to single redirect."

---

### 💳 Stripe Business Agent

**Watches For**:
- Prices shown on website don't match Stripe
- Features listed in pricing aren't actually available
- Trial doesn't expire correctly
- Checkout flow is broken
- User can access features they didn't pay for

**Examples of Findings**:
- ✅ "Pricing page says 'Professional: $99/month' but Stripe product is $99/month + $10 setup. Clarify on page."
- ✅ "Professional includes 'API Access' but code has no permission gate. Users can access API without paying."
- ✅ "Trial length is 14 days in Stripe but website says 30. Update Stripe or website."

---

## Running the System

### Automatic (Scheduled)

Runs automatically at 06:00 UTC daily.

Watch for Slack notification in `#platform-evolution`:

```
Platform Intelligence Analysis - July 21, 2026

📊 Summary:
  🔴 Critical: 2
  🟠 High: 5
  🟡 Medium: 8
  🟢 Low: 12
  ✅ Total: 27 findings

1. [CRITICAL] Checkout form missing required field
   Users cannot complete purchase...

2. [HIGH] Signup takes 7 steps, should be 3
   Recommend: Make company/industry optional...

...

See full report: https://github.com/...
```

### Manual Trigger

```bash
# Trigger via GitHub Actions (coming soon)
gh workflow run platform-intelligence.yml

# Or via curl (coming soon)
curl -X POST https://api.realsync.com/agent/analyze \
  -H "Authorization: Bearer $TOKEN"
```

### View Results

- GitHub Issues: https://github.com/realsyncdynamics-spec/realsyncdynamics.ai/issues?q=label:platform-intelligence
- Slack Thread: #platform-evolution
- Dashboard (coming soon): `https://app.realsync.com/platform-intelligence`

---

## Working with Findings

### If Critical Finding

1. Get alerted in Slack
2. Read full context in GitHub issue
3. Decide: Fix now, or defer?
4. If fix: Create PR, link to issue
5. If defer: Label issue with priority, leave note

### If High Finding

1. See in daily summary
2. Approve PR from platform-intelligence-agent if confidence high
3. Or: Request changes if you disagree

### If Medium/Low Finding

1. Will be auto-applied as PR
2. Review in PR if interested
3. Close if not relevant

---

## Extending the System

### Add New Analysis

Edit `.claude/agents/*.md` file:

```markdown
### New Check: [Feature Name]

**What it does**: [Brief description]

**When to alert**: [Condition that triggers finding]

**Examples**:
- ✅ [Good example]
- ❌ [Bad example that would be caught]
```

Then implement in corresponding edge function.

### Change Severity Thresholds

Edit `src/config/agent-policies.ts`:

```typescript
thresholds: {
  priorityHigh: 5,           // Number of issues before flagging
  performanceWarning: 2000,  // ms
  conversionLoss: 0.05,      // 5% drop
}
```

### Disable an Agent

Edit `src/config/agent-policies.ts`:

```typescript
SUB_AGENTS['ux-optimization'] = {
  enabled: false,  // Won't run
  // ...
}
```

---

## Success Metrics

After 3 months of operation:

- **Zero orphaned pages** — Every route is reachable
- **Zero dead links** — All internal links point to valid routes
- **No pricing mismatches** — Website = Stripe = Backend
- **Customer journey <5 steps** — Signup to first value in <5 minutes
- **Feature discoverability 70%+** — Users find features in Week 1
- **Support tickets -30%** — Fewer UX/billing related issues

---

## Future Roadmap

### Q3 2026 (Post-Go-Live)
- ✅ Basic agent implementation
- 🔄 Manual review → Auto-approval for low-risk fixes
- 🔄 Performance monitoring (page load times, bundle size)

### Q4 2026
- Integrate with Sentry (error patterns → UX issues)
- Integrate with analytics (user behavior → journey optimization)
- A/B testing recommendations (based on findings)

### Q1 2027
- Competitor analysis (features they have, we don't)
- Customer feedback integration (support tickets → actionable findings)
- Machine learning for severity prediction

---

## Troubleshooting

### No findings generated

1. Check agent is enabled in `src/config/agent-policies.ts`
2. Check logs: `supabase functions list` → view function logs
3. Verify scope includes your files: `agent-policies.ts` → `scope`

### Too many false positives

1. Review finding in GitHub issue
2. If incorrect: Close issue with comment
3. Update agent prompt in `.claude/agents/*.md`

### Auto-fix created unwanted changes

1. Review PR from platform-intelligence-agent
2. Request changes or close PR
3. Update auto-fix rules in agent prompt

---

## Questions?

- **For architecture questions**: See CLAUDE.md
- **For phase planning**: See git branch documentation
- **For implementation details**: Check `.claude/agents/*.md`
- **For configuration**: Edit `src/config/agent-policies.ts`

---

**Last Updated**: July 21, 2026  
**Maintainer**: Claude Platform Intelligence  
**Status**: Foundation Phase Complete → Ready for Implementation
