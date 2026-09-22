-- Audited incident repair after enabling the safe write gateway. Resolve the
-- affected trip and actor from the committed receipt; never seed generated IDs.
-- Other environments have no matching incident and perform no data writes.
do $$
declare incident record; matched integer=0;
begin
  for incident in
    select l.trip_id,l.sequence,t.owner_id,t.sync_revision
    from public.triplog_change_log l
    join public.triplog_operation_receipts r on r.trip_id=l.trip_id and r.operation_id=l.operation_id
    join public.triplog_trips t on t.id=l.trip_id
    where l.sequence=88 and l.created_at='2026-09-21 10:20:27.135086+00'::timestamptz
      and jsonb_array_length(r.request->'patches')=27
      and (select count(*) from jsonb_array_elements(r.request->'patches') p where p->>'action'='delete' and p->>'kind'='itinerary')=13
      and (select count(*) from jsonb_array_elements(r.request->'patches') p where p->>'action'='delete' and p->>'kind'='expense')=1
  loop
    matched=matched+1;
    if matched>1 then raise exception 'AMBIGUOUS_INCIDENT'; end if;
    if exists(select 1 from public.triplog_operation_receipts r where r.trip_id=incident.trip_id
      and r.actor_id=incident.owner_id and r.request=jsonb_build_object('action','restore-change','sequence',incident.sequence)
      and r.result->>'status'='applied') then continue; end if;
    if incident.sync_revision<>incident.sequence then raise exception 'HISTORY_CHANGED'; end if;
    perform public.triplog_restore_change(incident.owner_id,incident.trip_id,incident.sequence,gen_random_uuid());
  end loop;
end $$;
