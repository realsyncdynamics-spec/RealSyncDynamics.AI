-- Newsletter mit Double-Opt-In gemäß § 7 UWG + BGH I ZR 218/07.

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL,
  confirm_token   UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  unsub_token     UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'confirmed', 'unsubscribed', 'bounced')),
  source          TEXT,
  ip_hash         TEXT,
  user_agent      TEXT,
  consent_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at    TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_email_unique
  ON public.newsletter_subscribers (lower(email))
  WHERE status IN ('pending', 'confirmed');

CREATE INDEX IF NOT EXISTS idx_newsletter_status ON public.newsletter_subscribers(status);
CREATE INDEX IF NOT EXISTS idx_newsletter_ip_hash_created
  ON public.newsletter_subscribers(ip_hash, created_at);

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "newsletter super_admin_read" ON public.newsletter_subscribers;
CREATE POLICY "newsletter super_admin_read"
  ON public.newsletter_subscribers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_super_admin = true
  ));
