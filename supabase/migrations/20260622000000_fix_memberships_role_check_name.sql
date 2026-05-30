-- Korrektur zu 20260621000000 (P0a): realer Constraint-Name.
--
-- `memberships` entstand aus `organization_members` (Rename in
-- 20260430160000). Der inline-CHECK aus der CREATE TABLE (20260406000000)
-- heisst daher auto-generiert `organization_members_role_check` und
-- ueberlebte den Rename. Die P0a-Migration droppte nur den (nicht
-- existenten) Namen `memberships_role_check` und legte einen zweiten,
-- dpo-faehigen CHECK an — auf einer FRISCHEN DB blieb damit der alte
-- 4-Werte-CHECK aktiv und wuerde 'dpo' faelschlich ablehnen.
--
-- Dieser additive Fix entfernt den Alt-Constraint idempotent und stellt
-- sicher, dass exakt EIN dpo-faehiger CHECK existiert. Append-only:
-- 20260621000000 bleibt unveraendert.

ALTER TABLE public.memberships DROP CONSTRAINT IF EXISTS organization_members_role_check;
ALTER TABLE public.memberships DROP CONSTRAINT IF EXISTS memberships_role_check;

ALTER TABLE public.memberships
    ADD CONSTRAINT memberships_role_check
    CHECK (role IN ('owner', 'admin', 'dpo', 'editor', 'viewer_auditor'));

COMMENT ON CONSTRAINT memberships_role_check ON public.memberships IS
    'ADR 0005: owner/admin (Administration) · dpo (Compliance-Hoheit) · editor (Operate) · viewer_auditor (Read).';
