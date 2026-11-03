-- Only the allocation exception changes; membership, privacy and optimistic conflicts remain.
create or replace function public.triplog_apply_sync(p_actor uuid,p_trip uuid,p_operation jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare t public.triplog_trips; e public.triplog_entities; p jsonb; r public.triplog_operation_receipts;
  operation uuid; conflicts jsonb='[]'; changes jsonb='[]'; previous jsonb='[]'; f text; v jsonb;
  fields jsonb; versions jsonb; next_version bigint; seq bigint; result jsonb; role_name text;
  day_value text; time_value text; relation public.triplog_entities; linked public.triplog_entities; allowed_fields text[];
begin
  if (p_operation->>'protocolVersion')::integer is distinct from 2 then raise exception 'UPGRADE_REQUIRED'; end if;
  if jsonb_typeof(p_operation->'patches') is distinct from 'array' or jsonb_array_length(p_operation->'patches') not between 1 and 500 or octet_length(p_operation::text)>3145728 then raise exception 'INVALID_OPERATION'; end if;
  if exists(select 1 from jsonb_array_elements(p_operation->'patches') x group by x->>'kind',x->>'id' having count(*)>1) then raise exception 'INVALID_DUPLICATE_PATCH'; end if;
  operation=(p_operation->>'operationId')::uuid;
  if operation is null then raise exception 'INVALID_OPERATION_ID'; end if;
  select * into t from public.triplog_trips where id=p_trip for update;
  role_name=public.triplog_sync_role(p_actor,p_trip);
  if role_name is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  -- Allocations are shared by accepted members, even if their other access is read-only.
  if role_name='viewer' and exists (
    select 1 from jsonb_array_elements(p_operation->'patches') x
    where x->>'kind' is distinct from 'split' or coalesce(x->>'id','') !~ '^current:.+'
      or coalesce(x->>'action','') not in ('create','patch','delete')
      or (x->>'action'<>'delete' and (jsonb_typeof(x->'fields') is distinct from 'object'
        or (x->'fields') - 'p:value' <> '{}'::jsonb or not ((x->'fields') ? 'p:value')))
  ) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if t.collaboration_version<>2 then raise exception 'MIGRATION_REQUIRED'; end if;
  select * into r from public.triplog_operation_receipts where trip_id=p_trip and actor_id=p_actor and operation_id=operation;
  if found then
    if r.request<>p_operation then raise exception 'OPERATION_ID_REUSED'; end if;
    return public.triplog_redact_result(r.result,t.privacy,role_name);
  end if;
  if t.archived_at is not null then raise exception 'TRIP_ARCHIVED'; end if;
  if (select count(*) from public.triplog_entities where trip_id=p_trip and deleted_at is null)>20000 then raise exception 'INVALID_TRIP_SIZE_LIMIT'; end if;
  -- Check every patch before modifying any row: linked cost/expense updates are atomic.
  for p in select value from jsonb_array_elements(p_operation->'patches') loop
    if coalesce(p->>'kind','') not in ('trip','settings','itinerary','expense','packing','participant','reservation','progress','split','share','comment','note_update')
      or length(coalesce(p->>'id','')) not between 1 and 300 or coalesce(p->>'action','') not in ('create','patch','delete') then raise exception 'INVALID_PATCH'; end if;
    if p->>'kind' in ('itinerary','reservation','progress','note_update','comment') and t.privacy->>'shareItinerary'='false' then raise exception 'PRIVATE_DATA_NOT_SHARED'; end if;
    if p->>'kind' in ('expense','split','share') and t.privacy->>'shareExpenses'='false' then raise exception 'PRIVATE_DATA_NOT_SHARED'; end if;
    if t.privacy->>'shareExpenses'='false' and ((p->>'kind'='participant' and p->'fields' ? 'p:individualSpent') or (p->>'kind'='trip' and p->'fields' ? 'p:totalBudget') or (p->>'kind'='settings' and p->>'id'='settlement')) then raise exception 'PRIVATE_DATA_NOT_SHARED'; end if;
    if p->>'kind'='trip' and p->>'id'<>'settings' then raise exception 'INVALID_TRIP_ENTITY'; end if;
    if p->>'kind' in ('trip','settings') and p->>'action'='delete' then raise exception 'REQUIRED_ENTITY'; end if;
    if p->>'action'<>'delete' and jsonb_typeof(p->'fields') is distinct from 'object' then raise exception 'INVALID_FIELDS'; end if;
    if p->>'kind'='note_update' and (p->>'action'<>'create' or p#>>'{fields,p:document}' is distinct from 'shared-notes' or length(coalesce(p#>>'{fields,p:update}','')) not between 1 and 1048576) then raise exception 'INVALID_NOTE_UPDATE'; end if;
    if p->>'kind'='note_update' and (select coalesce(sum(octet_length(data::text)),0) from public.triplog_entities where trip_id=p_trip and kind='note_update' and deleted_at is null)+octet_length(p::text)>4194304 then raise exception 'INVALID_NOTE_SIZE'; end if;
    for f,v in select * from jsonb_each(coalesce(p->'fields','{}')) loop
      if f !~ '^(p:[a-zA-Z][a-zA-Z0-9_]*|g:(schedule|place|transit|voucher|money|payment|dates|destination|currency)|@position)$'
        or f in ('p:id','p:__proto__','p:constructor','p:prototype','p:collaboration','p:ownerId','p:accountId','p:serverId','p:role') then raise exception 'INVALID_FIELD'; end if;
      if f like 'g:%' and v<>'null' and jsonb_typeof(v)<>'object' then raise exception 'INVALID_GROUP'; end if;
      if f like 'g:%' and v<>'null' then
        allowed_fields=case f
          when 'g:schedule' then array['date','time','endTime']
          when 'g:place' then array['place','location','lat','lon','mapQuery','coordinateSource','coordinateSignature','coordinatePrecision','coordinateAddress','googlePlaceId']
          when 'g:transit' then array['trans','transits','duration','cost','syncExpense','expenseId']
          when 'g:voucher' then array['voucherName','voucherCode','voucherFile','voucherFileName']
          when 'g:money' then array['amount','foreignAmount','currency','exchangeRate','exchangeBase','mode']
          when 'g:payment' then array['paymentDate','payerKey','paymentMethod']
          when 'g:dates' then array['startDate','endDate']
          when 'g:destination' then array['travelMode','country','countryCode','city']
          when 'g:currency' then array['currencyCode','currencySymbol','currencyUnit','exchangeBase','exchangeRate','exchangeRateSource','exchangeRateUpdatedAt','currencyAutoMatchedCountryCode']
          else array[]::text[] end;
        if exists(select 1 from jsonb_object_keys(v) k where not(k=any(allowed_fields))) then raise exception 'INVALID_GROUP_FIELD'; end if;
        if exists(select 1 from jsonb_each(v) item where item.value<>'null' and case
          when item.key='transits' then jsonb_typeof(item.value)<>'array'
          when item.key='syncExpense' then jsonb_typeof(item.value)<>'boolean'
          when item.key in ('lat','lon') then jsonb_typeof(item.value) not in ('number','string')
          when item.key in ('duration','cost','amount','foreignAmount','exchangeRate','exchangeBase') then jsonb_typeof(item.value)<>'number'
          else jsonb_typeof(item.value)<>'string' end) then raise exception 'INVALID_FIELD_TYPE'; end if;
        if f='g:transit' and v ? 'transits' and v->'transits'<>'null' and exists(select 1 from jsonb_array_elements(v->'transits') item where jsonb_typeof(item)<>'object') then raise exception 'INVALID_TRANSIT'; end if;
        if not ((p->>'kind'='itinerary' and f in ('g:schedule','g:place','g:transit','g:voucher')) or (p->>'kind'='expense' and f in ('g:money','g:payment')) or (p->>'kind'='trip' and f in ('g:dates','g:destination','g:currency'))) then raise exception 'INVALID_GROUP'; end if;
      end if;
      if f like 'g:%' and v<>'null' and (v ?| array['id','__proto__','constructor','prototype','collaboration','accountId','serverId','role']) then raise exception 'INVALID_GROUP'; end if;
      if f in ('p:name','p:tripName','p:description','p:note','p:memo','p:date','p:title','p:type','p:reference','p:location','p:url','p:category','p:theme','p:time','p:endDate','p:leaderName') and v<>'null' and jsonb_typeof(v)<>'string' then raise exception 'INVALID_FIELD_TYPE'; end if;
      if p->>'kind'='itinerary' and f in ('p:date','p:time','p:endTime','p:place','p:location','p:lat','p:lon','p:trans','p:transits','p:duration','p:cost','p:syncExpense','p:expenseId','p:voucherName','p:voucherCode','p:voucherFile','p:voucherFileName') then raise exception 'INVALID_FIELD'; end if;
      if p->>'kind'='expense' and f in ('p:amount','p:foreignAmount','p:currency','p:exchangeRate','p:exchangeBase','p:mode','p:paymentDate','p:payerKey','p:paymentMethod') then raise exception 'INVALID_FIELD'; end if;
      if p->>'kind'='trip' and f in ('p:startDate','p:endDate','p:travelMode','p:country','p:countryCode','p:city','p:currencyCode','p:currencySymbol','p:currencyUnit','p:exchangeBase','p:exchangeRate','p:exchangeRateSource','p:exchangeRateUpdatedAt','p:currencyAutoMatchedCountryCode') then raise exception 'INVALID_FIELD'; end if;
      if p->>'kind'='trip' and f in ('p:entries','p:itineraryItems','p:packingList','p:companions','p:travelCompanion','p:settlement') then raise exception 'INVALID_FIELD'; end if;
      if f='@position' and (jsonb_typeof(v)<>'number' or abs(v::numeric)>9007199254740991) then raise exception 'INVALID_POSITION'; end if;
    end loop;
    select * into e from public.triplog_entities where trip_id=p_trip and kind=p->>'kind' and entity_id=p->>'id';
    if p->>'kind'='comment' and p->>'action'<>'create' and role_name<>'owner' and e.data->>'p:authorId' is distinct from p_actor::text then raise exception 'INVALID_COMMENT_PERMISSION'; end if;
    if p->>'kind'='comment' and p->'fields' ?| array['p:authorId','p:createdAt'] then raise exception 'INVALID_COMMENT_AUTHOR'; end if;
    if p->>'action'='create' then
      if e.entity_id is not null then conflicts=conflicts||jsonb_build_array(jsonb_build_object('kind',p->>'kind','id',p->>'id','reason',case when e.deleted_at is null then 'exists' else 'deleted' end,'current',to_jsonb(e))); end if;
    elsif e.entity_id is null or e.deleted_at is not null then
      if p->>'action'<>'delete' then conflicts=conflicts||jsonb_build_array(jsonb_build_object('kind',p->>'kind','id',p->>'id','reason','deleted','current',to_jsonb(e))); end if;
    elsif p->>'action'='delete' then
      if e.version<>coalesce((p->>'expectedVersion')::bigint,-1) or e.data<>p->'before' then conflicts=conflicts||jsonb_build_array(jsonb_build_object('kind',p->>'kind','id',p->>'id','reason','changed','current',to_jsonb(e))); end if;
    else
      for f,v in select * from jsonb_each(p->'fields') loop
        if coalesce(e.data->f,'null')=v then continue; end if;
        if coalesce((e.field_versions->>f)::bigint,0)<>coalesce((p#>>array['expectedFields',f])::bigint,-1)
          or coalesce(e.data->f,'null') is distinct from coalesce(p#>array['before',f],'null') then
          conflicts=conflicts||jsonb_build_array(jsonb_build_object('kind',p->>'kind','id',p->>'id','field',f,'reason','changed','current',to_jsonb(e)));
        end if;
      end loop;
    end if;
    fields=case when p->>'action'='create' then p->'fields' else coalesce(e.data,'{}')||coalesce(p->'fields','{}') end;
    if p->>'kind'='comment' and p->>'action'<>'delete' then
      if length(trim(coalesce(fields->>'p:body',''))) not between 1 and 3000 then raise exception 'INVALID_COMMENT_BODY'; end if;
      if nullif(fields->>'p:targetId','') is not null and not exists(select 1 from public.triplog_entities where trip_id=p_trip and kind='itinerary' and entity_id=fields->>'p:targetId' and deleted_at is null) then raise exception 'INVALID_COMMENT_TARGET'; end if;
    end if;
    if p->>'kind'='itinerary' and nullif(fields->>'p:assigneeId','') is not null and not exists(select 1 from public.triplog_trip_members where trip_id=p_trip and user_id::text=fields->>'p:assigneeId' and status='accepted') then raise exception 'INVALID_ASSIGNEE'; end if;
    if p->>'action'<>'delete' and p#>>'{fields,g:voucher,voucherFile}' like 'triplog-attachment:%'
      and not exists(select 1 from public.triplog_attachments a where a.trip_id=p_trip and a.digest=substring(p#>>'{fields,g:voucher,voucherFile}' from 20)) then raise exception 'INVALID_ATTACHMENT_REFERENCE'; end if;
    if p->>'action'<>'delete' and p#>>'{fields,g:voucher,voucherFile}' like 'data:%' then raise exception 'INVALID_INLINE_ATTACHMENT'; end if;
    if p->>'kind'='expense' and p->>'action'<>'delete' and fields#>>'{g:money,amount}' is not null then
      if jsonb_typeof(fields#>'{g:money,amount}')<>'number' or (fields#>>'{g:money,amount}')::numeric<0 or (fields#>>'{g:money,amount}')::numeric>9007199254740991 or mod((fields#>>'{g:money,amount}')::numeric,1)<>0 then raise exception 'INVALID_AMOUNT'; end if;
    end if;
    if p->>'action'<>'delete' then
      foreach f in array array['p:individualSpent','p:totalBudget'] loop
        if fields ? f and fields->f<>'null' then
          if jsonb_typeof(fields->f)<>'number' or (fields->>f)::numeric not between 0 and 9007199254740991 or mod((fields->>f)::numeric,1)<>0 then raise exception 'INVALID_AMOUNT'; end if;
        end if;
      end loop;
      for day_value in select value from unnest(array[fields#>>'{g:schedule,date}',fields#>>'{g:dates,startDate}',fields#>>'{g:dates,endDate}',fields->>'p:date',fields->>'p:endDate']) value loop
        if day_value is not null and day_value<>'' and not (p->>'kind'='expense' and day_value='__pretrip__') then
          if day_value !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'INVALID_DATE'; end if;
          begin perform day_value::date; exception when others then raise exception 'INVALID_DATE'; end;
        end if;
      end loop;
      for time_value in select value from unnest(array[fields#>>'{g:schedule,time}',fields#>>'{g:schedule,endTime}',fields->>'p:time']) value loop
        if time_value is not null and time_value<>'' and time_value !~ '^([01]\d|2[0-3]):[0-5]\d$' then raise exception 'INVALID_TIME'; end if;
      end loop;
      if p->>'kind'='trip' and fields#>>'{g:dates,startDate}'>fields#>>'{g:dates,endDate}' then raise exception 'INVALID_DATE_RANGE'; end if;
      if fields#>>'{g:place,lat}' is not null and (abs((fields#>>'{g:place,lat}')::numeric)>90 or fields#>>'{g:place,lon}' is null) then raise exception 'INVALID_COORDINATE'; end if;
      if fields#>>'{g:place,lon}' is not null and (abs((fields#>>'{g:place,lon}')::numeric)>180 or fields#>>'{g:place,lat}' is null) then raise exception 'INVALID_COORDINATE'; end if;
      if fields#>>'{g:transit,cost}' is not null and (fields#>>'{g:transit,cost}')::numeric<0 then raise exception 'INVALID_AMOUNT'; end if;
      if fields#>>'{g:transit,duration}' is not null and (fields#>>'{g:transit,duration}')::numeric not between 0 and 10080 then raise exception 'INVALID_DURATION'; end if;
    end if;
    if p->>'kind'='trip' and (fields ? 'p:ownerId' or fields ? 'p:collaboration' or fields ? 'p:__proto__') then raise exception 'INVALID_FIELD'; end if;
  end loop;
  if jsonb_array_length(conflicts)>0 then
    result=jsonb_build_object('status','conflict','operationId',operation,'conflicts',conflicts);
    insert into public.triplog_operation_receipts values(p_trip,p_actor,operation,p_operation,result,now());
    return public.triplog_redact_result(result,t.privacy,role_name);
  end if;
  for p in select value from jsonb_array_elements(p_operation->'patches') loop
    select * into e from public.triplog_entities where trip_id=p_trip and kind=p->>'kind' and entity_id=p->>'id';
    previous=previous||jsonb_build_array(case when e.entity_id is null then jsonb_build_object('kind',p->>'kind','entity_id',p->>'id','missing',true) else to_jsonb(e) end);
    if p->>'action'='delete' then
      if e.entity_id is null or e.deleted_at is not null then continue; end if;
      update public.triplog_entities set deleted_at=now(),version=version+1,updated_at=now(),updated_by=p_actor
        where trip_id=p_trip and kind=p->>'kind' and entity_id=p->>'id' returning * into e;
    else
      fields=case when p->>'action'='create' then '{}'::jsonb else e.data end;
      versions=case when p->>'action'='create' then '{}'::jsonb else e.field_versions end;
      next_version=coalesce(e.version,0)+1;
      for f,v in select * from jsonb_each(p->'fields') loop
        if v='null' then fields=fields-f; else fields=jsonb_set(fields,array[f],v,true); end if;
        versions=jsonb_set(versions,array[f],to_jsonb(next_version),true);
      end loop;
      if p->>'kind'='comment' and p->>'action'='create' then
        fields=fields||jsonb_build_object('p:authorId',p_actor,'p:createdAt',now());
        versions=versions||jsonb_build_object('p:authorId',next_version,'p:createdAt',next_version);
      end if;
      insert into public.triplog_entities(trip_id,kind,entity_id,data,version,field_versions,updated_by)
      values(p_trip,p->>'kind',p->>'id',fields,next_version,versions,p_actor)
      on conflict(trip_id,kind,entity_id) do update set data=excluded.data,version=excluded.version,field_versions=excluded.field_versions,updated_by=p_actor,updated_at=now()
      returning * into e;
    end if;
    changes=changes||jsonb_build_array(to_jsonb(e));
  end loop;
  -- Validate links against the post-command state, so linked edits either commit together or roll back together.
  for relation in select * from public.triplog_entities i where i.trip_id=p_trip and i.kind='itinerary' and i.deleted_at is null
    and i.data#>>'{g:transit,syncExpense}'='true' and nullif(i.data#>>'{g:transit,expenseId}','') is not null
    and exists(select 1 from jsonb_array_elements(p_operation->'patches') x where
      (x->>'kind'='itinerary' and x->>'id'=i.entity_id and (x->>'action'<>'patch' or x->'fields' ?| array['g:transit','g:schedule']))
      or (x->>'kind'='expense' and x->>'id'=i.data#>>'{g:transit,expenseId}' and (x->>'action'<>'patch' or x->'fields' ?| array['g:money','p:date']))) loop
    select * into linked from public.triplog_entities where trip_id=p_trip and kind='expense' and entity_id=relation.data#>>'{g:transit,expenseId}' and deleted_at is null;
    if linked.entity_id is null or linked.data#>'{g:money,amount}' is distinct from relation.data#>'{g:transit,cost}'
      or linked.data->>'p:date' is distinct from relation.data#>>'{g:schedule,date}' then raise exception 'INVALID_LINKED_EXPENSE'; end if;
  end loop;
  seq=t.sync_revision+1;
  update public.triplog_trips set sync_revision=seq,updated_at=now(),
    trip_name=coalesce((select data->>'p:tripName' from public.triplog_entities where trip_id=p_trip and kind='trip' and entity_id='settings'),trip_name)
  where id=p_trip;
  insert into public.triplog_change_log values(p_trip,seq,p_actor,operation,changes,previous,now());
  insert into public.triplog_notification_outbox(trip_id,sequence) values(p_trip,seq);
  result=jsonb_build_object('status','applied','operationId',operation,'cursor',seq,'changes',changes,'committedAt',now());
  insert into public.triplog_operation_receipts values(p_trip,p_actor,operation,p_operation,result,now());
  return public.triplog_redact_result(result,t.privacy,role_name);
end $$;
