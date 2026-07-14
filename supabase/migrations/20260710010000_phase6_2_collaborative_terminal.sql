-- Phase 6.2: Multi-Tenant Terminal Collaboration
-- Team collaboration in terminal sessions

-- Terminal session members: Track who is in each session
CREATE TABLE IF NOT EXISTS public.terminal_session_members (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.terminal_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('owner', 'editor', 'viewer', 'approver')) DEFAULT 'editor',
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  left_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  CONSTRAINT terminal_members_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT unique_session_member UNIQUE(session_id, user_id)
);

-- RLS for terminal_session_members
ALTER TABLE public.terminal_session_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view members of their sessions"
  ON public.terminal_session_members
  FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Session owners can manage members"
  ON public.terminal_session_members
  FOR INSERT
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

-- Indexes
CREATE INDEX terminal_session_members_session_id_idx ON public.terminal_session_members(session_id);
CREATE INDEX terminal_session_members_user_id_idx ON public.terminal_session_members(user_id);
CREATE INDEX terminal_session_members_tenant_id_idx ON public.terminal_session_members(tenant_id);
CREATE INDEX terminal_session_members_role_idx ON public.terminal_session_members(role);
CREATE INDEX terminal_session_members_active_idx ON public.terminal_session_members(is_active);

-- Terminal session invitations: Pending team invites
CREATE TABLE IF NOT EXISTS public.terminal_session_invitations (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.terminal_sessions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  role TEXT CHECK (role IN ('editor', 'viewer', 'approver')) DEFAULT 'editor',
  token VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  accepted_by UUID REFERENCES auth.users(id),
  rejected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT terminal_invitations_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- RLS for terminal_session_invitations
ALTER TABLE public.terminal_session_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invitations for their tenant"
  ON public.terminal_session_invitations
  FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Users can create invitations in their tenant"
  ON public.terminal_session_invitations
  FOR INSERT
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

-- Indexes
CREATE INDEX terminal_invitations_session_id_idx ON public.terminal_session_invitations(session_id);
CREATE INDEX terminal_invitations_tenant_id_idx ON public.terminal_session_invitations(tenant_id);
CREATE INDEX terminal_invitations_email_idx ON public.terminal_session_invitations(invited_email);
CREATE INDEX terminal_invitations_token_idx ON public.terminal_session_invitations(token);
CREATE INDEX terminal_invitations_expires_at_idx ON public.terminal_session_invitations(expires_at);

-- Terminal approvals: Track audit approval workflows
CREATE TABLE IF NOT EXISTS public.terminal_approvals (
  id UUID PRIMARY KEY,
  audit_id UUID NOT NULL,
  terminal_command_id UUID NOT NULL REFERENCES public.terminal_commands(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  approver_id UUID REFERENCES auth.users(id),
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  reason TEXT,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT terminal_approvals_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- RLS for terminal_approvals
ALTER TABLE public.terminal_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view approvals for their tenant"
  ON public.terminal_approvals
  FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Users can create approvals"
  ON public.terminal_approvals
  FOR INSERT
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Approvers can update approvals"
  ON public.terminal_approvals
  FOR UPDATE
  USING (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

-- Indexes
CREATE INDEX terminal_approvals_audit_id_idx ON public.terminal_approvals(audit_id);
CREATE INDEX terminal_approvals_tenant_id_idx ON public.terminal_approvals(tenant_id);
CREATE INDEX terminal_approvals_status_idx ON public.terminal_approvals(status);
CREATE INDEX terminal_approvals_approver_id_idx ON public.terminal_approvals(approver_id);
CREATE INDEX terminal_approvals_requested_at_idx ON public.terminal_approvals(requested_at DESC);

-- Terminal activity log: Track all actions in collaborative sessions
CREATE TABLE IF NOT EXISTS public.terminal_activity_log (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.terminal_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  action_type TEXT CHECK (action_type IN ('command', 'member_join', 'member_leave', 'member_invited', 'approval_requested', 'approval_completed')),
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT terminal_activity_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- RLS for terminal_activity_log
ALTER TABLE public.terminal_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view activity in their tenant"
  ON public.terminal_activity_log
  FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Users can create activity logs"
  ON public.terminal_activity_log
  FOR INSERT
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

-- Indexes
CREATE INDEX terminal_activity_session_id_idx ON public.terminal_activity_log(session_id);
CREATE INDEX terminal_activity_user_id_idx ON public.terminal_activity_log(user_id);
CREATE INDEX terminal_activity_tenant_id_idx ON public.terminal_activity_log(tenant_id);
CREATE INDEX terminal_activity_type_idx ON public.terminal_activity_log(action_type);
CREATE INDEX terminal_activity_created_at_idx ON public.terminal_activity_log(created_at DESC);
