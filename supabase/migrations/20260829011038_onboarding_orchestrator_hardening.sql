-- Nachgezogen am 2026-08-30 aus dem Produktions-Ledger.
--
-- WARUM DIESE DATEI NACHTRÄGLICH ENTSTEHT
--
-- Angewandt am 2026-08-29 um 01:10 UTC direkt gegen Produktion, verbucht als
-- `20260829011038`, ohne Datei im Repo. Sie gehört zur Edge Function
-- `onboarding-orchestrator`, die im selben Zeitfenster (01:06–01:17 UTC)
-- deployt wurde und ihrerseits keinen Quellcode im Repo hat — siehe die
-- Messung in CLAUDE.md §5.
--
-- Inhalt wortgleich aus `supabase_migrations.schema_migrations` übernommen.
-- Version und Name entsprechen dem Ledger.
--
-- Zwei Teile: Tenant-Indizes für die Onboarding-Abfragen, und eine
-- SECURITY-DEFINER-Funktion, die einem Tenant Policy Packs nach Branche
-- zuweist. Die Funktion prüft die Mitgliedschaft selbst (`FORBIDDEN`, wenn
-- der Nutzer nicht zum Tenant gehört) und entzieht `public` anschließend
-- jedes Ausführungsrecht — sie umgeht RLS, ist aber nicht frei aufrufbar.

create index if not exists idx_company_profiles_tenant_id on public.company_profiles(tenant_id);
create index if not exists idx_ai_systems_tenant_id on public.ai_systems(tenant_id);
create index if not exists idx_bots_tenant_id on public.bots(tenant_id);
create index if not exists idx_agent_kb_tenant_id on public.agent_knowledge_base(tenant_id);
create index if not exists idx_policy_pack_activations_tenant_id on public.policy_pack_activations(tenant_id);
create index if not exists idx_inventory_audit_events_tenant_id_occurred_at on public.inventory_audit_events(tenant_id, occurred_at desc);
create index if not exists idx_enterprise_ai_audit_events_tenant_id_created_at on public.enterprise_ai_audit_events(tenant_id, created_at desc);
create index if not exists idx_governance_audit_log_tenant_id_created_at on public.governance_audit_log(tenant_id, created_at desc);
create index if not exists idx_agent_configuration_tenant_id on public.agent_configuration(tenant_id);

create or replace function public.onboarding_tenant_policy_packs(p_tenant_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_industry text;
  v_pack text;
  v_packs text[] := array['dsgvo-essentials','iso-27001-foundation'];
  v_result jsonb := '[]'::jsonb;
begin
  if not exists (select 1 from memberships where tenant_id=p_tenant_id and user_id=p_user_id) then
    raise exception 'FORBIDDEN';
  end if;
  select coalesce(industry,'all') into v_industry from tenants where id=p_tenant_id;
  if v_industry in ('healthcare','ai') then v_packs := v_packs || 'eu-ai-act-high-risk'; end if;
  if v_industry in ('critical-infrastructure','public_sector') then v_packs := v_packs || 'nis2-cybersecurity'; end if;
  if v_industry='automotive' then v_packs := v_packs || 'tisax-automotive'; end if;
  if v_industry='fintech' then v_packs := v_packs || 'fintech-compliance'; end if;
  foreach v_pack in array v_packs loop
    if exists(select 1 from policy_pack_catalog where id=v_pack) then
      insert into policy_pack_activations(tenant_id,pack_id,activated_at,created_by)
      values(p_tenant_id,v_pack,now(),p_user_id)
      on conflict do nothing;
      v_result := v_result || jsonb_build_array(v_pack);
    end if;
  end loop;
  return v_result;
end $$;

revoke all on function public.onboarding_tenant_policy_packs(uuid,uuid) from public;
