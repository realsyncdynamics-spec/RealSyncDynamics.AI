# P0 Track 3 — Entitlement-Flow

**Status:** Scaffold only. Depends on Auth (#1011) and ideally on Deploy/Migrations track.

## Goal

Fix F-03 from Audit #1005:

> Einmalprodukt „Governance Launch" (349 €) can not be fulfilled in production because `entitlement_grants` is missing (`PGRST205`).

Customer can pay; the webhook cannot write the grant → paid service without unlock.

## Planned contents of this PR

1. Ensure `entitlement_grants` migration is applied (or land the missing migration here)
2. Stripe webhook path that writes the grant for `purchaseMode: 'one_time'`
3. Temporary safety: disable the one-time product in Checkout until the table + grant path is live
4. Test: Stripe test event `checkout.session.completed` with `purchaseMode=one_time` → assert grant exists

## References

- Audit #1005 (F-03)
- Auth remediation #1011
- Pricing SSoT: `shared/pricing.ts` / `docs/product/pricing-governance.md`
