-- Collaborative Dashboard Features for SEO-Marketing-Dashboard
-- Enables sharing, custom views, annotations, and team collaboration

-- Create table for custom dashboard views/configurations
CREATE TABLE IF NOT EXISTS seo_dashboard_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  view_name VARCHAR(255) NOT NULL,
  view_description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  is_public_to_team BOOLEAN DEFAULT FALSE,
  view_config JSONB NOT NULL DEFAULT '{}', -- stores layout, visible metrics, filters
  theme_preset VARCHAR(50), -- industrial, minimal, detailed
  refresh_interval_seconds INT DEFAULT 30,
  pinned_widgets JSONB DEFAULT '[]', -- order of widgets
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for dashboard sharing
CREATE TABLE IF NOT EXISTS seo_dashboard_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  dashboard_view_id UUID NOT NULL REFERENCES public.seo_dashboard_views(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_email VARCHAR(255), -- for external sharing
  share_token VARCHAR(255) UNIQUE, -- for generating public links
  access_level VARCHAR(50) DEFAULT 'view', -- view, edit, comment, manage
  expires_at TIMESTAMP WITH TIME ZONE,
  can_export BOOLEAN DEFAULT TRUE,
  can_share BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for annotations and comments
CREATE TABLE IF NOT EXISTS seo_dashboard_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  dashboard_view_id UUID NOT NULL REFERENCES public.seo_dashboard_views(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  annotation_type VARCHAR(50) NOT NULL, -- comment, highlight, issue, insight
  position_x NUMERIC, -- x coordinate on dashboard
  position_y NUMERIC, -- y coordinate
  content TEXT NOT NULL,
  metadata JSONB, -- additional data (color, icon, etc)
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  pinned_until TIMESTAMP WITH TIME ZONE, -- keep visible until date
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for dashboard activity log
CREATE TABLE IF NOT EXISTS seo_dashboard_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL, -- view_opened, metric_changed, annotation_added, export_shared
  dashboard_view_id UUID REFERENCES public.seo_dashboard_views(id) ON DELETE SET NULL,
  activity_details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for dashboard alerts and notifications
CREATE TABLE IF NOT EXISTS seo_dashboard_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL, -- new_annotation, shared_dashboard, alert_triggered, comment_reply
  related_resource_id UUID, -- link to dashboard, annotation, etc
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  action_url VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all collaboration tables
ALTER TABLE seo_dashboard_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_dashboard_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_dashboard_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_dashboard_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_dashboard_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for dashboard views
CREATE POLICY seo_dashboard_views_read ON public.seo_dashboard_views
  FOR SELECT
  USING (
    (created_by = auth.uid()) OR
    (is_public_to_team AND public.is_tenant_member(tenant_id)) OR
    (is_default AND public.is_tenant_member(tenant_id))
  );

CREATE POLICY seo_dashboard_views_create ON public.seo_dashboard_views
  FOR INSERT
  WITH CHECK (
    public.is_tenant_member(tenant_id) AND
    created_by = auth.uid()
  );

CREATE POLICY seo_dashboard_views_update ON public.seo_dashboard_views
  FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY seo_dashboard_views_delete ON public.seo_dashboard_views
  FOR DELETE
  USING (
    created_by = auth.uid() OR
    (
      public.is_tenant_member(tenant_id) AND
      EXISTS (
        SELECT 1 FROM public.team_members
        WHERE team_members.user_id = auth.uid()
        AND team_members.tenant_id = seo_dashboard_views.tenant_id
        AND team_members.role IN ('admin', 'owner')
      )
    )
  );

-- RLS Policies for shares
CREATE POLICY seo_dashboard_shares_read ON public.seo_dashboard_shares
  FOR SELECT
  USING (
    (shared_by = auth.uid()) OR
    (shared_with_user_id = auth.uid()) OR
    (shared_with_email = (SELECT email FROM auth.users WHERE id = auth.uid())) OR
    (public.is_tenant_member(tenant_id))
  );

CREATE POLICY seo_dashboard_shares_insert ON public.seo_dashboard_shares
  FOR INSERT
  WITH CHECK (
    public.is_tenant_member(tenant_id) AND
    shared_by = auth.uid()
  );

-- RLS Policies for annotations
CREATE POLICY seo_dashboard_annotations_read ON public.seo_dashboard_annotations
  FOR SELECT
  USING (
    public.is_tenant_member(tenant_id) AND
    (
      (created_by = auth.uid()) OR
      EXISTS (
        SELECT 1 FROM seo_dashboard_shares
        WHERE seo_dashboard_shares.dashboard_view_id = seo_dashboard_annotations.dashboard_view_id
        AND seo_dashboard_shares.access_level IN ('comment', 'edit', 'manage')
      ) OR
      EXISTS (
        SELECT 1 FROM seo_dashboard_views
        WHERE seo_dashboard_views.id = seo_dashboard_annotations.dashboard_view_id
        AND seo_dashboard_views.is_public_to_team = TRUE
      )
    )
  );

CREATE POLICY seo_dashboard_annotations_insert ON public.seo_dashboard_annotations
  FOR INSERT
  WITH CHECK (
    public.is_tenant_member(tenant_id) AND
    created_by = auth.uid()
  );

-- RLS Policies for activity
CREATE POLICY seo_dashboard_activity_read ON public.seo_dashboard_activity
  FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY seo_dashboard_activity_insert ON public.seo_dashboard_activity
  FOR INSERT
  WITH CHECK (
    public.is_tenant_member(tenant_id) AND
    user_id = auth.uid()
  );

-- RLS Policies for notifications
CREATE POLICY seo_dashboard_notifications_read ON public.seo_dashboard_notifications
  FOR SELECT
  USING (recipient_user_id = auth.uid());

CREATE POLICY seo_dashboard_notifications_update ON public.seo_dashboard_notifications
  FOR UPDATE
  USING (recipient_user_id = auth.uid())
  WITH CHECK (recipient_user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX idx_dashboard_views_tenant ON public.seo_dashboard_views(tenant_id);
CREATE INDEX idx_dashboard_views_created_by ON public.seo_dashboard_views(created_by);
CREATE INDEX idx_dashboard_views_is_default ON public.seo_dashboard_views(is_default) WHERE is_default = TRUE;
CREATE INDEX idx_dashboard_views_public ON public.seo_dashboard_views(is_public_to_team) WHERE is_public_to_team = TRUE;

CREATE INDEX idx_dashboard_shares_token ON public.seo_dashboard_shares(share_token);
CREATE INDEX idx_dashboard_shares_user ON public.seo_dashboard_shares(shared_with_user_id);
CREATE INDEX idx_dashboard_shares_view ON public.seo_dashboard_shares(dashboard_view_id);
CREATE INDEX idx_dashboard_shares_expires ON public.seo_dashboard_shares(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX idx_dashboard_annotations_view ON public.seo_dashboard_annotations(dashboard_view_id, created_at DESC);
CREATE INDEX idx_dashboard_annotations_unresolved ON public.seo_dashboard_annotations(is_resolved) WHERE is_resolved = FALSE;

CREATE INDEX idx_dashboard_activity_tenant_created ON public.seo_dashboard_activity(tenant_id, created_at DESC);
CREATE INDEX idx_dashboard_activity_user ON public.seo_dashboard_activity(user_id);
CREATE INDEX idx_dashboard_activity_type ON public.seo_dashboard_activity(activity_type);

CREATE INDEX idx_dashboard_notifications_user_read ON public.seo_dashboard_notifications(recipient_user_id, is_read);
CREATE INDEX idx_dashboard_notifications_created ON public.seo_dashboard_notifications(created_at DESC);

-- Create function to log dashboard activity
CREATE OR REPLACE FUNCTION log_dashboard_activity(
  p_tenant_id UUID,
  p_user_id UUID,
  p_activity_type VARCHAR,
  p_dashboard_view_id UUID DEFAULT NULL,
  p_activity_details JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_activity_id UUID;
BEGIN
  INSERT INTO seo_dashboard_activity (
    tenant_id, user_id, activity_type, dashboard_view_id, activity_details
  )
  VALUES (p_tenant_id, p_user_id, p_activity_type, p_dashboard_view_id, p_activity_details)
  RETURNING id INTO v_activity_id;

  RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to notify users of dashboard activity
CREATE OR REPLACE FUNCTION notify_dashboard_activity(
  p_tenant_id UUID,
  p_activity_type VARCHAR,
  p_user_id UUID,
  p_title VARCHAR,
  p_message VARCHAR,
  p_resource_id UUID DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  -- Insert notifications for all team members
  INSERT INTO seo_dashboard_notifications (
    tenant_id, recipient_user_id, notification_type,
    related_resource_id, title, message
  )
  SELECT
    p_tenant_id,
    tm.user_id,
    p_activity_type,
    p_resource_id,
    p_title,
    p_message
  FROM public.team_members tm
  WHERE tm.tenant_id = p_tenant_id
    AND tm.user_id != p_user_id
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create view for dashboard activity summary
CREATE OR REPLACE VIEW seo_dashboard_activity_summary AS
SELECT
  dv.id AS view_id,
  dv.view_name,
  COUNT(*) AS total_views,
  COUNT(DISTINCT da.user_id) AS unique_viewers,
  MAX(da.created_at) AS last_accessed,
  COUNT(CASE WHEN da.activity_type = 'export_shared' THEN 1 END) AS export_count,
  COUNT(CASE WHEN da.activity_type = 'annotation_added' THEN 1 END) AS annotation_count
FROM seo_dashboard_views dv
LEFT JOIN seo_dashboard_activity da ON dv.id = da.dashboard_view_id
GROUP BY dv.id, dv.view_name;

-- Create view for unread notifications
CREATE OR REPLACE VIEW seo_dashboard_unread_notifications AS
SELECT
  id,
  recipient_user_id,
  notification_type,
  title,
  message,
  created_at,
  (NOW() AT TIME ZONE 'UTC' - created_at) AS age
FROM seo_dashboard_notifications
WHERE is_read = FALSE
  AND is_archived = FALSE
ORDER BY created_at DESC;

-- Create trigger to log view access
CREATE OR REPLACE FUNCTION log_dashboard_view_access()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_dashboard_activity(
    NEW.tenant_id,
    auth.uid(),
    'view_opened',
    NEW.id,
    jsonb_build_object('view_name', NEW.view_name)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for annotation notifications
CREATE OR REPLACE FUNCTION notify_on_annotation()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM notify_dashboard_activity(
    NEW.tenant_id,
    'new_annotation',
    NEW.created_by,
    'Neue Anmerkung',
    'Eine neue Anmerkung wurde zu einem Dasboard hinzugefügt',
    NEW.id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER annotation_notification_trigger AFTER INSERT ON public.seo_dashboard_annotations
FOR EACH ROW EXECUTE FUNCTION notify_on_annotation();
