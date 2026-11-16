-- Open lost reports within radius_miles of a point, newest first.
-- Runs with the caller's rights, so the reports security rule still applies.
create function public.reports_near(
  lat double precision,
  lng double precision,
  radius_miles double precision
)
returns table (
  id uuid,
  pet_id uuid,
  owner_id uuid,
  last_seen_at timestamptz,
  last_seen_lat double precision,
  last_seen_lng double precision,
  distance_miles double precision
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    r.id,
    r.pet_id,
    r.owner_id,
    r.last_seen_at,
    st_y(r.last_seen_location::geometry),
    st_x(r.last_seen_location::geometry),
    st_distance(r.last_seen_location, st_point(lng, lat)::geography) / 1609.344
  from public.lost_reports r
  where r.status = 'open'
    and st_dwithin(
      r.last_seen_location,
      st_point(lng, lat)::geography,
      radius_miles * 1609.344
    )
  order by r.last_seen_at desc;
$$;

-- Fix 1: a report can only be opened for a pet you own
drop policy "own reports insert" on public.lost_reports;
create policy "own reports insert" on public.lost_reports
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.pets p
      where p.id = pet_id and p.owner_id = (select auth.uid())
    )
  );

drop policy "own reports update" on public.lost_reports;
create policy "own reports update" on public.lost_reports
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.pets p
      where p.id = pet_id and p.owner_id = (select auth.uid())
    )
  );

-- Fix 2: owners of a report can change a sighting's status and nothing else
revoke update on public.sightings from authenticated;
grant update (status) on public.sightings to authenticated;
