-- website_rebuilds checkout-flow patch
-- Adds columns and constraint updates needed by the updated
-- checkout-website-rebuild Edge-Function which pre-creates the rebuild row
-- before Stripe payment and links it via stripe_session_id.
--
-- Changes:
-- 1. Add stripe_session_id column (Stripe cs_xxx) for webhook correlation.
-- 2. Add plan_key column (e.g. 'website_rebuild_managed').
-- 3. Extend status CHECK to include 'pending_payment'.
-- 4. Make customer_email nullable (Stripe Checkout collects it; we don't
--    have it at row-creation time — the stripe-webhook fills it in on
--    checkout.session.completed).
-- 5. Add generated column domain as alias for source_domain so both the
--    old stripe-webhook (uses source_domain) and new checkout code (uses
--    domain) work without a breaking rename.

-- 1. stripe_session_id
ALTER TABLE public.website_rebuilds
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_website_rebuilds_stripe_session
  ON public.website_rebuilds(stripe_session_id) WHERE stripe_session_id IS NOT NULL;

-- 2. plan_key
ALTER TABLE public.website_rebuilds
  ADD COLUMN IF NOT EXISTS plan_key TEXT;

-- 3. Extend status CHECK — PostgreSQL requires DROP + ADD constraint.
--    Idempotent: IF EXISTS guard on DROP.
ALTER TABLE public.website_rebuilds
  DROP CONSTRAINT IF EXISTS website_rebuilds_status_check;

ALTER TABLE public.website_rebuilds
  ADD CONSTRAINT website_rebuilds_status_check
  CHECK (status IN (
    'pending_payment',
    'queued', 'running',
    'preview_ready', 'live',
    'failed', 'cancelled'
  ));

-- 4. Make customer_email nullable
--    The column was created NOT NULL DEFAULT '' which blocks our pre-create.
ALTER TABLE public.website_rebuilds
  ALTER COLUMN customer_email DROP NOT NULL;

-- 5. Add domain column as alias for source_domain (generated, stored).
--    Allows the checkout function to INSERT INTO domain=... while the
--    webhook continues to write source_domain.
--    Using a plain column (not GENERATED) for max insert flexibility:
ALTER TABLE public.website_rebuilds
  ADD COLUMN IF NOT EXISTS domain TEXT
  GENERATED ALWAYS AS (source_domain) STORED;

-- Backfill: for rows that already exist the generated column is auto-populated.

COMMENT ON COLUMN public.website_rebuilds.stripe_session_id IS
  'Stripe Checkout Session ID (cs_xxx) — written by checkout-website-rebuild, read by stripe-webhook to correlate checkout.session.completed.';
COMMENT ON COLUMN public.website_rebuilds.plan_key IS
  'Stripe products plan_key — e.g. website_rebuild_managed.';
COMMENT ON COLUMN public.website_rebuilds.domain IS
  'Hostname extracted from source_url — generated alias for source_domain.';
