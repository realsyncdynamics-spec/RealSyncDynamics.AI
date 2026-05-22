-- rotate_subject_ref_key RPC — P2-impl-2 of the Operational Governance
-- Kernel RFC (§P2.4 Key-Rotation-Procedure).
--
-- Atomic rotation: existing 'active' row → 'rotating', new 'active' row
-- inserted with key_version+1 in a single transaction. Without this,
-- a read-modify-write from the Edge-Function would race two parallel
-- rotations and could leave the tenant with two 'active' keys.
--
-- SECURITY DEFINER: callers don't need direct write access to
-- subject_ref_keys (the table's RLS is deny-by-default). The function
-- runs with the schema owner's privileges and explicitly validates the
-- tenant id passed in.
--
-- Caller responsibility:
--   - p_vault_secret_name MUST already exist in Supabase Vault. This
--     RPC does NOT provision Vault entries — operator pre-creates the
--     secret, then calls this RPC.
--   - Authorisation: callers reach this RPC only via service-role (or
--     a higher-level admin RPC). The function does NOT enforce
--     tenant-membership because anon callers cannot rotate.

create or replace function public.rotate_subject_ref_key(
  p_tenant_id           uuid,
  p_vault_secret_name   text
)
returns table (
  key_version int,
  status      text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_version int;
begin
  if p_tenant_id is null then
    raise exception 'rotate_subject_ref_key: p_tenant_id is null';
  end if;
  if p_vault_secret_name is null or length(p_vault_secret_name) = 0 then
    raise exception 'rotate_subject_ref_key: p_vault_secret_name is empty';
  end if;

  -- Demote current active (if any) to 'rotating'. There is at most one
  -- 'active' row per tenant (unique constraint on (tenant_id, key_version)
  -- only — uniqueness of status is enforced by this procedure).
  update public.subject_ref_keys
     set status = 'rotating'
   where tenant_id = p_tenant_id
     and status    = 'active';

  -- Determine the next version. coalesce handles the very-first-key case.
  select coalesce(max(key_version), 0) + 1
    into v_next_version
    from public.subject_ref_keys
   where tenant_id = p_tenant_id;

  insert into public.subject_ref_keys
    (tenant_id, key_version, algorithm, vault_secret_name, status)
  values
    (p_tenant_id, v_next_version, 'HMAC-SHA-256', p_vault_secret_name, 'active');

  return query
    select v_next_version, 'active'::text;
end;
$$;

-- Lock down: only service_role may invoke. Anon/authenticated are denied
-- by default for SECURITY DEFINER functions, but we make it explicit so
-- adding a tenant-role later requires an intentional GRANT, not a silent
-- inheritance from the schema default.
revoke all on function public.rotate_subject_ref_key(uuid, text) from public;
revoke all on function public.rotate_subject_ref_key(uuid, text) from anon;
revoke all on function public.rotate_subject_ref_key(uuid, text) from authenticated;

comment on function public.rotate_subject_ref_key(uuid, text) is
  'Atomic subject_ref_key rotation per RFC §P2.4. Service-role only. Caller must pre-create the Vault entry referenced by p_vault_secret_name.';
