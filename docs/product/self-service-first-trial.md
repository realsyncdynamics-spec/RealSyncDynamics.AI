# Self-Service First Trial

Branch `feat/self-service-first-trial`. Not merged. Not deployed.

## Grant

```
eligible =
  plan.trialDays > 0
  AND purchaseMode === 'checkout'
  AND no live sub (trialing|active|past_due)
  AND trial not consumed (subscriptions.trial_start OR trial_audit_logs row)
```

Starter/Growth: 14 days on first grant. Agency and others: never (`trialDays: 0`).
`body.pilot` / `?pilot=true` are not an entitlement.

## Consume

Only after a real grant: Stripe subscription with `trial_start`, or `create-trial-subscription` insert + audit.
Abandoned or expired Checkout Sessions do not consume.

## One open session

Table `checkout_session_locks`: at most one `status=open` Subscription Checkout Session per tenant. Reuse that URL. Expire at Stripe before replacing. Cardless trial expires an open session first.

## Live sub

`409 SUBSCRIPTION_EXISTS`. No second subscription checkout. No silent paid checkout over a running trial.
