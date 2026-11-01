create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  home_location geography(point, 4326),
  alert_radius_miles numeric not null default 1
    check (alert_radius_miles between 0.5 and 5),
  created_at timestamptz not null default now()
);

create table public.pets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  species text not null,
  breed text,
  description text,
  photo_paths text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.lost_reports (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  last_seen_location geography(point, 4326) not null,
  last_seen_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'found')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create unique index one_open_report_per_pet
  on public.lost_reports (pet_id) where status = 'open';
create index lost_reports_location_idx
  on public.lost_reports using gist (last_seen_location);

create table public.sightings (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.lost_reports (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  location geography(point, 4326) not null,
  seen_at timestamptz not null,
  posted_at timestamptz not null default now(),
  photo_path text,
  note text,
  status text not null default 'unconfirmed'
    check (status in ('unconfirmed', 'confirmed', 'rejected'))
);

create index sightings_location_idx
  on public.sightings using gist (location);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
