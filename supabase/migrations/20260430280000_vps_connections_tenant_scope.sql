-- VPS connections become tenant-aware.
--
-- Until now vps_connections was strictly user-scoped — only the creator
-- could see and use it. Adding tenant_id (nullable) lets a connection be
-- shared across a tenant: any member can run actions, only the owner
-- writes / deletes. NULL tenant_id keeps the v1 personal-connection
-- semantics for users without an active tenant.

-- 1. Add the column (idempotent)
ALTER TABLE public.vps_connections
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_vps_connections_tenant
    ON public.vps_connections(tenant_id);

-- 2. Backfill existing rows with the owner's first tenant, if any.
--    Rows whose owner has no membership stay NULL (= personal connection).
UPDATE public.vps_connections vc
   SET tenant_id = sub.tenant_id
  FROM (
    SELECT m.user_id, m.tenant_id
    FROM (
      SELECT user_id,
             tenant_id,
             ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) AS rn
        FROM public.memberships
    ) m
    WHERE m.rn = 1
  ) AS sub
 WHERE vc.tenant_id IS NULL
   AND sub.user_id = vc.owner_id;

-- 3. Replace owner-only RLS with owner-OR-tenant-member.
DROP POLICY IF EXISTS "Nutzer können eigene VPS-Verbindungen lesen"     ON public.vps_connections;
DROP POLICY IF EXISTS "Nutzer können eigene VPS-Verbindungen anlegen"   ON public.vps_connections;
DROP POLICY IF EXISTS "Nutzer können eigene VPS-Verbindungen ändern"    ON public.vps_connections;
DROP POLICY IF EXISTS "Nutzer können eigene VPS-Verbindungen löschen"   ON public.vps_connections;
DROP POLICY IF EXISTS "vps_connections owner-or-tenant select"          ON public.vps_connections;
DROP POLICY IF EXISTS "vps_connections owner insert"                    ON public.vps_connections;
DROP POLICY IF EXISTS "vps_connections owner update"                    ON public.vps_connections;
DROP POLICY IF EXISTS "vps_connections owner delete"                    ON public.vps_connections;

CREATE POLICY "vps_connections owner-or-tenant select"
    ON public.vps_connections FOR SELECT
    USING (
        owner_id = auth.uid()
        OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id))
    );

-- Writes always require ownership; tenant association does not grant write.
CREATE POLICY "vps_connections owner insert"
    ON public.vps_connections FOR INSERT
    WITH CHECK (
        owner_id = auth.uid()
        AND (tenant_id IS NULL OR public.is_tenant_member(tenant_id))
    );

CREATE POLICY "vps_connections owner update"
    ON public.vps_connections FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (
        owner_id = auth.uid()
        AND (tenant_id IS NULL OR public.is_tenant_member(tenant_id))
    );

CREATE POLICY "vps_connections owner delete"
    ON public.vps_connections FOR DELETE
    USING (owner_id = auth.uid());

COMMENT ON COLUMN public.vps_connections.tenant_id IS
    'Optional tenant scope. NULL = personal connection (owner-only). Otherwise any tenant member can run actions; only the owner can update/delete.';
