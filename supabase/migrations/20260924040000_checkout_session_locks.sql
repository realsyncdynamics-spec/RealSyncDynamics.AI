-- One open Stripe Checkout Session per tenant for subscription mode.
-- Reservation is NOT a trial grant. Consume trial only after Stripe
-- creates a subscription with trial_start or create-trial-subscription writes.

CREATE TABLE IF NOT EXISTS public.checkout_session_locks (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  stripe_session_id text NOT NULL,
  plan_key text NOT NULL,
  trial_intended boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'expired', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS checkout_session_locks_open_idx
  ON public.checkout_session_locks (tenant_id)
  WHERE status = 'open';

ALTER TABLE public.checkout_session_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "checkout_session_locks tenant-read" ON public.checkout_session_locks;
CREATE POLICY "checkout_session_locks tenant-read"
  ON public.checkout_session_locks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = checkout_session_locks.tenant_id
        AND m.user_id = auth.uid()
    )
  );

REVOKE ALL ON public.checkout_session_locks FROM PUBLIC;
GRANT SELECT ON public.checkout_session_locks TO authenticated;
GRANT ALL ON public.checkout_session_locks TO service_role;
