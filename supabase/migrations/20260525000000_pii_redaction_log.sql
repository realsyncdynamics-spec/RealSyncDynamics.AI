-- pii_redaction_log — append-only Audit-Spur der serverseitigen PII-Redaction.
--
-- Jeder Export aus evidence-vault-export, audit-report-pdf,
-- evidence-export (tax) oder gdpr-export schreibt hier genau eine Zeile.
-- Auch Exporte mit policy='never' werden protokolliert — der DSB soll
-- nachweisen koennen, dass die Entscheidung Klartext-Export bewusst war
-- (Art. 15 DSGVO oder berufsrechtliche Notwendigkeit nach StBerG).
--
-- Append-only via Trigger, RLS tenant-scoped, Service-Role schreibt.

create table if not exists public.pii_redaction_log (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid,                            -- nullable: system-level events
  function_name    text not null
    check (function_name in (
      'evidence-vault-export',
      'audit-report-pdf',
      'evidence-export',
      'gdpr-export'
    )),
  policy_applied   text not null
    check (policy_applied in ('always', 'third_party_only', 'never')),
  correlation_id   text,                            -- audit_id / export_id / user_id
  hits_total       integer not null default 0
    check (hits_total >= 0),
  hits_by_category jsonb not null default '{}'::jsonb,
  payload_bytes    integer
    check (payload_bytes is null or payload_bytes >= 0),
  applied_by       uuid,                            -- user_id wenn vorhanden
  applied_at       timestamptz not null default now(),
  notes            text                             -- Freitext, optional
);

create index if not exists idx_pii_redaction_log_tenant on public.pii_redaction_log(tenant_id);
create index if not exists idx_pii_redaction_log_function on public.pii_redaction_log(function_name);
create index if not exists idx_pii_redaction_log_applied_at on public.pii_redaction_log(applied_at desc);
create index if not exists idx_pii_redaction_log_correlation on public.pii_redaction_log(correlation_id);

-- RLS aktivieren — Default-Deny.
alter table public.pii_redaction_log enable row level security;

-- Tenant-Members duerfen ihre eigenen Eintraege lesen (DSB-Audit).
drop policy if exists "pii_redaction_log_tenant_read" on public.pii_redaction_log;
create policy "pii_redaction_log_tenant_read"
  on public.pii_redaction_log for select
  to authenticated
  using (
    tenant_id is not null
    and tenant_id in (
      select tenant_id from public.memberships where user_id = auth.uid()
    )
  );

-- Service-Role schreibt (Edge Functions).
drop policy if exists "pii_redaction_log_service_write" on public.pii_redaction_log;
create policy "pii_redaction_log_service_write"
  on public.pii_redaction_log for insert
  to service_role
  with check (true);

-- Append-only: UPDATE und DELETE auf der Tabelle werden via Trigger geblockt.
create or replace function public.pii_redaction_log_block_modification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  raise exception 'pii_redaction_log is append-only. Insert a new row instead of modifying.';
end;
$$;

drop trigger if exists trg_pii_redaction_log_no_update on public.pii_redaction_log;
create trigger trg_pii_redaction_log_no_update
  before update on public.pii_redaction_log
  for each row execute function public.pii_redaction_log_block_modification();

drop trigger if exists trg_pii_redaction_log_no_delete on public.pii_redaction_log;
create trigger trg_pii_redaction_log_no_delete
  before delete on public.pii_redaction_log
  for each row execute function public.pii_redaction_log_block_modification();

comment on table public.pii_redaction_log is
  'Append-only Spur jeder Server-Export-Operation: welche Funktion mit welcher Redaction-Policy lief, wieviele PII-Treffer geschwaerzt wurden. DSB-Audit-Material.';
comment on column public.pii_redaction_log.policy_applied is
  '''always'' = Bundle fuer Dritte, hart geschwaerzt. ''third_party_only'' = nur fremde Domains/Felder geschwaerzt. ''never'' = bewusst Klartext (Art. 15 DSGVO oder StBerG).';
