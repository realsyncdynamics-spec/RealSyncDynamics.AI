# P0 Track 2 — Deploy-Manifest + Migrationen

**Status:** Scaffold only. Do not start work until Auth PR (`fix/p0-auth-f04-f05` / #1011) is merged, deployed and independently verified.

## Goal

Reconcile the production gap documented in Audit #1005:

- 83 of 178 Edge Functions not deployed (F-01)
- 12+ core tables missing in prod (`PGRST205`) (F-02)
- Migration ledger drift

## Hard gate

> Never deploy the missing functions before F-04/F-05 are fixed and verified in staging/production.

Deploying the 83 functions while Auth bypasses still exist would activate multiple Auth-Bypasses at once.

## Planned contents of this PR

1. Updated deploy manifest / inventory of the 83 functions
2. Migration reconciliation runbook execution notes
3. Additive migrations for the missing core tables (if not already covered by open PRs)
4. CI hardening so `check:edge-functions` fails closed without credentials (F-06)

## References

- Audit snapshot: #1005
- Auth remediation: #1011
- Runbook: `docs/runbooks/p0-2-migration-reconciliation.md` (if present)
