-- Dashboard Notifications Table
-- Stores notifications for users about compliance events, alerts, and digests

CREATE TABLE IF NOT EXISTS dashboard_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('alert', 'digest', 'reminder', 'achievement')),
  category TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  action_url TEXT,
  action_label TEXT DEFAULT 'View',
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  is_read BOOLEAN DEFAULT false,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  email_sent_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE dashboard_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own notifications"
  ON dashboard_notifications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can create notifications"
  ON dashboard_notifications
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
  ON dashboard_notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON dashboard_notifications
  FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_dashboard_notifications_tenant_user
  ON dashboard_notifications(tenant_id, user_id);

CREATE INDEX idx_dashboard_notifications_unread
  ON dashboard_notifications(tenant_id, user_id, is_read)
  WHERE is_read = false;

CREATE INDEX idx_dashboard_notifications_type
  ON dashboard_notifications(tenant_id, type);

CREATE INDEX idx_dashboard_notifications_priority
  ON dashboard_notifications(tenant_id, priority);

CREATE INDEX idx_dashboard_notifications_created_at
  ON dashboard_notifications(tenant_id, created_at DESC);

CREATE INDEX idx_dashboard_notifications_not_sent
  ON dashboard_notifications(tenant_id, email_sent_at)
  WHERE email_sent_at IS NULL;

-- Notification Preferences Table
CREATE TABLE IF NOT EXISTS dashboard_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_digests_enabled BOOLEAN DEFAULT true,
  email_alerts_enabled BOOLEAN DEFAULT true,
  in_app_alerts_enabled BOOLEAN DEFAULT true,
  digest_frequency TEXT DEFAULT 'daily' CHECK (digest_frequency IN ('daily', 'weekly', 'never')),
  alert_threshold TEXT DEFAULT 'high' CHECK (alert_threshold IN ('critical', 'high', 'medium', 'low')),
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id)
);

-- Enable RLS
ALTER TABLE dashboard_notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for preferences
CREATE POLICY "Users can view own notification preferences"
  ON dashboard_notification_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own notification preferences"
  ON dashboard_notification_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
  ON dashboard_notification_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notification_preferences_updated_at
BEFORE UPDATE ON dashboard_notification_preferences
FOR EACH ROW
EXECUTE FUNCTION update_notification_preferences_updated_at();

-- Helper function to create notification
CREATE OR REPLACE FUNCTION create_notification(
  p_tenant_id UUID,
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_action_url TEXT DEFAULT NULL,
  p_action_label TEXT DEFAULT 'View',
  p_priority TEXT DEFAULT 'medium',
  p_category TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO dashboard_notifications (
    tenant_id,
    user_id,
    type,
    title,
    body,
    action_url,
    action_label,
    priority,
    category
  ) VALUES (
    p_tenant_id,
    p_user_id,
    p_type,
    p_title,
    p_body,
    p_action_url,
    p_action_label,
    p_priority,
    p_category
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(
  p_notification_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE dashboard_notifications
  SET
    is_read = true,
    read_at = NOW()
  WHERE id = p_notification_id
    AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count(
  p_tenant_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM dashboard_notifications
  WHERE tenant_id = p_tenant_id
    AND user_id = auth.uid()
    AND is_read = false;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Helper function to get notifications for user
CREATE OR REPLACE FUNCTION get_notifications(
  p_tenant_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  type TEXT,
  title TEXT,
  body TEXT,
  action_url TEXT,
  priority TEXT,
  is_read BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dashboard_notifications.id,
    dashboard_notifications.type,
    dashboard_notifications.title,
    dashboard_notifications.body,
    dashboard_notifications.action_url,
    dashboard_notifications.priority,
    dashboard_notifications.is_read,
    dashboard_notifications.created_at
  FROM dashboard_notifications
  WHERE dashboard_notifications.tenant_id = p_tenant_id
    AND dashboard_notifications.user_id = auth.uid()
  ORDER BY dashboard_notifications.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Helper function to get notification preferences for user
CREATE OR REPLACE FUNCTION get_notification_preferences(
  p_tenant_id UUID
)
RETURNS TABLE (
  email_digests_enabled BOOLEAN,
  email_alerts_enabled BOOLEAN,
  in_app_alerts_enabled BOOLEAN,
  digest_frequency TEXT,
  alert_threshold TEXT,
  quiet_hours_start TIME,
  quiet_hours_end TIME
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dashboard_notification_preferences.email_digests_enabled,
    dashboard_notification_preferences.email_alerts_enabled,
    dashboard_notification_preferences.in_app_alerts_enabled,
    dashboard_notification_preferences.digest_frequency,
    dashboard_notification_preferences.alert_threshold,
    dashboard_notification_preferences.quiet_hours_start,
    dashboard_notification_preferences.quiet_hours_end
  FROM dashboard_notification_preferences
  WHERE dashboard_notification_preferences.tenant_id = p_tenant_id
    AND dashboard_notification_preferences.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
