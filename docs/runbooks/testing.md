# Testing — Vitest + Playwright

## Stack

| Tool | Scope | Speed | CI |
|---|---|---|---|
| **Vitest** | Unit tests for components, helpers, pure functions | ~1 s for current 5 tests | ✅ runs in `build` job after typecheck |
| **Playwright** | E2E smoke specs against the running dev server | ~10 s per spec (browser-bound) | ❌ not yet — runnable locally |

## Run Vitest (unit)

```bash
npm test          # one-shot
npm run test:watch  # re-run on change (dev loop)
```

Tests live under `test/`, with file path mirroring `src/` so `<EmptyStateGraphic>`'s test sits at `test/components/visual/EmptyStateGraphic.test.tsx`.

Setup file `test/setup.ts` wires the `@testing-library/jest-dom` matchers (`toBeInTheDocument`, `toHaveAttribute`, `toHaveClass`, …) into `expect()` automatically — every test file gets them without explicit import.

## Run Playwright (E2E)

One-time:

```bash
npx playwright install chromium  # downloads the browser binary (~150 MB)
```

Per session:

```bash
npm run dev          # in terminal 1 — Vite dev server on :3000
npm run e2e          # in terminal 2 — runs everything under e2e/
npm run e2e -- --headed  # open the browser to watch tests
```

Specs live under `e2e/`. Currently one smoke spec asserting the Landing Hero renders.

## CI integration

`.github/workflows/ci.yml` `build` job runs:

1. `npm ci`
2. `npm run lint` — TypeScript typecheck (no emit)
3. `npm test` — Vitest unit tests
4. `npm run build` — Vite production build

Any failure short-circuits the pipeline. Missing test → bug doesn't catch it; failing test → PR can't merge until fixed.

Playwright is **not** in CI yet — would need `npx playwright install --with-deps chromium` (slow, ~30 s) plus a server boot, and currently has only one spec. Promote when the spec count justifies the cost.

## Adding a new unit test

1. Find the corresponding source file, e.g. `src/components/visual/SectionDivider.tsx`
2. Mirror under `test/`, e.g. `test/components/visual/SectionDivider.test.tsx`
3. Import the unit + Testing-Library helpers:
   ```ts
   import { describe, it, expect } from 'vitest';
   import { render, screen } from '@testing-library/react';
   import { SectionDivider } from '../../../src/components/visual/SectionDivider';
   ```
4. Run `npm run test:watch` to iterate

## Adding a new E2E spec

1. Add `<feature>.spec.ts` under `e2e/`
2. Use the Playwright `test` + `expect`:
   ```ts
   import { test, expect } from '@playwright/test';
   test('feature works', async ({ page }) => {
     await page.goto('/some/route');
     await expect(page.getByRole('heading', { name: /headline/i })).toBeVisible();
   });
   ```
3. Run with `npm run e2e`

## What we're NOT doing yet

- No Storybook / visual-regression — overkill for current size; revisit when the design system has 30+ components
- No coverage threshold — wait until we have a baseline of meaningful tests; arbitrary threshold rewards trivial tests
- No DB-integration tests in CI — Edge Functions are tested manually against staging Supabase project; harness for them lands when the function count makes manual untenable
