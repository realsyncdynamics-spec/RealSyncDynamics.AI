-- ════════════════════════════════════════════════════════════════════════════
-- AI-OS — Aktionsprotokoll für Plattform-Operatoren (rein additiv)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Wozu: Die Edge Function `ai-os-control` (internes AI-OS, /admin/ai-os) löst
-- Schreibaktionen aus — Routine starten/pausieren, Wissensänderung als
-- Draft-PR. Jede davon muss nachvollziehbar sein: wer, was, wann, Ergebnis.
--
-- Warum nicht `governance_admin_log`: dort ist `tenant_id` NOT NULL. Die
-- AI-OS-Aktionen haben keinen Mandanten; eine erfundene tenant_id wäre eine
-- falsche Angabe im Prüfpfad. ADR 0011 D5: Plattform-Scope-Tabellen werden
-- über `is_platform_operator()` gelesen.
--
-- Eigenschaften:
--   - lesen: nur aktive Plattform-Operatoren (RLS über is_platform_operator())
--   - schreiben: nur service_role (Edge Function), kein Client-Schreibrecht
--   - append-only: UPDATE und DELETE sind für jede Rolle gesperrt
--   - keine Inhalte: `detail` trägt Kennungen und Ergebnisse, nie Notiztexte,
--     Tokens oder personenbezogene Daten (die Edge Function filtert)
--
-- Destruktiv: nein. Nur CREATE … IF NOT EXISTS, keine bestehende Tabelle
-- berührt. Anwendung auf Produktion nur mit separatem GO (PLAN.md §5).

CREATE TABLE IF NOT EXISTS public.ai_os_action_log (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    request_id     UUID NOT NULL,
    actor_user_id  UUID NOT NULL,
    action_id      TEXT NOT NULL CHECK (action_id ~ '^[a-z0-9][a-z0-9_.-]{2,80}$'),
    agent_id       TEXT CHECK (agent_id IS NULL OR agent_id ~ '^[a-z0-9-]{2,40}$'),
    action_class   TEXT NOT NULL CHECK (action_class IN ('read', 'write')),
    phase          TEXT NOT NULL CHECK (phase IN ('requested', 'succeeded', 'failed', 'denied')),
    target         TEXT CHECK (target IS NULL OR length(target) <= 200),
    detail         JSONB NOT NULL DEFAULT '{}'::jsonb
                   CHECK (jsonb_typeof(detail) = 'object' AND length(detail::text) <= 4000)
);

CREATE INDEX IF NOT EXISTS idx_ai_os_action_log_created
    ON public.ai_os_action_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_os_action_log_request
    ON public.ai_os_action_log (request_id);

ALTER TABLE public.ai_os_action_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ai_os_action_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ai_os_action_log TO authenticated;
GRANT SELECT, INSERT ON public.ai_os_action_log TO service_role;

DROP POLICY IF EXISTS ai_os_action_log_operator_read ON public.ai_os_action_log;
CREATE POLICY ai_os_action_log_operator_read
    ON public.ai_os_action_log
    FOR SELECT
    TO authenticated
    USING ((SELECT public.is_platform_operator()));

CREATE OR REPLACE FUNCTION public.ai_os_action_log_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'ai_os_action_log ist append-only' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_os_action_log_append_only ON public.ai_os_action_log;
CREATE TRIGGER trg_ai_os_action_log_append_only
    BEFORE UPDATE OR DELETE ON public.ai_os_action_log
    FOR EACH ROW EXECUTE FUNCTION public.ai_os_action_log_append_only();

COMMENT ON TABLE public.ai_os_action_log IS
    'Internes AI-OS: append-only Protokoll der Operator-Aktionen aus ai-os-control. Lesen nur is_platform_operator(), schreiben nur service_role.';
