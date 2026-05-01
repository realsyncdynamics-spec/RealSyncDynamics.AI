# Contributing

## Branch naming

| Pattern                | Used for                                                |
| ---------------------- | ------------------------------------------------------- |
| `feat/<short-slug>`    | new user-facing feature                                 |
| `fix/<short-slug>`     | bug fix                                                 |
| `refactor/<slug>`      | internal change, no behavior change                     |
| `chore/<slug>`         | tooling, deps, CI, docs                                 |
| `claude/<slug>-<id>`   | reserved for Claude-Code-on-the-Web sessions            |

Slug = lowercase kebab-case, ≤ 40 chars, e.g. `feat/quota-bar` or `fix/stripe-webhook-signature`.

PR titles follow the same prefix (`feat:`, `fix:`, `refactor:`, `chore:`).

## Migration workflow

We use Supabase migration files under `supabase/migrations/`. The DB is the
source of truth; **never** make schema changes through the dashboard.

### Local development

```bash
# 1. Start the local Supabase stack (Docker required)
supabase start

# 2. Create a new migration. CLI generates a timestamped filename.
supabase migration new <descriptive-name>

# 3. Edit the new SQL file. Make every statement idempotent
#    (CREATE … IF NOT EXISTS, DROP POLICY IF EXISTS, etc.) so re-running
#    is safe.

# 4. Reset the local DB and replay ALL migrations from scratch.
#    This is the only reliable way to verify that your migration is
#    consistent with the rest of the schema.
supabase db reset

# 5. Smoke-test in the app (npm run dev) or psql.
```

### Two hard rules

1. **Append-only.** Once a migration file lands on `main`, *never* edit it.
   Need to fix something? Add a new migration that ALTERs the offending
   object. CI blocks PRs that modify already-merged migrations.

2. **Reset before push.** Always run `supabase db reset` locally before
   opening a PR. CI runs the same on every PR — but catching it locally
   saves a round-trip.

### Conflict resolution

Two branches that both add a migration with timestamps `20260501120000` and
`20260501130000` rebase cleanly. Two branches with the **same** timestamp
collide. The newer PR renames its file to a later timestamp during rebase:

```bash
mv supabase/migrations/<colliding>.sql supabase/migrations/$(date +%Y%m%d%H%M%S)_<name>.sql
```

This preserves history and ordering on `main`.

### Deploying

```bash
# Once linked (see deploy playbook): pushes pending migrations.
supabase db push
```

CI does not auto-deploy; that's a deliberate manual step today.

## Edge functions

Every new function gets:

- `supabase/functions/<name>/index.ts`
- `supabase/functions/<name>/README.md` documenting request/response and
  required secrets

Shared logic goes in `supabase/functions/_shared/*.ts`.

Deployed manually: `supabase functions deploy <name>`.

## Tests

`npm run lint` — TypeScript typecheck.
`npm run build` — Vite production build.
Migration job in CI validates `supabase db reset` works against a fresh DB.

PRs need both jobs (`build`, `db`) to be green before merge.

## Reviewing

- New entitlement keys MUST be plan-bound in the same migration that adds
  them, otherwise `tenant_entitlements()` returns nothing for that key on
  any tenant.
- New write actions MUST require a confirm token.
- New AI tools MUST set `cost_input/output_per_million_usd` non-zero.
- Edge functions MUST validate user → membership → entitlement, in that
  order, before any side effect.
