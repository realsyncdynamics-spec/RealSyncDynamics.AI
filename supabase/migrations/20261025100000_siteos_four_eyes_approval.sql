-- SiteOS: Vier-Augen-Prinzip und menschliche Freigabe, in der Datenbank
-- erzwungen (Baustein A, G2 vom 25.10.2026).
--
-- Anlass (Phase-0-Gap-Analyse):
--   1. `siteos/agents` op=approve prüfte nur die Mitgliedschaft — jedes
--      Mitglied, auch `viewer_auditor`, konnte einen wartenden Lauf freigeben.
--   2. `siteos/publish-approve` prüfte die Rolle, aber nicht, ob die
--      freigebende Person die bewertete Version selbst erstellt hat.
--   3. Wer `siteos_agent_runs` angestoßen hat, wurde nicht gespeichert —
--      eine Selbstfreigabe war damit nicht einmal feststellbar.
--
-- Warum ein Trigger und nicht nur die Edge Function: Dasselbe Prinzip wie
-- `publishable GENERATED` (20260822120000): Auch ein Schreibpfad mit
-- `service_role` darf die Regel nicht umgehen können. Ein Cron- oder
-- KI-Pfad ohne Nutzer-ID kann damit strukturell nicht freigeben.
--
-- Regeln (identisch zu supabase/functions/siteos/approval-policy.ts):
--   - Freigeben darf nur ein Mitglied des Mandanten mit Rolle owner/admin/dpo.
--   - Nie der Autor der bewerteten Version / der Auslöser des Laufs.
--   - Ausnahme: Ist die Person das EINZIGE freigabeberechtigte Mitglied,
--     ist eine Selbstfreigabe zulässig — nur mit `self_approval = true`
--     und einer Begründung von mindestens 30 Zeichen.
--   - Autor unbekannt (NULL) ⇒ keine Freigabe (fail-closed).
--   - Eine erteilte Freigabe ist unveränderlich.
--   - Ein wartender Agentenlauf verlässt `awaiting_approval` nur über eine
--     Freigabe oder `cancelled`.
--
-- Rein additiv: neue nullable Spalten bzw. Spalten mit Default, ein
-- Trigger. Keine Daten-, RLS- oder Rechteänderung. Altdaten bleiben
-- unberührt; der Trigger greift nur bei UPDATE.

BEGIN;

-- ── 1. Neue Spalten ────────────────────────────────────────────────────

ALTER TABLE public.siteos_agent_runs
  ADD COLUMN IF NOT EXISTS requested_by    UUID,
  ADD COLUMN IF NOT EXISTS approved_by     UUID,
  ADD COLUMN IF NOT EXISTS approved_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_reason TEXT,
  ADD COLUMN IF NOT EXISTS self_approval   BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'siteos_agent_runs_approval_complete') THEN
    ALTER TABLE public.siteos_agent_runs
      ADD CONSTRAINT siteos_agent_runs_approval_complete CHECK (
        (approved_by IS NULL AND approved_at IS NULL)
        OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)
      );
  END IF;
END $$;

COMMENT ON COLUMN public.siteos_agent_runs.requested_by IS
  'Mensch, dessen Aktion den Lauf eingereiht hat. Darf den Lauf nicht selbst freigeben (Vier-Augen). NULL nur bei Altdaten — solche Läufe sind nicht freigebbar.';
COMMENT ON COLUMN public.siteos_agent_runs.approved_by IS
  'Freigebende Person (auth.users.id). Unveränderlich, per Trigger gegen Rolle und Vier-Augen geprüft.';
COMMENT ON COLUMN public.siteos_agent_runs.approval_id IS
  'Historisch: bis 20261025100000 die Nutzer-ID der Freigabe. Maßgeblich ist approved_by.';

ALTER TABLE public.siteos_publish_evaluations
  ADD COLUMN IF NOT EXISTS self_approval BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.siteos_publish_evaluations.self_approval IS
  'true = Autor der Version hat als einziges freigabeberechtigtes Mitglied selbst freigegeben (dokumentierte Ausnahme vom Vier-Augen-Prinzip).';

-- ── 2. Gemeinsame Prüfung ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.siteos_assert_human_approval(
  p_tenant_id   UUID,
  p_approver_id UUID,
  p_author_id   UUID,
  p_reason      TEXT,
  p_self        BOOLEAN
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role     TEXT;
  v_eligible INTEGER;
BEGIN
  SELECT role INTO v_role
    FROM public.memberships
   WHERE tenant_id = p_tenant_id AND user_id = p_approver_id;

  IF v_role IS NULL OR v_role NOT IN ('owner', 'admin', 'dpo') THEN
    RAISE EXCEPTION 'siteos approval: approver is not an owner, admin or dpo of this tenant'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_author_id IS NULL THEN
    RAISE EXCEPTION 'siteos approval: author unknown — approval refused (fail-closed)'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_approver_id <> p_author_id THEN
    IF p_self THEN
      RAISE EXCEPTION 'siteos approval: self_approval set although approver is not the author'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN;
  END IF;

  -- Autor gibt selbst frei: nur als einziges freigabeberechtigtes Mitglied.
  SELECT count(*) INTO v_eligible
    FROM public.memberships
   WHERE tenant_id = p_tenant_id AND role IN ('owner', 'admin', 'dpo');

  IF v_eligible <> 1 OR NOT p_self OR coalesce(length(btrim(p_reason)), 0) < 30 THEN
    RAISE EXCEPTION 'siteos approval: four-eyes rule — author may not approve own version'
      USING ERRCODE = 'check_violation';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.siteos_assert_human_approval(UUID, UUID, UUID, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;

-- ── 3. Trigger: Publish-Bewertungen ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.siteos_publish_evaluations_four_eyes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_author UUID;
BEGIN
  IF NEW.approved_by IS NOT DISTINCT FROM OLD.approved_by THEN
    IF NEW.self_approval IS DISTINCT FROM OLD.self_approval THEN
      RAISE EXCEPTION 'siteos approval: self_approval may only change together with an approval'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.approved_by IS NOT NULL THEN
    RAISE EXCEPTION 'siteos approval: an approval is immutable'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT created_by INTO v_author
    FROM public.siteos_blueprints
   WHERE id = NEW.blueprint_id AND tenant_id = NEW.tenant_id;

  PERFORM public.siteos_assert_human_approval(
    NEW.tenant_id, NEW.approved_by, v_author, NEW.approval_reason, NEW.self_approval);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS siteos_publish_evaluations_four_eyes ON public.siteos_publish_evaluations;
CREATE TRIGGER siteos_publish_evaluations_four_eyes
  BEFORE UPDATE ON public.siteos_publish_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.siteos_publish_evaluations_four_eyes();

-- ── 4. Trigger: Agentenläufe ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.siteos_agent_runs_four_eyes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.requested_by IS DISTINCT FROM OLD.requested_by THEN
    RAISE EXCEPTION 'siteos approval: requested_by is immutable'
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.approved_by IS NOT NULL AND NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN
    RAISE EXCEPTION 'siteos approval: an approval is immutable'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.approved_by IS NULL AND NEW.self_approval THEN
    RAISE EXCEPTION 'siteos approval: self_approval without approval'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Ein wartender Lauf verlässt den Wartezustand nur über eine Freigabe
  -- oder einen Abbruch — sonst könnte ein Status-Update die Freigabe ersetzen.
  IF OLD.status = 'awaiting_approval'
     AND NEW.status NOT IN ('awaiting_approval', 'cancelled')
     AND NEW.approved_by IS NULL THEN
    RAISE EXCEPTION 'siteos approval: run awaiting approval cannot proceed without a human approval'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.approved_by IS NOT NULL AND OLD.approved_by IS NULL THEN
    PERFORM public.siteos_assert_human_approval(
      NEW.tenant_id, NEW.approved_by, OLD.requested_by, NEW.approval_reason, NEW.self_approval);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS siteos_agent_runs_four_eyes ON public.siteos_agent_runs;
CREATE TRIGGER siteos_agent_runs_four_eyes
  BEFORE UPDATE ON public.siteos_agent_runs
  FOR EACH ROW EXECUTE FUNCTION public.siteos_agent_runs_four_eyes();

REVOKE ALL ON FUNCTION public.siteos_publish_evaluations_four_eyes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.siteos_agent_runs_four_eyes() FROM PUBLIC, anon, authenticated;

COMMIT;
