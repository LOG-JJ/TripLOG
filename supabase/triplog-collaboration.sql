-- TripLOG collaboration schema for Supabase.
-- Apply this to the TripLOG Supabase project before enabling server-backed invites.
-- Keep service_role keys out of the browser; the app only needs the Project URL and publishable/anon key.

create extension if not exists pgcrypto;

create table if not exists public.triplog_trips (
  id uuid primary key default gen_random_uuid(),
  app_trip_id text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  trip_name text not null default '현재 여행',
  start_date date,
  end_date date,
  travel_state jsonb not null default '{}'::jsonb,
  privacy jsonb not null default jsonb_build_object(
    'shareItinerary', true,
    'shareExpenses', true,
    'showMemberEmail', false,
    'allowInviteRequests', true
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.triplog_trip_members (
  trip_id uuid not null references public.triplog_trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  display_name text not null default '여행 멤버',
  role text not null default 'member' check (role in ('owner', 'member')),
  status text not null default 'accepted' check (status in ('accepted', 'pending')),
  invite_token text,
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table if not exists public.triplog_trip_invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  trip_id uuid not null references public.triplog_trips(id) on delete cascade,
  app_trip_id text not null,
  trip_name text not null default '현재 여행',
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'revoked')),
  created_at timestamptz not null default now()
);

create index if not exists triplog_trip_members_user_idx
  on public.triplog_trip_members(user_id);

create index if not exists triplog_trips_owner_idx
  on public.triplog_trips(owner_id);

create index if not exists triplog_trip_invites_token_idx
  on public.triplog_trip_invites(token);

create index if not exists triplog_trip_invites_trip_idx
  on public.triplog_trip_invites(trip_id);

create index if not exists triplog_trip_invites_created_by_idx
  on public.triplog_trip_invites(created_by);

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.triplog_is_trip_owner(target_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.triplog_trips t
    where t.id = target_trip_id
      and t.owner_id = (select auth.uid())
  );
$$;

create or replace function private.triplog_is_trip_member(target_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.triplog_trip_members m
    where m.trip_id = target_trip_id
      and m.user_id = (select auth.uid())
      and m.status = 'accepted'
  );
$$;

create or replace function private.triplog_is_valid_invite(target_trip_id uuid, raw_token text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.triplog_trip_invites i
    where i.trip_id = target_trip_id
      and i.token = raw_token
      and i.status = 'open'
      and i.expires_at > now()
  );
$$;

alter table public.triplog_trips enable row level security;
alter table public.triplog_trip_members enable row level security;
alter table public.triplog_trip_invites enable row level security;

grant usage on schema public to authenticated;
revoke all on public.triplog_trips from public, anon;
revoke all on public.triplog_trip_members from public, anon;
revoke all on public.triplog_trip_invites from public, anon;
grant select, insert, update, delete on public.triplog_trips to authenticated;
grant select, insert, update, delete on public.triplog_trip_members to authenticated;
grant select, insert, update, delete on public.triplog_trip_invites to authenticated;

revoke all on function private.triplog_is_trip_owner(uuid) from public;
revoke all on function private.triplog_is_trip_member(uuid) from public;
revoke all on function private.triplog_is_valid_invite(uuid, text) from public;
grant execute on function private.triplog_is_trip_owner(uuid) to authenticated;
grant execute on function private.triplog_is_trip_member(uuid) to authenticated;
grant execute on function private.triplog_is_valid_invite(uuid, text) to authenticated;

drop policy if exists "trip owners can create trips" on public.triplog_trips;
create policy "trip owners can create trips"
  on public.triplog_trips
  for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "trip members can read trips" on public.triplog_trips;
create policy "trip members can read trips"
  on public.triplog_trips
  for select
  to authenticated
  using (
    owner_id = (select auth.uid())
    or private.triplog_is_trip_member(id)
  );

drop policy if exists "trip owners can update trips" on public.triplog_trips;
create policy "trip owners can update trips"
  on public.triplog_trips
  for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "trip owners can delete trips" on public.triplog_trips;
create policy "trip owners can delete trips"
  on public.triplog_trips
  for delete
  to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "members can read trip members" on public.triplog_trip_members;
create policy "members can read trip members"
  on public.triplog_trip_members
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or private.triplog_is_trip_owner(trip_id)
    or private.triplog_is_trip_member(trip_id)
  );

drop policy if exists "owners and invited users can create members" on public.triplog_trip_members;
create policy "owners and invited users can create members"
  on public.triplog_trip_members
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      private.triplog_is_trip_owner(trip_id)
      or private.triplog_is_valid_invite(trip_id, invite_token)
    )
  );

drop policy if exists "members can update themselves" on public.triplog_trip_members;
create policy "members can update themselves"
  on public.triplog_trip_members
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    or private.triplog_is_trip_owner(trip_id)
  )
  with check (
    user_id = (select auth.uid())
    or private.triplog_is_trip_owner(trip_id)
  );

drop policy if exists "owners can manage invites" on public.triplog_trip_invites;
drop policy if exists "authenticated users can resolve open invite links" on public.triplog_trip_invites;
drop policy if exists "owners and authenticated users can read invites" on public.triplog_trip_invites;
-- MVP client flow: authenticated users can resolve open invite links by token.
-- For production hardening, move token resolution to a Supabase Edge Function so open invite rows
-- are not broadly listable through the Data API.
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
  using (private.triplog_is_trip_owner(trip_id));
