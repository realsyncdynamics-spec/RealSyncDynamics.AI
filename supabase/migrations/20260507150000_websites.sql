-- Websites — Customer-Site-Registry für DSGVO-Website-as-a-Service.
--
-- Trackt eine Kunden-Domain durch den vollen Lifecycle (Audit → Rebuild → Managed).
-- Bewusst minimal gehalten: ein Tisch für M1-Pilot, weitere Sub-Tabellen
-- (builds, managed_configs, audit_schedules, deployments, dns_records) folgen
-- in M2, sobald die Daten-Shapes durch echte Pilot-Kunden geklärt sind.
--
-- RLS: Tenant-Members lesen ihre eigenen Sites. Schreibzugriff ausschließlich
-- über service_role (Stripe-Webhook, Provisioning-Edge-Functions, Admin-UI).

create table if not exists public.websites (
    id                  uuid primary key default gen_random_uuid(),
    tenant_id           uuid not null references public.tenants(id) on delete cascade,
    domain              text not null,                  -- normalized hostname (lowercase, no scheme)

    -- Welche Stufe der Kunde gebucht hat
    plan_tier           text not null check (plan_tier in ('audit', 'rebuild', 'managed')),

    -- Wo der Kunde im Lifecycle steht
    status              text not null default 'lead' check (status in (
        'lead',                  -- captured but not started
        'audit_pending',         -- audit scheduled, not yet run
        'audit_done',            -- audit delivered to customer
        'rebuild_in_progress',   -- rebuild project running
        'rebuild_done',          -- rebuild delivered, awaiting managed handoff
        'live',                  -- managed, currently online
        'paused',                -- managed but paused (billing held)
        'churned'                -- ended
    )),

    -- Optional: link to most recent audit run from /audit (lead-magnet flow)
    latest_audit_id     uuid references public.gdpr_audits(id) on delete set null,

    -- Deployment metadata (populated when site goes live in Managed tier)
    deployment_host     text,                            -- e.g. eu-vps-de-01.realsyncdynamics.cloud
    deployment_ip       inet,

    -- Re-audit schedule (Managed tier ships 2× per year)
    next_reaudit_at     timestamptz,

    -- Free-form ops notes
    notes               text,

    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),

    unique (tenant_id, domain)
);

create index if not exists idx_websites_tenant on public.websites(tenant_id);
create index if not exists idx_websites_status on public.websites(status);
create index if not exists idx_websites_domain on public.websites(domain);
create index if not exists idx_websites_next_reaudit
    on public.websites(next_reaudit_at)
    where status = 'live';

-- updated_at trigger
create or replace function public.websites_set_updated_at()
returns trigger
language plpgsql
as $$
begin
    NEW.updated_at = now();
    return NEW;
end;
$$;

drop trigger if exists trg_websites_updated on public.websites;
create trigger trg_websites_updated
    before update on public.websites
    for each row execute function public.websites_set_updated_at();

-- RLS
alter table public.websites enable row level security;

drop policy if exists "websites_service_all" on public.websites;
create policy "websites_service_all"
    on public.websites for all
    to service_role
    using (true) with check (true);

drop policy if exists "websites_tenant_read" on public.websites;
create policy "websites_tenant_read"
    on public.websites for select
    to authenticated
    using (public.is_tenant_member(tenant_id));

comment on table public.websites is
    'Customer site registry für DSGVO-Website-as-a-Service. Eine Zeile pro (tenant, domain). Lifecycle: lead → audit_pending → audit_done → rebuild_in_progress → rebuild_done → live → (paused | churned). Schreibzugriff nur via service_role.';
comment on column public.websites.plan_tier is
    'Welcher Pakettyp gebucht wurde: audit (249 € einmalig) · rebuild (1.5–4 k€ einmalig) · managed (ab 99 €/Monat).';
comment on column public.websites.next_reaudit_at is
    'Geplanter Zeitpunkt für nächstes Re-Audit (Managed-Tier: 2× pro Jahr). Cron-Job konsumiert idx_websites_next_reaudit.';
