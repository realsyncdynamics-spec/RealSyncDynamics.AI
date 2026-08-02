-- WIEDERHERGESTELLT aus der Prod-Migrations-History (2026-08-02), Option A.
-- 1:1 aus supabase_migrations.schema_migrations, Version 20260628193744.
--
-- Dies ist Bots-Feature B. Es wurde am 2026-06-28 rund sieben Stunden nach
-- Feature A (bots / bot_appointments / bot_orders) auf Prod angewendet und
-- existierte danach NUR noch in der Prod-Migrations-History — ohne Repo-Datei,
-- ohne eine einzige Code-Referenz, mit 0 Zeilen in allen Tabellen.
--
-- WICHTIG — bekannte Kollision, bewusst unveraendert uebernommen:
-- Diese Migration deklariert `bot_conversations` und `bot_messages` erneut,
-- obwohl Feature A sie bereits angelegt hat. Durch `create table if not exists`
-- werden beide Definitionen still uebersprungen. In Prod tragen diese zwei
-- Tabellen daher A's Form, waehrend der Rest von B B's Form voraussetzt:
--
--   bot_conversations.bot_id  -> FK auf bots(id), NICHT bot_agents(id)
--   bot_messages.role  CHECK  -> ohne 'tool'
--   bot_conversations.status  -> ohne 'handed_off'
--
-- Wer auf bot_agents aufsetzt, laeuft deshalb in FK- und CHECK-Verletzungen,
-- deren Ursache nicht nach dieser Datei aussieht. Die Datei bleibt trotzdem
-- unveraendert, damit `supabase db reset` exakt den Prod-Zustand reproduziert
-- statt eine geschoente Variante. Aufloesung der Kollision ist eine offene
-- Produktentscheidung — siehe docs/runtime/PRODUCTION_BLOCKERS.md, Blocker 2.

-- RealSyncDynamics.AI — Bots Foundation. ADDITIVE / NON-BREAKING.
create or replace function public.bots_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

create table if not exists public.bot_agents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  kind text not null default 'chat' check (kind in ('chat','voice')),
  persona text not null default 'friendly',
  address_form text not null default 'sie' check (address_form in ('du','sie','mirror')),
  capabilities jsonb not null default '[]'::jsonb,
  active_hours jsonb,
  is_active boolean not null default false,
  disclosure_text text not null default 'Hinweis: Sie sprechen mit einem KI-Assistenten.',
  ai_act_inventory_id uuid references public.ai_act_risk_inventory(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bot_agents_tenant_idx on public.bot_agents(tenant_id);

create table if not exists public.bot_question_catalog (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  bot_id uuid not null references public.bot_agents(id) on delete cascade,
  flow text not null check (flow in ('greeting','appointment','order','faq','handoff')),
  nodes jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bot_question_catalog_bot_idx on public.bot_question_catalog(bot_id);
create index if not exists bot_question_catalog_tenant_idx on public.bot_question_catalog(tenant_id);

create table if not exists public.bot_conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  bot_id uuid not null references public.bot_agents(id) on delete cascade,
  channel text not null default 'web' check (channel in ('web','telegram','voice')),
  external_ref text,
  status text not null default 'open' check (status in ('open','handed_off','closed')),
  started_at timestamptz not null default now(),
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists bot_conversations_bot_idx on public.bot_conversations(bot_id);
create index if not exists bot_conversations_tenant_idx on public.bot_conversations(tenant_id);

create table if not exists public.bot_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  conversation_id uuid not null references public.bot_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','system','tool')),
  content text,
  ai_tool_run_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists bot_messages_conversation_idx on public.bot_messages(conversation_id);
create index if not exists bot_messages_tenant_idx on public.bot_messages(tenant_id);

create table if not exists public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  bot_id uuid not null references public.bot_agents(id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  slot_minutes integer not null default 30 check (slot_minutes > 0),
  service_type text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists availability_rules_bot_idx on public.availability_rules(bot_id);
create index if not exists availability_rules_tenant_idx on public.availability_rules(tenant_id);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  bot_id uuid references public.bot_agents(id) on delete set null,
  conversation_id uuid references public.bot_conversations(id) on delete set null,
  service_type text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  customer_name text,
  customer_contact text,
  status text not null default 'requested' check (status in ('requested','confirmed','cancelled','completed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists appointments_tenant_idx on public.appointments(tenant_id);
create index if not exists appointments_starts_idx on public.appointments(tenant_id, starts_at);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  bot_id uuid references public.bot_agents(id) on delete set null,
  conversation_id uuid references public.bot_conversations(id) on delete set null,
  fulfilment text not null default 'pickup' check (fulfilment in ('pickup','delivery')),
  customer_name text,
  customer_contact text,
  delivery_address text,
  total_cents integer not null default 0,
  currency text not null default 'EUR',
  payment_method text check (payment_method in ('cash','card_on_delivery','prepay')),
  status text not null default 'received' check (status in ('received','confirmed','in_preparation','fulfilled','cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_tenant_idx on public.orders(tenant_id);
create index if not exists orders_status_idx on public.orders(tenant_id, status);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  name text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price_cents integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists order_items_tenant_idx on public.order_items(tenant_id);

create table if not exists public.voice_channels (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  bot_id uuid not null references public.bot_agents(id) on delete cascade,
  provider text,
  phone_number text,
  greeting text,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists voice_channels_tenant_idx on public.voice_channels(tenant_id);

create trigger trg_bot_agents_touch before update on public.bot_agents for each row execute function public.bots_touch_updated_at();
create trigger trg_bot_question_catalog_touch before update on public.bot_question_catalog for each row execute function public.bots_touch_updated_at();
create trigger trg_appointments_touch before update on public.appointments for each row execute function public.bots_touch_updated_at();
create trigger trg_orders_touch before update on public.orders for each row execute function public.bots_touch_updated_at();
create trigger trg_voice_channels_touch before update on public.voice_channels for each row execute function public.bots_touch_updated_at();

do $$
declare t text;
begin
  foreach t in array array[
    'bot_agents','bot_question_catalog','bot_conversations','bot_messages',
    'availability_rules','appointments','orders','order_items','voice_channels'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format($f$create policy %I on public.%I for select to authenticated using (public.is_tenant_member(tenant_id));$f$, t||'_sel', t);
    execute format($f$create policy %I on public.%I for insert to authenticated with check (public.is_tenant_owner_or_admin(tenant_id));$f$, t||'_ins', t);
    execute format($f$create policy %I on public.%I for update to authenticated using (public.is_tenant_owner_or_admin(tenant_id)) with check (public.is_tenant_owner_or_admin(tenant_id));$f$, t||'_upd', t);
    execute format($f$create policy %I on public.%I for delete to authenticated using (public.is_tenant_owner_or_admin(tenant_id));$f$, t||'_del', t);
  end loop;
end $$;
