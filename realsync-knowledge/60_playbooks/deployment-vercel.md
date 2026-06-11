---
title: Deployment Playbook — Vercel (SPA)
owner: platform
status: draft
sensitivity: internal
review_cycle: quarterly
valid_until: 2026-08-31
tags: [deployment, vercel, spa, playbook]
---

# Deployment Playbook — Vercel (SPA)

Operational playbook for deploying the RealSync SPA (Vite +
React 19) to Vercel. The SPA is a static bundle; all backend
logic lives in Supabase Edge Functions and the VPS stack.

## Scope

- The Vite-built SPA from `src/`.
- Static assets in `public/`.
- Edge configuration limited to redirects and headers.

Out of scope:
- Supabase migrations (see `../20_architecture/` once added).
- VPS services (see `deployment-hostinger.md`).

## Environments

| Environment | Branch                          | URL pattern                       | Purpose                          |
|-------------|---------------------------------|-----------------------------------|----------------------------------|
| production  | `main`                          | `app.<domain>`                    | tenant-facing production         |
| staging     | `staging`                       | `staging.<domain>`                | pre-production validation        |
| preview     | any pull request                | `<sha>-realsync.vercel.app`       | per-PR review and `npm run check:production` |

The branch and domain mapping is configured in the Vercel
project. Changing the mapping is a controlled change and
requires updating this document.

## Environment Handling

Environment variables are injected via the Vercel project
settings, scoped per environment.

| Variable                       | Source           | Scope                |
|--------------------------------|------------------|----------------------|
| `VITE_SUPABASE_URL`            | Vercel env       | all                  |
| `VITE_SUPABASE_ANON_KEY`       | Vercel env       | all                  |
| `VITE_SENTRY_DSN`              | Vercel env       | production, staging  |
| `VITE_STRIPE_PUBLISHABLE_KEY`  | Vercel env       | all                  |

Service-role keys MUST NOT appear in any `VITE_*` variable. Per
project convention, service-role keys live only in edge
functions.

## Deployment Flow

1. **Open PR** against `main` or `staging`. A preview
   deployment is created automatically by Vercel.
2. **CI checks** run on the PR: `npm run lint`, `npm test`,
   `npm run check:production`.
3. **Manual smoke** on the preview URL: authentication, one
   workflow run, billing entry visible.
4. **Merge** the PR. Vercel deploys to the corresponding
   environment.
5. **Post-deploy verification**: visit the environment URL,
   confirm the build hash matches the commit, confirm Sentry
   receives the release event.

## Rollback

A failed production deployment is rolled back by re-promoting
the previous deployment in the Vercel dashboard:

1. Locate the previous green deployment in the production
   environment.
2. Use "Promote to Production".
3. Confirm via the deployed build hash that the rollback took
   effect.
4. Open an incident ticket (see
   `../40_security/incident-response.md`) if user impact was
   observed.

Rollback does NOT revert backend state (database, edge
functions). Coupling-aware changes (schema + SPA) require the
schema change to be backward-compatible across at least one
deployment.

## Preview Deployments

- Created on every PR; one preview URL per commit.
- Use `VITE_SUPABASE_URL` pointing to the staging Supabase
  project unless the PR explicitly targets production secrets.
- Preview deployments MUST NOT be linked from external content
  or shared with users outside RealSync personnel.

## Secrets Handling

- Secrets are managed in the Vercel project settings UI.
- Rotation cadence: quarterly; immediate on suspected exposure.
- A secret rotation is logged as a finding of category
  `security.config` (see `../50_runtime/finding-model.md`).
- A secret MUST NOT be committed to the repository under any
  circumstances, including documentation examples. Use
  placeholders.

## Build Configuration

- Build command: `npm run build`.
- Output directory: `dist`.
- Node version: pinned in `package.json` `engines` field; Vercel
  must match.

## Open Items

- Edge configuration (redirects, security headers) inventory.
- Domain switchover runbook.
- Release tagging convention aligning Vercel deployment id and
  git tag.
