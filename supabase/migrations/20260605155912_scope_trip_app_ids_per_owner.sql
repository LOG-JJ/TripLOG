alter table public.triplog_trips
  drop constraint if exists triplog_trips_app_trip_id_key;

create unique index if not exists triplog_trips_owner_app_trip_id_idx
  on public.triplog_trips(owner_id, app_trip_id);

create index if not exists triplog_trips_app_trip_id_idx
  on public.triplog_trips(app_trip_id);;
