-- Phase 6.3 Week 2: Audit Export & Role Editing
-- Audit export tracking and member role change history

-- Audit exports: Track all exported audits with signatures
CREATE TABLE IF NOT EXISTS public.audit_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  format TEXT NOT NULL CHECK (format IN ('pdf', 'csv', 'xlsx')),
  file_path TEXT NOT NULL, -- S3 path
  file_size INTEGER,
  signature_hash VARCHAR(64), -- SHA256
  signature_verified_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT audit_exports_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- RLS for audit_exports
ALTER TABLE public.audit_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant's exports"
  ON public.audit_exports
  FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Users can create exports"
  ON public.audit_exports
  FOR INSERT
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
    AND user_id = auth.uid()
  );

-- Indexes
CREATE INDEX audit_exports_user_id_idx ON public.audit_exports(user_id);
CREATE INDEX audit_exports_tenant_id_idx ON public.audit_exports(tenant_id);
CREATE INDEX audit_exports_audit_id_idx ON public.audit_exports(audit_id);
CREATE INDEX audit_exports_format_idx ON public.audit_exports(format);
CREATE INDEX audit_exports_created_at_idx ON public.audit_exports(created_at DESC);
CREATE INDEX audit_exports_expires_at_idx ON public.audit_exports(expires_at);

-- Terminal member role changes: Audit trail for role modifications
CREATE TABLE IF NOT EXISTS public.terminal_member_role_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.terminal_session_members(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.terminal_sessions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  old_role TEXT NOT NULL CHECK (old_role IN ('owner', 'editor', 'viewer', 'approver')),
  new_role TEXT NOT NULL CHECK (new_role IN ('owner', 'editor', 'viewer', 'approver')),
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT member_role_changes_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- RLS for terminal_member_role_changes
ALTER TABLE public.terminal_member_role_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view role changes in their tenant"
  ON public.terminal_member_role_changes
  FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Users can create role change records"
  ON public.terminal_member_role_changes
  FOR INSERT
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

-- Indexes
CREATE INDEX member_role_changes_member_id_idx ON public.terminal_member_role_changes(member_id);
CREATE INDEX member_role_changes_session_id_idx ON public.terminal_member_role_changes(session_id);
CREATE INDEX member_role_changes_tenant_id_idx ON public.terminal_member_role_changes(tenant_id);
CREATE INDEX member_role_changes_changed_by_idx ON public.terminal_member_role_changes(changed_by);
CREATE INDEX member_role_changes_created_at_idx ON public.terminal_member_role_changes(created_at DESC);

-- Realtime publication updates.
-- Guarded: die Publication `supabase_realtime` existiert nur auf einem echten
-- Supabase-Stack — die CI-Migrationsvalidierung läuft gegen Vanilla-Postgres,
-- dort wird der Block übersprungen. `duplicate_object` macht den Re-Run idempotent.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_exports;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.terminal_member_role_changes;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END;
$$;

-- Function: Log role change to activity log and notification
CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Log to activity log
  INSERT INTO public.terminal_activity_log (
    id,
    session_id,
    user_id,
    tenant_id,
    action,
    action_type,
    details,
    created_at
  )
  VALUES (
    gen_random_uuid(),
    NEW.session_id,
    NEW.changed_by,
    NEW.tenant_id,
    'Changed member role from ' || NEW.old_role || ' to ' || NEW.new_role,
    'member_role_changed',
    jsonb_build_object(
      'member_id', NEW.member_id,
      'old_role', NEW.old_role,
      'new_role', NEW.new_role,
      'reason', NEW.reason
    ),
    NEW.created_at
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Log role changes to activity log
CREATE TRIGGER log_terminal_role_change
AFTER INSERT ON public.terminal_member_role_changes
FOR EACH ROW
EXECUTE FUNCTION public.log_role_change();

-- Function: Update member role atomically
CREATE OR REPLACE FUNCTION public.update_member_role(
  p_member_id UUID,
  p_new_role TEXT,
  p_changed_by UUID,
  p_tenant_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  old_role TEXT
) AS $$
DECLARE
  v_old_role TEXT;
  v_session_id UUID;
BEGIN
  -- Get current role and session
  SELECT role, session_id INTO v_old_role, v_session_id
  FROM public.terminal_session_members
  WHERE id = p_member_id AND tenant_id = p_tenant_id;

  IF v_old_role IS NULL THEN
    RETURN QUERY SELECT false, 'Member not found', NULL;
    RETURN;
  END IF;

  -- Prevent self-downgrade (security check)
  IF (SELECT user_id FROM public.terminal_session_members WHERE id = p_member_id) = p_changed_by
    AND p_new_role != v_old_role
    AND v_old_role = 'owner'
  THEN
    RETURN QUERY SELECT false, 'Cannot downgrade your own role', v_old_role;
    RETURN;
  END IF;

  -- Update role
  UPDATE public.terminal_session_members
  SET role = p_new_role, updated_at = now()
  WHERE id = p_member_id AND tenant_id = p_tenant_id;

  -- Record change
  INSERT INTO public.terminal_member_role_changes (
    member_id,
    session_id,
    tenant_id,
    old_role,
    new_role,
    changed_by,
    reason
  )
  VALUES (p_member_id, v_session_id, p_tenant_id, v_old_role, p_new_role, p_changed_by, p_reason);

  RETURN QUERY SELECT true, 'Role updated successfully', v_old_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
