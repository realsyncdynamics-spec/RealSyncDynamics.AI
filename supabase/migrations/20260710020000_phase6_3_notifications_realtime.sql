-- Phase 6.3 Week 1: Email Notifications & Real-Time Updates
-- Notification preferences and real-time infrastructure

-- Notification preferences: per-user/tenant settings
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email_on_invite BOOLEAN DEFAULT true,
  email_on_approval_pending BOOLEAN DEFAULT true,
  email_on_approval_action BOOLEAN DEFAULT true,
  email_on_member_join BOOLEAN DEFAULT true,
  email_on_command_executed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT notification_preferences_unique UNIQUE(user_id, tenant_id),
  CONSTRAINT notification_preferences_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- RLS for notification_preferences
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own preferences"
  ON public.notification_preferences
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Users can update their own preferences"
  ON public.notification_preferences
  FOR UPDATE
  USING (
    user_id = auth.uid()
    AND tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Users can insert their preferences"
  ON public.notification_preferences
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

-- Indexes
CREATE INDEX notification_preferences_user_id_idx ON public.notification_preferences(user_id);
CREATE INDEX notification_preferences_tenant_id_idx ON public.notification_preferences(tenant_id);
CREATE INDEX notification_preferences_unique_idx ON public.notification_preferences(user_id, tenant_id);

-- Notification events log: track all notifications sent
CREATE TABLE IF NOT EXISTS public.notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type TEXT CHECK (event_type IN ('member_invited', 'approval_pending', 'approval_approved', 'approval_rejected', 'member_joined', 'command_executed')),
  subject_id UUID, -- ID of related object (invitation, approval, member, etc.)
  channel TEXT CHECK (channel IN ('email', 'in_app', 'push')),
  status TEXT CHECK (status IN ('queued', 'sent', 'failed', 'bounced')),
  email_address TEXT,
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT notification_events_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- RLS for notification_events
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notification events"
  ON public.notification_events
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "System can insert notification events"
  ON public.notification_events
  FOR INSERT
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

-- Indexes
CREATE INDEX notification_events_user_id_idx ON public.notification_events(user_id);
CREATE INDEX notification_events_tenant_id_idx ON public.notification_events(tenant_id);
CREATE INDEX notification_events_event_type_idx ON public.notification_events(event_type);
CREATE INDEX notification_events_status_idx ON public.notification_events(status);
CREATE INDEX notification_events_created_at_idx ON public.notification_events(created_at DESC);

-- Enable Realtime for activity log and approvals (for WebSocket subscriptions)
-- This allows subscribers to receive real-time updates via WebSocket.
-- Guarded: die Publication `supabase_realtime` existiert nur auf einem echten
-- Supabase-Stack — die CI-Migrationsvalidierung läuft gegen Vanilla-Postgres,
-- dort wird der Block übersprungen. `duplicate_object` macht den Re-Run idempotent.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.terminal_activity_log;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.terminal_approvals;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.terminal_session_members;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END;
$$;

-- Function: Create default notification preferences for new users
CREATE OR REPLACE FUNCTION public.create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  -- Triggered when a new user joins a tenant
  -- Creates default notification preferences if not exists
  INSERT INTO public.notification_preferences (
    user_id,
    tenant_id,
    email_on_invite,
    email_on_approval_pending,
    email_on_approval_action,
    email_on_member_join,
    email_on_command_executed
  )
  VALUES (
    NEW.user_id,
    NEW.tenant_id,
    true,  -- default: receive invite notifications
    true,  -- default: receive approval pending notifications
    true,  -- default: receive approval action notifications
    false, -- default: don't receive member join notifications
    false  -- default: don't receive command executed notifications
  )
  ON CONFLICT (user_id, tenant_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Auto-create notification preferences when member joins session
CREATE TRIGGER create_notification_preferences_on_member_join
AFTER INSERT ON public.terminal_session_members
FOR EACH ROW
EXECUTE FUNCTION public.create_default_notification_preferences();

-- Function: Log notification events
CREATE OR REPLACE FUNCTION public.log_notification_event(
  p_user_id UUID,
  p_tenant_id UUID,
  p_event_type TEXT,
  p_subject_id UUID,
  p_channel TEXT
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.notification_events (
    user_id,
    tenant_id,
    event_type,
    subject_id,
    channel,
    status
  )
  VALUES (
    p_user_id,
    p_tenant_id,
    p_event_type,
    p_subject_id,
    p_channel,
    'queued'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
