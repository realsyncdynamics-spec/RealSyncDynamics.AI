-- ============================================================
-- Cron-Dispatch: Request-IDs protokollieren
-- ============================================================
--
-- Anlass: Der Cron-Health-Guard (scripts/check-cron-health.mjs, Klasse C)
-- ordnete Antworten aus `net._http_response` den Dispatch-Laeufen bisher
-- ueber ein Zeitfenster zu. Das trennt nicht sauber: `business-metrics-
-- cron-15min` ruft `net.http_post` direkt im selben */15-Takt auf wie
-- `scan-scheduler-dispatch`, dazu kommen Trigger-Aufrufe (Stripe-Webhook,
-- Welcome-Mail). Deren Antworten erzeugten falsche Befunde oder verdeckten
-- einen Dispatch ohne Antwort.
--
-- `net.http_post` liefert die Request-ID, und `net._http_response.id` ist
-- genau diese ID. `dispatch_cron_function` gab sie bisher zurueck, aber
-- pg_cron verwirft den Rueckgabewert. Ab jetzt schreibt die Funktion sie in
-- `cron_dispatch_requests`; der Guard joint darueber exakt.
--
-- Additiv: neue Tabelle, Funktion mit unveraenderter Signatur und
-- unveraendertem Verhalten gegenueber den Aufrufern.

CREATE TABLE IF NOT EXISTS public.cron_dispatch_requests (
  request_id    bigint      PRIMARY KEY,
  function_name text        NOT NULL,
  dispatched_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cron_dispatch_requests_dispatched_at_idx
  ON public.cron_dispatch_requests (dispatched_at);

-- Nur service_role (Guard ueber die Management API, Funktion als DEFINER).
ALTER TABLE public.cron_dispatch_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cron_dispatch_requests FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.cron_dispatch_requests IS
  'Request-IDs der von dispatch_cron_function abgesetzten net.http_post-Aufrufe. Join-Schluessel zu net._http_response.id fuer den Cron-Health-Guard. Haelt zwei Tage vor.';

CREATE OR REPLACE FUNCTION public.dispatch_cron_function(
  p_function    text,
  p_secret_name text,
  p_body        jsonb DEFAULT '{}'::jsonb
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token      text;
  v_request_id bigint;
BEGIN
  v_token := public.get_app_secret(p_secret_name);

  IF v_token IS NULL OR v_token = '' THEN
    RAISE EXCEPTION
      'Cron-Dispatch "%" abgebrochen: Vault-Secret "%" fehlt. Anlegen mit: SELECT vault.create_secret(''<wert>'', ''%'');',
      p_function, p_secret_name, p_secret_name;
  END IF;

  v_request_id := net.http_post(
    url     := public.app_functions_base_url() || p_function,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_token
    ),
    body    := p_body,
    timeout_milliseconds := 60000
  );

  INSERT INTO public.cron_dispatch_requests (request_id, function_name)
  VALUES (v_request_id, p_function)
  ON CONFLICT (request_id) DO NOTHING;

  -- net._http_response haelt rund sechs Stunden vor; zwei Tage reichen fuer
  -- den Guard und halten die Tabelle klein.
  DELETE FROM public.cron_dispatch_requests
  WHERE dispatched_at < now() - interval '2 days';

  RETURN v_request_id;
END;
$$;

REVOKE ALL    ON FUNCTION public.dispatch_cron_function(text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.dispatch_cron_function(text, text, jsonb) TO service_role;

COMMENT ON FUNCTION public.dispatch_cron_function(text, text, jsonb) IS
  'Ruft eine Edge Function aus pg_cron auf. Token aus dem Vault; fehlendes Secret bricht mit klarer Meldung ab. Protokolliert die Request-ID in cron_dispatch_requests.';
