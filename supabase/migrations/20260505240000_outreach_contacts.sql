-- Outreach-Tracker für CEO-Briefe.
--
-- Konzept: market_gap → ceo_brief → outreach_contact. Ein Brief kann
-- an mehrere Kontakte gehen (deshalb m:n via Tabelle, nicht
-- ALTER TABLE ceo_briefs).

CREATE TABLE IF NOT EXISTS public.outreach_contacts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_gap_id   UUID REFERENCES public.market_gaps(id)  ON DELETE SET NULL,
    ceo_brief_id    UUID REFERENCES public.ceo_briefs(id)   ON DELETE SET NULL,

    name            TEXT,
    company         TEXT,
    email           TEXT,
    linkedin_url    TEXT,
    phone           TEXT,

    status          TEXT NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new', 'contacted', 'replied', 'meeting', 'deal', 'lost')),
    notes           TEXT,
    contacted_at    TIMESTAMPTZ,
    replied_at      TIMESTAMPTZ,
    next_followup_at TIMESTAMPTZ,

    created_by      UUID REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_market_gap ON public.outreach_contacts(market_gap_id);
CREATE INDEX IF NOT EXISTS idx_outreach_brief      ON public.outreach_contacts(ceo_brief_id);
CREATE INDEX IF NOT EXISTS idx_outreach_status     ON public.outreach_contacts(status);
CREATE INDEX IF NOT EXISTS idx_outreach_followup   ON public.outreach_contacts(next_followup_at)
    WHERE next_followup_at IS NOT NULL;

ALTER TABLE public.outreach_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "outreach super_admin all" ON public.outreach_contacts;
CREATE POLICY "outreach super_admin all"
    ON public.outreach_contacts FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.profiles p
         WHERE p.id = auth.uid() AND p.is_super_admin = true
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles p
         WHERE p.id = auth.uid() AND p.is_super_admin = true
    ));

DROP TRIGGER IF EXISTS update_outreach_modtime ON public.outreach_contacts;
CREATE TRIGGER update_outreach_modtime
    BEFORE UPDATE ON public.outreach_contacts
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

COMMENT ON TABLE public.outreach_contacts IS
    'Cold-Outreach-Tracker für CEO-Brief-Versand. super_admin only.';

-- ─── Cron-Job auf Vault-Token umstellen ────────────────────────────────────
-- Alter Job (mit GUC `app.market_scanner_secret` der nie gesetzt wurde) raus,
-- neuer Job mit Vault-Lookup.
DO $$
BEGIN
  PERFORM cron.unschedule('market-scanner-daily')
   WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'market-scanner-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'market-scanner-daily',
  '0 6 * * *',
  $cron$
    SELECT net.http_post(
      url     := 'https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/market-scanner',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets
           WHERE name = 'market_scanner_token' LIMIT 1
        )
      ),
      body    := jsonb_build_object('depth', 'deep', 'rotate', true)
    );
  $cron$
);
