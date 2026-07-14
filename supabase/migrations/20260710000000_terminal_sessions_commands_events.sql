-- Phase 6: Agentic Terminal - Core Tables
-- Terminal sessions, commands, and sealed events

CREATE TABLE IF NOT EXISTS public.terminal_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_command_at TIMESTAMP WITH TIME ZONE,
  command_count INTEGER DEFAULT 0,
  current_context JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  CONSTRAINT terminal_sessions_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- RLS for terminal_sessions
ALTER TABLE public.terminal_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own terminal sessions"
  ON public.terminal_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create terminal sessions"
  ON public.terminal_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own terminal sessions"
  ON public.terminal_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX terminal_sessions_user_id_idx ON public.terminal_sessions(user_id);
CREATE INDEX terminal_sessions_tenant_id_idx ON public.terminal_sessions(tenant_id);
CREATE INDEX terminal_sessions_created_at_idx ON public.terminal_sessions(created_at DESC);

-- Terminal commands - logs all executed commands
CREATE TABLE IF NOT EXISTS public.terminal_commands (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.terminal_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  command TEXT NOT NULL,
  parsed_command JSONB,
  status TEXT CHECK (status IN ('pending', 'executing', 'success', 'error')) DEFAULT 'pending',
  result JSONB,
  error_message TEXT,
  executed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT terminal_commands_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- RLS for terminal_commands
ALTER TABLE public.terminal_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own terminal commands"
  ON public.terminal_commands
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create terminal commands"
  ON public.terminal_commands
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX terminal_commands_session_id_idx ON public.terminal_commands(session_id);
CREATE INDEX terminal_commands_user_id_idx ON public.terminal_commands(user_id);
CREATE INDEX terminal_commands_tenant_id_idx ON public.terminal_commands(tenant_id);
CREATE INDEX terminal_commands_status_idx ON public.terminal_commands(status);
CREATE INDEX terminal_commands_created_at_idx ON public.terminal_commands(created_at DESC);

-- Terminal events - links to Evidence-Chain with cryptographic sealing
CREATE TABLE IF NOT EXISTS public.terminal_events (
  id UUID PRIMARY KEY,
  terminal_command_id UUID REFERENCES public.terminal_commands(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_payload JSONB NOT NULL,
  event_hash VARCHAR(64) NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT terminal_events_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- RLS for terminal_events
ALTER TABLE public.terminal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own terminal events"
  ON public.terminal_events
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create terminal events"
  ON public.terminal_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX terminal_events_command_id_idx ON public.terminal_events(terminal_command_id);
CREATE INDEX terminal_events_tenant_id_idx ON public.terminal_events(tenant_id);
CREATE INDEX terminal_events_type_idx ON public.terminal_events(event_type);
CREATE INDEX terminal_events_user_id_idx ON public.terminal_events(user_id);
CREATE INDEX terminal_events_created_at_idx ON public.terminal_events(created_at DESC);
