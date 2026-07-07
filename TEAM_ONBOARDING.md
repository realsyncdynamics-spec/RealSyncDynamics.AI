# RealSyncDynamics.AI — Team Onboarding & Operations Guide

## Quick Start (First Day)

### 1. Repository Access & Setup
```bash
# Clone the repository
git clone https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI.git
cd RealSyncDynamics.AI

# Install dependencies
npm install

# Create local environment file
cp .env.example .env.local

# Start development server
npm run dev
```

### 2. Obtain Credentials
Request from DevOps team:
- [ ] Supabase API keys (anon + service role)
- [ ] Anthropic API key
- [ ] Stripe test/live keys
- [ ] Sentry DSN
- [ ] GitHub SSH key setup

### 3. Verify Setup
```bash
npm test                    # Should see 2069 tests passing
npm run lint                # TypeScript strict mode check
npm run check:production    # Production readiness verification
```

---

## Development Workflow

### Branch Strategy
```
main (production)
  ↓
feature/<task-type>/<short-desc>
  ↓
Pull Request → Review → Merge
```

**Branch naming:** `feature/monitoring-dashboard`, `bugfix/auth-timeout`, `docs/deployment-guide`

### Daily Workflow
```bash
# Update main branch
git fetch origin main
git rebase origin/main

# Create feature branch
git checkout -b feature/your-feature

# Make changes and test
npm run dev              # Watch mode
npm run test:watch      # Tests in watch mode

# Commit with clear messages
git commit -m "Feature: Add compliance dashboard monitoring"

# Push and create PR
git push -u origin feature/your-feature

# In GitHub: Create Draft PR, request review
```

### Pre-Commit Checklist
- [ ] Code passes `npm run lint`
- [ ] Tests added/updated for new features
- [ ] `npm test` all passing
- [ ] No TypeScript errors (`npm run lint`)
- [ ] Bundle size analyzed (`npm run build`)
- [ ] Security audit passing (`npm audit`)
- [ ] Documentation updated in CLAUDE.md if needed

---

## Project Structure Guide

### Frontend Routes & Features
```
src/pages/                    → Public pages (eager loaded)
  ├── MainLanding.tsx        → Homepage (✅ LOCKED - no changes)
  ├── PricingPage.tsx        → Pricing (edit text only)
  ├── AuditLanding.tsx       → Compliance page
  └── ...

src/features/                → Auth-gated features (lazy loaded)
  ├── governance/            → Compliance monitoring
  │   ├── ComplianceMonitoringDashboard.tsx
  │   ├── ComplianceAlertRulesView.tsx
  │   └── ComplianceScoreCard.tsx
  ├── settings/              → Tenant configuration
  │   ├── BrandingSettings.tsx
  │   ├── SettingsView.tsx
  │   └── WhiteLabelPresets.tsx
  ├── billing/               → Stripe integration
  │   ├── PricingSelector.tsx
  │   └── SubscriptionManager.tsx
  └── ...

src/config/                  → Single Source of Truth
  ├── pricing.ts            → Pricing tiers
  ├── seo.ts                → SEO metadata
  ├── competitor-comparisons.ts
  └── industries.ts

src/core/                    → Context providers
  ├── access/TenantProvider.tsx
  ├── DemoModeProvider.tsx
  └── AuthContext.tsx
```

**Key Rules:**
- Public pages in `src/pages/` (eager import in App.tsx)
- Auth-gated features in `src/features/` (lazy import)
- Shared config in `src/config/` (never duplicate)
- Always use TenantProvider for tenant context

---

## Database & Migrations

### Common Database Tasks
```bash
# Reset local database to latest migration
supabase db reset

# Apply local migrations to remote
supabase db push

# View all migrations
supabase migration list

# Create new migration
supabase migration new <description>

# Test database in unit tests
npm run test:db
```

### RLS Policy Pattern
All tables must have Row Level Security enabled:
```sql
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own tenant data"
  ON my_table
  FOR SELECT
  USING (tenant_id = auth.uid()::text);
```

### Adding a New Table
1. Create migration: `supabase migration new add_new_table`
2. Write SQL with RLS policy
3. Test locally: `supabase db reset && npm run test:db`
4. Push: `supabase db push`

---

## Edge Functions

### Local Development
```bash
# Start local function server
supabase functions serve

# Test function
curl -X POST http://localhost:54321/functions/v1/my-function \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"param": "value"}'
```

### Function Location & Pattern
```
supabase/functions/
  ├── ai-invoke/index.ts          → Claude API calls
  ├── stripe-webhook/index.ts     → Payment events
  ├── compliance-alert-trigger/   → Alert execution
  └── tenant-branding-update/     → Branding API
```

**Key Rules:**
- Service-role keys ONLY in edge functions (never in client)
- Always validate input and authenticate requests
- Log important operations for audit trail
- Set appropriate CORS headers for cross-origin requests
- Handle errors gracefully (don't expose stack traces)

### Deploying Functions
```bash
# Deploy single function
supabase functions deploy my-function

# Deploy all functions
git push origin main
# (automatic via GitHub Actions)

# View logs
supabase functions get-logs my-function --limit 50
```

---

## Monitoring & Observability

### Key Dashboards
| Dashboard | URL | Owner |
|-----------|-----|-------|
| Sentry | https://sentry.io/projects/realsyncdynamics/ | Engineering |
| Supabase | https://supabase.com/dashboard/projects | DevOps |
| Cloudflare | https://dash.cloudflare.com/pages | DevOps |
| GitHub Actions | https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/actions | CI/CD |

### Critical Metrics to Monitor
```
Frontend Performance:
  ├── Lighthouse score > 90
  ├── Page load time < 2s
  └── Bundle size < 1MB gzip

API Health:
  ├── Error rate < 1%
  ├── Latency p95 < 500ms
  └── Uptime 99.9%

Database:
  ├── Query time < 200ms p95
  ├── Connection pool < 80%
  └── Storage usage trending
```

### Setting Up Alerts
In Sentry:
1. Go to Alerts → Create Alert Rule
2. Set condition: `Error rate > 1%`
3. Action: `Send to #alerts Slack channel`

---

## Testing Guide

### Unit Tests (Vitest)
```bash
npm test                    # Run all tests
npm run test:watch         # Watch mode
npm test -- src/lib/       # Run specific path
npm test -- --reporter=verbose  # Detailed output
```

### E2E Tests (Playwright)
```bash
npm run e2e                 # Run all E2E tests
npm run test:e2e:ui        # Interactive mode
npm run test:e2e:report    # View test report
```

### Testing Checklist
- [ ] Unit tests for utility functions (src/lib/)
- [ ] Component tests for UI components
- [ ] E2E tests for critical user flows:
  - Sign-up → Create workspace
  - Create compliance rule → Trigger alert
  - Update white-label branding → Verify in dashboard
  - Create webhook subscription → Verify delivery

---

## Security Best Practices

### Development
- ✅ Use `.env.local` for secrets (git-ignored)
- ✅ Never commit API keys or credentials
- ✅ Use TypeScript strict mode (catches type errors)
- ✅ Validate all user input before database queries
- ✅ Use parameterized queries (Supabase client does this)
- ✅ Enable 2FA on GitHub and service provider accounts

### Deployment
- ✅ Enable HTTPS/TLS everywhere
- ✅ Use environment variables for all secrets
- ✅ Rotate API keys quarterly
- ✅ Run `npm audit` regularly and fix vulnerabilities
- ✅ Enable and monitor CORS policies
- ✅ Implement rate limiting on public APIs
- ✅ Use Content Security Policy (CSP) headers

### Incident Response
- ✅ Know your on-call contact (see INCIDENT_RESPONSE.md)
- ✅ Familiarize with incident severity levels
- ✅ Keep API key rotation playbook accessible
- ✅ Know where backups are stored
- ✅ Have Supabase support contact info handy

---

## Release Process

### Pre-Release Checklist
```bash
# 1. Ensure all tests passing
npm test

# 2. Verify production readiness
npm run check:production

# 3. Build and analyze bundle
npm run build
npm run bundle:analyze

# 4. Security audit
npm audit

# 5. Create release branch
git checkout -b release/v1.2.0

# 6. Update version
npm version minor  # or patch/major

# 7. Create PR and merge
git push -u origin release/v1.2.0
```

### Deployment
- Main branch push → Automatic deployment to staging
- Merge to main → Automatic deployment to production (Cloudflare Pages)
- Monitor Sentry & dashboards for 30 minutes post-deploy
- Rollback procedure: `git revert <commit> && git push origin main`

---

## Common Tasks

### Adding a New Page
1. Create `src/pages/NewPage.tsx`
2. Import in `src/App.tsx`
3. Add route: `<Route path="/path" element={<NewPage />} />`
4. Test routing: `npm run dev` and navigate to page

### Adding a Protected Feature
1. Create `src/features/feature-name/FeatureView.tsx`
2. Lazy import in App.tsx
3. Add route with ProtectedRoute wrapper
4. Write E2E test in `e2e/feature.spec.ts`

### Adding a Database Table
1. Create migration: `supabase migration new add_table_name`
2. Write SQL with RLS policy
3. Add TypeScript types to `src/lib/database.types.ts`
4. Create data access functions in `src/lib/`
5. Test with `npm run test:db`

### Updating Environment Variables
1. Add to `.env.example` (for documentation)
2. Update `.env.local` locally
3. Add to Cloudflare Pages project settings
4. Update DEPLOYMENT.md documentation

---

## Getting Help

### Documentation
- **CLAUDE.md** — Project-specific conventions and patterns
- **DEPLOYMENT.md** — Production deployment procedures
- **INCIDENT_RESPONSE.md** — Incident playbooks and contacts
- **README.md** — High-level project overview

### Common Questions
**Q: Where should I put this component?**
A: Public UI → `src/components/`, Feature-specific → `src/features/feature-name/`

**Q: How do I access tenant context?**
A: Use `const { activeTenantId } = useTenant()` hook

**Q: How do I check if user is authenticated?**
A: Use `const user = useAuth()` hook, wrap routes with `<ProtectedRoute>`

**Q: How do I make a call to Claude API?**
A: Create edge function in `supabase/functions/` using ANTHROPIC_API_KEY (server-only)

**Q: What's the preferred way to fetch data?**
A: Use `getSupabase().from('table').select()` with RLS filters included

---

## Team Contacts

| Role | Name | Slack | Email |
|------|------|-------|-------|
| Engineering Lead | TBD | @lead | |
| DevOps/Infrastructure | TBD | @devops | |
| Security | TBD | @security | |
| Product Manager | TBD | @pm | |

---

**Revision History:**
- 2026-07-06: Initial version for production handoff
- Next: Update after first incident and lessons learned

**Questions?** Post in #engineering-support or #questions on Slack
