-- email-auth-rescan: Finding-Dedupe/Resolve-Spalten + täglicher Cron-Job.
--
-- BEFUND
-- Es gab keinen automatischen DNS-Check (SPF/DMARC/DKIM). Das einzige
-- email_auth_finding (governance_events e712035d, "DMARC absent") war ein
-- Seed ohne Gegenstück; findings kannte nur manuelle Statuswechsel
-- (_shared/findings.ts updateFindingStatus) und keinen Schlüssel, über den
-- ein wiederkehrender Detector "derselbe Befund noch da / jetzt weg"
-- erkennen könnte.
--
-- WAS DIESE MIGRATION TUT
--   1. findings.dedupe_key  text        — stabiler Befund-Schlüssel eines
--      Detectors, z. B. 'email_auth.dmarc:<domain>'. NULL für alle
--      bestehenden Detectors (gdpr-audit etc.) — für sie ändert sich nichts.
--   2. findings.resolved_at timestamptz — Zeitpunkt der automatischen
--      Auflösung (status='resolved').
--   3. Partieller UNIQUE-Index: höchstens EIN offener (open/acknowledged)
--      Befund pro (tenant_id, dedupe_key). Bewusst OHNE asset_id: asset_id
--      ist nullable (NULLs wären im Index verschieden → keine Dedupe) und
--      derselbe Apex hängt live an zwei Assets (1838591e realsyncdynamicsai.de
--      und 83781774 www.realsyncdynamicsai.de). Die Domain steckt im
--      dedupe_key, das Asset in findings.asset_id.
--   4. Lese-Index für die Paarung email_auth_finding ↔ email_auth_resolved.
--   5. pg_cron-Job 'website-rescan-daily' (03:30 UTC) → Edge Function
--      email-auth-rescan über dispatch_cron_function mit dem DEDIZIERTEN
--      Vault-Key 'cron_website_rescan_key' (kein service_role-Bearer, siehe
--      docs/runbooks/cron-vault-secrets.md).
--
-- governance_events.event_type hat KEIN CHECK-Constraint (live geprüft
-- 2026-09-25: nur event_source, risk_level, policy_action, environment sind
-- eingeschränkt). 'email_auth_resolved' braucht daher keine Constraint-
-- Änderung; event_source 'website_scanner', risk_level 'info' und
-- policy_action 'log' sind erlaubte Werte.
--
-- FEHLT DER VAULT-EINTRAG?
-- cron.schedule legt den Job trotzdem an (keine Abhängigkeit beim Apply).
-- Zur Laufzeit wirft public.dispatch_cron_function dann
--   'Cron-Dispatch "email-auth-rescan" abgebrochen: Vault-Secret
--    "cron_website_rescan_key" fehlt. …'
-- → der Lauf steht in cron.job_run_details als failed, es wird KEIN HTTP-
-- Request abgesetzt, nichts geschrieben. Der Cron Health Guard meldet das.
-- Fehlt nur das Function Secret CRON_WEBSITE_RESCAN_KEY, antwortet die
-- Function fail-closed mit 500 und schreibt ebenfalls nichts.
--
-- IDEMPOTENT
-- ADD COLUMN / CREATE INDEX mit IF NOT EXISTS; ein vorhandener Job gleichen
-- Namens wird vorher entfernt und neu angelegt.
--
-- Betreiberschritt (Namen only, keine Werte): docs/runbooks/cron-vault-secrets.md

BEGIN;

ALTER TABLE public.findings
  ADD COLUMN IF NOT EXISTS dedupe_key  text,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

COMMENT ON COLUMN public.findings.dedupe_key IS
  'Stabiler Befund-Schluessel eines wiederkehrenden Detectors (z. B. email_auth.dmarc:<domain>). NULL = kein Dedupe.';
COMMENT ON COLUMN public.findings.resolved_at IS
  'Zeitpunkt der (automatischen) Aufloesung, gesetzt zusammen mit status=resolved.';

CREATE UNIQUE INDEX IF NOT EXISTS findings_open_dedupe_key_uidx
  ON public.findings (tenant_id, dedupe_key)
  WHERE status IN ('open', 'acknowledged') AND dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS governance_events_email_auth_idx
  ON public.governance_events (tenant_id, event_type, created_at)
  WHERE event_type IN ('email_auth_finding', 'email_auth_resolved');

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'website-rescan-daily') THEN
    PERFORM cron.unschedule('website-rescan-daily');
  END IF;
END
$do$;

SELECT cron.schedule(
  'website-rescan-daily',
  '30 3 * * *',
  $cron$ SELECT public.dispatch_cron_function(
           'email-auth-rescan',
           'cron_website_rescan_key',
           jsonb_build_object('trigger', 'cron')) $cron$
);

COMMIT;
