-- market-scanner valorization: prompt versioning + outreach-to-brief status sync.

ALTER TABLE public.market_gaps
  ADD COLUMN IF NOT EXISTS prompt_version TEXT;

ALTER TABLE public.research_runs
  ADD COLUMN IF NOT EXISTS prompt_version TEXT;

COMMENT ON COLUMN public.market_gaps.prompt_version IS
  'Version identifier for market-scanner prompt/scoring logic used to generate the gap.';
COMMENT ON COLUMN public.research_runs.prompt_version IS
  'Version identifier for market-scanner prompt/scoring logic used during this run.';

CREATE OR REPLACE FUNCTION public.sync_ceo_brief_status_from_outreach()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_status TEXT;
BEGIN
  IF NEW.ceo_brief_id IS NULL THEN
    RETURN NEW;
  END IF;

  target_status := CASE NEW.status
    WHEN 'contacted' THEN 'sent'
    WHEN 'meeting' THEN 'sent'
    WHEN 'deal' THEN 'sent'
    WHEN 'replied' THEN 'replied'
    WHEN 'lost' THEN 'archived'
    ELSE NULL
  END;

  IF target_status IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.ceo_briefs cb
     SET status = CASE
       WHEN cb.status = 'archived' THEN 'archived'
       WHEN target_status = 'archived' THEN 'archived'
       WHEN cb.status = 'replied' AND target_status = 'sent' THEN 'replied'
       ELSE target_status
     END,
         sent_at = CASE
           WHEN target_status IN ('sent', 'replied', 'archived')
             THEN COALESCE(cb.sent_at, now())
           ELSE cb.sent_at
         END,
         sent_to_email = COALESCE(NULLIF(btrim(NEW.email), ''), cb.sent_to_email)
   WHERE cb.id = NEW.ceo_brief_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_ceo_brief_status_from_outreach ON public.outreach_contacts;
CREATE TRIGGER trg_sync_ceo_brief_status_from_outreach
AFTER INSERT OR UPDATE OF status, email, ceo_brief_id
ON public.outreach_contacts
FOR EACH ROW
EXECUTE FUNCTION public.sync_ceo_brief_status_from_outreach();
