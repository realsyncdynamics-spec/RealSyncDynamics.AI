-- Browser-Runtime · Freigaben genau einmal ausführen (PR #1728).
--
-- Befund: browser-execute erkannte eine verbrauchte Freigabe nur daran, dass
-- NACH dem Executor eine passende Zeile in governance_evidence stand. Zwei
-- gleichzeitige Requests mit derselben approval_id fanden beide keine und
-- führten die Mutation (click/type/select) beide aus. Scheiterte die
-- Persistenz nach dem Executor, blieb die Freigabe ebenfalls wiederholbar.
-- Zusätzlich wurde expires_at der Freigabe nie geprüft.
--
-- Diese Migration:
--   - public.browser_executions: eine Zeile je verbrauchter Freigabe,
--     UNIQUE(approval_id). Status:
--       reserved             vor dem Executor angelegt
--       executed             Executor ok, Event + Evidence geschrieben
--       executed_unrecorded  Executor ok, Event/Evidence gescheitert —
--                            Aktion ist gelaufen, Prüfpfad unvollständig
--       executor_failed      Executor-Fehler/Timeout — ob der Browser schon
--                            teilweise gehandelt hat, ist nicht feststellbar
--     Keiner dieser Status gibt die Freigabe wieder frei. Ein neuer Versuch
--     braucht eine neue Freigabe.
--   - public.reserve_browser_execution(): prüft unter Zeilensperre auf der
--     Freigabe Mandant, Status 'approved', expires_at > now() (Datenbankuhr)
--     und Fingerprint und reserviert in derselben Transaktion.
--   - public.finish_browser_execution(): Statuswechsel nur aus 'reserved'.
--     'reserved' wird nie automatisch freigegeben, auch nicht manuell.
--
-- Runbook — stehengebliebene und ungeklärte Ausführungen (service_role):
--
--   SELECT e.id, e.tenant_id, e.approval_id, e.status, e.detail,
--          e.reserved_at, e.finished_at, now() - e.reserved_at AS age
--     FROM public.browser_executions e
--    WHERE (e.status = 'reserved' AND e.reserved_at < now() - interval '5 minutes')
--       OR e.status IN ('executed_unrecorded', 'executor_failed')
--    ORDER BY e.reserved_at DESC;
--
--   Executor-Timeout ist 90 s: 'reserved' nach 5 Minuten heisst, die Function
--   brach zwischen Reservierung und Abschluss ab. Ob die Aktion lief, zeigt das
--   Zielsystem oder ein governance_events-Eintrag 'browser.action.executed'
--   mit payload->>'browser_execution_id' = e.id::text.
--   executed_unrecorded: Aktion lief, Prüfpfad unvollständig → manuell prüfen
--   und nachdokumentieren. executor_failed: Ausgang unklar → Zielsystem prüfen.
--   Ein neuer Versuch braucht immer eine neue Freigabe.
--
-- Rein additiv: governance_approvals (inkl. CHECK auf status) bleibt
-- unverändert. Zugriff nur service_role. Deploy-Reihenfolge: diese
-- Migration VOR browser-execute — sonst scheitert jede Reservierung und
-- jede freigabepflichtige Aktion wird (fail-closed) abgewiesen.

CREATE TABLE IF NOT EXISTS public.browser_executions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL,
  approval_id  uuid NOT NULL REFERENCES public.governance_approvals(id) ON DELETE CASCADE,
  fingerprint  text NOT NULL,
  status       text NOT NULL DEFAULT 'reserved' CHECK (
                 status IN ('reserved', 'executed', 'executed_unrecorded', 'executor_failed')
               ),
  detail       text,
  reserved_at  timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz,
  CONSTRAINT browser_executions_approval_once UNIQUE (approval_id),
  CONSTRAINT browser_executions_finished_consistent CHECK (
    (status = 'reserved') = (finished_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_browser_executions_tenant
  ON public.browser_executions (tenant_id, reserved_at DESC);

CREATE INDEX IF NOT EXISTS idx_browser_executions_stale
  ON public.browser_executions (reserved_at)
  WHERE status = 'reserved';

ALTER TABLE public.browser_executions ENABLE ROW LEVEL SECURITY;
-- Keine Policies: nur service_role (BYPASSRLS) greift zu.
REVOKE ALL ON TABLE public.browser_executions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.browser_executions TO service_role;

-- Nachtrag: Freigaben, die vor dieser Migration verbraucht wurden, kennt die
-- alte Function nur über governance_evidence (browser_execution_consumed).
-- Ohne diese Zeilen wären sie nach dem Deploy ein weiteres Mal ausführbar.
INSERT INTO public.browser_executions
  (tenant_id, approval_id, fingerprint, status, detail, reserved_at, finished_at)
SELECT DISTINCT ON (ga.id)
       coalesce(ga.tenant_id, ge.tenant_id),
       ga.id,
       ga.requested_action,
       'executed',
       'backfill: consumed before browser_executions existed',
       ge.created_at,
       ge.created_at
  FROM public.governance_evidence ge
  JOIN public.governance_approvals ga
    ON ga.id::text = ge.metadata ->> 'browser_approval_id'
 WHERE ge.metadata ->> 'browser_execution_consumed' = 'true'
   AND coalesce(ga.tenant_id, ge.tenant_id) IS NOT NULL
 ORDER BY ga.id, ge.created_at
ON CONFLICT (approval_id) DO NOTHING;

COMMENT ON TABLE public.browser_executions IS
  'Eine Zeile je verbrauchter Browser-Freigabe. UNIQUE(approval_id) verhindert doppelte '
  'Ausführung; kein Status gibt die Freigabe wieder frei. Nur service_role.';

-- outcome:
--   reserved      Reservierung angelegt, Executor darf laufen
--   already_used  es gibt schon eine Ausführung (execution_status sagt welche)
--   not_found     Freigabe fehlt oder gehört zu einem anderen Mandanten
--   not_approved  Freigabe ist nicht 'approved' (approval_status sagt welcher)
--   expired       expires_at <= now()
--   mismatch      Fingerprint passt nicht zur freigegebenen Aktion
CREATE OR REPLACE FUNCTION public.reserve_browser_execution(
  p_tenant_id   uuid,
  p_approval_id uuid,
  p_fingerprint text
)
RETURNS TABLE (
  outcome          text,
  execution_id     uuid,
  execution_status text,
  approval_status  text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_approval public.governance_approvals%ROWTYPE;
  v_exec_id     uuid;
  v_exec_status text;
BEGIN
  IF p_tenant_id IS NULL OR p_approval_id IS NULL OR p_fingerprint IS NULL THEN
    RAISE EXCEPTION 'tenant_id, approval_id and fingerprint required' USING ERRCODE = '22023';
  END IF;

  -- Sperre auf der Freigabe: gleichzeitige Reservierungen derselben Freigabe
  -- laufen nacheinander, und ein paralleles Ablehnen wartet ebenfalls.
  SELECT * INTO v_approval
    FROM public.governance_approvals a
   WHERE a.id = p_approval_id
   FOR UPDATE;

  IF NOT FOUND OR v_approval.tenant_id IS DISTINCT FROM p_tenant_id THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid, NULL::text, NULL::text;
    RETURN;
  END IF;

  SELECT e.id, e.status INTO v_exec_id, v_exec_status
    FROM public.browser_executions e
   WHERE e.approval_id = p_approval_id;
  IF FOUND THEN
    RETURN QUERY SELECT 'already_used'::text, v_exec_id, v_exec_status, v_approval.status;
    RETURN;
  END IF;

  IF v_approval.status <> 'approved' THEN
    RETURN QUERY SELECT 'not_approved'::text, NULL::uuid, NULL::text, v_approval.status;
    RETURN;
  END IF;

  IF v_approval.expires_at <= now() THEN
    RETURN QUERY SELECT 'expired'::text, NULL::uuid, NULL::text, v_approval.status;
    RETURN;
  END IF;

  IF v_approval.requested_action IS DISTINCT FROM p_fingerprint THEN
    RETURN QUERY SELECT 'mismatch'::text, NULL::uuid, NULL::text, v_approval.status;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.browser_executions (tenant_id, approval_id, fingerprint, status)
    VALUES (p_tenant_id, p_approval_id, p_fingerprint, 'reserved')
    RETURNING id INTO v_exec_id;
  EXCEPTION WHEN unique_violation THEN
    -- Rückfallnetz, falls die Sperre umgangen wurde: UNIQUE entscheidet.
    SELECT e.id, e.status INTO v_exec_id, v_exec_status
      FROM public.browser_executions e
     WHERE e.approval_id = p_approval_id;
    RETURN QUERY SELECT 'already_used'::text, v_exec_id, v_exec_status, v_approval.status;
    RETURN;
  END;

  RETURN QUERY SELECT 'reserved'::text, v_exec_id, 'reserved'::text, v_approval.status;
END;
$$;

COMMENT ON FUNCTION public.reserve_browser_execution(uuid, uuid, text) IS
  'Reserviert eine Browser-Freigabe genau einmal (Zeilensperre + UNIQUE). Prüft Mandant, '
  'approved, expires_at > now() und Fingerprint in einer Transaktion. Nur service_role.';

REVOKE ALL     ON FUNCTION public.reserve_browser_execution(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reserve_browser_execution(uuid, uuid, text) TO service_role;

-- Liefert true, wenn der Wechsel stattfand. false heisst: die Ausführung war
-- nicht (mehr) 'reserved' — es wird nichts überschrieben.
CREATE OR REPLACE FUNCTION public.finish_browser_execution(
  p_execution_id uuid,
  p_status       text,
  p_detail       text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_rows integer;
BEGIN
  IF p_status NOT IN ('executed', 'executed_unrecorded', 'executor_failed') THEN
    RAISE EXCEPTION 'invalid terminal status: %', p_status USING ERRCODE = '22023';
  END IF;

  UPDATE public.browser_executions
     SET status = p_status,
         detail = left(p_detail, 500),
         finished_at = clock_timestamp()
   WHERE id = p_execution_id
     AND status = 'reserved';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;

COMMENT ON FUNCTION public.finish_browser_execution(uuid, text, text) IS
  'Statuswechsel einer Browser-Ausführung nur aus reserved in einen Endstatus. Nur service_role.';

REVOKE ALL     ON FUNCTION public.finish_browser_execution(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.finish_browser_execution(uuid, text, text) TO service_role;
