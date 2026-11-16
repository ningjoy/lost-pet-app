-- Fake users. All three have the password: password123
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'alice@example.com',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Alice"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'bob@example.com',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Bob"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333',
   'authenticated', 'authenticated', 'carol@example.com',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Carol"}',
   now(), now(), '', '', '', '');

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', now(), now(), now()
from auth.users u
where u.email in ('alice@example.com', 'bob@example.com', 'carol@example.com');

-- The sign-up trigger already made the profiles; add home locations
update public.profiles set
  home_location = st_makepoint(-88.2073, 40.1106)::geography, alert_radius_miles = 1
  where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set
  home_location = st_makepoint(-88.2150, 40.1130)::geography, alert_radius_miles = 2
  where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set
  home_location = st_makepoint(-88.2300, 40.1000)::geography, alert_radius_miles = 1
  where id = '33333333-3333-3333-3333-333333333333';

insert into public.pets (id, owner_id, name, species, breed, description) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'Biscuit', 'Dog', 'Golden retriever mix', 'Red collar, shy around strangers.'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'Luna', 'Cat', 'Tabby', 'Green eyes, missing part of one ear.'),
  ('aaaaaaaa-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333',
   'Pepper', 'Dog', 'Beagle', 'Wears a blue tag, very friendly.'),
  ('aaaaaaaa-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222',
   'Milo', 'Cat', 'Siamese', 'Always at home.');

-- Biscuit and Pepper are lost; Luna was found; Milo was never lost
insert into public.lost_reports (
  id, pet_id, owner_id, last_seen_location, last_seen_at, status, closed_at
) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111',
   st_makepoint(-88.2090, 40.1115)::geography, now() - interval '3 hours', 'open', null),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000003',
   '33333333-3333-3333-3333-333333333333',
   st_makepoint(-88.2310, 40.1010)::geography, now() - interval '5 hours', 'open', null),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002',
   '11111111-1111-1111-1111-111111111111',
   st_makepoint(-88.2060, 40.1100)::geography, now() - interval '3 days', 'found',
   now() - interval '2 days');

insert into public.sightings (
  report_id, reporter_id, location, seen_at, note, status
) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
   st_makepoint(-88.2105, 40.1122)::geography, now() - interval '2 hours',
   'Near the bus stop on Green St.', 'confirmed'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333',
   st_makepoint(-88.2130, 40.1140)::geography, now() - interval '1 hour',
   'Ran toward the park.', 'unconfirmed'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
   st_makepoint(-88.1900, 40.1300)::geography, now() - interval '90 minutes',
   'Looked like him but a different collar.', 'rejected'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   st_makepoint(-88.2320, 40.1020)::geography, now() - interval '4 hours',
   'Heard barking behind the library.', 'unconfirmed');
