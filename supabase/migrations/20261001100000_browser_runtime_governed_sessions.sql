-- Browser-Runtime · serverseitige Sessions, Freigabe-Entscheidung atomar, Action-Log
--
-- Baut auf 20260930190000_browser_execution_reservations.sql (#1728) auf:
-- Der Einmal-Verbrauch einer Freigabe bleibt dort (browser_executions,
-- reserve_browser_execution / finish_browser_execution). Diese Migration
-- führt KEINEN zweiten Verbrauchsmechanismus ein.
--
-- Befund (Audit 2026-09-29, Feature-Matrix in der PR-Beschreibung):
--   - Die Browser-Session-ID entstand im Browser (localStorage); es gab keine
--     serverseitige Session, auf die sich UI und Executor beziehen konnten.
--   - Freigeben/Ablehnen schrieb den Status und danach getrennt die Evidence.
--     Dazwischen war eine Freigabe schon 'approved' und damit reservierbar,
--     ohne dass ihre Entscheidung nachgewiesen war.
--   - Die Zahl offener Sessions je Mandant war nur gezählt, nicht gesperrt:
--     parallele Anfragen kamen am Limit vorbei.
--   - browser_actions erlaubte nur Vorschau-Ereignisse.
--
-- Diese Migration ist ADDITIV:
--   1. public.browser_sessions          — eine Zeile = genau eine Executor-Session
--   2. Trigger browser_sessions_enforce_open_limit — höchstens 3 offene Sessions
--      je Mandant, Advisory-Lock je Mandant (Muster: bots_enforce_quota)
--   3. governance_approvals             — requested_by, browser_session_id,
--      Status zusätzlich 'cancelled' (vom Anfragenden zurückgezogen)
--   4. public.decide_governance_approval — Entscheidung + gekettete Evidence in
--      EINER Transaktion (fail closed: ohne Evidence keine Entscheidung)
--   5. browser_actions                  — Aktionstypen/Status erweitert, Governance-Spalten
--   6. public.browser_executor_status   — letzter Health-Befund je Executor
--
-- Der Fingerprint in governance_approvals.requested_action (von
-- reserve_browser_execution verglichen) ist ab browser-execute v2 ein
-- HMAC-SHA-256 mit serverseitigem Schlüssel ('browser:v2:<hex>'). Mitglieder
-- lesen die Spalte per RLS; ohne Schlüssel lässt sich eine kurze Eingabe
-- (z. B. eine PIN) daraus nicht per Wörterbuch zurückrechnen.
--
-- Autorität bleibt serverseitig: Schreiben ausschließlich über service_role
-- (Edge Functions browser-execute / governance-approvals nach JWT →
-- memberships). Mitglieder lesen Sessions ihres Mandanten per RLS.

-- ─── 1. browser_sessions ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.browser_sessions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id              uuid NOT NULL,
  executor_session_id  text NOT NULL UNIQUE CHECK (char_length(executor_session_id) BETWEEN 16 AND 200),
  mode                 text NOT NULL DEFAULT 'assist'
                         CHECK (mode IN ('assist', 'copilot', 'autonomous')),
  status               text NOT NULL DEFAULT 'creating'
                         CHECK (status IN ('creating', 'ready', 'executing', 'awaiting_approval',
                                           'paused', 'failed', 'closed')),
  current_url          text CHECK (current_url IS NULL OR char_length(current_url) <= 2048),
  page_title           text CHECK (page_title IS NULL OR char_length(page_title) <= 500),
  last_action          jsonb,
  next_action          jsonb,
  last_error_code      text CHECK (last_error_code IS NULL OR last_error_code ~ '^[A-Z0-9_]{1,64}$'),
  last_frame_sha256    text CHECK (last_frame_sha256 IS NULL OR last_frame_sha256 ~ '^[0-9a-f]{64}$'),
  last_frame_at        timestamptz,
  action_count         integer NOT NULL DEFAULT 0 CHECK (action_count >= 0),
  executor_version     text CHECK (executor_version IS NULL OR char_length(executor_version) <= 100),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  expires_at           timestamptz NOT NULL,
  closed_at            timestamptz,
  CHECK (closed_at IS NULL OR status IN ('closed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_browser_sessions_tenant_created
  ON public.browser_sessions (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_browser_sessions_tenant_open
  ON public.browser_sessions (tenant_id, status)
  WHERE status NOT IN ('closed', 'failed');

ALTER TABLE public.browser_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "browser_sessions member read" ON public.browser_sessions;
CREATE POLICY "browser_sessions member read"
  ON public.browser_sessions FOR SELECT
  TO authenticated
  USING (public.is_tenant_member(tenant_id));

-- Keine Schreib-Policy: Anlage und Statuswechsel nur über service_role.
REVOKE INSERT, UPDATE, DELETE ON public.browser_sessions FROM anon, authenticated;
REVOKE ALL ON public.browser_sessions FROM anon;

COMMENT ON TABLE public.browser_sessions IS
  'Governed Browser Runtime: eine Zeile = genau eine Executor-Session (executor_session_id). '
  'Status nur serverseitig (browser-execute). Mitglieder lesen per RLS.';

-- ─── 2. Offene Sessions je Mandant: atomar begrenzt ──────────────────────────
--
-- 3 = EXECUTION_LIMITS.maxOpenSessionsPerTenant in
-- supabase/functions/_shared/browser-runtime/policy.ts (ein Test hält beide
-- Werte gleich). Offen heisst: nicht closed/failed und noch nicht abgelaufen
-- — dieselbe Definition wie die Vorabprüfung in browser-execute.

CREATE OR REPLACE FUNCTION public.browser_sessions_enforce_open_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_open integer;
BEGIN
  -- Erst der Lock, dann das Zählen: ein paralleler Insert desselben Mandanten
  -- wartet hier und zählt danach die inzwischen festgeschriebene Zeile mit.
  PERFORM pg_advisory_xact_lock(hashtext('public.browser_sessions.open'), hashtext(NEW.tenant_id::text));

  SELECT count(*) INTO v_open
    FROM public.browser_sessions s
   WHERE s.tenant_id = NEW.tenant_id
     AND s.status NOT IN ('closed', 'failed')
     AND s.expires_at > now();

  IF v_open >= 3 THEN
    RAISE EXCEPTION 'browser session limit reached: % open sessions', v_open
      USING ERRCODE = 'P0001',
            DETAIL  = 'BROWSER_SESSION_LIMIT_REACHED';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.browser_sessions_enforce_open_limit() IS
  'BEFORE-INSERT-Trigger auf public.browser_sessions: höchstens 3 offene, nicht abgelaufene '
  'Sessions je Mandant. Advisory-Lock je Mandant macht die Prüfung gegen parallele Anlagen dicht. '
  'DETAIL = BROWSER_SESSION_LIMIT_REACHED.';

REVOKE ALL ON FUNCTION public.browser_sessions_enforce_open_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS browser_sessions_enforce_open_limit ON public.browser_sessions;
CREATE TRIGGER browser_sessions_enforce_open_limit
  BEFORE INSERT ON public.browser_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.browser_sessions_enforce_open_limit();

-- ─── 3. governance_approvals: Anfragender, Session, Zurückziehen ─────────────

ALTER TABLE public.governance_approvals
  ADD COLUMN IF NOT EXISTS requested_by        uuid,
  ADD COLUMN IF NOT EXISTS browser_session_id  uuid REFERENCES public.browser_sessions(id) ON DELETE SET NULL;

-- Erweitert, nicht verengt: bestehende Werte bleiben gültig.
--   rejected  = abgelehnt (denied)
--   cancelled = vom Anfragenden zurückgezogen
-- Ausgeführt / fehlgeschlagen steht NICHT hier, sondern in
-- public.browser_executions (#1728) — eine Quelle für den Verbrauch.
ALTER TABLE public.governance_approvals
  DROP CONSTRAINT IF EXISTS governance_approvals_status_check;
ALTER TABLE public.governance_approvals
  ADD CONSTRAINT governance_approvals_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_governance_approvals_browser_session
  ON public.governance_approvals (browser_session_id)
  WHERE browser_session_id IS NOT NULL;

-- ─── 4. Entscheidung + Evidence in einer Transaktion ─────────────────────────
--
-- Vorher: Status-Update, danach getrennt die Evidence, bei Fehler Rücknahme.
-- Dazwischen konnte reserve_browser_execution die Freigabe schon verbrauchen.
-- Jetzt: Zeilensperre auf der Freigabe, Prüfung von Mandant, Status und
-- Ablauf (Datenbankuhr), Statuswechsel und append_governance_evidence in
-- derselben Transaktion. Bewegt sich der Kettenkopf, wird ALLES
-- zurückgerollt (SQLSTATE 40001); der Aufrufer liest den Kopf neu und
-- versucht es erneut. Ohne geschriebene Evidence gibt es keine Entscheidung.
--
-- outcome:
--   decided           Entscheidung + Evidence geschrieben
--   not_found         Freigabe fehlt oder gehört zu einem anderen Mandanten
--   already_resolved  nicht mehr entscheidbar (approval_status sagt welcher);
--                     'cancelled' geht auch aus 'approved', solange es keine
--                     Ausführung in browser_executions gibt
--   expired           expires_at <= now(); Status wird auf 'expired' gesetzt

CREATE OR REPLACE FUNCTION public.decide_governance_approval(
  p_approval_id            uuid,
  p_tenant_id              uuid,
  p_decided_by             uuid,
  p_target                 text,
  p_reason                 text,
  p_decided_at             timestamptz,
  p_evidence               jsonb,
  p_expected_previous_hash text
)
RETURNS TABLE (
  outcome          text,
  evidence_id      uuid,
  approval_status  text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_approval public.governance_approvals%ROWTYPE;
  v_evidence uuid;
BEGIN
  IF p_approval_id IS NULL OR p_tenant_id IS NULL OR p_decided_by IS NULL THEN
    RAISE EXCEPTION 'approval_id, tenant_id and decided_by required' USING ERRCODE = '22023';
  END IF;
  IF p_target NOT IN ('approved', 'rejected', 'cancelled') THEN
    RAISE EXCEPTION 'invalid target status: %', p_target USING ERRCODE = '22023';
  END IF;
  IF p_evidence IS NULL OR (p_evidence ->> 'tenant_id')::uuid IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'evidence row must belong to the approval tenant' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_approval
    FROM public.governance_approvals a
   WHERE a.id = p_approval_id
   FOR UPDATE;

  IF NOT FOUND OR v_approval.tenant_id IS DISTINCT FROM p_tenant_id THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  -- Entscheiden nur aus 'pending'. Ausnahme: Zurückziehen ('cancelled') einer
  -- freigegebenen, aber noch nicht eingelösten Freigabe — reserve_browser_execution
  -- sperrt dieselbe Zeile, daher ist „nicht eingelöst" hier verlässlich.
  IF v_approval.status <> 'pending'
     AND NOT (p_target = 'cancelled'
              AND v_approval.status = 'approved'
              AND NOT EXISTS (SELECT 1 FROM public.browser_executions e WHERE e.approval_id = p_approval_id)) THEN
    RETURN QUERY SELECT 'already_resolved'::text, NULL::uuid, v_approval.status;
    RETURN;
  END IF;

  IF v_approval.expires_at <= now() THEN
    UPDATE public.governance_approvals SET status = 'expired' WHERE id = p_approval_id;
    RETURN QUERY SELECT 'expired'::text, NULL::uuid, 'expired'::text;
    RETURN;
  END IF;

  UPDATE public.governance_approvals
     SET status            = p_target,
         resolved_by       = p_decided_by,
         resolved_at       = coalesce(p_decided_at, clock_timestamp()),
         resolution_reason = left(p_reason, 2000)
   WHERE id = p_approval_id;

  v_evidence := public.append_governance_evidence(p_evidence, p_expected_previous_hash);
  IF v_evidence IS NULL THEN
    RAISE EXCEPTION 'governance evidence chain head moved' USING ERRCODE = '40001';
  END IF;

  RETURN QUERY SELECT 'decided'::text, v_evidence, p_target;
END;
$$;

COMMENT ON FUNCTION public.decide_governance_approval(uuid, uuid, uuid, text, text, timestamptz, jsonb, text) IS
  'Entscheidet eine offene Freigabe (approved/rejected/cancelled) und schreibt die gekettete '
  'Evidence in derselben Transaktion. Ablauf nach Datenbankuhr. Nur service_role.';

REVOKE ALL     ON FUNCTION public.decide_governance_approval(uuid, uuid, uuid, text, text, timestamptz, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.decide_governance_approval(uuid, uuid, uuid, text, text, timestamptz, jsonb, text) TO service_role;

-- ─── 5. browser_actions: Governed Actions ────────────────────────────────────

ALTER TABLE public.browser_actions
  DROP CONSTRAINT IF EXISTS browser_actions_browser_action_check;
ALTER TABLE public.browser_actions
  ADD CONSTRAINT browser_actions_browser_action_check
  CHECK (browser_action IN (
    -- Vorschau-Ereignisse (EmbeddedBrowserCanvas, unverändert)
    'preview_load', 'preview_error', 'reload', 'scan_start', 'scan_complete',
    'evidence_generate', 'open_external',
    -- Governed Browser Runtime
    'session_open', 'session_close',
    'navigate', 'scroll', 'click', 'type', 'select', 'submit', 'wait',
    'extract', 'read_text', 'read_dom', 'screenshot', 'back', 'forward',
    'download', 'upload'
  ));

ALTER TABLE public.browser_actions
  DROP CONSTRAINT IF EXISTS browser_actions_status_check;
ALTER TABLE public.browser_actions
  ADD CONSTRAINT browser_actions_status_check
  CHECK (status IN ('started', 'completed', 'failed', 'blocked', 'awaiting_approval', 'denied'));

ALTER TABLE public.browser_actions
  ADD COLUMN IF NOT EXISTS browser_session_id    uuid REFERENCES public.browser_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_id           uuid REFERENCES public.governance_approvals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS browser_execution_id  uuid REFERENCES public.browser_executions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS governance_event_id   uuid REFERENCES public.governance_events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS evidence_id           uuid,
  ADD COLUMN IF NOT EXISTS policy_decision       text CHECK (policy_decision IS NULL OR policy_decision IN ('allow', 'deny', 'require_approval')),
  ADD COLUMN IF NOT EXISTS policy_id             text,
  ADD COLUMN IF NOT EXISTS policy_version        text,
  ADD COLUMN IF NOT EXISTS risk_level            text CHECK (risk_level IS NULL OR risk_level IN ('info', 'low', 'medium', 'high', 'critical')),
  ADD COLUMN IF NOT EXISTS verification          text CHECK (verification IS NULL OR verification IN ('passed', 'failed', 'not_applicable')),
  ADD COLUMN IF NOT EXISTS correlation_id        uuid;

CREATE INDEX IF NOT EXISTS idx_browser_actions_browser_session
  ON public.browser_actions (browser_session_id, started_at DESC)
  WHERE browser_session_id IS NOT NULL;

-- ─── 6. browser_executor_status (nur service_role) ───────────────────────────

CREATE TABLE IF NOT EXISTS public.browser_executor_status (
  executor_id      text PRIMARY KEY CHECK (char_length(executor_id) BETWEEN 1 AND 100),
  status           text NOT NULL CHECK (status IN ('offline', 'connecting', 'ready', 'busy', 'degraded', 'error')),
  reason_code      text,
  last_checked_at  timestamptz NOT NULL,
  last_seen_at     timestamptz,
  runtime          text,
  version          text,
  active_sessions  integer CHECK (active_sessions IS NULL OR active_sessions >= 0),
  max_sessions     integer CHECK (max_sessions IS NULL OR max_sessions >= 0),
  capabilities     text[] NOT NULL DEFAULT '{}'
);

ALTER TABLE public.browser_executor_status ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.browser_executor_status FROM anon, authenticated;

COMMENT ON TABLE public.browser_executor_status IS
  'Letzter Health-Befund je Browser-Executor (last_seen_at = letzte erfolgreiche Probe). '
  'Nur service_role; das Dashboard liest über browser-execute op=health.';
