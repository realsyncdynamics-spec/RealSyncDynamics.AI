-- Evidence Layer für Audit-Pipeline (Phase 7.3 nach ARCHITECTURE.md).
--
-- Pro Audit-Finding können mehrere Evidence-Items existieren: Screenshots,
-- Network-Request-Logs, Cookie-Dumps, DOM-Snapshots, Script-References.
-- Storage-URL verweist auf Supabase Storage Bucket "audit-evidence".

create extension if not exists "pgcrypto";

-- 1. Evidence-Tabelle
create table if not exists public.audit_evidence (
  id              uuid primary key default gen_random_uuid(),
  audit_id        uuid not null,
  finding_id      uuid,                   -- nullable: Evidence kann auch global sein
  type            text not null
    check (type in (
      'screenshot',
      'request_log',
      'cookie_dump',
      'dom_snapshot',
      'script_reference',
      'response_header'
    )),
  payload_json    jsonb,                  -- strukturierte Daten (URL, headers, etc)
  storage_url     text,                   -- für Binär-Files: Bucket-URL
  storage_bucket  text default 'audit-evidence',
  storage_path    text,                   -- Path im Bucket
  size_bytes      bigint,
  mime_type       text,
  tenant_id       uuid not null,
  created_at      timestamptz not null default now(),
  -- Constraint: entweder payload_json oder storage_url muss gesetzt sein
  constraint evidence_has_payload_or_storage
    check (payload_json is not null or storage_url is not null or storage_path is not null)
);

create index if not exists idx_audit_evidence_audit_id on public.audit_evidence(audit_id);
create index if not exists idx_audit_evidence_finding_id on public.audit_evidence(finding_id);
create index if not exists idx_audit_evidence_tenant_id on public.audit_evidence(tenant_id);
create index if not exists idx_audit_evidence_type on public.audit_evidence(type);

-- 2. RLS aktivieren — Default-Deny
alter table public.audit_evidence enable row level security;

-- 3. Policy: Tenant-Members lesen ihre eigene Evidence
drop policy if exists "audit_evidence_tenant_read" on public.audit_evidence;
create policy "audit_evidence_tenant_read"
  on public.audit_evidence for select
  to authenticated
  using (
    tenant_id in (
      select tenant_id from public.memberships where user_id = auth.uid()
    )
  );

-- 4. Policy: Service-Role schreibt (Edge Functions)
drop policy if exists "audit_evidence_service_write" on public.audit_evidence;
create policy "audit_evidence_service_write"
  on public.audit_evidence for insert
  to service_role
  with check (true);

-- 5. Policy: niemand updated/deleted (append-only — wie audit-trail)
-- Updates und Deletes sind explizit nicht erlaubt für authenticated/anon.
-- Service-Role kann via SQL-Editor wenn nötig (für Tests/Cleanup).

-- 6. Trigger: verhindert UPDATE/DELETE auf evidence (append-only)
create or replace function public.audit_evidence_block_modification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  raise exception 'audit_evidence is append-only. Insert a new row instead of modifying.';
end;
$$;

drop trigger if exists trg_audit_evidence_no_update on public.audit_evidence;
create trigger trg_audit_evidence_no_update
  before update on public.audit_evidence
  for each row execute function public.audit_evidence_block_modification();

drop trigger if exists trg_audit_evidence_no_delete on public.audit_evidence;
create trigger trg_audit_evidence_no_delete
  before delete on public.audit_evidence
  for each row execute function public.audit_evidence_block_modification();

-- 7. Storage-Bucket + Policy — nur wenn Supabase-Storage-Schema vorhanden ist.
-- CI-Migration-Validation-Stub hat kein storage-Schema, deshalb defensiv guarded.
-- In Production (Supabase) ist storage.buckets + storage.objects immer da.
do $storage_setup$
begin
  if exists (
    select 1 from information_schema.schemata where schema_name = 'storage'
  ) and exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'buckets'
  ) then
    -- Bucket erstellen falls nicht existiert
    execute $sql$
      insert into storage.buckets (id, name, public)
      values ('audit-evidence', 'audit-evidence', false)
      on conflict (id) do nothing
    $sql$;

    -- Policy für tenant-scoped read via signed URL
    execute $sql$drop policy if exists "audit_evidence_storage_tenant_read" on storage.objects$sql$;
    execute $sql$
      create policy "audit_evidence_storage_tenant_read"
        on storage.objects for select
        to authenticated
        using (
          bucket_id = 'audit-evidence'
          and (
            (storage.foldername(name))[1] in (
              select tenant_id::text from public.memberships where user_id = auth.uid()
            )
          )
        )
    $sql$;
  else
    raise notice 'storage schema not available — skipping bucket + policy setup (CI/test env)';
  end if;
end
$storage_setup$;

-- 9. Helper-View: Findings mit Evidence (für UI + PDF-Rendering)
-- Einfache View; falls audit_findings noch nicht existiert wird die View
-- nur das Skelett haben — kein Fehler.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'audit_findings'
  ) then
    execute $view$
      create or replace view public.v_findings_with_evidence as
      select
        f.id              as finding_id,
        f.audit_id,
        f.tenant_id,
        f.rule_id,
        f.severity,
        f.title,
        f.created_at,
        coalesce(jsonb_agg(
          jsonb_build_object(
            'id', e.id,
            'type', e.type,
            'storage_url', e.storage_url,
            'storage_path', e.storage_path,
            'mime_type', e.mime_type,
            'created_at', e.created_at
          )
        ) filter (where e.id is not null), '[]'::jsonb) as evidence
      from public.audit_findings f
      left join public.audit_evidence e on e.finding_id = f.id
      group by f.id;
    $view$;
  else
    raise notice 'audit_findings does not exist yet — skipping v_findings_with_evidence';
  end if;
end $$;

-- 10. Comment für Doku
comment on table public.audit_evidence is
  'Evidence Layer (ARCHITECTURE.md Phase 7.3): append-only Beweis-Items pro Audit-Finding. RLS tenant-scoped, Updates/Deletes blockiert per Trigger.';
