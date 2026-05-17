-- OutputAgent — notification fan-out layer.
--
-- Closes the observability loop:
--   MonitoringAgent emits agent_observations  →
--   OutputAgent delivers them via configured channels (Slack/email/
--   webhook/in_app) and records every attempt in an append-only log.
--
-- Spec §15 hard safety:
--   - NEVER modifies the source observation/task/decision.
--   - NEVER auto-acknowledges an observation.
--   - Failed deliveries do NOT auto-retry — humans must trigger retry.
--   - Every delivery produces a deliveries row (full audit).
--   - Per-channel rate limit (defaults to 20/h) to prevent runaway.
--
-- Storage: 2 tables. Channels are mutable config; deliveries are
-- append-only.

BEGIN;

-- ── 1. output_agent_channels ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.output_agent_channels (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  name                TEXT NOT NULL,
  kind                TEXT NOT NULL
                        CHECK (kind IN ('slack','email','webhook','in_app')),

  -- Channel-specific configuration. Examples:
  --   slack:   { webhook_url, default_channel }
  --   email:   { to, from, subject_prefix }
  --   webhook: { url, secret_header_name, secret_value }
  --   in_app:  { recipient_user_ids: [] }
  -- Webhook + Slack URLs are PII-adjacent; store as jsonb so we can
  -- redact in audit displays. Never log the full URL — only the host.
  config              JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Minimum observation severity to route through this channel.
  min_severity        TEXT NOT NULL DEFAULT 'high'
                        CHECK (min_severity IN ('info','low','medium','high','critical')),

  -- Rate limit per hour. Default 20.
  rate_limit_per_hour INT NOT NULL DEFAULT 20
                        CHECK (rate_limit_per_hour > 0 AND rate_limit_per_hour <= 1000),

  enabled             BOOLEAN NOT NULL DEFAULT TRUE,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT output_agent_channels_tenant_name_unique UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS output_agent_channels_tenant_enabled_idx
  ON public.output_agent_channels(tenant_id, enabled);

-- ── 2. output_agent_deliveries ───────────────────────────────────
-- Append-only log. One row per delivery attempt.

CREATE TABLE IF NOT EXISTS public.output_agent_deliveries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id          UUID NOT NULL REFERENCES public.output_agent_channels(id) ON DELETE CASCADE,
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  observation_id      UUID REFERENCES public.agent_observations(id) ON DELETE SET NULL,

  -- Snapshot for replay even if the source observation is deleted.
  severity            TEXT NOT NULL,
  title               TEXT NOT NULL,
  detail              TEXT,

  status              TEXT NOT NULL
                        CHECK (status IN ('delivered','failed','rate_limited','skipped_severity')),
  attempt             INT NOT NULL DEFAULT 1 CHECK (attempt >= 1),
  error_message       TEXT,
  response_code       INT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS output_agent_deliveries_channel_idx
  ON public.output_agent_deliveries(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS output_agent_deliveries_tenant_status_idx
  ON public.output_agent_deliveries(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS output_agent_deliveries_observation_idx
  ON public.output_agent_deliveries(observation_id) WHERE observation_id IS NOT NULL;

-- ── updated_at trigger ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.output_agent_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS output_agent_channels_set_updated_at ON public.output_agent_channels;
CREATE TRIGGER output_agent_channels_set_updated_at
  BEFORE UPDATE ON public.output_agent_channels
  FOR EACH ROW EXECUTE FUNCTION public.output_agent_set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────

ALTER TABLE public.output_agent_channels   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.output_agent_deliveries ENABLE ROW LEVEL SECURITY;

-- Members SELECT both. Channels: owners+admins write. Deliveries:
-- insert-only (no UPDATE / DELETE policy — agent writes via
-- service_role; humans only read).
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['output_agent_channels','output_agent_deliveries']) LOOP
    EXECUTE format($f$
      DROP POLICY IF EXISTS %1$s_member_select ON public.%1$s;
      CREATE POLICY %1$s_member_select ON public.%1$s
        FOR SELECT TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.memberships m
            WHERE m.tenant_id = %1$s.tenant_id
              AND m.user_id   = auth.uid()
          )
        );
    $f$, t);
  END LOOP;
END $$;

-- Channels: owner + admin can ALL (insert/update/delete config).
DROP POLICY IF EXISTS output_agent_channels_admin_write ON public.output_agent_channels;
CREATE POLICY output_agent_channels_admin_write ON public.output_agent_channels
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.memberships m
            WHERE m.tenant_id = output_agent_channels.tenant_id
              AND m.user_id   = auth.uid()
              AND m.role IN ('owner','admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.memberships m
            WHERE m.tenant_id = output_agent_channels.tenant_id
              AND m.user_id   = auth.uid()
              AND m.role IN ('owner','admin'))
  );

COMMIT;
