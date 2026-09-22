-- Requires the existing triplog-collaboration.sql schema.
-- Additive migration. Legacy travel_state is retained as an import/recovery source.
alter table public.triplog_trips add column if not exists collaboration_version integer not null default 1;
alter table public.triplog_trips add column if not exists sync_revision bigint not null default 0;
alter table public.triplog_trips add column if not exists channel_epoch uuid not null default gen_random_uuid();
alter table public.triplog_trips add column if not exists archived_at timestamptz;
alter table public.triplog_trips add column if not exists min_sync_cursor bigint not null default 0;
alter table public.triplog_trip_members drop constraint if exists triplog_trip_members_role_check;
alter table public.triplog_trip_members add constraint triplog_trip_members_role_check check (role in ('owner','member','editor','viewer'));
alter table public.triplog_trip_invites add column if not exists invite_role text not null default 'editor' check (invite_role in ('editor','viewer'));

create table public.triplog_entities (
  trip_id uuid not null references public.triplog_trips(id) on delete cascade,
  kind text not null check (kind in ('trip','settings','itinerary','expense','packing','participant','reservation','progress','split','share','comment','note_update')),
  entity_id text not null check (length(entity_id) between 1 and 300),
  data jsonb not null default '{}' check (jsonb_typeof(data)='object'),
  version bigint not null default 1,
  field_versions jsonb not null default '{}',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (trip_id,kind,entity_id)
);
create index triplog_entities_active on public.triplog_entities(trip_id,kind) where deleted_at is null;
create table public.triplog_operation_receipts (
  trip_id uuid not null references public.triplog_trips(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  request jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(trip_id,actor_id,operation_id)
);
create table public.triplog_change_log (
  trip_id uuid not null references public.triplog_trips(id) on delete cascade,
  sequence bigint not null,
  actor_id uuid references auth.users(id) on delete set null,
  operation_id uuid,
  changes jsonb not null,
  before_changes jsonb not null,
  created_at timestamptz not null default now(),
  primary key(trip_id,sequence)
);
create table public.triplog_recovery_snapshots (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.triplog_trips(id) on delete cascade,
  source text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
create index triplog_recovery_trip on public.triplog_recovery_snapshots(trip_id,created_at desc);
create table public.triplog_notification_outbox (
  trip_id uuid not null,
  sequence bigint not null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  primary key(trip_id,sequence),
  foreign key(trip_id,sequence) references public.triplog_change_log(trip_id,sequence) on delete cascade
);
create index triplog_notification_pending on public.triplog_notification_outbox(created_at) where delivered_at is null;

create table public.triplog_request_buckets (
  actor_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  bucket_start timestamptz not null,
  requests integer not null,
  primary key(actor_id,category,bucket_start)
);
create table public.triplog_settlement_snapshots (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.triplog_trips(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  operation_id uuid not null,
  cursor bigint not null,
  source_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  unique(trip_id,actor_id,operation_id)
);
create index triplog_settlement_latest on public.triplog_settlement_snapshots(trip_id,created_at desc);
alter table public.triplog_settlement_snapshots enable row level security;
revoke all on public.triplog_settlement_snapshots from public,anon,authenticated;
grant all on public.triplog_settlement_snapshots to service_role;
alter table public.triplog_request_buckets enable row level security;
revoke all on public.triplog_request_buckets from public,anon,authenticated;
grant all on public.triplog_request_buckets to service_role;
create function public.triplog_rate_limit(p_actor uuid,p_category text,p_limit integer) returns boolean
language plpgsql security invoker set search_path='' as $$
declare count_value integer;
begin
  insert into public.triplog_request_buckets values(p_actor,p_category,date_trunc('minute',clock_timestamp()),1)
  on conflict(actor_id,category,bucket_start) do update set requests=public.triplog_request_buckets.requests+1 returning requests into count_value;
  return count_value<=p_limit;
end $$;
revoke all on function public.triplog_rate_limit(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.triplog_rate_limit(uuid,text,integer) to service_role;

create table public.triplog_attachments (
  trip_id uuid not null references public.triplog_trips(id) on delete cascade,
  digest text not null check(digest ~ '^[0-9a-f]{64}$'),
  object_path text not null unique,
  content_type text not null,
  byte_size integer not null check(byte_size between 1 and 1572864),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key(trip_id,digest)
);
alter table public.triplog_attachments enable row level security;
revoke all on public.triplog_attachments from public,anon,authenticated;
grant all on public.triplog_attachments to service_role;
do $$ begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
    values('triplog-private-attachments','triplog-private-attachments',false,1572864,array['image/jpeg','image/png','image/gif','image/webp','application/pdf'])
    on conflict(id) do nothing;
  end if;
end $$;

alter table public.triplog_entities enable row level security;
alter table public.triplog_operation_receipts enable row level security;
alter table public.triplog_change_log enable row level security;
alter table public.triplog_recovery_snapshots enable row level security;
alter table public.triplog_notification_outbox enable row level security;
revoke all on public.triplog_entities,public.triplog_operation_receipts,public.triplog_change_log,public.triplog_recovery_snapshots,public.triplog_notification_outbox from public,anon,authenticated;
grant all on public.triplog_entities,public.triplog_operation_receipts,public.triplog_change_log,public.triplog_recovery_snapshots,public.triplog_notification_outbox to service_role;

-- A single server-only command boundary. No caller-controlled actor reaches these
-- functions except through the Edge Function's verified getUser() result.
create function public.triplog_sync_role(p_actor uuid,p_trip uuid) returns text
language sql stable security invoker set search_path='' as $$
  select case when t.owner_id=p_actor then 'owner' else m.role end
  from public.triplog_trips t left join public.triplog_trip_members m
  on m.trip_id=t.id and m.user_id=p_actor and m.status='accepted'
  where t.id=p_trip and (t.owner_id=p_actor or m.user_id=p_actor)
$$;

create function public.triplog_initialize_sync(p_actor uuid,p_trip uuid,p_updated_at timestamptz,p_entities jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare t public.triplog_trips; e jsonb;
begin
  select * into t from public.triplog_trips where id=p_trip for update;
  if public.triplog_sync_role(p_actor,p_trip) is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if t.collaboration_version=2 then return jsonb_build_object('initialized',true); end if;
  if t.updated_at is distinct from p_updated_at then raise exception 'LEGACY_CHANGED' using errcode='40001'; end if;
  insert into public.triplog_recovery_snapshots(trip_id,source,snapshot) values(p_trip,'legacy-migration',t.travel_state);
  for e in select value from jsonb_array_elements(p_entities) loop
    insert into public.triplog_entities(trip_id,kind,entity_id,data,version,field_versions,updated_by)
    values(p_trip,e->>'kind',e->>'id',e->'fields',1,
      (select coalesce(jsonb_object_agg(k,1),'{}') from jsonb_object_keys(e->'fields') k),p_actor);
  end loop;
  update public.triplog_trips set collaboration_version=2 where id=p_trip;
  return jsonb_build_object('initialized',true);
end $$;

create function public.triplog_create_sync(p_actor uuid,p_app_id text,p_snapshot jsonb,p_entities jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare tid uuid;
begin
  if p_actor is null or not exists(select 1 from auth.users where id=p_actor) then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;
  insert into public.triplog_trips(app_trip_id,owner_id,trip_name,start_date,end_date,travel_state,privacy)
  values(p_app_id,p_actor,coalesce(p_snapshot->>'tripName','새 여행'),nullif(p_snapshot->>'startDate','')::date,nullif(p_snapshot->>'endDate','')::date,p_snapshot,
    coalesce(p_snapshot#>'{collaboration,privacy}','{}'))
  on conflict(owner_id,app_trip_id) do nothing returning id into tid;
  if tid is null then select id into tid from public.triplog_trips where owner_id=p_actor and app_trip_id=p_app_id; return tid; end if;
  insert into public.triplog_trip_members(trip_id,user_id,role,status,display_name) values(tid,p_actor,'owner','accepted',left(coalesce(p_snapshot#>>'{collaboration,ownerName}','여행 소유자'),80));
  perform public.triplog_initialize_sync(p_actor,tid,(select updated_at from public.triplog_trips where id=tid),p_entities);
  return tid;
end $$;

create function public.triplog_redact_entity(p_row jsonb,p_privacy jsonb,p_role text) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare keys text[];
begin
  if p_role='owner' or coalesce(p_privacy->>'shareExpenses','true')<>'false' then return p_row; end if;
  if p_row->>'kind'='participant' then keys=array['p:individualSpent'];
  elsif p_row->>'kind'='trip' then keys=array['p:totalBudget']; else return p_row; end if;
  return jsonb_set(jsonb_set(p_row,'{data}',coalesce(p_row->'data','{}')-keys,true),'{field_versions}',coalesce(p_row->'field_versions','{}')-keys,true);
end $$;
create function public.triplog_redact_result(p_result jsonb,p_privacy jsonb,p_role text) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare rows jsonb; conflicts jsonb;
begin
  select coalesce(jsonb_agg(public.triplog_redact_entity(x,p_privacy,p_role)),'[]') into rows from jsonb_array_elements(coalesce(p_result->'changes','[]')) x
  where p_role='owner' or (
    not(coalesce(p_privacy->>'shareItinerary','true')='false' and x->>'kind' in ('itinerary','reservation','progress','comment','note_update'))
    and not(coalesce(p_privacy->>'shareExpenses','true')='false' and (x->>'kind' in ('expense','split','share') or (x->>'kind'='settings' and x->>'entity_id'='settlement'))));
  select coalesce(jsonb_agg(case when x ? 'current' then jsonb_set(x,'{current}',public.triplog_redact_entity(x->'current',p_privacy,p_role),true) else x end),'[]') into conflicts from jsonb_array_elements(coalesce(p_result->'conflicts','[]')) x
  where p_role='owner' or (
    not(coalesce(p_privacy->>'shareItinerary','true')='false' and x->>'kind' in ('itinerary','reservation','progress','comment','note_update'))
    and not(coalesce(p_privacy->>'shareExpenses','true')='false' and x->>'kind' in ('expense','split','share')));
  return p_result||jsonb_build_object('changes',rows,'conflicts',conflicts);
end $$;
revoke all on function public.triplog_redact_entity(jsonb,jsonb,text),public.triplog_redact_result(jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.triplog_redact_entity(jsonb,jsonb,text),public.triplog_redact_result(jsonb,jsonb,text) to service_role;

create function public.triplog_read_sync(p_actor uuid,p_trip uuid,p_after bigint default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare t public.triplog_trips; result jsonb; seq bigint; rows jsonb; privacy jsonb; role_name text;
begin
  -- The trip lock makes the snapshot/cursor one consistent view relative to writes.
  select * into t from public.triplog_trips where id=p_trip for share;
  role_name=public.triplog_sync_role(p_actor,p_trip);
  if role_name is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  privacy=t.privacy;
  if p_after is not null and p_after<t.min_sync_cursor then p_after=null; end if;
  if p_after is not null and p_after>t.sync_revision then raise exception 'INVALID_CURSOR'; end if;
  if p_after is null then
    select coalesce(jsonb_agg(public.triplog_redact_entity(to_jsonb(e),privacy,role_name) order by kind,entity_id),'[]') into rows
    from public.triplog_entities e where trip_id=p_trip and (kind<>'note_update' or deleted_at is null)
    and (role_name='owner' or not(kind in ('itinerary','reservation','progress','note_update','comment') and coalesce(privacy->>'shareItinerary','true')='false'))
    and (role_name='owner' or not((kind in ('expense','split','share') or (kind='settings' and entity_id='settlement')) and coalesce(privacy->>'shareExpenses','true')='false'));
    seq=t.sync_revision;
  else
    select coalesce(max(sequence),p_after) into seq from (select sequence from public.triplog_change_log where trip_id=p_trip and sequence>p_after order by sequence limit 100) page;
    select coalesce(jsonb_agg(public.triplog_redact_entity(change,privacy,role_name) order by sequence,change->>'kind',change->>'entity_id'),'[]') into rows
    from public.triplog_change_log l cross join lateral jsonb_array_elements(l.changes) change
    where trip_id=p_trip and sequence>p_after and sequence<=seq
    and (role_name='owner' or not(change->>'kind' in ('itinerary','reservation','progress','note_update','comment') and coalesce(privacy->>'shareItinerary','true')='false'))
    and (role_name='owner' or not(change->>'kind' in ('expense','split','share') and coalesce(privacy->>'shareExpenses','true')='false'));
  end if;
  return jsonb_build_object('tripId',p_trip,'appTripId',t.app_trip_id,'tripName',t.trip_name,'ownerId',t.owner_id,'cursor',seq,'head',t.sync_revision,'entities',rows,'privacy',privacy,'role',role_name,'epoch',t.channel_epoch,'full',p_after is null,'archivedAt',t.archived_at);
end $$;

create function public.triplog_apply_sync(p_actor uuid,p_trip uuid,p_operation jsonb)
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
  if role_name is null or role_name='viewer' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
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

create function public.triplog_sync_control(p_actor uuid,p_trip uuid,p_action text,p_data jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare role_name text; t public.triplog_trips; tok text; new_privacy jsonb; privacy_key text; default_value jsonb;
begin
  select * into t from public.triplog_trips where id=p_trip for update;
  role_name=public.triplog_sync_role(p_actor,p_trip);
  if role_name is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_action='profile' then
    update public.triplog_trip_members set display_name=left(p_data->>'displayName',80) where trip_id=p_trip and user_id=p_actor;
  elsif p_action='leave' then
    if role_name='owner' then raise exception 'OWNER_REQUIRED'; end if;
    delete from public.triplog_trip_members where trip_id=p_trip and user_id=p_actor;
    update public.triplog_trips set channel_epoch=gen_random_uuid() where id=p_trip;
  elsif role_name<>'owner' then raise exception 'OWNER_REQUIRED' using errcode='42501';
  elsif p_action='archive' then
    insert into public.triplog_recovery_snapshots(trip_id,source,snapshot)
      select p_trip,'before-trip-archive',jsonb_build_object('entities',coalesce(jsonb_agg(to_jsonb(e)),'[]'),'cursor',t.sync_revision) from public.triplog_entities e where trip_id=p_trip;
    update public.triplog_trips set archived_at=coalesce(archived_at,now()),channel_epoch=gen_random_uuid() where id=p_trip;
  elsif p_action='restore' then
    update public.triplog_trips set archived_at=null,channel_epoch=gen_random_uuid() where id=p_trip;
  elsif p_action='transfer-owner' then
    if p_data->>'userId'=p_actor::text or not exists(select 1 from public.triplog_trip_members where trip_id=p_trip and user_id::text=p_data->>'userId' and status='accepted') then raise exception 'INVALID_OWNER'; end if;
    update public.triplog_trip_members set role='editor' where trip_id=p_trip and user_id=p_actor;
    update public.triplog_trip_members set role='owner' where trip_id=p_trip and user_id::text=p_data->>'userId';
    update public.triplog_trips set owner_id=(p_data->>'userId')::uuid,channel_epoch=gen_random_uuid() where id=p_trip;
  elsif p_action='privacy' then
    new_privacy=t.privacy;
    foreach privacy_key in array array['shareItinerary','shareExpenses','showMemberEmail','allowInviteRequests'] loop
      default_value=to_jsonb(privacy_key<>'showMemberEmail');
      if p_data ? '_expected' and p_data->privacy_key=coalesce(p_data#>array['_expected',privacy_key],default_value) then continue; end if;
      if p_data ? '_expected' and coalesce(t.privacy->privacy_key,default_value) is distinct from coalesce(p_data#>array['_expected',privacy_key],default_value) then raise exception 'PRIVACY_CONFLICT'; end if;
      if jsonb_typeof(p_data->privacy_key) is distinct from 'boolean' then raise exception 'INVALID_PRIVACY'; end if;
      new_privacy=jsonb_set(new_privacy,array[privacy_key],p_data->privacy_key,true);
    end loop;
    update public.triplog_trips set privacy=new_privacy,channel_epoch=gen_random_uuid(),
      travel_state=case when new_privacy->>'shareItinerary'='false' then travel_state||'{"itineraryItems":[],"travelCompanion":{}}' else travel_state end
      ||case when new_privacy->>'shareExpenses'='false' then '{"entries":[]}'::jsonb else '{}'::jsonb end
      where id=p_trip;
  elsif p_action='member' then
    if p_data->>'userId'=t.owner_id::text then raise exception 'OWNER_CANNOT_BE_REMOVED'; end if;
    if p_data->>'role'='remove' then delete from public.triplog_trip_members where trip_id=p_trip and user_id=(p_data->>'userId')::uuid;
    elsif p_data->>'role' in ('editor','viewer') then update public.triplog_trip_members set role=p_data->>'role' where trip_id=p_trip and user_id=(p_data->>'userId')::uuid;
    else raise exception 'INVALID_ROLE'; end if;
    update public.triplog_trips set channel_epoch=gen_random_uuid() where id=p_trip;
  elsif p_action='invite' then
    if p_data->>'role' not in ('editor','viewer') then raise exception 'INVALID_ROLE'; end if;
    insert into public.triplog_trip_invites(token,trip_id,app_trip_id,trip_name,created_by,expires_at,invite_role)
    values(p_data->>'tokenHash',p_trip,t.app_trip_id,t.trip_name,p_actor,now()+interval '14 days',p_data->>'role');
  elsif p_action='revoke-invite' then
    update public.triplog_trip_invites set status='revoked' where id=(p_data->>'inviteId')::uuid and trip_id=p_trip;
  else raise exception 'UNKNOWN_CONTROL'; end if;
  return jsonb_build_object('ok',true);
end $$;

create function public.triplog_finalize_settlement(p_actor uuid,p_trip uuid,p_operation uuid,p_cursor bigint,p_hash text,p_result jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t public.triplog_trips; role_name text; saved public.triplog_settlement_snapshots;
begin
  select * into t from public.triplog_trips where id=p_trip for update;
  role_name=public.triplog_sync_role(p_actor,p_trip);
  if role_name is null or role_name='viewer' then raise exception 'FORBIDDEN'; end if;
  if t.privacy->>'shareExpenses'='false' then raise exception 'PRIVATE_DATA_NOT_SHARED'; end if;
  select * into saved from public.triplog_settlement_snapshots where trip_id=p_trip and actor_id=p_actor and operation_id=p_operation;
  if found then
    if saved.source_hash<>p_hash then raise exception 'OPERATION_ID_REUSED'; end if;
    return to_jsonb(saved);
  end if;
  if t.archived_at is not null then raise exception 'TRIP_ARCHIVED'; end if;
  if t.sync_revision<>p_cursor then raise exception 'SETTLEMENT_STALE'; end if;
  if p_hash !~ '^[a-f0-9]{64}$' or jsonb_typeof(p_result) is distinct from 'object' then raise exception 'INVALID_SETTLEMENT'; end if;
  insert into public.triplog_settlement_snapshots(trip_id,actor_id,operation_id,cursor,source_hash,result)
  values(p_trip,p_actor,p_operation,p_cursor,p_hash,p_result) returning * into saved;
  update public.triplog_trips set sync_revision=sync_revision+1 where id=p_trip;
  insert into public.triplog_change_log values(p_trip,t.sync_revision+1,p_actor,p_operation,'[]','[]',now());
  insert into public.triplog_notification_outbox(trip_id,sequence) values(p_trip,t.sync_revision+1);
  return to_jsonb(saved);
end $$;
revoke all on function public.triplog_finalize_settlement(uuid,uuid,uuid,bigint,text,jsonb) from public,anon,authenticated;
grant execute on function public.triplog_finalize_settlement(uuid,uuid,uuid,bigint,text,jsonb) to service_role;

-- Compaction replaces a causally complete Yjs document, never plain text. Its
-- expected head prevents a concurrent update from disappearing between read/commit.
create function public.triplog_compact_note(p_actor uuid,p_trip uuid,p_head bigint,p_update text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare t public.triplog_trips; old_rows jsonb; changes jsonb; checkpoint public.triplog_entities; seq bigint;
begin
  select * into t from public.triplog_trips where id=p_trip for update;
  if coalesce(public.triplog_sync_role(p_actor,p_trip),'viewer')='viewer' then raise exception 'FORBIDDEN'; end if;
  if t.sync_revision<>p_head or t.archived_at is not null then return false; end if;
  if length(p_update) not between 1 and 1048576 then raise exception 'INVALID_NOTE_SIZE'; end if;
  if (select count(*)<64 and coalesce(sum(octet_length(data::text)),0)<1048576 from public.triplog_entities where trip_id=p_trip and kind='note_update' and deleted_at is null) then return false; end if;
  select jsonb_agg(to_jsonb(e)) into old_rows from public.triplog_entities e where trip_id=p_trip and kind='note_update' and deleted_at is null;
  with removed as (
    update public.triplog_entities set data='{}',deleted_at=now(),updated_at=now(),version=version+1 where trip_id=p_trip and kind='note_update' and deleted_at is null returning *
  ) select jsonb_agg(to_jsonb(removed)) into changes from removed;
  insert into public.triplog_entities(trip_id,kind,entity_id,data,version,field_versions,updated_by)
  values(p_trip,'note_update',gen_random_uuid()::text,jsonb_build_object('p:document','shared-notes','p:update',p_update),1,'{"p:document":1,"p:update":1}',p_actor) returning * into checkpoint;
  changes=changes||jsonb_build_array(to_jsonb(checkpoint)); seq=t.sync_revision+1;
  update public.triplog_trips set sync_revision=seq where id=p_trip;
  insert into public.triplog_change_log values(p_trip,seq,p_actor,gen_random_uuid(),changes,old_rows,now());
  insert into public.triplog_notification_outbox(trip_id,sequence) values(p_trip,seq);
  return true;
end $$;
revoke all on function public.triplog_compact_note(uuid,uuid,bigint,text) from public,anon,authenticated;
grant execute on function public.triplog_compact_note(uuid,uuid,bigint,text) to service_role;

-- Retry failed notifications even if no browser is currently polling.
create function public.triplog_flush_notifications(p_limit integer default 200) returns integer
language plpgsql security invoker set search_path='' as $$
declare row public.triplog_notification_outbox; epoch uuid; sent integer=0;
begin
  for row in select * from public.triplog_notification_outbox where delivered_at is null order by created_at limit least(greatest(p_limit,1),1000) for update skip locked loop
    select channel_epoch into epoch from public.triplog_trips where id=row.trip_id;
    perform realtime.send(jsonb_build_object('head',row.sequence,'protocolVersion',2),'changed','triplog:'||row.trip_id::text||':'||epoch::text,true);
    update public.triplog_notification_outbox set delivered_at=now() where trip_id=row.trip_id and sequence=row.sequence;
    sent=sent+1;
  end loop;
  return sent;
end $$;

-- Receipt IDs and entity tombstones are deliberately retained: an old offline
-- request must never be applied a second time or resurrect a deleted entity.
create function public.triplog_retention() returns integer
language plpgsql security invoker set search_path='' as $$
declare t public.triplog_trips; cutoff bigint; cleaned integer=0;
begin
  for t in select * from public.triplog_trips where collaboration_version=2 order by id for update skip locked loop
    select coalesce(min(sequence)-1,t.sync_revision) into cutoff from public.triplog_change_log where trip_id=t.id and created_at>=now()-interval '30 days';
    if cutoff>t.min_sync_cursor then
      update public.triplog_trips set min_sync_cursor=cutoff where id=t.id;
      delete from public.triplog_change_log where trip_id=t.id and sequence<=cutoff;
      cleaned=cleaned+1;
    end if;
  end loop;
  delete from public.triplog_notification_outbox where delivered_at<now()-interval '7 days';
  delete from public.triplog_request_buckets where bucket_start<now()-interval '1 hour';
  return cleaned;
end $$;
revoke all on function public.triplog_flush_notifications(integer),public.triplog_retention() from public,anon,authenticated;
grant execute on function public.triplog_flush_notifications(integer),public.triplog_retention() to service_role;

create view public.triplog_sync_health with(security_invoker=true) as
select (select count(*) from public.triplog_notification_outbox where delivered_at is null) as pending_notifications,
  (select min(created_at) from public.triplog_notification_outbox where delivered_at is null) as oldest_pending_notification,
  (select count(*) from public.triplog_operation_receipts where created_at>now()-interval '1 hour' and result->>'status'='conflict') as conflicts_last_hour,
  (select count(*) from public.triplog_operation_receipts where created_at>now()-interval '1 hour' and result->>'status'='applied') as applied_last_hour,
  (select pg_total_relation_size('public.triplog_operation_receipts')) as receipt_bytes,
  (select pg_total_relation_size('public.triplog_change_log')) as history_bytes;
revoke all on public.triplog_sync_health from public,anon,authenticated;
grant select on public.triplog_sync_health to service_role;

create function public.triplog_accept_sync_invite(p_actor uuid,p_token text,p_name text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare inv public.triplog_trip_invites;
begin
  select * into inv from public.triplog_trip_invites where token=p_token and status='open' and expires_at>now() for update;
  if inv.id is null then raise exception 'INVALID_INVITE'; end if;
  if (select privacy->>'allowInviteRequests' from public.triplog_trips where id=inv.trip_id)='false' then raise exception 'INVALID_INVITE'; end if;
  if p_actor is null then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;
  insert into public.triplog_trip_members(trip_id,user_id,display_name,role,status,invite_token)
  values(inv.trip_id,p_actor,left(p_name,80),inv.invite_role,'accepted',null)
  on conflict(trip_id,user_id) do nothing;
  return inv.trip_id;
end $$;

revoke all on function public.triplog_sync_role(uuid,uuid),public.triplog_initialize_sync(uuid,uuid,timestamptz,jsonb),public.triplog_create_sync(uuid,text,jsonb,jsonb),public.triplog_read_sync(uuid,uuid,bigint),public.triplog_apply_sync(uuid,uuid,jsonb),public.triplog_sync_control(uuid,uuid,text,jsonb),public.triplog_accept_sync_invite(uuid,text,text) from public,anon,authenticated;
grant execute on function public.triplog_sync_role(uuid,uuid),public.triplog_initialize_sync(uuid,uuid,timestamptz,jsonb),public.triplog_create_sync(uuid,text,jsonb,jsonb),public.triplog_read_sync(uuid,uuid,bigint),public.triplog_apply_sync(uuid,uuid,jsonb),public.triplog_sync_control(uuid,uuid,text,jsonb),public.triplog_accept_sync_invite(uuid,text,text) to service_role;

-- Old JSON reads can disclose fields that have since become private. All app data
-- reads and writes use the verified gateway, including membership and invites.
revoke all on public.triplog_trips,public.triplog_trip_members,public.triplog_trip_invites from authenticated;

create function private.triplog_can_join_sync(p_topic text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.triplog_trips t where p_topic='triplog:'||t.id::text||':'||t.channel_epoch::text
    and (t.owner_id=(select auth.uid()) or exists(select 1 from public.triplog_trip_members m
      where m.trip_id=t.id and m.user_id=(select auth.uid()) and m.status='accepted')))
$$;
revoke all on function private.triplog_can_join_sync(text) from public,anon;
grant execute on function private.triplog_can_join_sync(text) to authenticated;

-- Broadcast carries only an invalidation. The data API rechecks current membership.
create policy triplog_sync_broadcast_receive on realtime.messages for select to authenticated using (
  extension='broadcast' and private.triplog_can_join_sync((select realtime.topic()))
);
create policy triplog_sync_presence_read on realtime.messages for select to authenticated using (
  extension='presence' and private.triplog_can_join_sync((select realtime.topic()))
);
create policy triplog_sync_presence_write on realtime.messages for insert to authenticated with check (
  extension='presence' and private.triplog_can_join_sync((select realtime.topic()))
);
