begin;
create function public.dsr_mutate(
  p_tenant uuid, p_actor uuid, p_operation uuid, p_dsr uuid,
  p_expected bigint, p_action text, p_patch jsonb
) returns bigint language plpgsql security definer set search_path='' as $$
declare
  current_row public.dsr_requests%rowtype;
  updated public.dsr_requests%rowtype;
  receipt public.dsr_outbox%rowtype;
  allowed text[];
  event_name text;
  fingerprint bytea;
  revision_no bigint;
begin
  if p_tenant is null or p_actor is null or p_operation is null or p_dsr is null
     or p_expected is null or p_expected < 0 then raise exception 'missing identity or revision'; end if;
  perform 1 from public.memberships where tenant_id=p_tenant and user_id=p_actor
    and role in ('owner','admin','dpo','editor') for share;
  if not found then raise exception 'writer required' using errcode='42501'; end if;
  case p_action
    when 'update' then
      allowed := array['status','response_notes','assigned_to','subject_description','requester_name','affected_assets'];
      event_name := 'dsr.updated';
    when 'assign' then allowed := array['assigned_to']; event_name := 'dsr.assigned';
    when 'close' then allowed := array['status','response_notes']; event_name := 'dsr.closed';
    else raise exception 'unknown operation';
  end case;
  if jsonb_typeof(p_patch) is distinct from 'object' or p_patch - allowed <> '{}'::jsonb
     or (p_action <> 'close' and p_patch='{}') then raise exception 'invalid patch'; end if;
  if exists(select from jsonb_each(p_patch - 'affected_assets') f
    where jsonb_typeof(f.value) not in ('null','string')) then raise exception 'invalid text field'; end if;
  if p_patch ? 'affected_assets' then
    if jsonb_typeof(p_patch->'affected_assets') <> 'array' then raise exception 'invalid assets'; end if;
    if jsonb_array_length(p_patch->'affected_assets')>100 or exists (
      select from jsonb_array_elements(p_patch->'affected_assets') item
      where jsonb_typeof(item)<>'string' or length(item #>> '{}')>200
    ) then raise exception 'invalid assets'; end if;
  end if;
  if p_action='close' and not p_patch ? 'status' then p_patch:=p_patch || '{"status":"completed"}'; end if;
  if p_patch ? 'status' and (p_patch->>'status' is null or p_patch->>'status' not in
      ('received','in_progress','pending_verification','completed','rejected','overdue'))
    or p_action='close' and p_patch->>'status' not in ('completed','rejected')
    or p_action='assign' and nullif(trim(p_patch->>'assigned_to'),'') is null
    or length(p_patch->>'assigned_to')>254 or length(p_patch->>'requester_name')>200
    or length(p_patch->>'subject_description')>5000 or length(p_patch->>'response_notes')>5000
  then raise exception 'invalid patch value'; end if;

  fingerprint := sha256(convert_to(jsonb_build_array(p_operation,p_expected,p_patch)::text,'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended(p_tenant::text || p_operation::text,0));
  select * into receipt from public.dsr_outbox where tenant_id=p_tenant and operation_id=p_operation;
  if found then
    if receipt.actor_user_id<>p_actor or receipt.dsr_id<>p_dsr or receipt.event_type<>event_name
       or receipt.intake_fingerprint<>fingerprint then raise exception 'operation conflict' using errcode='23505'; end if;
    return receipt.revision;
  end if;
  select * into current_row from public.dsr_requests where id=p_dsr and tenant_id=p_tenant for update;
  if not found then raise exception 'request unavailable'; end if;
  select coalesce(max(revision),0) into revision_no from public.dsr_outbox where dsr_id=p_dsr and tenant_id=p_tenant;
  if revision_no<>p_expected then raise exception 'revision conflict'; end if;
  select * into updated from jsonb_populate_record(current_row,p_patch);
  if p_patch ? 'status' then
    updated.completed_at := case when updated.status in ('completed','rejected')
      then coalesce(current_row.completed_at,now()) end;
  end if;
  update public.dsr_requests set status=updated.status, response_notes=updated.response_notes,
    assigned_to=updated.assigned_to, subject_description=updated.subject_description,
    requester_name=updated.requester_name, affected_assets=updated.affected_assets,
    completed_at=updated.completed_at where id=p_dsr and tenant_id=p_tenant;
  insert into public.dsr_outbox(tenant_id,operation_id,actor_user_id,dsr_id,event_type,revision,intake_fingerprint,email_binding)
    values(p_tenant,p_operation,p_actor,p_dsr,event_name,revision_no+1,fingerprint,
      sha256(convert_to(jsonb_build_array('dsr-email-v1',p_tenant::text,p_operation::text,
        lower(btrim(current_row.requester_email)))::text,'UTF8')));
  return revision_no+1;
end $$;
revoke all on function public.dsr_mutate(uuid,uuid,uuid,uuid,bigint,text,jsonb) from public,anon,authenticated;
grant execute on function public.dsr_mutate(uuid,uuid,uuid,uuid,bigint,text,jsonb) to service_role;
commit;
