-- Sub-Processor-Change-Notification-System (Art. 28 Abs. 2 DSGVO).
--
-- Auftragsverarbeiter müssen Verantwortliche 30 Tage vorab über
-- Sub-Processor-Änderungen informieren. Dieses Schema:
--
-- 1. sub_processor_subscriptions — Tenants/Kunden, die Notifications wollen
-- 2. sub_processor_changes        — geplante / vollzogene Änderungen
-- 3. sub_processor_notifications  — wer wurde wann benachrichtigt (Audit-Trail)

-- 1. Subscription-Tabelle
create table if not exists public.sub_processor_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  email           text not null,
  tenant_id       uuid,                              -- nullable: auch nicht-tenant Kunden
  company         text,
  verified_at     timestamptz,
  unsubscribed_at timestamptz,
  unsub_token     uuid not null unique default gen_random_uuid(),
  created_at      timestamptz not null default now()
);

create unique index if not exists idx_sp_sub_email_active
  on public.sub_processor_subscriptions (lower(email))
  where unsubscribed_at is null;

create index if not exists idx_sp_sub_verified
  on public.sub_processor_subscriptions (verified_at)
  where unsubscribed_at is null;

-- 2. Changes-Tabelle (Audit-Log + Notification-Schedule)
create table if not exists public.sub_processor_changes (
  id              uuid primary key default gen_random_uuid(),
  change_type     text not null
    check (change_type in ('added', 'removed', 'replaced', 'region_changed', 'purpose_changed')),
  processor_name  text not null,
  processor_purpose text,
  processor_region text,
  processor_dpa_url text,
  description     text not null,                    -- human-readable change summary
  effective_from  timestamptz not null,             -- wann tritt die Änderung wirksam in Kraft
  notify_at       timestamptz not null,             -- wann sollen Notifications versendet werden (= effective_from - 30d)
  notified_at     timestamptz,                      -- wann tatsächlich versendet
  created_by      uuid,                             -- super_admin who initiated
  created_at      timestamptz not null default now()
);

create index if not exists idx_sp_changes_notify
  on public.sub_processor_changes (notify_at)
  where notified_at is null;

create index if not exists idx_sp_changes_effective
  on public.sub_processor_changes (effective_from desc);

-- 3. Notifications-Audit-Trail (immutable per trigger)
create table if not exists public.sub_processor_notifications (
  id              uuid primary key default gen_random_uuid(),
  change_id       uuid not null references public.sub_processor_changes(id) on delete cascade,
  subscription_id uuid not null references public.sub_processor_subscriptions(id) on delete cascade,
  email           text not null,
  sent_at         timestamptz not null default now(),
  resend_message_id text,
  error_message   text,
  unique(change_id, subscription_id)
);

create index if not exists idx_sp_notif_change on public.sub_processor_notifications(change_id);
create index if not exists idx_sp_notif_sent on public.sub_processor_notifications(sent_at desc);

-- Append-only Trigger
create or replace function public.sp_notif_block_modification()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  raise exception 'sub_processor_notifications is append-only';
end;
$$;

drop trigger if exists trg_sp_notif_no_update on public.sub_processor_notifications;
create trigger trg_sp_notif_no_update
  before update or delete on public.sub_processor_notifications
  for each row execute function public.sp_notif_block_modification();

-- 4. RLS
alter table public.sub_processor_subscriptions enable row level security;
alter table public.sub_processor_changes enable row level security;
alter table public.sub_processor_notifications enable row level security;

-- Subscriptions: anyone can subscribe (insert), only service-role + owner read
drop policy if exists "sp_sub_anon_insert" on public.sub_processor_subscriptions;
create policy "sp_sub_anon_insert"
  on public.sub_processor_subscriptions for insert
  to anon, authenticated
  with check (true);

drop policy if exists "sp_sub_service_all" on public.sub_processor_subscriptions;
create policy "sp_sub_service_all"
  on public.sub_processor_subscriptions for all
  to service_role using (true) with check (true);

-- Changes: nur super_admin schreibt, alle authenticated lesen (Transparenz)
drop policy if exists "sp_changes_authenticated_read" on public.sub_processor_changes;
create policy "sp_changes_authenticated_read"
  on public.sub_processor_changes for select
  to authenticated using (true);

drop policy if exists "sp_changes_service_write" on public.sub_processor_changes;
create policy "sp_changes_service_write"
  on public.sub_processor_changes for all
  to service_role using (true) with check (true);

-- Notifications: nur service-role
drop policy if exists "sp_notif_service_all" on public.sub_processor_notifications;
create policy "sp_notif_service_all"
  on public.sub_processor_notifications for all
  to service_role using (true) with check (true);

-- 5. Helper: pending changes (notify_at <= now AND not yet notified)
create or replace function public.sub_processor_changes_pending()
returns table (
  id uuid, change_type text, processor_name text, description text,
  effective_from timestamptz, notify_at timestamptz
)
language sql security definer set search_path = public, pg_catalog as $$
  select id, change_type, processor_name, description, effective_from, notify_at
    from public.sub_processor_changes
   where notified_at is null
     and notify_at <= now()
   order by notify_at asc;
$$;

revoke all on function public.sub_processor_changes_pending() from public;
grant execute on function public.sub_processor_changes_pending() to service_role;

-- 6. Helper: mark change as notified
create or replace function public.sub_processor_change_mark_notified(p_id uuid)
returns void language sql security definer set search_path = public, pg_catalog as $$
  update public.sub_processor_changes set notified_at = now() where id = p_id;
$$;

revoke all on function public.sub_processor_change_mark_notified(uuid) from public;
grant execute on function public.sub_processor_change_mark_notified(uuid) to service_role;

-- 7. Cron-Schedule: täglich 08:00 UTC ruft sub-processor-notify Edge Function auf
do $cron_setup$
declare
  v_supabase_url text;
  v_anon_key text;
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'cron') then
    raise notice 'cron schema unavailable — skipping schedule';
    return;
  end if;

  v_supabase_url := current_setting('app.supabase_url', true);
  v_anon_key := current_setting('app.supabase_service_key', true);

  if v_supabase_url is null or v_supabase_url = '' then
    raise notice 'app.supabase_url GUC not set — skipping cron';
    return;
  end if;

  perform cron.schedule(
    'sub-processor-notify-daily',
    '0 8 * * *',
    format($schedule$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object('Authorization', %L, 'Content-Type', 'application/json'),
        body := '{}'::jsonb
      );
    $schedule$, v_supabase_url || '/functions/v1/sub-processor-notify', 'Bearer ' || v_anon_key)
  );
end
$cron_setup$;

comment on table public.sub_processor_subscriptions is
  'Sub-Processor-Change-Notification-Subscribers (Art. 28 Abs. 2 DSGVO). Email-only oder Tenant-bound.';
comment on table public.sub_processor_changes is
  'Geplante/vollzogene Sub-Processor-Änderungen. notify_at = effective_from - 30 Tage.';
