-- Seed-Migration: 3 globale Demo-Policies, die das Verhalten der
-- Policy-Engine (siehe supabase/functions/_shared/policy-engine.ts)
-- exemplarisch zeigen.
--
-- tenant_id = NULL bedeutet "global" — die Policies gelten fuer alle
-- Tenants, bis ein Tenant eigene anlegt. So funktioniert das System aus
-- der Box; Customizing ist optional, nicht zwingend.
--
-- Auf Production kann ein Operator diese Demo-Policies nach Belieben
-- deaktivieren (UPDATE ai_policies SET enabled=false WHERE id=...).

-- Policy 1: Keine personenbezogenen Daten an externe LLMs.
-- Wirkt wie eine harte Schutzschicht gegen den klassischen DSGVO-Verstoss
-- "Mitarbeiter copy-pasted Bewerber-CV in ChatGPT".
insert into ai_policies (
  id, tenant_id, name, description, severity, rule_type, action, condition, enabled
) values (
  '00000000-0000-0000-0000-00000000a001',
  null,
  'Keine personenbezogenen Daten an externe LLMs',
  'Personenbezogene oder besonders kategorisierte Daten (Art. 9 DSGVO) duerfen nicht an OpenAI, Anthropic, Google oder Perplexity uebertragen werden.',
  'critical',
  'data_transfer',
  'block',
  '{"data_classes": ["personal_data", "special_category"], "to_external_vendor": true}'::jsonb,
  true
)
on conflict (id) do nothing;

-- Policy 2: Human Review fuer high-risk AI-Output.
-- Greift bei Events mit risk_level high/critical — z.B. AI-Klassifikation
-- in HR/Bonitaets-/Versicherungs-Kontexten.
insert into ai_policies (
  id, tenant_id, name, description, severity, rule_type, action, condition, enabled
) values (
  '00000000-0000-0000-0000-00000000a002',
  null,
  'Human Review fuer High-Risk AI-Output',
  'Bei high- oder critical-risk Events ist eine dokumentierte menschliche Pruefung erforderlich, bevor das AI-Ergebnis Wirkung entfaltet.',
  'high',
  'human_review',
  'require_approval',
  '{"risk_levels": ["high", "critical"]}'::jsonb,
  true
)
on conflict (id) do nothing;

-- Policy 3: Audit-Logging fuer Agent-Actions + Tool-Calls.
-- Greift bei agentischen Aktionen (Webhooks, externe API-Calls) damit die
-- Aktion in der Audit-Trail-Liste sichtbar wird. Action=warn weil das
-- Logging eh stattfindet — die Warnung macht das Event "sichtbar
-- ueberprueft" im Dashboard.
insert into ai_policies (
  id, tenant_id, name, description, severity, rule_type, action, condition, enabled
) values (
  '00000000-0000-0000-0000-00000000a003',
  null,
  'Audit-Log fuer Agent-Actions',
  'Agentische Aktionen (event_type=agent_action oder tool_call) werden im Evidence-Vault festgehalten und im Dashboard markiert.',
  'medium',
  'logging_required',
  'warn',
  '{"event_types": ["agent_action", "tool_call"]}'::jsonb,
  true
)
on conflict (id) do nothing;
