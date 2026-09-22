-- Restore a committed change atomically, including tombstones, without uploading
-- a device snapshot. A newer edit to any affected entity aborts the whole restore.
create function public.triplog_restore_change(p_actor uuid,p_trip uuid,p_sequence bigint,p_operation uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  t public.triplog_trips; source public.triplog_change_log;
  e public.triplog_entities; original jsonb; changed jsonb;
  previous jsonb='[]'; changes jsonb='[]'; role_name text;
  request jsonb; receipt public.triplog_operation_receipts;
  result jsonb; target_data jsonb; versions jsonb; seq bigint;
begin
  select * into t from public.triplog_trips where id=p_trip for update;
  role_name=public.triplog_sync_role(p_actor,p_trip);
  if role_name is null or role_name='viewer' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if t.archived_at is not null then raise exception 'TRIP_ARCHIVED'; end if;
  if p_operation is null then raise exception 'INVALID_OPERATION_ID'; end if;
  request=jsonb_build_object('action','restore-change','sequence',p_sequence);
  select * into receipt from public.triplog_operation_receipts where trip_id=p_trip and actor_id=p_actor and operation_id=p_operation;
  if found then
    if receipt.request is distinct from request then raise exception 'OPERATION_ID_REUSED'; end if;
    return public.triplog_redact_result(receipt.result,t.privacy,role_name);
  end if;
  select * into source from public.triplog_change_log where trip_id=p_trip and sequence=p_sequence;
  if not found then raise exception 'INVALID_HISTORY'; end if;
  if role_name<>'owner' and source.actor_id is distinct from p_actor then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  for changed in select value from jsonb_array_elements(source.changes) loop
    if changed->>'kind'='note_update' then raise exception 'INVALID_HISTORY_KIND'; end if;
    if role_name<>'owner' and (
      (t.privacy->>'shareItinerary'='false' and changed->>'kind' in ('itinerary','reservation','progress','comment')) or
      (t.privacy->>'shareExpenses'='false' and changed->>'kind' in ('trip','expense','split','share','participant','settings'))
    ) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
    select * into e from public.triplog_entities where trip_id=p_trip and kind=changed->>'kind' and entity_id=changed->>'entity_id';
    if not found or e.version is distinct from (changed->>'version')::bigint then raise exception 'HISTORY_CHANGED'; end if;
  end loop;
  for changed in select value from jsonb_array_elements(source.changes) loop
    select value into original from jsonb_array_elements(source.before_changes)
      where value->>'kind'=changed->>'kind' and value->>'entity_id'=changed->>'entity_id';
    if original is null then raise exception 'INVALID_HISTORY'; end if;
    select * into e from public.triplog_entities where trip_id=p_trip and kind=changed->>'kind' and entity_id=changed->>'entity_id';
    previous=previous||jsonb_build_array(to_jsonb(e));
    target_data=case when original->>'missing'='true' then e.data else original->'data' end;
    select coalesce(jsonb_object_agg(field,e.version+1),'{}') into versions
      from (select jsonb_object_keys(e.data) as field union select jsonb_object_keys(target_data) as field) fields;
    update public.triplog_entities set data=target_data,version=e.version+1,field_versions=versions,updated_by=p_actor,updated_at=now(),
      deleted_at=case when original->>'missing'='true' then now() else (original->>'deleted_at')::timestamptz end
      where trip_id=p_trip and kind=e.kind and entity_id=e.entity_id returning * into e;
    changes=changes||jsonb_build_array(to_jsonb(e));
  end loop;
  -- Restoring an older transaction must not break links created afterwards.
  if exists(select 1 from public.triplog_entities i left join public.triplog_entities x
    on x.trip_id=i.trip_id and x.kind='expense' and x.entity_id=i.data#>>'{g:transit,expenseId}' and x.deleted_at is null
    where i.trip_id=p_trip and i.kind='itinerary' and i.deleted_at is null and i.data#>>'{g:transit,syncExpense}'='true'
      and nullif(i.data#>>'{g:transit,expenseId}','') is not null
      and (x.entity_id is null or x.data#>'{g:money,amount}' is distinct from i.data#>'{g:transit,cost}' or x.data->>'p:date' is distinct from i.data#>>'{g:schedule,date}'))
    then raise exception 'INVALID_LINKED_EXPENSE'; end if;
  seq=t.sync_revision+1;
  update public.triplog_trips set sync_revision=seq,updated_at=now(),
    trip_name=coalesce((select data->>'p:tripName' from public.triplog_entities where trip_id=p_trip and kind='trip' and entity_id='settings'),trip_name)
    where id=p_trip;
  insert into public.triplog_change_log values(p_trip,seq,p_actor,p_operation,changes,previous,now());
  insert into public.triplog_notification_outbox(trip_id,sequence) values(p_trip,seq);
  result=jsonb_build_object('status','applied','operationId',p_operation,'cursor',seq,'changes',changes,'committedAt',now());
  insert into public.triplog_operation_receipts values(p_trip,p_actor,p_operation,request,result,now());
  return public.triplog_redact_result(result,t.privacy,role_name);
end $$;
revoke all on function public.triplog_restore_change(uuid,uuid,bigint,uuid) from public,anon,authenticated;
grant execute on function public.triplog_restore_change(uuid,uuid,bigint,uuid) to service_role;
