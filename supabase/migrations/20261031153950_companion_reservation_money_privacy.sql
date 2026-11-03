-- Reservation display metadata follows expense privacy, including historic
-- changes and conflict responses. No new tables, grants or client credentials.
create or replace function public.triplog_redact_entity(p_row jsonb,p_privacy jsonb,p_role text) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare keys text[];
begin
  if p_role='owner' or coalesce(p_privacy->>'shareExpenses','true')<>'false' then return p_row; end if;
  if p_row->>'kind'='participant' then keys=array['p:individualSpent'];
  elsif p_row->>'kind'='trip' then keys=array['p:totalBudget'];
  elsif p_row->>'kind'='reservation' then keys=array['p:quotedAmount','p:quotedCurrency','p:linkedExpenseId'];
  else return p_row; end if;
  return jsonb_set(jsonb_set(p_row,'{data}',coalesce(p_row->'data','{}')-keys,true),'{field_versions}',coalesce(p_row->'field_versions','{}')-keys,true);
end $$;

create function public.triplog_validate_reservation_money() returns trigger
language plpgsql security invoker set search_path='' as $$
declare previous_money jsonb='{}'; current_money jsonb; privacy jsonb; actor_role text;
begin
  if new.kind<>'reservation' then return new; end if;
  if new.data ? 'p:quotedAmount' and new.data->'p:quotedAmount'<>'null'::jsonb and
    (jsonb_typeof(new.data->'p:quotedAmount')<>'number' or (new.data->>'p:quotedAmount')::numeric<0 or (new.data->>'p:quotedAmount')::numeric>9007199254740991)
    then raise exception 'INVALID_RESERVATION_AMOUNT'; end if;
  if coalesce(new.data->>'p:quotedCurrency','')<>'' and new.data->>'p:quotedCurrency' !~ '^[A-Z]{3}$' then raise exception 'INVALID_RESERVATION_CURRENCY'; end if;
  if tg_op='UPDATE' then previous_money=jsonb_build_object('amount',old.data->'p:quotedAmount','currency',old.data->'p:quotedCurrency','expense',old.data->'p:linkedExpenseId');
  else previous_money=jsonb_build_object('amount',null,'currency',null,'expense',null); end if;
  current_money=jsonb_build_object('amount',new.data->'p:quotedAmount','currency',new.data->'p:quotedCurrency','expense',new.data->'p:linkedExpenseId');
  if previous_money is distinct from current_money then
    select t.privacy into privacy from public.triplog_trips t where t.id=new.trip_id;
    actor_role=public.triplog_sync_role(new.updated_by,new.trip_id);
    if actor_role is distinct from 'owner' and coalesce(privacy->>'shareExpenses','true')='false' then raise exception 'PRIVATE_DATA_NOT_SHARED'; end if;
  end if;
  return new;
end $$;
revoke all on function public.triplog_validate_reservation_money() from public,anon,authenticated;
grant execute on function public.triplog_validate_reservation_money() to service_role;
create trigger triplog_reservation_money_validation before insert or update on public.triplog_entities
for each row execute function public.triplog_validate_reservation_money();
