# Security Incidents & Mitigations

## Phase 2 Security Hardening (2026-07-20)

### Overview
This document tracks security incidents, mitigations, and remediation paths identified during Phase 2 security review. All findings have been addressed to the extent possible within current infrastructure constraints.

---

## Incident 1: Untracked Ad-Hoc Stripe Admin Functions

**Severity:** HIGH (payment infrastructure exposure) | **Status:** MITIGATED (partial), REMEDIATION BLOCKED (plan limit)

### What Happened
Two temporary Stripe admin functions were deployed outside the standard git/CI/CD pipeline directly to Supabase (project `ebljyceifhnlzhjfyxup`):

1. **`stripe-webhook-fixer`** — Webhook endpoint management + arbitrary Stripe credential injection
2. **`stripe-webhook-provision`** — Webhook creation/deletion + signing secret rotation

Both:
- Had entrypoints in `/tmp/user_fn_.../` (outside tracked history, inaccessible to git/GitHub Actions)
- Lacked role-based access control (only secret/token-based auth)
- Could modify critical payment infrastructure

### Why This Happened
- One-off admin tasks during initial Stripe integration setup
- Deployed directly for speed/agility, not intended as permanent endpoints
- Never committed to repository or documented

### Mitigations Applied (2026-07-20)

✅ **`stripe-webhook-fixer`:**
- `stripe_meter_shared_secret` rotated in Vault (new 32-byte random value)
- Function now returns 403 for all callers with old tokens
- Legitimate cron job `stripe-meter-sync-hourly` unaffected (reads secret fresh on each run)
- **Status:** De-facto disabled without code redeploy

⚠️ **`stripe-webhook-provision`:**
- Auth token hardcoded in compiled source (`rsd_prov_7Qk2Vx9mB4tLpZ0aN8se_2026`)
- Cannot rotate token without rebuilding/redeploying function
- Remains live and accessible to anyone who knows the hardcoded string
- **Status:** Exposed, blocked from remediation by Supabase plan limit (see "Blockers" below)

### Root Cause
1. Temporary tools deployed outside version control = no audit trail, no code review
2. No secret rotation mechanism for hardcoded tokens
3. No role-based access checks (only bearer token + hardcoded string)

### Remediation Path
1. **Unblock Supabase plan limit:**
   - Upgrade Supabase plan to remove function cap, OR
   - Increase spend cap, OR
   - Delete 3 already-deprecated functions (`debug-secret-shape`, `vault-set-secret`, `vault-key-setter`) to free slots
2. **Once unblocked:**
   - Delete both functions from Supabase dashboard
   - Remove function stubs from repository
   - Audit deploy logs for token exposure (manual task)
3. **If Stripe webhook provisioning is needed long-term:**
   - Build as proper protected route (not edge function)
   - Use role-based access control (cf. `document_vault` implementation)
   - Maintain audit trail for all operations

### Lessons Learned
- ❌ Never deploy admin tools outside version control
- ❌ Never use hardcoded secrets (no rotation possible)
- ❌ Admin operations require audit trail + approval, not just auth checks
- ✅ Temporary tasks should be one-shot scripts or documented processes, not persistent endpoints

---

## Incident 2: Document Vault RLS Bypass

**Severity:** HIGH (evidence confidentiality) | **Status:** FIXED

### What Happened
`evidence_vault_metadata` table lacked RLS policies, allowing any authenticated user to read/write all organization evidence regardless of tenant membership.

### Fix Applied (2026-07-20)
- ✅ RLS policies added: Super-Admin-only read/write
- ✅ Verified via test queries
- ✅ No data loss or exposure (no evidence that bypass was exploited)

### Commit
```
fix: evidence-vault-rls-hardening — Add Super-Admin-only RLS policies to evidence_vault_metadata
```

---

## Outstanding Findings (Out of Scope)

These require infrastructure changes or external authorization:

| Finding | Blocker | Owner | Status |
|---------|---------|-------|--------|
| Stripe webhook provision function deletion | Supabase plan limit (max functions reached) | User | Waiting for plan upgrade or spend-cap adjustment |
| Leaked-password-protection toggle | Only available in Supabase dashboard, no API tool | Supabase | Manual action required |
| Canonical tag bug (duplicate content penalty) | Frontend repo not connected to this session | User | Need GitHub app authorization or manual fix |
| GitHub Actions integration | OAuth authorization required | User | Need explicit GitHub permission grant |

---

## Next Steps

1. **This week:** Decide on Supabase plan (upgrade, increase spend cap, or delete old functions)
2. **Once unblocked:** Push PR with function deletions + cleanup
3. **Long-term:** Build proper admin routes with role-based access if these features are needed permanently

---

## Timeline

| Date | Event |
|------|-------|
| 2026-05-28 | 3 ad-hoc functions (`debug-secret-shape`, `vault-set-secret`, `vault-key-setter`) deprecated (410 Gone) |
| 2026-07-20 | Phase 2 security review: 2 live Stripe functions identified as high-risk |
| 2026-07-20 | `stripe_meter_shared_secret` rotated (mitigates `stripe-webhook-fixer` exposure) |
| 2026-07-20 | Evidence vault RLS policies hardened (closes `document_vault` bypass) |
| 2026-07-20 | Deprecated function stubs committed to repo + this document created |
| TBD | Supabase plan adjusted → remaining functions deleted |
