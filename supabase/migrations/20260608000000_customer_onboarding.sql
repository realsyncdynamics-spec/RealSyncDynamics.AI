-- customer_onboarding: persists onboarding state after checkout.session.completed.
-- stripe-webhook upserts here before sending the welcome email via Resend.
-- Without this table the webhook handler throws on every purchase.
-- NOTE: table was created directly in Supabase on 2026-06-08; this file is
-- the code-documentation counterpart for the repo audit trail.

CREATE TABLE IF NOT EXISTS public.customer_onboarding (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id text        UNIQUE NOT NULL,
  email             text        NOT NULL,
  product_label     text,
  amount_cents      integer,
  currency          text,
  mode              text,
  completed_at      timestamptz,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE public.customer_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "service_role_all" ON public.customer_onboarding
  FOR ALL TO service_role USING (true) WITH CHECK (true);
