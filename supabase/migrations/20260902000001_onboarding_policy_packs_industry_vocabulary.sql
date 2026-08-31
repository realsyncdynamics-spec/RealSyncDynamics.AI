-- ═══════════════════════════════════════════════════════════════════════════
--  onboarding_tenant_policy_packs — Branchen-Vokabular angleichen
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WARUM: `tenants.industry` hat zwei Leser, und sie sprechen nicht dieselbe
-- Sprache.
--
--   Schreiber   supabase/functions/onboarding-orchestrator  industryOf()
--   Leser A     src/lib/policy-packs/recommend.ts           TENANT_INDUSTRY_OPTIONS
--   Leser B     diese Funktion (aus 20260829011038)
--
-- Leser A ist die dokumentierte Optionsliste; der Schreiber richtet sich nach
-- ihr. Leser B prüft dagegen auf zwei Werte, die dort gar nicht vorkommen:
--
--   Funktion prüft      geschrieben wird     Folge
--   'healthcare'        'health'             eu-ai-act-high-risk greift nie
--   'public_sector'     'public-sector'      nis2-cybersecurity greift nie
--
-- Beide Packs existieren im Katalog und wären aktivierbar — die Bedingung
-- trifft nur nie zu. Es schlägt nichts fehl, es passiert bloß nichts: genau
-- die Sorte Fehler, die ohne Test unbemerkt bleibt.
--
-- COMPLIANCE-BEZUG: Das sind keine beliebigen Packs. Ein Gesundheitsmandant
-- verliert damit still die EU-AI-Act-Hochrisiko-Vorlage, ein öffentlicher
-- Auftraggeber die NIS2-Vorlage. Der Mandant sieht keinen Fehler, sondern
-- ein Onboarding, das ihm diese Pflichten schlicht nie vorgeschlagen hat.
--
-- WAHL DER RICHTUNG: korrigiert wird die Funktion, nicht der Schreiber.
-- 'health' und 'public-sector' stehen in TENANT_INDUSTRY_OPTIONS und werden
-- vom TypeScript-Empfehlungspfad ausgewertet; würde der Schreiber auf die
-- Werte der Funktion umgestellt, fiele stattdessen dieser Pfad aus.
--
-- BESTANDSDATEN: keine. Gemessen am 2026-08-31 gegen das Live-Projekt —
-- `tenants.industry` trägt 4× NULL und 1× 'generic'; kein Mandant führt einen
-- der vier betroffenen Werte. Die Änderung schreibt nichts um.
--
-- Additiv: nur die beiden IN-Listen ändern sich, Signatur, Rechte und
-- Membership-Prüfung bleiben unangetastet.

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
  -- Mandantentrennung: SECURITY DEFINER umgeht RLS, deshalb wird die
  -- Mitgliedschaft hier ausdrücklich geprüft, bevor irgendetwas passiert.
  if not exists (select 1 from memberships where tenant_id=p_tenant_id and user_id=p_user_id) then
    raise exception 'FORBIDDEN';
  end if;
  select coalesce(industry,'all') into v_industry from tenants where id=p_tenant_id;
  -- Die Literale folgen TENANT_INDUSTRY_OPTIONS (src/lib/policy-packs/recommend.ts).
  -- Wer sie hier ändert, ändert sie dort mit — sonst greift die Regel wieder ins Leere.
  if v_industry in ('health','ai') then v_packs := v_packs || 'eu-ai-act-high-risk'; end if;
  if v_industry in ('critical-infrastructure','public-sector') then v_packs := v_packs || 'nis2-cybersecurity'; end if;
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
