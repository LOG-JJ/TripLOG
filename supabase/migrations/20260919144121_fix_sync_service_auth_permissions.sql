-- Edge verifies the actor with auth.getUser before calling this service-only RPC.
-- Existing foreign keys validate actor existence without granting SELECT on auth.users.
create or replace function public.triplog_create_sync(p_actor uuid,p_app_id text,p_snapshot jsonb,p_entities jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare tid uuid;
begin
  if p_actor is null then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;
  insert into public.triplog_trips(app_trip_id,owner_id,trip_name,start_date,end_date,travel_state,privacy)
  values(p_app_id,p_actor,coalesce(p_snapshot->>'tripName','새 여행'),nullif(p_snapshot->>'startDate','')::date,nullif(p_snapshot->>'endDate','')::date,p_snapshot,
    coalesce(p_snapshot#>'{collaboration,privacy}','{}'))
  on conflict(owner_id,app_trip_id) do nothing returning id into tid;
  if tid is null then select id into tid from public.triplog_trips where owner_id=p_actor and app_trip_id=p_app_id; return tid; end if;
  insert into public.triplog_trip_members(trip_id,user_id,role,status,display_name) values(tid,p_actor,'owner','accepted',left(coalesce(p_snapshot#>>'{collaboration,ownerName}','여행 소유자'),80));
  perform public.triplog_initialize_sync(p_actor,tid,(select updated_at from public.triplog_trips where id=tid),p_entities);
  return tid;
end $$;
revoke all on function public.triplog_create_sync(uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.triplog_create_sync(uuid,text,jsonb,jsonb) to service_role;
