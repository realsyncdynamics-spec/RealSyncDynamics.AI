-- P0 #2360 isolated WORKER LEASE / RETRY candidate; NOT a migration.
--
-- No "complete" or evidence ACK operation is intentionally exposed here.
-- A future transaction must insert hash-chain evidence + admin audit + ACK
-- atomically. A success flag without those rows would mislead users.
--
-- Service role only, no public endpoint. The dedicated worker runs only
-- after explicit approval and must never log plaintext DSR payloads.
begin;

create function public.dsr_claim_outbox(
  p_worker uuid, p_limit integer default 10, p_lease_seconds integer default 120
) returns table(
  tenant_id uuid, operation_id uuid, dsr_id uuid, event_type text,
  revision bigint, lease_epoch bigint
) language plpgsql security definer set search_path = '' as $$
begin
  if p_worker is null or p_limit is null or p_limit not between 1 and 20
     or p_lease_seconds is null or p_lease_seconds not between 10 and 600
  then
    raise exception 'invalid worker lease request' using errcode='22023';
  end if;

  -- Recover permanently abandoned tasks after the eighth failed claim.
  -- A crashed worker at the retry limit must not leave an invisible zombie.
  update public.dsr_outbox as o
     set evidence_status = 'failed',
         lease_owner = null,
         lease_until = null,
         last_error_code = 'RETRIES_EXHAUSTED'
   where o.evidence_status in ('pending','retry')
     and o.attempts >= 8
     and (o.lease_until is null or o.lease_until < clock_timestamp())
     and o.next_attempt_at <= clock_timestamp();

  return query
  with picked as (
    select o.tenant_id, o.operation_id
      from public.dsr_outbox as o
     where o.evidence_status in ('pending','retry')
       and o.attempts < 8
       and o.next_attempt_at <= clock_timestamp()
       and (o.lease_until is null or o.lease_until < clock_timestamp())
     order by o.created_at, o.operation_id
     for update of o skip locked
     limit p_limit
  )
  update public.dsr_outbox as o
     set lease_owner = p_worker,
         lease_until = clock_timestamp() + make_interval(secs => p_lease_seconds),
         lease_epoch = o.lease_epoch + 1,
         attempts = o.attempts + 1,
         evidence_status = 'retry'
    from picked
   where o.tenant_id = picked.tenant_id
     and o.operation_id = picked.operation_id
  returning o.tenant_id, o.operation_id, o.dsr_id, o.event_type,
            o.revision, o.lease_epoch;
end $$;

revoke all on function public.dsr_claim_outbox(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.dsr_claim_outbox(uuid,integer,integer) to service_role;

create function public.dsr_retry_outbox(
  p_tenant uuid, p_operation uuid, p_worker uuid, p_lease_epoch bigint,
  p_error_code text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  task public.dsr_outbox%rowtype;
  next_delay_seconds integer;
begin
  if p_tenant is null or p_operation is null or p_worker is null
     or p_lease_epoch is null
     or p_error_code is null
     or p_error_code !~ '^[A-Z0-9_]{1,64}$'
  then
    raise exception 'invalid retry receipt' using errcode='22023';
  end if;

  select * into task from public.dsr_outbox as o
   where o.tenant_id = p_tenant and o.operation_id = p_operation
   for update;
  if not found or task.evidence_status in ('complete','failed') then
    return false;
  end if;
  if task.lease_owner is distinct from p_worker
     or task.lease_epoch is distinct from p_lease_epoch
     or task.lease_until is null
     or task.lease_until <= clock_timestamp()
  then
    raise exception 'stale worker lease' using errcode='55000';
  end if;

  next_delay_seconds := least(3600, (5 * power(2, least(task.attempts - 1, 9)))::integer);

  update public.dsr_outbox
     set evidence_status = case when task.attempts >= 8 then 'failed' else 'retry' end,
         lease_owner = null, lease_until = null,
         next_attempt_at = clock_timestamp() + make_interval(secs => next_delay_seconds),
         last_error_code = p_error_code
   where tenant_id = p_tenant and operation_id = p_operation;
  return true;
end $$;

revoke all on function public.dsr_retry_outbox(uuid,uuid,uuid,bigint,text) from public,anon,authenticated;
grant execute on function public.dsr_retry_outbox(uuid,uuid,uuid,bigint,text) to service_role;

commit;
