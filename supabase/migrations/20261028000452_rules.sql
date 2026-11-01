alter table public.profiles enable row level security;
alter table public.pets enable row level security;
alter table public.lost_reports enable row level security;
alter table public.sightings enable row level security;
alter table public.push_subscriptions enable row level security;

-- profiles: you see and edit only your own (this also hides home locations)
create policy "own profile read" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "own profile update" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- pets: owners manage their own; others can see pets that have an open report
create policy "pets read" on public.pets
  for select to authenticated using (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.lost_reports r
      where r.pet_id = pets.id and r.status = 'open'
    )
  );
create policy "own pets insert" on public.pets
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "own pets update" on public.pets
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "own pets delete" on public.pets
  for delete to authenticated using (owner_id = (select auth.uid()));

-- lost reports: everyone signed in sees open ones; owners see and manage theirs
create policy "reports read" on public.lost_reports
  for select to authenticated using (
    status = 'open' or owner_id = (select auth.uid())
  );
create policy "own reports insert" on public.lost_reports
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "own reports update" on public.lost_reports
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- sightings: readable on open reports (and on your own); anyone can post to an open report
create policy "sightings read" on public.sightings
  for select to authenticated using (
    exists (
      select 1 from public.lost_reports r
      where r.id = sightings.report_id
        and (r.status = 'open' or r.owner_id = (select auth.uid()))
    )
  );
create policy "sightings insert" on public.sightings
  for insert to authenticated with check (
    reporter_id = (select auth.uid())
    and exists (
      select 1 from public.lost_reports r
      where r.id = report_id and r.status = 'open'
    )
  );
create policy "owner updates sightings" on public.sightings
  for update to authenticated using (
    exists (
      select 1 from public.lost_reports r
      where r.id = sightings.report_id and r.owner_id = (select auth.uid())
    )
  );

-- push subscriptions: private to their owner
create policy "own subscriptions" on public.push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- create a profile row whenever someone signs up
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
