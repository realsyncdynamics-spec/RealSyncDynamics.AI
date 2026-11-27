-- Review candidate for issue 2360. Apply only to an isolated database.
begin;
create table public.dsr_outbox (
  tenant_id uuid not null,
  operation_id uuid not null,
  actor_user_id uuid not null,
  -- SHA-256 over canonical payload + high-entropy tenant/operation IDs.
  -- No plaintext PII in the outbox; hashes are private to the service role.
  intake_fingerprint bytea not null check (octet_length(intake_fingerprint) = 32),
  email_binding bytea not null check (octet_length(email_binding) = 32),
  dsr_id uuid not null,
  event_type text not null check (event_type = 'dsr.created'),
  revision bigint not null check (revision > 0),
  evidence_status text not null default 'pending' check (evidence_status in ('pending','retry','complete','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  lease_owner uuid,
  lease_until timestamptz,
  lease_epoch bigint not null default 0 check (lease_epoch >= 0),
  last_error_code text check (length(last_error_code) <= 64),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (tenant_id, operation_id),
  unique (dsr_id, revision)
);
alter table public.dsr_outbox enable row level security;

-- A state transition can change lease/retry/status columns, but MUST NOT
-- rewrite the immutable identity/payload receipt, even under service_role.
create function public.dsr_outbox_protect_identity() returns trigger
  language plpgsql set search_path = '' as $
begin
  if row(new.tenant_id,new.operation_id,new.actor_user_id,new.dsr_id,
         new.event_type,new.revision,new.intake_fingerprint,new.email_binding)
     is distinct from
     row(old.tenant_id,old.operation_id,old.actor_user_id,old.dsr_id,
         old.event_type,old.revision,old.intake_fingerprint,old.email_binding)
  then
    raise exception 'immutable outbox receipt' using errcode = '23514';
  end if;
  return new;
end $;
revoke all on function public.dsr_outbox_protect_identity() from public,anon,authenticated;
create trigger dsr_outbox_identity_guard before update on public.dsr_outbox
  for each row execute function public.dsr_outbox_protect_identity();
revoke all on public.dsr_outbox from public, anon, authenticated;

create function public.dsr_intake(
  p_tenant uuid, p_actor uuid, p_operation uuid, p_type text, p_email text,
  p_name text default null, p_description text default null,
  p_assignee text default null, p_assets text[] default '{}'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  receipt public.dsr_outbox%rowtype;
  request public.dsr_requests%rowtype;
  v_fingerprint bytea;
  v_email_binding bytea;
begin
  if p_operation is null or p_tenant is null or p_actor is null then
    raise exception 'missing operation identity';
  end if;
  perform 1 from public.memberships where tenant_id=p_tenant and user_id=p_actor
    and role in ('owner','admin','dpo','editor') for share;
  if not found then raise exception 'writer required' using errcode='42501'; end if;
  if p_type is null or p_type not in ('access','erasure','portability','rectification','restriction','objection')
     or nullif(trim(p_email),'') is null or length(p_email)>254
     or length(p_name)>200 or length(p_description)>5000 or length(p_assignee)>254
     or cardinality(p_assets)>100 or exists(select from unnest(p_assets) a where a is null or length(a)>200)
  then raise exception 'invalid intake'; end if;

  -- The canonical request is bound to the operation, not to mutable
  -- dsr_requests fields. Replays keep working after assignment/redaction.
  v_fingerprint := pg_catalog.sha256(pg_catalog.convert_to(
    pg_catalog.jsonb_build_array('dsr-intake-v1',p_tenant::text,p_actor::text,
      p_operation::text,p_type,pg_catalog.btrim(p_email),
      p_name,p_description,p_assignee,coalesce(p_assets,'{}'::text[]))::text,
    'UTF8'));
  v_email_binding := pg_catalog.sha256(pg_catalog.convert_to(
    pg_catalog.jsonb_build_array('dsr-email-v1',p_tenant::text,
      p_operation::text,pg_catalog.lower(pg_catalog.btrim(p_email)))::text,
    'UTF8'));

  perform pg_advisory_xact_lock(hashtextextended(p_tenant::text || p_operation::text, 0));
  select * into receipt from public.dsr_outbox where tenant_id=p_tenant and operation_id=p_operation;
  if found then
    if receipt.actor_user_id <> p_actor then
      raise exception 'operation conflict' using errcode='23505';
    end if;
    -- Compare immutable operation receipt, NOT the live, mutable DSR row.
    -- The snapshot includes a random operation UUID to prevent easy
    -- dictionary matching of low-entropy requester data.
    if receipt.intake_fingerprint is distinct from v_fingerprint
       or receipt.email_binding is distinct from v_email_binding then
      raise exception 'operation conflict' using errcode='23505';
    end if;
    return receipt.dsr_id;
  end if;

  select * into request from jsonb_populate_record(null::public.dsr_requests,
    jsonb_build_object('affected_assets',coalesce(p_assets,'{}')));
  insert into public.dsr_requests(tenant_id,request_type,status,requester_email,requester_name,
    subject_description,assigned_to,affected_assets,metadata)
  values(p_tenant,p_type,'received',trim(p_email),p_name,p_description,p_assignee,request.affected_assets,'{}')
  returning id into request.id;
  insert into public.dsr_outbox
    (tenant_id,operation_id,actor_user_id,intake_fingerprint,email_binding,
     dsr_id,event_type,revision)
  values(p_tenant,p_operation,p_actor,v_fingerprint,v_email_binding,
         request.id,'dsr.created',1);
  return request.id;
end $$;
revoke all on function public.dsr_intake(uuid,uuid,uuid,text,text,text,text,text,text[]) from public,anon,authenticated;
grant execute on function public.dsr_intake(uuid,uuid,uuid,text,text,text,text,text,text[]) to service_role;
commit;
