-- Audit-Email-Drip-Flow (Phase D.2 nach STRIPE+EMAIL-Strategie).
--
-- Track-Tabelle für Drip-Sequenz nach Audit-Lead-Capture:
--   step 0 — sofort: gdpr-audit löst audit-report-email aus (existing flow)
--   step 1 — Tag 3:  Welcome + Methodik-Walkthrough-Angebot
--   step 2 — Tag 14: Re-Audit-Reminder + Score-Drift-Check
--   step 3 — Tag 30: Pricing-Upsell für Pro-Tier (Audit-Pro 499€)
--
-- audit-drip-cron Edge Function läuft täglich 09:00 UTC und sendet alle
-- fälligen Drip-Mails via Resend.

-- 1. Drip-Tracking-Tabelle
create table if not exists public.audit_email_drip (
  id              uuid primary key default gen_random_uuid(),
  audit_id        uuid references public.gdpr_audits(id) on delete cascade,
  email           text not null,
  current_step    int not null default 0,
  next_send_at    timestamptz,
  unsubscribed    boolean not null default false,
  unsubscribe_token uuid not null default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_sent_step  int,
  last_sent_at    timestamptz,
  last_error      text
);

create index if not exists idx_audit_drip_due
  on public.audit_email_drip (next_send_at)
  where unsubscribed = false and next_send_at is not null;

create index if not exists idx_audit_drip_email on public.audit_email_drip(email);
create unique index if not exists idx_audit_drip_unsubscribe
  on public.audit_email_drip(unsubscribe_token);

-- 2. RLS — Tenant nicht zugehörig (Public-Audits ohne Account), nur
-- service-role schreibt; Auswahl per audit_id für Owner-Selfservice
alter table public.audit_email_drip enable row level security;

drop policy if exists "drip_service_all" on public.audit_email_drip;
create policy "drip_service_all"
  on public.audit_email_drip for all
  to service_role
  using (true)
  with check (true);

-- 3. Auto-insert: bei neuem gdpr_audit → drip-row anlegen
create or replace function public.audit_email_drip_create_for_audit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  -- Skip wenn email leer (sollte nicht vorkommen, defensiv)
  if NEW.email is null or NEW.email = '' then
    return NEW;
  end if;

  -- Skip wenn schon ein nicht-unsubscribed drip für diese email + audit existiert
  if exists (
    select 1 from public.audit_email_drip
     where email = NEW.email and audit_id = NEW.id
  ) then
    return NEW;
  end if;

  insert into public.audit_email_drip (audit_id, email, current_step, next_send_at)
  values (NEW.id, NEW.email, 0, now() + interval '3 days');

  return NEW;
end;
$$;

drop trigger if exists trg_audit_create_drip on public.gdpr_audits;
create trigger trg_audit_create_drip
  after insert on public.gdpr_audits
  for each row execute function public.audit_email_drip_create_for_audit();

-- 4. Hilfsfunktion: nächste 50 fälligen Drip-Rows holen
create or replace function public.audit_email_drip_due(p_limit int default 50)
returns table (
  id uuid, audit_id uuid, email text, current_step int, unsubscribe_token uuid
)
language sql
security definer
set search_path = public, pg_catalog
as $$
  select id, audit_id, email, current_step, unsubscribe_token
    from public.audit_email_drip
   where unsubscribed = false
     and next_send_at is not null
     and next_send_at <= now()
     and current_step < 3
   order by next_send_at asc
   limit p_limit;
$$;

revoke all on function public.audit_email_drip_due(int) from public;
grant execute on function public.audit_email_drip_due(int) to service_role;

-- 5. Hilfsfunktion: Drip-Step als gesendet markieren + nächsten planen
create or replace function public.audit_email_drip_advance(
  p_id uuid,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_current int;
  v_next_offset interval;
begin
  select current_step into v_current
    from public.audit_email_drip where id = p_id;

  if v_current is null then return; end if;

  -- Bei Fehler: error speichern, NICHT advancen (cron retried morgen)
  if p_error is not null then
    update public.audit_email_drip
       set last_error = p_error, updated_at = now()
     where id = p_id;
    return;
  end if;

  -- Nächster Step: 0→1 nach 3d, 1→2 nach 14d total (=11d von step 1),
  -- 2→3 nach 30d total (=16d von step 2). Step 3 = Final, kein next_send.
  v_next_offset := case v_current
    when 0 then interval '11 days'
    when 1 then interval '16 days'
    else null
  end;

  update public.audit_email_drip
     set current_step = v_current + 1,
         last_sent_step = v_current + 1,
         last_sent_at = now(),
         updated_at = now(),
         last_error = null,
         next_send_at = case
           when v_current + 1 < 3 then now() + v_next_offset
           else null
         end
   where id = p_id;
end;
$$;

revoke all on function public.audit_email_drip_advance(uuid, text) from public;
grant execute on function public.audit_email_drip_advance(uuid, text) to service_role;

-- 6. Cron-Schedule: täglich 09:00 UTC ruft audit-drip-cron Edge Function auf
do $cron_setup$
declare
  v_supabase_url text;
  v_anon_key text;
begin
  -- Skip wenn cron-Schema nicht da (CI-Stub)
  if not exists (select 1 from information_schema.schemata where schema_name = 'cron') then
    raise notice 'cron schema unavailable — skipping schedule';
    return;
  end if;

  v_supabase_url := current_setting('app.supabase_url', true);
  v_anon_key := current_setting('app.supabase_service_key', true);

  if v_supabase_url is null or v_supabase_url = '' then
    raise notice 'app.supabase_url GUC not set — skipping cron (set in Supabase project later)';
    return;
  end if;

  perform cron.schedule(
    'audit-email-drip-daily',
    '0 9 * * *',
    format($schedule$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object('Authorization', %L, 'Content-Type', 'application/json'),
        body := '{}'::jsonb
      );
    $schedule$, v_supabase_url || '/functions/v1/audit-drip-cron', 'Bearer ' || v_anon_key)
  );
end
$cron_setup$;

comment on table public.audit_email_drip is
  'Audit-Email-Drip-Flow (Phase D.2): 3-Step-Sequence (Tag 3 / 14 / 30) nach gdpr_audit-Erstellung. Cron audit-email-drip-daily um 09:00 UTC.';
