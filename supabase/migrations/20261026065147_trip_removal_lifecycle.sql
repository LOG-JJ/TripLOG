-- Self-removal preserves the shared trip until its last accepted member leaves.
-- Receipts contain only operation metadata; no deleted travel content is kept.
create table public.triplog_trip_removal_receipts (
  actor_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  trip_id uuid not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(actor_id,operation_id)
);
create table public.triplog_attachment_cleanup (
  actor_id uuid not null,
  operation_id uuid not null,
  trip_id uuid not null,
  object_paths text[] not null,
  created_at timestamptz not null default now(),
  primary key(actor_id,operation_id)
);
alter table public.triplog_trip_removal_receipts enable row level security;
alter table public.triplog_attachment_cleanup enable row level security;
revoke all on public.triplog_trip_removal_receipts,public.triplog_attachment_cleanup from public,anon,authenticated;
grant select,insert,update,delete on public.triplog_trip_removal_receipts,public.triplog_attachment_cleanup to service_role;

create function public.triplog_remove_trip(p_actor uuid,p_trip uuid,p_operation uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  t public.triplog_trips;
  prior public.triplog_trip_removal_receipts;
  remaining integer;
  next_owner uuid;
  next_name text;
  next_app_id text;
  paths text[];
  result jsonb;
begin
  if p_actor is null or p_operation is null or p_trip is null then raise exception 'INVALID_REMOVAL'; end if;
  -- A lost HTTP response must never turn a retry into another removal.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor::text||':'||p_operation::text,0));
  select * into prior from public.triplog_trip_removal_receipts where actor_id=p_actor and operation_id=p_operation;
  if found then
    if prior.trip_id<>p_trip then raise exception 'OPERATION_ID_REUSED'; end if;
    return prior.result;
  end if;
  select * into t from public.triplog_trips where id=p_trip for update;
  if not found or public.triplog_sync_role(p_actor,p_trip) is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  select count(*) into remaining from (
    select user_id from public.triplog_trip_members where trip_id=p_trip and status='accepted'
    union select t.owner_id
  ) members where user_id<>p_actor;
  if remaining>0 then
    if t.owner_id=p_actor then
      select user_id,display_name into next_owner,next_name from public.triplog_trip_members
        where trip_id=p_trip and status='accepted' and user_id<>p_actor
        order by case when role='editor' then 0 else 1 end,joined_at,user_id limit 1;
      if next_owner is null then raise exception 'INVALID_OWNER'; end if;
      next_app_id=t.app_trip_id;
      while exists(select 1 from public.triplog_trips where owner_id=next_owner and app_trip_id=next_app_id and id<>p_trip) loop
        next_app_id=gen_random_uuid()::text;
      end loop;
      update public.triplog_trip_members set role='owner' where trip_id=p_trip and user_id=next_owner;
      update public.triplog_trips set owner_id=next_owner,app_trip_id=next_app_id,
        travel_state=jsonb_set(travel_state,'{collaboration}',coalesce(travel_state->'collaboration','{}'::jsonb)
          ||jsonb_build_object('ownerId',next_owner,'ownerName',coalesce(next_name,'여행 소유자'),'ownerEmail',''),true)
        where id=p_trip;
    end if;
    delete from public.triplog_trip_members where trip_id=p_trip and user_id=p_actor;
    update public.triplog_trip_invites set status='revoked' where trip_id=p_trip and created_by=p_actor and status='open';
    update public.triplog_trips set channel_epoch=gen_random_uuid() where id=p_trip;
    result=jsonb_build_object('ok',true,'removed',true,'serverDeleted',false,'remainingMembers',remaining);
  else
    select coalesce(array_agg(object_path),'{}'::text[]) into paths from public.triplog_attachments where trip_id=p_trip;
    if exists(select 1 from unnest(paths) value where value !~ ('^'||p_trip::text||'/[a-f0-9]{64}$')) then raise exception 'INVALID_ATTACHMENT_PATH'; end if;
    if cardinality(paths)>0 then
      insert into public.triplog_attachment_cleanup(actor_id,operation_id,trip_id,object_paths) values(p_actor,p_operation,p_trip,paths);
    end if;
    -- This outbox predates FK-backed collections and must be removed explicitly.
    delete from public.triplog_notification_outbox where trip_id=p_trip;
    delete from public.triplog_trips where id=p_trip;
    result=jsonb_build_object('ok',true,'removed',true,'serverDeleted',true,'remainingMembers',0);
  end if;
  insert into public.triplog_trip_removal_receipts(actor_id,operation_id,trip_id,result) values(p_actor,p_operation,p_trip,result);
  return result;
end $$;
revoke all on function public.triplog_remove_trip(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.triplog_remove_trip(uuid,uuid,uuid) to service_role;
