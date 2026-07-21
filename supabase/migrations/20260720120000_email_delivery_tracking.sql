-- Email Delivery Tracking (Phase 3, Bounce/Delivery Feedback)
-- Captures bounce, delivery, and complaint events from email service providers.
-- Integrates with distribution_queue_entries for end-to-end delivery observability.

-- 1. Email Event Log (captures all events from email providers)
create table if not exists public.email_delivery_events (
  id                uuid primary key default gen_random_uuid(),
  queue_entry_id    uuid references public.distribution_queue_entries(id) on delete set null,
  tenant_id         uuid,
  external_id       text,                 -- Message ID from SendGrid/Mailgun/SES
  recipient         text not null,
  event_type        text not null         -- 'delivered', 'bounce', 'complaint', 'open', 'click', 'unsubscribe'
    check (event_type in ('delivered', 'bounce', 'complaint', 'open', 'click', 'unsubscribe', 'deferred')),
  bounce_type       text,                 -- 'permanent' | 'temporary' | null
  bounce_reason     text,                 -- SMTP error details
  email_provider    text,                 -- 'sendgrid' | 'mailgun' | 'ses'
  raw_event         jsonb default '{}'::jsonb,
  processed_at      timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create index if not exists idx_email_events_queue_entry on public.email_delivery_events(queue_entry_id);
create index if not exists idx_email_events_external_id on public.email_delivery_events(external_id);
create index if not exists idx_email_events_recipient on public.email_delivery_events(recipient);
create index if not exists idx_email_events_event_type on public.email_delivery_events(event_type, created_at);
create index if not exists idx_email_events_tenant on public.email_delivery_events(tenant_id);

-- 2. Enable RLS
alter table public.email_delivery_events enable row level security;

drop policy if exists "email_events_service_write" on public.email_delivery_events;
create policy "email_events_service_write"
  on public.email_delivery_events for all
  to service_role
  using (true)
  with check (true);

-- 3. Helper function: Process incoming email event and update queue status
create or replace function public.process_email_delivery_event(
  p_external_id text,
  p_recipient text,
  p_event_type text,
  p_email_provider text,
  p_bounce_type text default null,
  p_raw_event jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_queue_id uuid;
  v_tenant_id uuid;
begin
  -- Find the queue entry by external_id
  select id, tenant_id into v_queue_id, v_tenant_id
    from public.distribution_queue_entries
   where external_id = p_external_id
   limit 1;

  -- Log the event (whether queue entry exists or not)
  insert into public.email_delivery_events (
    queue_entry_id,
    tenant_id,
    external_id,
    recipient,
    event_type,
    bounce_type,
    email_provider,
    raw_event
  ) values (
    v_queue_id,
    v_tenant_id,
    p_external_id,
    p_recipient,
    p_event_type,
    p_bounce_type,
    p_email_provider,
    p_raw_event
  );

  -- Update queue entry status if event indicates permanent failure
  if v_queue_id is not null then
    if p_event_type = 'bounce' and p_bounce_type = 'permanent' then
      update public.distribution_queue_entries
         set last_error = 'Permanent bounce from ' || p_recipient,
             updated_at = now()
       where id = v_queue_id;

      insert into public.distribution_audit_log (queue_entry_id, tenant_id, event_type, message)
        values (v_queue_id, v_tenant_id, 'publish_failed', 'Permanent bounce: ' || p_recipient);

    elsif p_event_type = 'complaint' then
      update public.distribution_queue_entries
         set last_error = 'Spam complaint from ' || p_recipient,
             updated_at = now()
       where id = v_queue_id;

      insert into public.distribution_audit_log (queue_entry_id, tenant_id, event_type, message)
        values (v_queue_id, v_tenant_id, 'publish_failed', 'Spam complaint: ' || p_recipient);
    end if;
  end if;
end;
$$;

revoke all on function public.process_email_delivery_event(text, text, text, text, text, jsonb) from public;
grant execute on function public.process_email_delivery_event(text, text, text, text, text, jsonb) to service_role;

-- 4. Comments
comment on table public.email_delivery_events is
  'Webhook event log from email providers (SendGrid, Mailgun, AWS SES). Captures delivery, bounce, complaint, and engagement metrics.';
comment on function public.process_email_delivery_event(text, text, text, text, text, jsonb) is
  'Process incoming email provider webhook event. Links to distribution_queue_entries and updates status on permanent failures.';
