-- Fix two bugs in the distribution queue (Phase 3 social orchestrator)
-- that together mean AUTO-approval posts are written but never claimed.
--
-- Bug 1 — approval_status CHECK constraint domain mismatch:
-- The constraint allowed ('auto', 'pending', 'approved', 'rejected') —
-- copy-pasted from `status`'s allowed values. But
-- DistributionQueue.persistEntry() (src/core/social-orchestrator/
-- distributionQueue.ts) writes entry.post.approvalStatus, whose real
-- domain is ('AUTO', 'REVIEW', 'BLOCKED'). Every insert with an AUTO or
-- REVIEW post violated the constraint.
--
-- Bug 2 — distribution_queue_claim_next() never matched status='auto':
-- its first branch required `status = 'pending' AND approval_status =
-- 'auto'`, but enqueue() always pairs AUTO posts with status='auto' (not
-- 'pending') and REVIEW posts with status='pending' (not approval_status
-- 'auto'). The two conditions were mutually exclusive, so AUTO entries —
-- the ones meant to skip human review — sat unclaimed forever unless a
-- human manually flipped them to 'approved'.

alter table public.distribution_queue_entries
  drop constraint if exists distribution_queue_entries_approval_status_check;

alter table public.distribution_queue_entries
  add constraint distribution_queue_entries_approval_status_check
  check (approval_status in ('AUTO', 'REVIEW', 'BLOCKED'));

alter table public.distribution_queue_entries
  alter column approval_status set default 'REVIEW';

create or replace function public.distribution_queue_claim_next(p_channel text)
returns table (
  id uuid,
  tenant_id uuid,
  post_id text,
  channel text,
  body text,
  hashtags text[],
  status text
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_id uuid;
begin
  -- Atomically claim the oldest auto/approved/retriable entry for this channel.
  update public.distribution_queue_entries
     set status = 'approved',
         attempts = attempts + 1,
         updated_at = now()
   where id = (
     select dqe.id
       from public.distribution_queue_entries dqe
      where dqe.channel = p_channel
        and (
          dqe.status = 'auto'
          or dqe.status = 'approved'
          or (dqe.status = 'failed'
              and dqe.attempts < dqe.max_attempts
              and (dqe.next_retry_at is null or dqe.next_retry_at <= now()))
        )
      order by created_at asc
      for update skip locked
      limit 1
   )
   returning distribution_queue_entries.id into v_id;

  if v_id is null then
    return;
  end if;

  return query
    select dqe.id, dqe.tenant_id, dqe.post_id, dqe.channel, dqe.body, dqe.hashtags, dqe.status
      from public.distribution_queue_entries dqe
     where dqe.id = v_id;
end;
$$;

revoke all on function public.distribution_queue_claim_next(text) from public;
grant execute on function public.distribution_queue_claim_next(text) to service_role;
