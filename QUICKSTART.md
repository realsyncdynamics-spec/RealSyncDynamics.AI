# Quick Start Guide

Get RealSyncDynamics.AI running locally in 5 minutes.

## Prerequisites

- Node.js 18+
- npm or yarn
- Git
- Supabase CLI (optional, for local database)

## Setup

### 1. Clone & Install

```bash
git clone https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI.git
cd RealSyncDynamics.AI
npm install
```

### 2. Environment Variables

Create `.env.local` in project root:

```bash
# Supabase
VITE_SUPABASE_URL=https://ebljyceifhnlzhjfyxup.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>

# Stripe (optional for local dev)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_<your-key>

# Optional: Sentry (error tracking)
# VITE_SENTRY_DSN=

# Local dev
VITE_API_URL=http://localhost:3000
```

**Get keys from:**
- Supabase: Project Settings → API
- Stripe: Developers → API Keys

### 3. Start Dev Server

```bash
npm run dev
```

Opens at **http://localhost:3000**

## Common Commands

### Development

```bash
# Watch mode with hot reload
npm run dev

# Type checking
npm run lint

# Format code (if configured)
npm run format
```

### Build & Test

```bash
# Production build
npm run build

# Preview production build locally
npm run preview

# Type checking (strict)
npm run check:production
```

### Testing

```bash
# Unit tests (watch mode)
npm run test:watch

# Unit tests (run once)
npm test

# Unit tests with database
npm run test:db

# E2E tests (Playwright)
npm run e2e

# E2E tests (interactive UI)
npm run test:e2e:ui

# View E2E test report
npm run test:e2e:report

# Specific test file
npm test -- src/lib/myutil.test.ts
```

## Project Structure

```
RealSyncDynamics.AI/
├── src/
│   ├── pages/           # Public pages (no auth required)
│   │   ├── MainLanding.tsx
│   │   ├── AuditLanding.tsx
│   │   ├── PricingPage.tsx
│   │   └── ...
│   ├── features/        # Auth-gated features
│   │   ├── billing/
│   │   ├── governance/
│   │   └── ...
│   ├── components/      # Shared UI components
│   ├── config/          # Centralized config (pricing, SEO, etc.)
│   ├── lib/             # Utilities (auth, tracking, etc.)
│   ├── core/            # Core providers
│   └── App.tsx          # Main router
├── supabase/
│   ├── functions/       # Edge Functions (AI, Stripe, etc.)
│   └── migrations/      # Database migrations
├── test/                # Unit tests
├── e2e/                 # E2E tests (Playwright)
└── scripts/             # Build & deploy scripts
```

## Key Routes

### Public (No Auth)
- `/` — Main landing page
- `/audit` — EU AI Act compliance audit landing
- `/pricing` — Pricing page
- `/scan` — Compliance scanner (free, no signup required)
- `/welcome` — Auth page (login/signup)

### Protected (Auth Required)
- `/app/dashboard` — Workspace home
- `/app/scans` — Scan history
- `/settings` — User settings & billing
- `/governance/*` — Governance features

## Database (Local Development)

### Start Local Supabase

```bash
supabase start
```

This creates local PostgreSQL, Auth, Storage, etc.

### Run Migrations

```bash
supabase db reset
```

Applies all migrations from `supabase/migrations/`

### Run Tests Against Local DB

```bash
npm run test:db
```

### View Local Database

```bash
# Open Supabase Studio
open http://localhost:54323

# Or use psql directly
psql postgresql://postgres:postgres@localhost:54322/postgres
```

## Edge Functions (Local)

### Start Function Server

```bash
supabase functions serve
```

Runs Edge Functions locally at `http://localhost:54321`

### Deploy to Production

```bash
supabase functions deploy stripe-checkout
```

## Troubleshooting

### Port 3000 Already in Use

```bash
# Find and kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### TypeScript Errors in Strict Mode

```bash
npm run lint
# Shows detailed errors with line numbers
```

### Build Fails

```bash
# Clear build cache
rm -rf dist node_modules/.vite

# Rebuild
npm run build
```

### Tests Failing

```bash
# Reset local database
supabase db reset

# Run tests again
npm test

# View test output in detail
npm test -- --reporter=verbose
```

### Environment Variables Not Loading

```bash
# Restart dev server (HMR doesn't catch .env.local changes)
npm run dev
```

### Supabase Auth Not Working

1. Verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in `.env.local`
2. Check browser console (F12) for errors
3. Verify Supabase project is accessible: `curl https://ebljyceifhnlzhjfyxup.supabase.co/auth/v1/health`

## Performance Tips

### Development

- Use `npm run dev` for hot reload (faster than manual refresh)
- Keep DevTools closed (F12) during dev for better performance
- Use `npm run test:watch` for continuous testing

### Production

```bash
# Check bundle size
npm run build 2>&1 | grep "dist/assets"

# Analyze with Lighthouse
npm run build && npm run preview
# Open Chrome DevTools → Lighthouse
```

## Next Steps

1. **Local Testing:** Run `npm run dev` and test at http://localhost:3000
2. **Features:** See `/src/pages` for public pages, `/src/features` for auth-gated
3. **Database:** See `supabase/migrations/` for schema
4. **Deployment:** See [DEPLOYMENT.md](./DEPLOYMENT.md)

## Resources

- **Supabase Docs:** https://supabase.com/docs
- **React Router:** https://reactrouter.com
- **Tailwind CSS:** https://tailwindcss.com
- **Vite Docs:** https://vitejs.dev
- **Playwright (E2E):** https://playwright.dev

## Support

- Check [MVP-BUILD-PROGRESS.md](./MVP-BUILD-PROGRESS.md) for development status
- See [SATURDAY-SUNDAY-PLAN.md](./SATURDAY-SUNDAY-PLAN.md) for testing procedures
- Review [CLAUDE.md](./CLAUDE.md) for codebase conventions

---

**Created:** Saturday, July 17, 2026  
**Last Updated:** Saturday, July 17, 2026
