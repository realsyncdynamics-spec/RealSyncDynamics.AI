-- AP2 Nachzug: Policy- und Mail-Pfad nur gegen Spalten, die es gibt.
--
-- 20261120160200 liegt auf main und ist auf Produktion noch nicht angewendet.
-- Eine Korrektur in dieser Datei wuerde der Guard
-- "Non-append-only migration change" (deploy.yml) und die CI-Pruefung
-- "Verify migrations are append-only" blockieren. Deshalb dieser spaetere
-- Ersatz, nicht ein Edit der bereits gemergten Migration.
--
-- Befund (CI-Lauf 44674479414, Job Migration validation):
--   Der Fehler `column webhook_deliveries.webhook_id does not exist` kommt
--   aus dem Test-Setup, nicht aus dem Anwenden von 20261120160200.
--   ap2_replace_policy legt eine Policy nur an, wenn sie schon existiert.
--   "webhook_deliveries tenant_member_read" ist seit
--   20260705200000 (Tabelle neu, ohne webhook_id) weg.
--   Der Vorwaertslauf ueberspringt sie und geht durch.
--   notify_quota_alert aus 20261120160200 schreibt trotzdem in webhook_id.
--   Der Aufruf bricht ab, bevor die Admin-Mail entsteht.
--
-- Diese Migration:
--   1. ersetzt "webhook_deliveries tenant_member_read" nur, wenn die Policy
--      existiert UND webhook_deliveries.webhook_id sowie die uebrigen
--      genannten Spalten existieren. Auf dem aktuellen Schema ist das ein
--      No-Op. Eine fehlende Policy wird nicht wieder angelegt.
--   2. stellt notify_quota_alert so, dass die Webhook-Zeile nur bei
--      vorhandenem webhook_id geschrieben wird. Empfaenger bleiben
--      memberships.role = 'admin'.
--   3. bildet warning_80 und limit_exceeded auf die vom Check
--      email_notifications (20260705140000) erlaubten event_type-Werte ab.
--      Ohne Abbildung scheitert derselbe Aufruf an der Check-Bedingung.

DO $ap2_webhook_policy$
BEGIN
  IF to_regclass('public.webhook_deliveries') IS NULL
     OR to_regclass('public.webhook_endpoints') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_policy
     WHERE polrelid = 'public.webhook_deliveries'::regclass
       AND polname = 'webhook_deliveries tenant_member_read'
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'webhook_deliveries' AND column_name = 'webhook_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'webhook_endpoints' AND column_name = 'id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'webhook_endpoints' AND column_name = 'tenant_id'
  ) THEN
    RETURN;
  END IF;

  DROP POLICY "webhook_deliveries tenant_member_read" ON public.webhook_deliveries;
  CREATE POLICY "webhook_deliveries tenant_member_read"
    ON public.webhook_deliveries FOR SELECT
    USING (EXISTS (
      SELECT 1
        FROM public.webhook_endpoints we
       WHERE we.id = webhook_deliveries.webhook_id
         AND public.is_tenant_member(we.tenant_id)
    ));
END
$ap2_webhook_policy$;

CREATE OR REPLACE FUNCTION public.notify_quota_alert(
  p_tenant_id UUID,
  p_alert_type TEXT,
  p_api_calls_count INTEGER,
  p_quota_limit INTEGER
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
  v_alert_id UUID;
  v_member_email TEXT;
  v_subject TEXT;
  v_body TEXT;
  v_email_event TEXT;
BEGIN
  INSERT INTO public.quota_alerts (tenant_id, alert_type, api_calls_count, quota_limit, message)
  VALUES (
    p_tenant_id,
    p_alert_type,
    p_api_calls_count,
    p_quota_limit,
    CASE
      WHEN p_alert_type = 'warning_80' THEN 'API quota usage at 80% (' || p_api_calls_count || '/' || p_quota_limit || ')'
      WHEN p_alert_type = 'limit_exceeded' THEN 'API quota limit exceeded (' || p_api_calls_count || '/' || p_quota_limit || ')'
      ELSE 'API quota alert'
    END
  ) RETURNING id INTO v_alert_id;

  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'webhook_deliveries'
       AND column_name = 'webhook_id'
  ) THEN
    EXECUTE $ins$
      INSERT INTO public.webhook_deliveries (webhook_id, event_type, event_data, created_at)
      SELECT
        we.id,
        $1,
        jsonb_build_object(
          'event_type', $1,
          'tenant_id', $2,
          'timestamp', now()::text,
          'api_calls', $3,
          'quota_limit', $4,
          'message', CASE
            WHEN $1 = 'warning_80' THEN 'Your API quota usage is at 80%'
            WHEN $1 = 'limit_exceeded' THEN 'Your API quota limit has been exceeded'
            ELSE 'API quota alert'
          END
        ),
        now()
      FROM public.webhook_endpoints we
      WHERE we.tenant_id = $2
        AND we.is_active = true
        AND $1 = ANY(we.events)
    $ins$
    USING p_alert_type, p_tenant_id, p_api_calls_count, p_quota_limit;
  END IF;

  v_email_event := CASE p_alert_type
    WHEN 'warning_80' THEN 'quota_warning'
    WHEN 'limit_exceeded' THEN 'quota_exceeded'
    ELSE p_alert_type
  END;

  FOR v_member_email IN
    SELECT u.email
    FROM public.memberships m
    JOIN auth.users u ON m.user_id = u.id
    WHERE m.tenant_id = p_tenant_id AND m.role = 'admin'
  LOOP
    v_subject := CASE
      WHEN p_alert_type = 'warning_80' THEN 'Alert: API Quota at 80%'
      WHEN p_alert_type = 'limit_exceeded' THEN 'Alert: API Quota Exceeded'
      ELSE 'API Quota Alert'
    END;

    v_body := CASE
      WHEN p_alert_type = 'warning_80' THEN 'Your API quota usage has reached 80% (' || p_api_calls_count || ' of ' || p_quota_limit || ' calls). Please review your usage or upgrade your plan.'
      WHEN p_alert_type = 'limit_exceeded' THEN 'Your API quota limit has been exceeded (' || p_api_calls_count || ' of ' || p_quota_limit || ' calls). Further API requests will be blocked. Please upgrade your plan or contact support.'
      ELSE 'An API quota event has occurred.'
    END;

    INSERT INTO public.email_notifications (tenant_id, recipient_email, event_type, subject, body, created_at)
    VALUES (p_tenant_id, v_member_email, v_email_event, v_subject, v_body, now());
  END LOOP;
END;
$fn$;
