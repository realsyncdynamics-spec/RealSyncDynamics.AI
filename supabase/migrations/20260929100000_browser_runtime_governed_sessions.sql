-- Browser-Runtime · serverseitige Sessions, Approval-Lebenszyklus, Action-Log
--
-- Befund (Audit 2026-09-29, Feature-Matrix in der PR-Beschreibung):
--   - Die Browser-Session-ID entstand im Browser (localStorage); es gab keine
--     serverseitige Session, auf die sich UI und Executor beziehen konnten.
--   - governance_approvals kannte weder Verbrauch noch Ausführung; der
--     Einmal-Verbrauch wurde über einen nachträglich geschriebenen Evidence-
--     Eintrag geprüft (nicht atomar), expires_at wurde nie ausgewertet.
--   - requested_action enthielt einen ungesalzenen SHA-256 über die
--     UNREDIGIERTE Aktion; Mitglieder lesen die Spalte per RLS — ein kurzer
--     eingegebener Text (z. B. eine PIN) wäre per Wörterbuch rückrechenbar.
--   - browser_actions erlaubte nur Vorschau-Ereignisse.
--
-- Diese Migration ist ADDITIV:
--   1. public.browser_sessions               — eine Zeile = genau eine Executor-Session
--   2. public.browser_approval_bindings      — Freigabe ↔ Session/Seite/Aktion (nur service_role)
--   3. governance_approvals                  — Status + Verbrauch/Ausführung (nur erweitert)
--   4. browser_actions                       — Aktionstypen/Status erweitert, Governance-Spalten
--   5. public.browser_executor_status        — letzter Health-Befund je Executor (nur service_role)
--   6. RPCs consume_browser_approval / finish_browser_approval (nur service_role)
--
-- Autorität bleibt serverseitig: Schreiben ausschließlich über service_role
-- (Edge Function browser-execute nach JWT → memberships). Mitglieder lesen
-- Sessions ihres Mandanten per RLS; Bindings und Executor-Status sind für
-- anon/authenticated unsichtbar.

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
  last_error_code      text CHECK (last_error_code IS NULL OR char_length(last_error_code) <= 100),
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

-- ─── 2. governance_approvals: Lebenszyklus ───────────────────────────────────

ALTER TABLE public.governance_approvals
  ADD COLUMN IF NOT EXISTS requested_by        uuid,
  ADD COLUMN IF NOT EXISTS browser_session_id  uuid REFERENCES public.browser_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS consumed_at         timestamptz,
  ADD COLUMN IF NOT EXISTS consumed_by         uuid,
  ADD COLUMN IF NOT EXISTS executed_at         timestamptz;

-- Erweitert, nicht verengt: bestehende Werte bleiben gültig.
--   rejected  = abgelehnt (denied)
--   cancelled = vom Anfragenden zurückgezogen
--   executed  = nach Freigabe genau einmal ausgeführt
--   failed    = nach Freigabe verbraucht, Ausführung fehlgeschlagen
ALTER TABLE public.governance_approvals
  DROP CONSTRAINT IF EXISTS governance_approvals_status_check;
ALTER TABLE public.governance_approvals
  ADD CONSTRAINT governance_approvals_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled', 'executed', 'failed'));

CREATE INDEX IF NOT EXISTS idx_governance_approvals_browser_session
  ON public.governance_approvals (browser_session_id)
  WHERE browser_session_id IS NOT NULL;

-- ─── 3. browser_approval_bindings (nur service_role) ─────────────────────────
--
-- Bindet eine Freigabe an genau eine Session, genau eine Seite und genau eine
-- Aktion. Der Fingerprint ist ein SHA-256 über die unredigierte Aktion — er
-- liegt deshalb NICHT in governance_approvals (per RLS für Mitglieder lesbar),
-- sondern hier ohne jede Policy für anon/authenticated.

CREATE TABLE IF NOT EXISTS public.browser_approval_bindings (
  approval_id         uuid PRIMARY KEY REFERENCES public.governance_approvals(id) ON DELETE CASCADE,
  tenant_id           uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  browser_session_id  uuid NOT NULL REFERENCES public.browser_sessions(id) ON DELETE CASCADE,
  fingerprint         text NOT NULL CHECK (fingerprint ~ '^browser:v2:[0-9a-f]{64}$'),
  action_type         text NOT NULL,
  page_url            text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.browser_approval_bindings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.browser_approval_bindings FROM anon, authenticated;

COMMENT ON TABLE public.browser_approval_bindings IS
  'Freigabe ↔ Session/Seite/Aktion. Fingerprint über die unredigierte Aktion — daher ohne '
  'Policy für anon/authenticated; nur service_role (browser-execute).';

-- ─── 4. browser_actions: Governed Actions ────────────────────────────────────

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
  ADD COLUMN IF NOT EXISTS browser_session_id   uuid REFERENCES public.browser_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_id          uuid REFERENCES public.governance_approvals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS governance_event_id  uuid REFERENCES public.governance_events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS evidence_id          uuid,
  ADD COLUMN IF NOT EXISTS policy_decision      text CHECK (policy_decision IS NULL OR policy_decision IN ('allow', 'deny', 'require_approval')),
  ADD COLUMN IF NOT EXISTS policy_id            text,
  ADD COLUMN IF NOT EXISTS policy_version       text,
  ADD COLUMN IF NOT EXISTS risk_level           text CHECK (risk_level IS NULL OR risk_level IN ('info', 'low', 'medium', 'high', 'critical')),
  ADD COLUMN IF NOT EXISTS verification         text CHECK (verification IS NULL OR verification IN ('passed', 'failed', 'not_applicable')),
  ADD COLUMN IF NOT EXISTS correlation_id       uuid;

CREATE INDEX IF NOT EXISTS idx_browser_actions_browser_session
  ON public.browser_actions (browser_session_id, started_at DESC)
  WHERE browser_session_id IS NOT NULL;

-- ─── 5. browser_executor_status (nur service_role) ───────────────────────────

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

-- ─── 6. Atomarer Verbrauch einer Browser-Freigabe ────────────────────────────
--
-- Genau ein Aufrufer gewinnt: Zeilensperre (FOR UPDATE) auf die Freigabe,
-- Prüfung von Mandant, Status, Ablauf, Verbrauch und Fingerprint, dann
-- consumed_at/consumed_by. Rückgabe ist ein Code, nie eine Ausnahme für
-- fachliche Ablehnungen:
--   consumed | not_found | pending | rejected | cancelled | expired |
--   already_used | mismatch
-- Eine abgelaufene, noch offene oder freigegebene Freigabe wird dabei auf
-- 'expired' gesetzt.

CREATE OR REPLACE FUNCTION public.consume_browser_approval(
  p_approval_id  uuid,
  p_tenant_id    uuid,
  p_session_id   uuid,
  p_fingerprint  text,
  p_consumer     uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_status      text;
  v_expires     timestamptz;
  v_consumed    timestamptz;
  v_fingerprint text;
  v_session     uuid;
BEGIN
  SELECT a.status, a.expires_at, a.consumed_at, b.fingerprint, b.browser_session_id
    INTO v_status, v_expires, v_consumed, v_fingerprint, v_session
    FROM public.governance_approvals a
    LEFT JOIN public.browser_approval_bindings b ON b.approval_id = a.id
   WHERE a.id = p_approval_id
     AND a.tenant_id = p_tenant_id
   FOR UPDATE OF a;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  IF v_consumed IS NOT NULL OR v_status IN ('executed', 'failed') THEN
    RETURN 'already_used';
  END IF;

  IF v_status IN ('pending', 'approved') AND v_expires <= now() THEN
    UPDATE public.governance_approvals SET status = 'expired' WHERE id = p_approval_id;
    RETURN 'expired';
  END IF;

  IF v_status = 'pending'   THEN RETURN 'pending';   END IF;
  IF v_status = 'rejected'  THEN RETURN 'rejected';  END IF;
  IF v_status = 'cancelled' THEN RETURN 'cancelled'; END IF;
  IF v_status = 'expired'   THEN RETURN 'expired';   END IF;

  IF v_fingerprint IS NULL
     OR v_session IS DISTINCT FROM p_session_id
     OR v_fingerprint IS DISTINCT FROM p_fingerprint THEN
    RETURN 'mismatch';
  END IF;

  UPDATE public.governance_approvals
     SET consumed_at = now(),
         consumed_by = p_consumer
   WHERE id = p_approval_id;

  RETURN 'consumed';
END;
$$;

COMMENT ON FUNCTION public.consume_browser_approval(uuid, uuid, uuid, text, uuid) IS
  'Verbraucht eine freigegebene Browser-Aktion genau einmal (Zeilensperre). Nur service_role.';

REVOKE ALL     ON FUNCTION public.consume_browser_approval(uuid, uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.consume_browser_approval(uuid, uuid, uuid, text, uuid) TO service_role;

-- Abschluss nach der Ausführung: nur eine verbrauchte, noch offene Freigabe.
CREATE OR REPLACE FUNCTION public.finish_browser_approval(
  p_approval_id uuid,
  p_tenant_id   uuid,
  p_outcome     text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_rows integer;
BEGIN
  IF p_outcome NOT IN ('executed', 'failed') THEN
    RAISE EXCEPTION 'outcome must be executed or failed' USING ERRCODE = '22023';
  END IF;

  UPDATE public.governance_approvals
     SET status = p_outcome,
         executed_at = now()
   WHERE id = p_approval_id
     AND tenant_id = p_tenant_id
     AND status = 'approved'
     AND consumed_at IS NOT NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;

COMMENT ON FUNCTION public.finish_browser_approval(uuid, uuid, text) IS
  'Setzt eine verbrauchte Browser-Freigabe auf executed/failed. Nur service_role.';

REVOKE ALL     ON FUNCTION public.finish_browser_approval(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.finish_browser_approval(uuid, uuid, text) TO service_role;
