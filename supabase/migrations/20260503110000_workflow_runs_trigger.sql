-- Atomic run_count + last_run_at maintenance via Trigger.
-- Vermeidet Race Conditions wenn mehrere Runs gleichzeitig zurückkommen.

CREATE OR REPLACE FUNCTION public.bump_workflow_run_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.workflows
           SET run_count = COALESCE(run_count, 0) + 1
         WHERE id = NEW.workflow_id;
    ELSIF TG_OP = 'UPDATE'
          AND NEW.status IN ('success', 'error', 'timeout', 'cancelled')
          AND OLD.status NOT IN ('success', 'error', 'timeout', 'cancelled') THEN
        UPDATE public.workflows
           SET last_run_at = COALESCE(NEW.finished_at, now())
         WHERE id = NEW.workflow_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trig_workflow_runs_bump ON public.workflow_runs;
CREATE TRIGGER trig_workflow_runs_bump
    AFTER INSERT OR UPDATE ON public.workflow_runs
    FOR EACH ROW EXECUTE FUNCTION public.bump_workflow_run_stats();

COMMENT ON FUNCTION public.bump_workflow_run_stats() IS
    'Inkrementiert workflows.run_count bei jedem neuen Run; setzt last_run_at wenn ein Run in den Endzustand übergeht.';
