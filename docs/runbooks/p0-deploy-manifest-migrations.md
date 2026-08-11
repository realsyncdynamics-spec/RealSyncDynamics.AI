# P0 Track 2 — Deploy-Manifest + Migrationen

**Status:** Gate open (2026-08-11). Auth P0 (#1011 + selective free-slot deploy + 401 verification) is live. Real work on this track can start.

**Related:** #1005 (audit) · #1011 (Auth) · #1015 (orphan cleanup) · `docs/runbooks/edge-function-kontingent.md`

---

## Goal

Reconcile the production gap documented in Audit #1005:

- ~83 of ~178 Edge Functions still not deployed (F-01)
- Core tables / migration ledger residual issues (F-02)
- CI: `check:edge-functions` / drift-guard behaviour without credentials (F-06)

---

## Hard constraints (do not violate)

1. **Never mass-deploy** the remaining functions while any Auth bypass still exists on them.  
   The three P0 endpoints are hardened; the other ~80 are **not** yet reviewed for `requireAuthAndTenant` + `verify_jwt`.
2. **Free-tier limit = 100**. After the 2026-08-11 orphan cleanup we have only a handful of free slots.  
   Deploying dozens of new functions is impossible without a plan upgrade (Pro = 500) or further deliberate deletions.
3. Prefer **selective, audited deploys** (same pattern as `selective-p0-auth-deploy.yml` / free-slot workflow) over the full `Deploy` workflow.

---

## Inventory strategy

### Current measured state (2026-08-11)

| Metric | Value |
|--------|-------|
| Live functions (post-orphan-delete) | ~95–96 / 100 |
| Repo directories under `supabase/functions/` (with `index.ts`) | ~160+ |
| Gap (repo present, not live) | ~65–70 |
| Orphans remaining | 0 (allowlist empty) |

Exact live list / gap is obtained via the new helper:

```bash
# repo-only
node scripts/edge-function-inventory.mjs

# full diff (needs secrets)
SUPABASE_ACCESS_TOKEN=… SUPABASE_PROJECT_ID=ebljyceifhnlzhjfyxup \
  node scripts/edge-function-inventory.mjs
```

or the temporary `list-edge-functions.yml` workflow.

### Priority tiers for remaining deploys

**Tier 0 — already live & hardened (done)**  
`governance-risk-score`, `governance-agents-list`, `enterprise-ai-os-discovery-pending`

**Tier 1 — Governance core (next, once slots + auth review exist)**  
High product value, already referenced by UI / other functions:

- `governance-dsr`, `governance-incidents`, `governance-connectors`, `governance-vendors`
- `governance-approvals`, `governance-dpias`, `governance-evidence-handler`
- `governance-memory`, `memory-decay-worker`, `memory-confidence-trigger`
- `evidence-vault`, `evidence-vault-export`, `iso42001-evidence-vault`
- `policy-packs`, `provenance`

**Tier 2 — Enterprise AI OS + agents**  
`enterprise-ai-os-*` remaining, `agent-os-runner`, `governance-agent`, …

**Tier 3 — Supporting / lower risk**  
Stripe helpers, email, marketing, SEO, SiteOS, etc.

**Tier 4 — Candidates for deletion / never deploy**  
Dead code, one-off debug, superseded helpers. Prefer delete over deploy to free slots.

Before any Tier-1 deploy: each function must have

1. `requireAuthAndTenant` (or equivalent) + parameterized queries
2. `verify_jwt = true` in `config.toml`
3. Selective deploy workflow (never the full matrix)

---

## Planned contents of this PR (incremental)

1. ✅ Status + gate update
2. ✅ Inventory strategy + priority tiers
3. ✅ Small inventory helper (`scripts/edge-function-inventory.mjs`)
4. F-06: harden `scripts/check-edge-function-drift.mjs` so missing credentials in CI produce a clear warning / optional fail (currently graceful skip)
5. Migration notes / residual ledger items (link to `p0-2-migration-reconciliation.md`)
6. Explicit decision log: which functions we will **not** deploy and why

---

## Immediate next actions (safe, no new deploys)

1. Run the inventory helper with credentials and commit a snapshot of the missing list (optional, under `docs/inventory/`).
2. Review the top 8–10 Tier-1 functions for Auth patterns (copy the hardened helper from the three P0 endpoints).
3. Decide plan upgrade vs. further cleanup of low-value live functions.
4. Only then open selective deploy workflows for the first 1–2 Tier-1 functions.

---

## References

- Auth remediation: #1011, #1015, `docs/runbooks/edge-function-kontingent.md` §7
- Migration residual: `docs/runbooks/p0-2-migration-reconciliation.md`
- Drift guard: `scripts/check-edge-function-drift.mjs` + empty allowlist
- Inventory helper: `scripts/edge-function-inventory.mjs`
- Audit: #1005
