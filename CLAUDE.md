# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# RealSyncDynamics.AI

EU-souveräne SaaS-Plattform für Creator und Agenturen.
Provenienz (C2PA), AI-Workflows, VPS-Operations — Multi-Tenant.

## Stack
- Frontend: Vite + React 19, TypeScript, Tailwind 4
- Routing: react-router-dom 7
- Backend: Supabase (Auth, Postgres mit RLS, Edge Functions, Storage)
- AI-Provider: Anthropic / Google / OpenAI (Cloud) · Ollama gemma3:4b (EU-lokal)
- Automation: n8n
- Billing: Stripe
- Monitoring: Sentry
- Tests: Vitest + Playwright (E2E)

## Wichtige Ordner
- `src/`                     — React-SPA
  - `pages/`                 — Public + protected pages (1 file = 1 route)
  - `features/`              — Auth-gated feature modules (billing, governance, etc.)
  - `components/`            — Shared UI components
  - `config/`                — Centralized config (pricing.ts, seo.ts, etc.) — Single Source of Truth
  - `lib/`                   — Utilities (auth, tracking, etc.)
  - `core/`                  — Core providers (TenantProvider, DemoModeProvider, etc.)
- `supabase/functions/`      — Edge Functions (ai-invoke, stripe-*, gdpr-*, kodee-*, workflow-*)
- `supabase/migrations/`     — DB-Migrations
- `services/`, `connectors/` — Backend-Services und Integrationen
- `worker/`                  — Background-Jobs
- `deploy/`                  — VPS-Stack (Traefik, Ollama, n8n)
- `scripts/`                 — Build- und Release-Skripte
- `test/`, `e2e/`            — Unit- und E2E-Tests

## Befehle
- Dev:           `npm run dev`                (http://localhost:3000)
- Dev (Watch):   `npm run dev` + edit files   (HMR works automatically)
- Build:         `npm run build`
- Build Full:    `npm run build:full`         (builds + generates legal pages + prerender)
- Lint/Type:     `npm run lint`               (tsc --noEmit)
- Tests:         `npm test`                   (vitest run)
- Tests (Watch): `npm run test:watch`         (re-runs on file change)
- Tests (DB):    `npm run test:db`            (unit tests with local Supabase)
- Test Single:   `npm test -- path/to/file`  (run one test file)
- E2E:           `npm run e2e`                (Playwright)
- E2E (UI):      `npm run test:e2e:ui`        (interactive test reporter)
- Prod-Check:    `npm run check:production`   (smoke tests, routing verification)
- QA Smoke:      `npm run qa:smoke`           (full system smoke test)

## Routen-Struktur und Patterns

### Public vs. Protected Pages
- **Public pages**: `src/pages/*.tsx`, no auth required, eager imports in `src/App.tsx`
  - Beispiel: `/` (MainLanding), `/pricing` (PricingPage), `/audit` (AuditLanding)
  - Nutzen eager imports (direkt in App.tsx) für SEO & kritisches Rendering
  
- **Protected/Auth-gated**: `src/features/*/`, lazy-loaded via `const FeatureName = lazy(() => import(...)))`
  - Gekapselt in ProtectedRoute oder RequireAal2
  - Beispiel: `/app/*` (GovernanceDashboard), `/settings` (SettingsView)

### Routing-Pattern
1. **Neue öffentliche Seite hinzufügen**:
   - Datei: `src/pages/NewPage.tsx`
   - Import in `src/App.tsx` (oben bei public pages)
   - Route hinzufügen: `<Route path="/path" element={<NewPage />} />`

2. **Neue geschützte Feature**:
   - Modul: `src/features/feature-name/FeatureView.tsx`
   - Lazy-Import in `src/App.tsx`
   - Route mit ProtectedRoute wrapper

3. **Dynamische Routen** (z.B. `/branchen/:slug`):
   - Komponente liest `useParams()` (react-router-dom)
   - Detailseiten nutzen zentrale Config-Dateien (z.B. `src/config/industries.ts`)

### Centralized Config Pattern
- **Single Source of Truth**: `src/config/*.ts` enthält strukturierte Daten
  - `pricing.ts` → PUBLIC_PRICING_TIERS, ENTERPRISE_TIER (konsumiert von PricingPage, PricingTeaserSection, index.html JSON-LD)
  - `seo.ts` → SEO-Metadaten, Open-Graph-Tags
  - `competitor-comparisons.ts` → Alternative-Doorway-Inhalte
  - Änderungen in config propagieren überall — niemals duplizieren

## Konventionen
- Sprache: Deutsch (Code-Kommentare und Doku, sofern nicht Standard-Englisch nötig)
- Terminologie: „Prüfpfad" statt „Audit Trail", „Herkunftsnachweis" statt „Provenance"
- Design-System: 
  - **App/Dashboard**: Hard-Edge Industrial UI (keine abgerundeten Ecken, Obsidian/Titanium-Palette)
  - **Public Landing-Pages**: „European Enterprise Trust" Light-Theme (Slate-Neutrals, ruhige Karten/Chips/Panels mit 10–14px Radius: `rounded-chip`, `rounded-card`, `rounded-panel`, Petrol #0F766E als Akzent)
  - Separate `LandingNavbar` (weiß) für öffentliche Seiten
  - Monospace überall für Metadaten (IDs, Codes, Technisches)
- Farben: 
  - App/Dashboard: Obsidian #0A0A0B · Titanium #E2E2E2 · Security-Blue #0052FF
  - Landing: Slate `slate-*` (#F8FAFC–#0F172A) · Petrol `petrol-700` (#0F766E)
- Compliance: EU AI Act + DSGVO; Service-Role-Keys ausschließlich in Edge Functions
- Multi-Tenancy: alle Tabellen RLS-geschützt; jeder externe Call wird in `ai_tool_runs` / `workflow_runs` geloggt

## Component-Patterns

### Public Page Template
```tsx
// src/pages/NewFeaturePage.tsx
import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';

export function NewFeaturePage() {
  return (
    <div className="bg-hero-only min-h-screen flex flex-col text-titanium-50">
      {/* Top bar */}
      <div className="px-4 py-4 flex items-center justify-between">
        <Link to="/" className="...">
          <Logo size={48} />
        </Link>
      </div>
      
      {/* Hero section */}
      {/* Content sections */}
      {/* Footer */}
    </div>
  );
}
```

### Lazy Loading für Auth-gated Features
```tsx
// In App.tsx
const NewFeatureView = lazy(() => import('./features/new-feature/NewFeatureView')
  .then((m) => ({ default: m.NewFeatureView })));

// In Routes
<Route path="/feature" element={<ProtectedRoute><NewFeatureView /></ProtectedRoute>} />
```

### Config-Datei Pattern
Neue Datenstruktur in `src/config/`:
1. Define TypeScript interfaces
2. Export const arrays/objects
3. Document Single Source of Truth sources
4. Add reasoning/history comments

## Testing

### Unit Tests (Vitest)
- Location: `test/`, `e2e/`, or `__tests__` folders
- Run all: `npm test`
- Run specific file: `npm test -- src/lib/myutil.test.ts`
- Watch mode: `npm run test:watch`
- Database tests: `npm run test:db` (spins up local Supabase)

### E2E Tests (Playwright)
- Location: Configured in `playwright.config.ts` and `playwright.catalog.config.ts`
- Run: `npm run e2e`
- Interactive mode: `npm run test:e2e:ui`
- View report: `npm run test:e2e:report`

### QA / Smoke Tests
- Full smoke test: `npm run qa:smoke`
- Governance smoke test: `npm run qa:governance`
- Load test: `npm run qa:load`

## Deployment & Releases

### Pre-Production Checks
- `npm run check:production` — validates routing, modules, SEO
- `npm run smoke:production` — tests critical paths against deployed instance

### Build Process
- `npm run build` — creates optimized dist/
- `npm run build:full` — also generates legal pages + prerender (SEO)

### Release Process
- Feature branches: `<task-type>/<short-desc>`
- PR workflow: Create draft PR, request review, merge
- After merge: GitHub Actions deploy to staging/production

## Edge Functions (Supabase)

### Location & Pattern
- `supabase/functions/` directory
- Each function in its own folder: `supabase/functions/my-function/index.ts`
- Only place for Service-Role Keys (never in client code)
- Example functions: `ai-invoke`, `stripe-*`, `gdpr-*`, `kodee-*`, `workflow-*`

### Deployment
- Local testing: `supabase functions serve`
- Deploy: automatic on push to main
- Logs: view in Supabase dashboard or `supabase functions list`

## Database Migrations (Supabase)

### Pattern
- Location: `supabase/migrations/`
- Name format: `YYYYMMDDHHMMSS_description.sql`
- **Always additive** — never break existing RLS policies or public APIs
- Test locally: `supabase db reset` (resets to latest migration)

### RLS Rules
- Every table must have RLS enabled
- Multi-tenant tables have `tenant_id` with RLS policy checking auth.uid()
- Audit tables: log all changes to `ai_tool_runs` / `workflow_runs`

## Design-Lock: Startseite (`src/pages/MainLanding.tsx`)
- **GESPERRT (Baseline: Commit `3b972f3`).** Das aktuelle Startseiten-Design ist der genehmigte, eingefrorene Stand („Das KI-Betriebssystem für DSGVO, EU AI Act & Code-Compliance" — Obsidian/Cyan-Globe-Hero mit Claude-Code-Metrik-Karten).
- **Erlaubt ohne Rückfrage:** nur Änderungen an **Texten/Copy** und **Button-Beschriftungen** (Strings) sowie an Link-Zielen der Buttons.
- **Nur mit ausdrücklicher Genehmigung:** jegliche Design-/Layout-/Struktur-/Farb-/Komponenten-/Spacing-/Icon-Änderung, Umbau der Sektionen, Theme-Wechsel oder Ersetzen der Seite. Im Zweifel: erst fragen, nicht ändern.

## Ziele für Claude
- Features in Edge Functions + SPA umsetzen
- Migrations sauber additiv halten (RLS nicht brechen)
- Tests (vitest/playwright) zu neuen Features ergänzen
- Refactorings ohne Breaking Changes an öffentlichen Routen
- Daten zentral in `src/config/` halten (Single Source of Truth)
- Neue öffentliche Seiten in `src/pages/`, geschützte Features in `src/features/`

## Auth & Multi-Tenancy

### Auth Flow
1. Public sign-up: Supabase Auth (Email/Password or OAuth)
2. Protected routes: `ProtectedRoute` or `RequireAal2` wrapper
3. Session: stored in localStorage, validated via `useSupabaseAuth()` hook
4. Service Role operations: Edge Functions only (never in client)

### Multi-Tenant Isolation
- `TenantProvider` wraps protected routes
- Each user belongs to exactly one tenant (workspace)
- All data queries filtered by `tenant_id` via RLS
- Workspace invitations: `InvitesView`, `AcceptInviteView`

### User Context
- Access via `useAuth()` hook → user object with `id`, `email`, `tenantId`
- Tenant context via `useTenant()` hook → workspace info, members, plan

## Common Patterns & Gotchas

### ✅ DO
- Keep public page imports eager (critical rendering path)
- Lazy-load auth-gated features (saves bundle for public users)
- Use centralized `src/config/` for data
- Test with `npm run test:watch` while developing
- Run `npm run check:production` before committing
- Add comments explaining *why* in non-obvious code (RLS logic, compliance rules)
- Write E2E tests for critical user flows (sign-up, checkout, compliance paths)

### ❌ DON'T
- Mutate shared config objects (they should be immutable const)
- Put Service-Role keys in client code
- Create auth-gated tables without RLS policies
- Break existing public route contracts (redirects are OK, but not URL changes)
- Duplicate data — always link to `src/config/` source
- Commit secrets, API keys, or credentials (use .env.local, never .env)

### RLS Debugging
- Check policies: `supabase db pull` then inspect `supabase/migrations/`
- Test locally: `supabase db reset && npm run test:db`
- Logs: `supabase functions serve` shows function errors
- Multi-tenant queries must include `tenant_id` in WHERE clause

### TypeScript Strict Mode
- Enabled by default (tsconfig.json strict: true)
- All function parameters typed
- No implicit any
- Run `npm run lint` before commit to catch type errors early
