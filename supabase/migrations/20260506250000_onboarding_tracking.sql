-- Track onboarding-tour completion to avoid showing the modal repeatedly.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_dismissed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_step INTEGER NOT NULL DEFAULT 0
    CHECK (onboarding_step BETWEEN 0 AND 5);
