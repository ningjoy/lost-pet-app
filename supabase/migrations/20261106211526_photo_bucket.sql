insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pet-photos',
  'pet-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "upload own pet photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'pet-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "update own pet photos" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'pet-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "delete own pet photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'pet-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
