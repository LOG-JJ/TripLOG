revoke all on public.triplog_trips from public, anon;
revoke all on public.triplog_trip_members from public, anon;
revoke all on public.triplog_trip_invites from public, anon;

grant select, insert, update, delete on public.triplog_trips to authenticated;
grant select, insert, update, delete on public.triplog_trip_members to authenticated;
grant select, insert, update, delete on public.triplog_trip_invites to authenticated;;
