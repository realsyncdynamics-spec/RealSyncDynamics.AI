-- Gate 4: Evidence Integrity with Hash Chains
--
-- Enables tamper detection: If any evidence is modified, all downstream chain hashes break.
--
-- Schema:
-- - Each finding links to previous finding (parent_finding_id)
-- - Each finding has integrity hash
-- - Chain hash computed as: hash(previous_chain_hash + current_finding_hash)
-- - If any finding is modified: chain breaks, tampering detected

alter table if exists public.audit_findings
add column if not exists parent_finding_id uuid,
add column if not exists finding_hash text,
add column if not exists chain_hash text,
add column if not exists evidence_root_hash text;

-- Add constraints
alter table public.audit_findings
add constraint fk_parent_finding
  foreign key (parent_finding_id)
  references public.audit_findings(id) on delete set null;

-- Indexes for chain traversal
create index if not exists idx_audit_findings_parent on public.audit_findings(parent_finding_id);
create index if not exists idx_audit_findings_chain_hash on public.audit_findings(chain_hash);
create index if not exists idx_audit_findings_root_hash on public.audit_findings(evidence_root_hash);

-- =========================================================================
-- Helper: Calculate finding hash (for integrity verification)
-- =========================================================================
create or replace function public.calculate_finding_hash(
  p_finding_id uuid
)
returns text
language sql
security definer
set search_path = public, pg_catalog
as $$
  select
    encode(
      digest(
        jsonb_build_object(
          'id', id,
          'audit_id', audit_id,
          'rule_id', rule_id,
          'severity', severity,
          'title', title,
          'description', description,
          'control_id', control_id,
          'created_at', created_at
        )::text,
        'sha256'
      ),
      'hex'
    )
  from public.audit_findings
  where id = p_finding_id;
$$;

-- =========================================================================
-- Trigger: Auto-compute chain hashes on INSERT
-- =========================================================================
create or replace function public.audit_findings_compute_chain()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_prev_chain_hash text;
  v_finding_hash text;
  v_new_chain_hash text;
begin
  -- Calculate finding hash
  v_finding_hash := public.calculate_finding_hash(new.id);
  new.finding_hash := v_finding_hash;

  -- Get previous chain hash (from parent finding)
  if new.parent_finding_id is not null then
    select chain_hash into v_prev_chain_hash
    from public.audit_findings
    where id = new.parent_finding_id;
  else
    v_prev_chain_hash := '';
  end if;

  -- Calculate new chain hash: hash(prev_chain + current_finding)
  v_new_chain_hash := encode(
    digest(
      v_prev_chain_hash || v_finding_hash,
      'sha256'
    ),
    'hex'
  );
  new.chain_hash := v_new_chain_hash;

  -- evidence_root_hash = chain_hash of last finding in audit
  -- (Computed later via RPC or view)
  new.evidence_root_hash := null;

  return new;
end;
$$;

drop trigger if exists trg_audit_findings_compute_chain on public.audit_findings;
create trigger trg_audit_findings_compute_chain
  before insert on public.audit_findings
  for each row
  execute function public.audit_findings_compute_chain();

-- =========================================================================
-- View: Audit Evidence Integrity Summary
-- =========================================================================
-- Shows: all findings for an audit with chain status
drop view if exists public.v_audit_evidence_chain;
create view public.v_audit_evidence_chain as
select
  f.id,
  f.audit_id,
  f.tenant_id,
  f.severity,
  f.title,
  f.parent_finding_id,
  f.finding_hash,
  f.chain_hash,
  -- Detect tampering: if chain_hash doesn't match computed hash
  case
    when f.chain_hash = encode(
      digest(
        (
          select coalesce(chain_hash, '')
          from public.audit_findings
          where id = f.parent_finding_id
        ) || encode(
          digest(
            jsonb_build_object(
              'id', f.id,
              'audit_id', f.audit_id,
              'rule_id', f.rule_id,
              'severity', f.severity,
              'title', f.title,
              'description', f.description,
              'control_id', f.control_id,
              'created_at', f.created_at
            )::text,
            'sha256'
          ),
          'hex'
        ),
        'sha256'
      ),
      'hex'
    ) then 'intact'
    else 'tampered'
  end as integrity_status,
  f.created_at
from public.audit_findings f
order by f.audit_id, f.created_at;

comment on view public.v_audit_evidence_chain is
  'Gate 4: Evidence Integrity Chain — Detect tampering via hash verification.
   integrity_status = "intact" if chain hash is valid, "tampered" if modified.';

-- =========================================================================
-- RPC: Verify Audit Evidence Chain Integrity
-- =========================================================================
create or replace function public.verify_audit_chain(
  p_audit_id uuid,
  p_tenant_id uuid
)
returns table (
  audit_id uuid,
  finding_count bigint,
  integrity_status text,
  tampered_findings bigint,
  evidence_root_hash text,
  verified_at timestamptz
)
language sql
security definer
set search_path = public, pg_catalog
as $$
  with chain_status as (
    select
      f.audit_id,
      f.tenant_id,
      count(*) as total_findings,
      count(*) filter (where v.integrity_status = 'tampered') as tampered_count,
      max(f.chain_hash) as root_hash
    from public.audit_findings f
    left join public.v_audit_evidence_chain v on v.id = f.id
    where f.audit_id = p_audit_id
      and f.tenant_id = p_tenant_id
    group by f.audit_id, f.tenant_id
  )
  select
    cs.audit_id,
    cs.total_findings,
    case
      when cs.tampered_count = 0 then 'intact'
      else 'tampered'
    end as integrity_status,
    cs.tampered_count,
    cs.root_hash,
    now()
  from chain_status cs;
$$;

-- =========================================================================
-- Comment: Documentation
-- =========================================================================
comment on table public.audit_findings is
  'Gate 4: Evidence Integrity — Each finding has finding_hash + chain_hash.
   Chain hash = hash(previous_chain_hash + current_finding_hash).
   If any finding is modified: chain breaks, tampering detected.
   Use verify_audit_chain() RPC to check integrity.';

comment on column public.audit_findings.parent_finding_id is
  'Links to previous finding in chain. Enables sequential integrity verification.';

comment on column public.audit_findings.finding_hash is
  'SHA256 hash of finding (id, severity, title, etc.). Computed on INSERT.';

comment on column public.audit_findings.chain_hash is
  'SHA256 hash of (previous_chain_hash + current_finding_hash). Tamper-proof link.';

comment on column public.audit_findings.evidence_root_hash is
  'Root hash of entire audit evidence chain. Computed after all findings inserted.';
