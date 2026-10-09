-- Gate 2 · Website-Scans pro Mandant atomar begrenzen.
--
-- Befund (Review #1711): tenant-audit zählte die scan_runs der letzten Stunde
-- und legte den neuen Lauf erst danach in einem zweiten Aufruf an. Parallele
-- Anfragen desselben Mandanten bestanden dieselbe Zählung und überschritten
-- das Limit (TOCTOU). gdpr-audit lässt den internen Aufruf an seinem IP-Limit
-- vorbei — ohne harte Grenze hier ließe sich also beliebig viel Abruflast
-- erzeugen.
--
-- Lösung nach dem Muster von bots_enforce_quota (20260920130000): ein
-- BEFORE-INSERT-Trigger nimmt eine mandantenbezogene Transaktionssperre,
-- zählt darunter und weist den Insert ab, wenn das Limit erreicht ist. Ein
-- paralleler Insert wartet auf die Sperre und zählt die inzwischen
-- festgeschriebene Zeile mit.
--
-- Gilt nur für detector = 'gdpr-audit' (tenant-audit). Andere Detektoren
-- (email-auth-rescan, …) sind unberührt. Das Limit (30/Stunde) spiegelt
-- TENANT_SCAN_LIMIT_PER_HOUR in supabase/functions/_shared/internal-scan-call.ts;
-- die Edge Function prüft vorab nur noch für eine freundliche 429.
--
-- Rein additiv: keine Tabelle, Spalte oder Policy wird geändert.

CREATE OR REPLACE FUNCTION public.scan_runs_enforce_tenant_audit_quota()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_limit CONSTANT integer := 30;
  v_used  integer;
BEGIN
  IF NEW.detector IS DISTINCT FROM 'gdpr-audit' THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('public.scan_runs.tenant_audit_quota'), hashtext(NEW.tenant_id::text));

  SELECT count(*) INTO v_used
    FROM public.scan_runs r
   WHERE r.tenant_id = NEW.tenant_id
     AND r.detector  = 'gdpr-audit'
     AND r.created_at >= now() - interval '1 hour';

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'TENANT_SCAN_LIMIT_EXCEEDED: max % website scans per tenant and hour', v_limit
      USING ERRCODE = 'P0001',
            DETAIL  = 'TENANT_SCAN_LIMIT_EXCEEDED';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.scan_runs_enforce_tenant_audit_quota() IS
  'Gate 2: höchstens 30 gdpr-audit-Läufe je Mandant und Stunde, serialisiert '
  'per Advisory-Lock je Mandant (kein TOCTOU zwischen Zählen und Einfügen).';

REVOKE ALL ON FUNCTION public.scan_runs_enforce_tenant_audit_quota() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS scan_runs_tenant_audit_quota ON public.scan_runs;
CREATE TRIGGER scan_runs_tenant_audit_quota
  BEFORE INSERT ON public.scan_runs
  FOR EACH ROW EXECUTE FUNCTION public.scan_runs_enforce_tenant_audit_quota();
