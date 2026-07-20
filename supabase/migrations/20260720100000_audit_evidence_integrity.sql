-- Gate 4: Evidence Integrity with Hash Chains — Schema Only
--
-- Minimal migration: Add columns + indexes only
-- Triggers/Functions/Views deferred to Phase 3 (post-launch optimization)
--
-- This enables:
-- - Parent finding links (parent_finding_id)
-- - Hash storage (finding_hash, chain_hash)
-- - Application-layer computation (no DB triggers yet)

-- Add columns for chain tracking (safe with 'if not exists')
alter table if exists public.audit_findings
add column if not exists parent_finding_id uuid,
add column if not exists finding_hash text,
add column if not exists chain_hash text,
add column if not exists evidence_root_hash text;

-- Add foreign key (drop if exists first, then add)
alter table if exists public.audit_findings
drop constraint if exists fk_parent_finding;

alter table if exists public.audit_findings
add constraint fk_parent_finding
  foreign key (parent_finding_id)
  references public.audit_findings(id) on delete set null;

-- Add indexes for chain traversal performance
create index if not exists idx_audit_findings_parent on public.audit_findings(parent_finding_id);
create index if not exists idx_audit_findings_chain_hash on public.audit_findings(chain_hash);
create index if not exists idx_audit_findings_root_hash on public.audit_findings(evidence_root_hash);

-- Documentation
comment on column public.audit_findings.parent_finding_id is
  'Gate 4: Links to previous finding in chain (enables sequential traversal).';

comment on column public.audit_findings.finding_hash is
  'SHA256 hash of finding metadata (computed by application layer).';

comment on column public.audit_findings.chain_hash is
  'SHA256 hash of (previous_chain_hash + current_finding_hash) — tamper-proof.';

comment on column public.audit_findings.evidence_root_hash is
  'Root hash of audit evidence chain (for batch verification).';
