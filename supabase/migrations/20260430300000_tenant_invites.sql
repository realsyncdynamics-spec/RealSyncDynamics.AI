-- Token-based invite system for tenants.
--
-- Owner / admin generates an invite for a target email + role. The plaintext
-- token is returned ONCE; only its SHA-256 hash is persisted. The invitee
-- redeems the token; the redeem endpoint verifies the hash, optionally
-- enforces the email match, and inserts a memberships row.

CREATE TABLE IF NOT EXISTS public.tenant_invites (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    email        TEXT NOT NULL,
    role         TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer_auditor')),
    token_hash   TEXT NOT NULL UNIQUE,                          -- hex SHA-256
    invited_by   UUID NOT NULL,                                 -- references auth.users
    expires_at   TIMESTAMPTZ NOT NULL,
    accepted_at  TIMESTAMPTZ,
    accepted_by  UUID,
    revoked_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_invites_tenant   ON public.tenant_invites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_invites_email    ON public.tenant_invites(email);
CREATE INDEX IF NOT EXISTS idx_tenant_invites_pending  ON public.tenant_invites(tenant_id, accepted_at)
    WHERE accepted_at IS NULL AND revoked_at IS NULL;

ALTER TABLE public.tenant_invites ENABLE ROW LEVEL SECURITY;

-- Members can list invites for their tenant; the token_hash column is fine
-- to expose since the hash alone is not redeemable.
DROP POLICY IF EXISTS "tenant_invites tenant-read"   ON public.tenant_invites;
CREATE POLICY "tenant_invites tenant-read"
    ON public.tenant_invites FOR SELECT
    USING (public.is_tenant_member(tenant_id));

-- Inserts/updates/deletes go via the dedicated edge function with the
-- service role; we deliberately do NOT add INSERT/UPDATE/DELETE policies.

COMMENT ON TABLE public.tenant_invites IS
    'Pending and historical tenant invites. token_hash = sha256(token); plaintext token is shown to inviter exactly once.';
