-- subject_ref Lifecycle schema — P2-impl-1 of the Operational Governance
-- Kernel RFC (docs/architecture/runtime-kernel-rfc.md §P2.2).
--
-- Establishes the two storage surfaces that back subject_ref hardening:
--   1) subject_ref_keys     — tenant-scoped HMAC keys with version + lifecycle
--   2) subject_ref_mappings — optional reverse-lookup (subject_ref → encrypted
--                              plaintext), used ONLY for DSGVO Art. 15/17 flows
--
-- This migration is PURE SCHEMA — no helpers, no Edge Function changes.
-- The HMAC helper (`_shared/subject-ref.ts` with key-lookup + rotation-aware
-- compute) is P2-impl-2. The DSR-Export Edge Function is P2-impl-3.
--
-- Security posture:
--   - Both tables RLS-enabled, deny-by-default for ALL roles
--   - Only service-role (which bypasses RLS) may read/write
--   - DSR-Export Edge Function path (P2-impl-3) gets a narrow SECURITY DEFINER
--     wrapper, not direct table access
--   - Key material does NOT live here — vault_secret_name points at
--     Supabase Vault entries (get_app_secret).
--
-- See RFC §P2 (esp. §P2.5 deletion semantics) and §5 security boundaries.

-- ──────────────────────────────────────────────────────────────────────
-- 1) subject_ref_keys — HMAC-key registry per tenant
-- ──────────────────────────────────────────────────────────────────────

create table if not exists public.subject_ref_keys (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  key_version         int  not null,                          -- monotonically increasing per tenant
  algorithm           text not null default 'HMAC-SHA-256',
  -- Key material lives in Supabase Vault. This column carries only the LOOKUP NAME.
  -- The Edge-Function helper resolves it via get_app_secret(vault_secret_name).
  vault_secret_name   text not null,
  status              text not null,
  activated_at        timestamptz not null default now(),
  retired_at          timestamptz,
  unique (tenant_id, key_version)
);

alter table public.subject_ref_keys
  drop constraint if exists subject_ref_keys_status_check;
alter table public.subject_ref_keys
  add constraint subject_ref_keys_status_check
  check (status in ('active','rotating','retired'));

-- `retired_at` MUST be set iff status='retired' — keeps lifecycle audit
-- consistent without a separate trigger.
alter table public.subject_ref_keys
  drop constraint if exists subject_ref_keys_retired_consistency_check;
alter table public.subject_ref_keys
  add constraint subject_ref_keys_retired_consistency_check
  check (
    (status = 'retired'     and retired_at is not null)
    or (status in ('active','rotating') and retired_at is null)
  );

create index if not exists subject_ref_keys_active_idx
  on public.subject_ref_keys (tenant_id, status, key_version desc);

-- ──────────────────────────────────────────────────────────────────────
-- 2) subject_ref_mappings — reverse lookup for DSR endpoints ONLY
-- ──────────────────────────────────────────────────────────────────────

create table if not exists public.subject_ref_mappings (
  subject_ref           text primary key,                    -- the HMAC output (also stored on runtime_events.subject_ref)
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  key_version           int  not null,
  subject_kind          text not null,
  -- Encrypted plaintext. Encryption is performed by the writer (pgsodium /
  -- libsodium in the Edge-Function) — this column is OPAQUE bytea.
  -- Reads ONLY through the DSR-Export pathway (P2-impl-3), never via RLS.
  encrypted_value       bytea,
  created_at            timestamptz not null default now(),
  retention_class       text not null default '3y',
  deletion_requested_at timestamptz,
  deleted_at            timestamptz
);

alter table public.subject_ref_mappings
  drop constraint if exists subject_ref_mappings_subject_kind_check;
alter table public.subject_ref_mappings
  add constraint subject_ref_mappings_subject_kind_check
  check (subject_kind in ('email','ip','user_id','session'));

-- Same retention_class whitelist as runtime_events (RFC §P0.4) — keeps the
-- two retention writers compatible.
alter table public.subject_ref_mappings
  drop constraint if exists subject_ref_mappings_retention_class_check;
alter table public.subject_ref_mappings
  add constraint subject_ref_mappings_retention_class_check
  check (retention_class in
    ('forever','7y','3y','1y','90d','30d','7d','ephemeral'));

-- Deletion lifecycle: deleted_at MUST imply deletion_requested_at — preserves
-- the DSGVO Art. 17 audit chain (requested → executed).
alter table public.subject_ref_mappings
  drop constraint if exists subject_ref_mappings_deletion_order_check;
alter table public.subject_ref_mappings
  add constraint subject_ref_mappings_deletion_order_check
  check (
    deleted_at is null
    or (deletion_requested_at is not null and deleted_at >= deletion_requested_at)
  );

-- After a deletion is executed, encrypted_value MUST be NULL — required
-- by RFC §P2.5 "Encrypted-Value-Spalte NULLen". subject_ref itself stays.
alter table public.subject_ref_mappings
  drop constraint if exists subject_ref_mappings_post_deletion_check;
alter table public.subject_ref_mappings
  add constraint subject_ref_mappings_post_deletion_check
  check (deleted_at is null or encrypted_value is null);

-- FK on the (tenant_id, key_version) couple keeps mapping integrity when a
-- key row is updated — but key rotation only ADDS rows, never deletes.
-- Cascade-on-delete piggybacks on tenant_id FK (the row's tenant deletes).
create index if not exists subject_ref_mappings_tenant_key_idx
  on public.subject_ref_mappings (tenant_id, key_version);

create index if not exists subject_ref_mappings_pending_deletions_idx
  on public.subject_ref_mappings (tenant_id, deletion_requested_at)
  where deletion_requested_at is not null and deleted_at is null;

-- ──────────────────────────────────────────────────────────────────────
-- 3) Row-Level-Security: deny-by-default for ALL roles
-- ──────────────────────────────────────────────────────────────────────
-- Service-role bypasses RLS (Supabase default) — that is the ONLY write path.
-- All other roles (anon, authenticated) are blocked even for SELECT.
-- The DSR-Export Edge-Function (P2-impl-3) calls a SECURITY DEFINER RPC
-- with narrow argument shape, never raw table access.

alter table public.subject_ref_keys     enable row level security;
alter table public.subject_ref_mappings enable row level security;

drop policy if exists "subject_ref_keys service-role only" on public.subject_ref_keys;
create policy "subject_ref_keys service-role only"
  on public.subject_ref_keys for all
  using (false) with check (false);

drop policy if exists "subject_ref_mappings service-role only" on public.subject_ref_mappings;
create policy "subject_ref_mappings service-role only"
  on public.subject_ref_mappings for all
  using (false) with check (false);

-- ──────────────────────────────────────────────────────────────────────
-- 4) Column comments — context-at-the-source for future readers
-- ──────────────────────────────────────────────────────────────────────

comment on table public.subject_ref_keys is
  'Tenant-scoped HMAC-key registry for subject_ref derivation (RFC §P2.2). Key material is in Supabase Vault — this table stores only the lookup name + lifecycle state.';

comment on column public.subject_ref_keys.vault_secret_name is
  'Name of the Vault secret holding the HMAC key. Resolved by Edge-Functions via get_app_secret(). NEVER store key material directly.';

comment on column public.subject_ref_keys.status is
  'active = current key (reads + writes). rotating = old key, reads only (backward-verify). retired = no longer used. See RFC §P2.3.';

comment on table public.subject_ref_mappings is
  'OPTIONAL reverse lookup subject_ref → encrypted plaintext. Used ONLY for DSGVO Art. 15/17 (DSR) flows. NEVER consulted during normal runtime. RLS deny-by-default — DSR-Export Edge Function is the only legitimate read path.';

comment on column public.subject_ref_mappings.subject_ref is
  'The HMAC output also stored in runtime_events.subject_ref. Primary key here, foreign-key-like join target there (no DB-FK to avoid cascade-locking on retention).';

comment on column public.subject_ref_mappings.encrypted_value is
  'Opaque ciphertext (pgsodium / libsodium). Writer encrypts. ONLY readable via DSR-Export pathway. NULLed when deletion is executed (RFC §P2.5).';

comment on column public.subject_ref_mappings.deletion_requested_at is
  'Set when a user files an Art. 17 deletion request. Together with deleted_at, forms the audit chain.';

comment on column public.subject_ref_mappings.deleted_at is
  'Set when the deletion is executed. Implies encrypted_value=NULL. subject_ref stays for runtime_events audit-trail consistency.';
