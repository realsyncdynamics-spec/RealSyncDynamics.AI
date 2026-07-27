-- Add trial_ends_at column to subscriptions table for trial countdown tracking
-- Used by TrialCountdownBanner component to display trial expiration countdown

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS subscriptions_trial_ends_at_idx ON public.subscriptions (trial_ends_at DESC)
  WHERE trial_ends_at IS NOT NULL;

COMMENT ON COLUMN public.subscriptions.trial_ends_at IS 'When the trial period ends. NULL = no trial or trial has passed. Populated from Stripe subscription.trial_end.';
