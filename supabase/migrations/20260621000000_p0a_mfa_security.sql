-- P0a — Enterprise Identity: MFA-Grundlage (additiv, rückwärtskompatibel).
-- ADR 0005 (Rollenmodell: dpo), ADR 0006 (MFA/AAL2), ADR 0009 (Public Sector).
--
-- Scope dieser Migration:
--   1. memberships.role CHECK additiv um 'dpo' erweitern.
--   2. tenant_security_settings (MFA-Pflicht-Konfiguration, Public-Sector-Vorbereitung).
--   3. mfa_recovery_codes (gehashte Einmal-Codes, Lockout-Schutz).
--   4. Helper is_tenant_admin(uuid).
-- KEIN SSO, KEIN SCIM, KEIN hartes AAL2-Enforcement. Nichts wird entfernt.

-- 1. Rollenmodell: 'dpo' additiv. Bestehende Werte bleiben gültig.
-- Der reale Constraint-Name ist historisch `organization_members_role_check`
-- (memberships wurde aus organization_members umbenannt). Beide Namen droppen,
-- damit die Migration unabhängig vom Stand idempotent ist.
ALTER TABLE public.memberships DROP CONSTRAINT IF EXISTS memberships_role_check;
ALTER TABLE public.memberships DROP CONSTRAINT IF EXISTS organization_members_role_check;
ALTER TABLE public.memberships
    ADD CONSTRAINT memberships_role_check
    CHECK (role IN ('owner', 'admin', 'dpo', 'editor', 'viewer_auditor'));

COMMENT ON CONSTRAINT memberships_role_check ON public.memberships IS
    'ADR 0005: owner/admin (Administration) · dpo (Compliance-Hoheit) · editor (Operate) · viewer_auditor (Read).';

-- 2. Helper: ist auth.uid() Owner/Admin des Tenants? (für Security-Settings-RLS)
CREATE OR REPLACE FUNCTION public.is_tenant_admin(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.memberships
        WHERE tenant_id = p_tenant_id
          AND user_id   = auth.uid()
          AND role      IN ('owner', 'admin')
    );
$$;

COMMENT ON FUNCTION public.is_tenant_admin(UUID) IS
    'True iff auth.uid() ist owner/admin des Tenants. SECURITY DEFINER, search_path gepinnt.';

-- 3. Tenant-Security-Settings (eine Zeile pro Tenant)
CREATE TABLE IF NOT EXISTS public.tenant_security_settings (
    tenant_id            UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    require_mfa_for_roles TEXT[] NOT NULL DEFAULT ARRAY['owner','admin','dpo']::TEXT[],
    enforce_mfa_all      BOOLEAN NOT NULL DEFAULT false,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tenant_security_settings IS
    'ADR 0006/0009: pro Tenant, welche Rollen MFA brauchen + enforce_mfa_all. Public-Sector-Enforcement folgt (P0c).';

ALTER TABLE public.tenant_security_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tss member-read"   ON public.tenant_security_settings;
DROP POLICY IF EXISTS "tss admin-write"   ON public.tenant_security_settings;
DROP POLICY IF EXISTS "tss service-all"   ON public.tenant_security_settings;

CREATE POLICY "tss member-read"
    ON public.tenant_security_settings FOR SELECT
    USING (public.is_tenant_member(tenant_id));

CREATE POLICY "tss admin-write"
    ON public.tenant_security_settings FOR ALL
    USING (public.is_tenant_admin(tenant_id))
    WITH CHECK (public.is_tenant_admin(tenant_id));

CREATE POLICY "tss service-all"
    ON public.tenant_security_settings FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- 4. MFA-Recovery-Codes (Einmal, gehasht; Klartext nur einmalig clientseitig)
CREATE TABLE IF NOT EXISTS public.mfa_recovery_codes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code_hash  TEXT NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mfa_recovery_codes_user_unused
    ON public.mfa_recovery_codes(user_id) WHERE used_at IS NULL;

COMMENT ON TABLE public.mfa_recovery_codes IS
    'ADR 0006: gehashte MFA-Recovery-Codes (account-level). Redemption nur via Edge Function (service-role).';

ALTER TABLE public.mfa_recovery_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mrc self-read"    ON public.mfa_recovery_codes;
DROP POLICY IF EXISTS "mrc self-insert"  ON public.mfa_recovery_codes;
DROP POLICY IF EXISTS "mrc service-all"  ON public.mfa_recovery_codes;

-- Eigene Codes lesen (nur Metadaten/Hash — kein Klartext gespeichert) und anlegen.
CREATE POLICY "mrc self-read"
    ON public.mfa_recovery_codes FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "mrc self-insert"
    ON public.mfa_recovery_codes FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Redemption (used_at setzen) + Admin-Reset (löschen) ausschließlich service-role.
CREATE POLICY "mrc service-all"
    ON public.mfa_recovery_codes FOR ALL TO service_role
    USING (true) WITH CHECK (true);
