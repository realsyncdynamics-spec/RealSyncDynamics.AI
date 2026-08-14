-- Mixed Stripe Checkout sessions can contain a recurring governance plan plus
-- the one-time €349 Governance Launch item. The existing Stripe webhook already
-- persists every verified event in webhook_events before its business handlers.
-- This trigger makes the launch entitlement atomic with that durable event store,
-- so bundle purchases do not depend on the subscription synchronizer to infer a
-- one-time entitlement.
--
-- Stripe documents subscription-mode mixed carts as recurring + one-time items;
-- the one-time item is charged on the initial invoice only.

CREATE OR REPLACE FUNCTION public.grant_governance_launch_from_stripe_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  session jsonb;
  metadata jsonb;
  tenant_uuid uuid;
  plan text;
  product_uuid uuid;
  paid boolean;
  session_id text;
  payment_intent text;
  customer_id text;
  amount_cents integer;
  currency_code text;
BEGIN
  IF NEW.type NOT IN ('checkout.session.completed', 'checkout.session.async_payment_succeeded') THEN
    RETURN NEW;
  END IF;

  session := COALESCE(NEW.payload -> 'data' -> 'object', '{}'::jsonb);
  metadata := COALESCE(session -> 'metadata', '{}'::jsonb);

  -- Only the server-generated bundle/launch metadata may create this grant.
  plan := COALESCE(metadata ->> 'launch_plan_key', '');
  IF plan <> 'governance_launch' THEN
    RETURN NEW;
  END IF;

  paid := COALESCE(session ->> 'payment_status', '') = 'paid';
  IF NOT paid THEN
    -- Do not grant rights for an unpaid/asynchronous session. The
    -- async_payment_succeeded event will run this function again.
    RETURN NEW;
  END IF;

  session_id := COALESCE(session ->> 'id', NEW.id);
  tenant_uuid := NULLIF(metadata ->> 'tenant_id', '')::uuid;
  IF tenant_uuid IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO product_uuid
  FROM public.products
  WHERE default_for_plan_key = 'governance_launch'
  ORDER BY created_at DESC NULLS LAST
  LIMIT 1;

  -- If catalog configuration is incomplete, leave the event available for the
  -- normal webhook handler and do not make the event insert fail.
  IF product_uuid IS NULL THEN
    RETURN NEW;
  END IF;

  payment_intent := NULLIF(session ->> 'payment_intent', '');
  customer_id := NULLIF(session ->> 'customer', '');
  amount_cents := NULLIF(session ->> 'amount_total', '')::integer;
  currency_code := lower(COALESCE(session ->> 'currency', 'eur'));

  INSERT INTO public.entitlement_grants (
    tenant_id,
    product_id,
    plan_key,
    source,
    purchase_reference,
    stripe_checkout_session_id,
    stripe_payment_intent_id,
    stripe_customer_id,
    amount_total_cents,
    currency,
    status,
    revoked_at,
    revoked_reason,
    expires_at,
    granted_at,
    updated_at
  ) VALUES (
    tenant_uuid,
    product_uuid,
    'governance_launch',
    'one_time_purchase',
    session_id,
    session_id,
    payment_intent,
    customer_id,
    amount_cents,
    currency_code,
    'active',
    NULL,
    NULL,
    NULL,
    to_timestamp(COALESCE((session ->> 'created')::double precision, extract(epoch from now()))),
    now()
  )
  ON CONFLICT (source, purchase_reference)
  DO UPDATE SET
    status = 'active',
    revoked_at = NULL,
    revoked_reason = NULL,
    updated_at = now();

  RETURN NEW;
EXCEPTION
  WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    -- Never turn an otherwise valid Stripe event into a failed webhook solely
    -- because optional metadata was malformed. The normal webhook remains the
    -- authoritative fallback path and the event is retained for diagnostics.
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.grant_governance_launch_from_stripe_event() IS
  'Atomically grants the €349 Governance Launch entitlement for verified paid Stripe mixed-cart checkout events. Browser clients cannot invoke it directly.';

DROP TRIGGER IF EXISTS trg_webhook_events_governance_launch ON public.webhook_events;
CREATE TRIGGER trg_webhook_events_governance_launch
AFTER INSERT ON public.webhook_events
FOR EACH ROW
EXECUTE FUNCTION public.grant_governance_launch_from_stripe_event();
