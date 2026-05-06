-- Track when each user has received the welcome email so the welcome-email
-- Edge Function stays idempotent (safe to call multiple times).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_welcome_unsent
  ON public.profiles(created_at)
  WHERE welcome_email_sent_at IS NULL;
