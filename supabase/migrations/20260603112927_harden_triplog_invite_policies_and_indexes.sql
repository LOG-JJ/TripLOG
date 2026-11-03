create index if not exists triplog_trips_owner_idx
  on public.triplog_trips(owner_id);

create index if not exists triplog_trip_invites_created_by_idx
  on public.triplog_trip_invites(created_by);

drop policy if exists "owners can manage invites" on public.triplog_trip_invites;
drop policy if exists "authenticated users can resolve open invite links" on public.triplog_trip_invites;
drop policy if exists "owners and authenticated users can read invites" on public.triplog_trip_invites;
create policy "owners and authenticated users can read invites"
  on public.triplog_trip_invites
  for select
  to authenticated
  using (
    private.triplog_is_trip_owner(trip_id)
    or (status = 'open' and expires_at > now())
  );

drop policy if exists "owners can create invites" on public.triplog_trip_invites;
create policy "owners can create invites"
  on public.triplog_trip_invites
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and private.triplog_is_trip_owner(trip_id)
  );

drop policy if exists "owners can update invites" on public.triplog_trip_invites;
create policy "owners can update invites"
  on public.triplog_trip_invites
  for update
  to authenticated
  using (private.triplog_is_trip_owner(trip_id))
  with check (
    created_by = (select auth.uid())
    and private.triplog_is_trip_owner(trip_id)
  );

drop policy if exists "owners can delete invites" on public.triplog_trip_invites;
create policy "owners can delete invites"
  on public.triplog_trip_invites
  for delete
  to authenticated
  using (private.triplog_is_trip_owner(trip_id));;
