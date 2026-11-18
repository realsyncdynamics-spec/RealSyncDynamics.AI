-- ═══════════════════════════════════════════════════════════════════════════
--  Google-Workspace-Ereignisse (RSD-01 … RSD-06) und gebundene Freigaben
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Eingang für Workspace-Studio-Flows über die Edge Function `workspace-events`.
-- Grundsätze (Masterplan „Google Workflow Automation“, 16.11.2026):
--   * Mandant nur aus dem Ingest-Schlüssel (governance_ingest_keys, Quelle
--     `google_workspace`) — nie aus dem Body.
--   * Idempotenz: event_id ist pro Mandant eindeutig.
--   * Externe Aktionen erzeugen nur eine Freigabeanfrage (PENDING). Eine
--     Freigabe ist an Aktion, Ressource und payload_hash gebunden, läuft ab
--     und ist einmalig einlösbar (consume_workspace_approval).
--   * Löschen, bezahlen, veröffentlichen, mergen, deployen werden bereits in
--     der Edge Function abgewiesen und kommen hier nie an.
--   * Clients lesen nur (RLS, Mandantenmitglieder). Schreiben ausschließlich
--     über SECURITY-DEFINER-Funktionen; Entscheidungen nur durch Admins.
-- Additiv, nicht destruktiv.

CREATE TABLE IF NOT EXISTS public.workspace_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ingest_key_id     uuid NOT NULL REFERENCES public.governance_ingest_keys(id) ON DELETE RESTRICT,
  event_id          text NOT NULL CHECK (event_id ~ '^[A-Za-z0-9._:-]{1,128}$'),
  agent_id          text NOT NULL CHECK (agent_id IN ('RSD-01','RSD-02','RSD-03','RSD-04','RSD-05','RSD-06')),
  event_type        text NOT NULL CHECK (event_type ~ '^[a-z][a-z0-9_.]{2,63}$'),
  resource_id       text NOT NULL CHECK (char_length(resource_id) BETWEEN 1 AND 256),
  requested_action  text NOT NULL CHECK (requested_action ~ '^[a-z][a-z0-9_]{2,47}$'),
  decision          text NOT NULL CHECK (decision IN ('allow','require_approval')),
  payload_hash      text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object' AND pg_column_size(metadata) <= 8192),
  received_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, event_id)
);

CREATE INDEX IF NOT EXISTS workspace_events_tenant_received_idx
  ON public.workspace_events (tenant_id, received_at DESC);
CREATE INDEX IF NOT EXISTS workspace_events_key_received_idx
  ON public.workspace_events (ingest_key_id, received_at DESC);

CREATE TABLE IF NOT EXISTS public.workspace_approvals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_row_id     uuid NOT NULL UNIQUE REFERENCES public.workspace_events(id) ON DELETE CASCADE,
  agent_id         text NOT NULL,
  action_type      text NOT NULL,
  target_resource  text NOT NULL,
  payload_hash     text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  status           text NOT NULL DEFAULT 'PENDING'
                   CHECK (status IN ('PENDING','APPROVED','EXECUTED','REJECTED','EXPIRED','CANCELLED','FAILED')),
  requested_at     timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL,
  decided_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at       timestamptz,
  execution_id     text,
  executed_at      timestamptz,
  CHECK (expires_at > requested_at),
  CHECK ((status = 'EXECUTED') = (executed_at IS NOT NULL AND execution_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS workspace_approvals_tenant_status_idx
  ON public.workspace_approvals (tenant_id, status, requested_at DESC);

ALTER TABLE public.workspace_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_approvals FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.workspace_events FROM anon, authenticated;
REVOKE ALL ON public.workspace_approvals FROM anon, authenticated;
GRANT SELECT ON public.workspace_events TO authenticated;
GRANT SELECT ON public.workspace_approvals TO authenticated;

DROP POLICY IF EXISTS workspace_events_select_member ON public.workspace_events;
CREATE POLICY workspace_events_select_member ON public.workspace_events
  FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS workspace_approvals_select_member ON public.workspace_approvals;
CREATE POLICY workspace_approvals_select_member ON public.workspace_approvals
  FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));

-- ─── Eingang (nur service_role, aus der Edge Function) ────────────────────
CREATE OR REPLACE FUNCTION public.ingest_workspace_event(
  p_tenant_id        uuid,
  p_ingest_key_id    uuid,
  p_event_id         text,
  p_agent_id         text,
  p_event_type       text,
  p_resource_id      text,
  p_requested_action text,
  p_decision         text,
  p_payload_hash     text,
  p_metadata         jsonb,
  p_approval_ttl     interval DEFAULT interval '24 hours',
  p_hourly_limit     integer  DEFAULT 600
) RETURNS TABLE (event_row_id uuid, duplicate boolean, approval_id uuid, approval_status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_key   public.governance_ingest_keys%ROWTYPE;
  v_row   uuid;
  v_appr  uuid;
  v_count integer;
BEGIN
  -- Schlüssel erneut prüfen: Mandantenbindung und Widerruf (fail closed).
  SELECT * INTO v_key FROM public.governance_ingest_keys WHERE id = p_ingest_key_id;
  IF NOT FOUND OR v_key.revoked_at IS NOT NULL OR v_key.tenant_id IS DISTINCT FROM p_tenant_id
     OR NOT ('google_workspace' = ANY (v_key.allowed_sources)) THEN
    RAISE EXCEPTION 'workspace_key_invalid' USING ERRCODE = 'P0001';
  END IF;
  IF p_approval_ttl <= interval '0' OR p_approval_ttl > interval '7 days' THEN
    RAISE EXCEPTION 'workspace_ttl_invalid' USING ERRCODE = 'P0001';
  END IF;

  -- Wiederholung desselben Ereignisses: bestehende Zeile zurückgeben, nichts doppelt anlegen.
  SELECT e.id INTO v_row FROM public.workspace_events e
   WHERE e.tenant_id = p_tenant_id AND e.event_id = p_event_id;
  IF FOUND THEN
    RETURN QUERY SELECT v_row, true, a.id, a.status
      FROM (SELECT 1) one LEFT JOIN public.workspace_approvals a ON a.event_row_id = v_row;
    RETURN;
  END IF;

  SELECT count(*) INTO v_count FROM public.workspace_events
   WHERE ingest_key_id = p_ingest_key_id AND received_at > now() - interval '1 hour';
  IF v_count >= p_hourly_limit THEN
    RAISE EXCEPTION 'workspace_rate_limited' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.workspace_events
    (tenant_id, ingest_key_id, event_id, agent_id, event_type, resource_id, requested_action, decision, payload_hash, metadata)
  VALUES
    (p_tenant_id, p_ingest_key_id, p_event_id, p_agent_id, p_event_type, p_resource_id, p_requested_action, p_decision, p_payload_hash, COALESCE(p_metadata, '{}'::jsonb))
  ON CONFLICT (tenant_id, event_id) DO NOTHING
  RETURNING id INTO v_row;

  IF v_row IS NULL THEN  -- gleichzeitiger Doppelversand
    SELECT e.id INTO v_row FROM public.workspace_events e
     WHERE e.tenant_id = p_tenant_id AND e.event_id = p_event_id;
    RETURN QUERY SELECT v_row, true, a.id, a.status
      FROM (SELECT 1) one LEFT JOIN public.workspace_approvals a ON a.event_row_id = v_row;
    RETURN;
  END IF;

  IF p_decision = 'require_approval' THEN
    INSERT INTO public.workspace_approvals
      (tenant_id, event_row_id, agent_id, action_type, target_resource, payload_hash, expires_at)
    VALUES
      (p_tenant_id, v_row, p_agent_id, p_requested_action, p_resource_id, p_payload_hash, now() + p_approval_ttl)
    RETURNING id INTO v_appr;
    RETURN QUERY SELECT v_row, false, v_appr, 'PENDING'::text;
  ELSE
    RETURN QUERY SELECT v_row, false, NULL::uuid, NULL::text;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.ingest_workspace_event(uuid, uuid, text, text, text, text, text, text, text, jsonb, interval, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_workspace_event(uuid, uuid, text, text, text, text, text, text, text, jsonb, interval, integer) TO service_role;

-- ─── Entscheidung (nur Mandanten-Admins, angemeldet) ──────────────────────
CREATE OR REPLACE FUNCTION public.decide_workspace_approval(p_approval_id uuid, p_approve boolean)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_appr public.workspace_approvals%ROWTYPE;
  v_new  text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'workspace_unauthenticated' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_appr FROM public.workspace_approvals WHERE id = p_approval_id FOR UPDATE;
  -- Unbekannt und fremd sind bewusst nicht unterscheidbar.
  IF NOT FOUND OR NOT public.is_tenant_admin(v_appr.tenant_id) THEN
    RAISE EXCEPTION 'workspace_approval_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_appr.status <> 'PENDING' THEN
    RAISE EXCEPTION 'workspace_approval_not_pending' USING ERRCODE = 'P0001';
  END IF;
  IF v_appr.expires_at <= now() THEN
    UPDATE public.workspace_approvals SET status = 'EXPIRED' WHERE id = p_approval_id;
    RETURN 'EXPIRED';
  END IF;
  v_new := CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END;
  UPDATE public.workspace_approvals
     SET status = v_new, decided_by = auth.uid(), decided_at = now()
   WHERE id = p_approval_id;
  RETURN v_new;
END $$;

REVOKE ALL ON FUNCTION public.decide_workspace_approval(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_workspace_approval(uuid, boolean) TO authenticated;

-- ─── Einlösung (nur service_role, für einen künftigen Ausführer) ──────────
-- Atomar: genau einmal, nur APPROVED, nicht abgelaufen, gleicher Mandant und
-- exakt derselbe payload_hash. Jede Änderung der Nutzdaten macht die Freigabe
-- damit unbrauchbar.
CREATE OR REPLACE FUNCTION public.consume_workspace_approval(
  p_tenant_id uuid, p_approval_id uuid, p_payload_hash text, p_execution_id text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF p_execution_id IS NULL OR char_length(p_execution_id) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'workspace_execution_id_invalid' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.workspace_approvals
     SET status = 'EXECUTED', execution_id = p_execution_id, executed_at = now()
   WHERE id = p_approval_id
     AND tenant_id = p_tenant_id
     AND status = 'APPROVED'
     AND expires_at > now()
     AND payload_hash = p_payload_hash
  RETURNING id INTO v_id;
  RETURN v_id IS NOT NULL;
END $$;

REVOKE ALL ON FUNCTION public.consume_workspace_approval(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_workspace_approval(uuid, uuid, text, text) TO service_role;

COMMENT ON TABLE public.workspace_events IS
  'Ereignisse aus Google-Workspace-Studio-Flows (RSD-01…06). Mandant aus dem Ingest-Schlüssel, idempotent pro (tenant_id, event_id). Schreiben nur über ingest_workspace_event.';
COMMENT ON TABLE public.workspace_approvals IS
  'Freigabeanfragen für externe Workspace-Aktionen. An payload_hash gebunden, ablaufend, einmalig einlösbar (consume_workspace_approval).';
