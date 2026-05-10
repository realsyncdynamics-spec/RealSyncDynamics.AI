-- AI Runtime Telemetry — Event-Schema fuer den Datenmoat.
--
-- Empfaengt Events von:
--   - Browser-Extension (geplant Folge-PR: ChatGPT/Claude/Copilot/Gemini-UI-Detection)
--   - SDK trackAiEvent() (siehe src/sdk/telemetry.ts)
--   - Agent-Connectors (geplant Folge-PR: n8n / Make / OpenAI / Anthropic Wrapper)
--
-- Pro Event landet 1 Row in ai_runtime_events. High-/Critical-Risiko und
-- Policy-Verletzungen erzeugen zusaetzlich einen ai_evidence_events-Eintrag
-- (siehe edge function telemetry-ai-event).
--
-- RLS aktiv, default-deny — Service-Role only bis Auth-Gating greift.

create table if not exists ai_runtime_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  ai_system_id uuid references ai_systems(id) on delete set null,

  -- Wer + Womit
  vendor text,                 -- 'openai' | 'anthropic' | 'google' | 'microsoft' | ...
  model text,                  -- 'gpt-4.1' | 'claude-opus-4-7' | 'gemini-2.5' | ...
  user_id text,                -- internal-user-ref (kein PII direkt)
  team text,                   -- 'engineering' | 'support' | 'hr' | ...

  -- Was passiert ist
  event_type text not null check (event_type in (
    'prompt_sent', 'response_received', 'agent_action',
    'file_upload', 'tool_call', 'session_start', 'session_end'
  )),
  prompt_category text check (prompt_category in (
    'code_generation', 'content_generation', 'classification',
    'summarization', 'translation', 'extraction', 'agent_action',
    'analysis', 'qa', 'unknown'
  )) default 'unknown',
  data_class text check (data_class in (
    'public', 'internal', 'confidential', 'personal_data', 'special_category'
  )) default 'unknown',

  -- Wie kritisch
  risk_level text not null check (risk_level in (
    'info', 'low', 'medium', 'high', 'critical'
  )) default 'info',
  policy_status text check (policy_status in (
    'allowed', 'warned', 'blocked', 'requires_approval', 'logged'
  )) default 'logged',
  policy_id uuid references ai_policies(id) on delete set null,

  -- Mess-Werte (optional)
  prompt_tokens int,
  response_tokens int,
  latency_ms int,

  -- Strukturierter Kontext fuer Policy-Eval + Audit-Trail
  metadata jsonb default '{}',

  occurred_at timestamptz default now(),
  created_at timestamptz default now()
);

alter table ai_runtime_events enable row level security;

-- Indexes fuer typische Dashboard-Queries
create index if not exists ai_runtime_events_tenant_idx
  on ai_runtime_events (tenant_id, occurred_at desc);

create index if not exists ai_runtime_events_ai_system_idx
  on ai_runtime_events (ai_system_id);

create index if not exists ai_runtime_events_vendor_idx
  on ai_runtime_events (tenant_id, vendor, occurred_at desc);

create index if not exists ai_runtime_events_risk_idx
  on ai_runtime_events (tenant_id, risk_level, occurred_at desc)
  where risk_level in ('high', 'critical');

create index if not exists ai_runtime_events_policy_status_idx
  on ai_runtime_events (tenant_id, policy_status, occurred_at desc)
  where policy_status in ('warned', 'blocked', 'requires_approval');
