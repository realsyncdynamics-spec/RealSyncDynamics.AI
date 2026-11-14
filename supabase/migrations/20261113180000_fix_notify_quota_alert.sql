-- Fix public.notify_quota_alert (T-001).
--
-- NICHT anwenden, bevor Dominik die Migration ausdrücklich freigibt.
-- Live-Projekt ebljyceifhnlzhjfyxup bleibt unberührt.
--
-- Live-Belege (13.11.2026, nur pg_catalog / information_schema, keine Kundendaten):
-- 1. Die Funktion insertiert in webhook_deliveries die Spalten webhook_id,
--    event_type, event_data. Die Live-Tabelle hat stattdessen subscription_id,
--    tenant_id, event_key, event_id, url, request_body, request_headers, status, …
--    (Neuaufbau in 20260705200000_webhook_delivery_system.sql, Funktion nicht nachgezogen).
-- 2. email_notifications.event_type bekommt p_alert_type (warning_80 / limit_exceeded).
--    Der Live-Check erlaubt nur quota_warning / quota_exceeded / rate_limit_warning /
--    suspicious_activity.
-- 3. Empfänger kommen aus tenant_memberships WHERE role = 'admin'. Kanonisch ist
--    public.memberships; Owner (zulässige Rolle dort) wurden nicht angeschrieben.
--    Zusätzlich filtert der Altbestand webhook_endpoints.events typischerweise
--    quota_warning/quota_exceeded, die Funktion verglich aber warning_80/limit_exceeded.
--
-- Diese Datei ersetzt nur die Funktion, setzt Grants wie live (EXECUTE nur
-- service_role / nicht anon/authenticated) und ergänzt fehlende Event-Keys im
-- Katalog. Kein Drop, keine Datenänderung, keine Policy-Änderung.

BEGIN;

INSERT INTO public.webhook_event_types (event_key, display_name, description, payload_schema)
VALUES
  (
    'quota.warning',
    'Quota Warning',
    'Triggered when API quota usage reaches the warning threshold (80%)',
    '{"type":"object","properties":{"tenant_id":{"type":"string"},"alert_type":{"type":"string"},"api_calls":{"type":"integer"},"quota_limit":{"type":"integer"}}}'
  ),
  (
    'quota.exceeded',
    'Quota Exceeded',
    'Triggered when the API quota limit is exceeded',
    '{"type":"object","properties":{"tenant_id":{"type":"string"},"alert_type":{"type":"string"},"api_calls":{"type":"integer"},"quota_limit":{"type":"integer"}}}'
  )
ON CONFLICT (event_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.notify_quota_alert(
  p_tenant_id uuid,
  p_alert_type text,
  p_api_calls_count integer,
  p_quota_limit integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_alert_id uuid;
  v_member_email text;
  v_subject text;
  v_body text;
  v_quota_alert_type text;
  v_email_event_type text;
  v_event_key text;
BEGIN
  -- quota_alerts.alert_type erlaubt warning_80 / limit_exceeded / suspicious_activity.
  v_quota_alert_type := CASE p_alert_type
    WHEN 'quota_warning' THEN 'warning_80'
    WHEN 'quota_exceeded' THEN 'limit_exceeded'
    ELSE p_alert_type
  END;

  -- email_notifications.event_type erlaubt quota_warning / quota_exceeded /
  -- rate_limit_warning / suspicious_activity.
  v_email_event_type := CASE p_alert_type
    WHEN 'warning_80' THEN 'quota_warning'
    WHEN 'limit_exceeded' THEN 'quota_exceeded'
    WHEN 'quota_warning' THEN 'quota_warning'
    WHEN 'quota_exceeded' THEN 'quota_exceeded'
    WHEN 'suspicious_activity' THEN 'suspicious_activity'
    ELSE NULL
  END;

  v_event_key := CASE v_email_event_type
    WHEN 'quota_warning' THEN 'quota.warning'
    WHEN 'quota_exceeded' THEN 'quota.exceeded'
    ELSE NULL
  END;

  INSERT INTO public.quota_alerts (tenant_id, alert_type, api_calls_count, quota_limit, message)
  VALUES (
    p_tenant_id,
    v_quota_alert_type,
    p_api_calls_count,
    p_quota_limit,
    CASE
      WHEN v_quota_alert_type = 'warning_80' THEN
        'API quota usage at 80% (' || p_api_calls_count || '/' || p_quota_limit || ')'
      WHEN v_quota_alert_type = 'limit_exceeded' THEN
        'API quota limit exceeded (' || p_api_calls_count || '/' || p_quota_limit || ')'
      ELSE 'API quota alert'
    END
  )
  RETURNING id INTO v_alert_id;

  -- Nur der aktuelle Delivery-Pfad (webhook_subscriptions + Live-Spalten).
  -- Legacy-webhook_endpoints haben kein subscription_id und werden nicht
  -- stillschweigend umgeschrieben.
  IF v_event_key IS NOT NULL THEN
    INSERT INTO public.webhook_deliveries (
      subscription_id,
      tenant_id,
      event_key,
      event_id,
      url,
      request_body,
      request_headers,
      status,
      created_at
    )
    SELECT
      ws.id,
      p_tenant_id,
      v_event_key,
      v_alert_id::text,
      COALESCE(ws.url, ws.endpoint_url),
      jsonb_build_object(
        'event_key', v_event_key,
        'event_type', v_email_event_type,
        'alert_type', v_quota_alert_type,
        'tenant_id', p_tenant_id,
        'timestamp', now()::text,
        'api_calls', p_api_calls_count,
        'quota_limit', p_quota_limit,
        'message', CASE
          WHEN v_quota_alert_type = 'warning_80' THEN 'Your API quota usage is at 80%'
          WHEN v_quota_alert_type = 'limit_exceeded' THEN 'Your API quota limit has been exceeded'
          ELSE 'API quota alert'
        END
      ),
      COALESCE(ws.headers, '{}'::jsonb),
      'pending',
      now()
    FROM public.webhook_subscriptions ws
    WHERE ws.tenant_id = p_tenant_id
      AND COALESCE(ws.enabled, true)
      AND COALESCE(ws.active, true)
      AND ws.disabled_at IS NULL
      AND COALESCE(ws.url, ws.endpoint_url) IS NOT NULL
      AND (
        ws.event_key = v_event_key
        OR (
          ws.events IS NOT NULL
          AND (
            v_event_key = ANY (ws.events)
            OR v_email_event_type = ANY (ws.events)
            OR p_alert_type = ANY (ws.events)
            OR v_quota_alert_type = ANY (ws.events)
          )
        )
      );
  END IF;

  -- Kanonische Mitgliedschaft: public.memberships. Owner und Admin.
  IF v_email_event_type IS NOT NULL THEN
    v_subject := CASE v_quota_alert_type
      WHEN 'warning_80' THEN 'Alert: API Quota at 80%'
      WHEN 'limit_exceeded' THEN 'Alert: API Quota Exceeded'
      ELSE 'API Quota Alert'
    END;

    v_body := CASE v_quota_alert_type
      WHEN 'warning_80' THEN
        'Your API quota usage has reached 80% (' || p_api_calls_count || ' of ' || p_quota_limit || ' calls). Please review your usage or upgrade your plan.'
      WHEN 'limit_exceeded' THEN
        'Your API quota limit has been exceeded (' || p_api_calls_count || ' of ' || p_quota_limit || ' calls). Further API requests will be blocked. Please upgrade your plan or contact support.'
      ELSE 'An API quota event has occurred.'
    END;

    FOR v_member_email IN
      SELECT DISTINCT u.email
      FROM public.memberships m
      JOIN auth.users u ON u.id = m.user_id
      WHERE m.tenant_id = p_tenant_id
        AND m.role IN ('owner', 'admin')
        AND u.email IS NOT NULL
        AND btrim(u.email) <> ''
    LOOP
      INSERT INTO public.email_notifications (
        tenant_id, recipient_email, event_type, subject, body, created_at
      )
      VALUES (
        p_tenant_id, v_member_email, v_email_event_type, v_subject, v_body, now()
      );
    END LOOP;
  END IF;
END;
$function$;

COMMENT ON FUNCTION public.notify_quota_alert(uuid, text, integer, integer) IS
  'Queues quota alerts, webhook_deliveries (live schema via webhook_subscriptions) and email_notifications. Maps warning_80/limit_exceeded to quota_warning/quota_exceeded. Recipients: memberships.role IN (owner, admin).';

REVOKE ALL ON FUNCTION public.notify_quota_alert(uuid, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_quota_alert(uuid, text, integer, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_quota_alert(uuid, text, integer, integer) TO service_role;

COMMIT;
