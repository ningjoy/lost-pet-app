-- Checks pet ownership without triggering row level security,
-- so the pets and lost_reports rules no longer refer to each other.
create function public.owns_pet(p_pet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pets p
    where p.id = p_pet_id and p.owner_id = (select auth.uid())
  );
$$;

revoke execute on function public.owns_pet(uuid) from public, anon;
grant execute on function public.owns_pet(uuid) to authenticated;

drop policy "own reports insert" on public.lost_reports;
create policy "own reports insert" on public.lost_reports
  for insert to authenticated with check (
    owner_id = (select auth.uid()) and public.owns_pet(pet_id)
  );

drop policy "own reports update" on public.lost_reports;
create policy "own reports update" on public.lost_reports
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and public.owns_pet(pet_id));
