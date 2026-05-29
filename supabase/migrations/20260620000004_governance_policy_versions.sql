-- Governance: append-only Versions-Historie fuer Richtlinien & Assets.
-- Schliesst die Luecke "Nachvollziehbarkeit von Richtlinienaenderungen"
-- (governance_policies/-assets hatten nur updated_at = In-place-Ueberschreiben).
-- Ein SECURITY-DEFINER-Trigger snapshottet den OLD-Zustand bei UPDATE/DELETE.
-- Kontext: docs/runtime/SYSTEMCHECK-2026-05-28.md. Idempotent.

create table if not exists public.governance_policy_versions (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null,
  source_table text not null,
  source_id    uuid not null,
  operation    text not null check (operation in ('UPDATE','DELETE')),
  snapshot     jsonb not null,
  changed_by   uuid,
  changed_at   timestamptz not null default now()
);
create index if not exists idx_gpv_source on public.governance_policy_versions (source_table, source_id, changed_at desc);
create index if not exists idx_gpv_tenant on public.governance_policy_versions (tenant_id);

alter table public.governance_policy_versions enable row level security;
drop policy if exists "tenant members read policy versions" on public.governance_policy_versions;
create policy "tenant members read policy versions"
  on public.governance_policy_versions for select
  using ((select public.is_tenant_member(tenant_id)));
-- Bewusst KEINE insert/update/delete-Policy: fuer anon/authenticated immutable;
-- nur der SECURITY-DEFINER-Trigger schreibt.

create or replace function public.tg_snapshot_governance_versioned()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $fn$
begin
  insert into public.governance_policy_versions(tenant_id, source_table, source_id, operation, snapshot, changed_by)
  values (OLD.tenant_id, TG_TABLE_NAME, OLD.id, TG_OP, to_jsonb(OLD), auth.uid());
  return case when TG_OP = 'DELETE' then OLD else NEW end;
end $fn$;

drop trigger if exists snapshot_versions on public.governance_policies;
create trigger snapshot_versions after update or delete on public.governance_policies
  for each row execute function public.tg_snapshot_governance_versioned();

drop trigger if exists snapshot_versions on public.governance_assets;
create trigger snapshot_versions after update or delete on public.governance_assets
  for each row execute function public.tg_snapshot_governance_versioned();
