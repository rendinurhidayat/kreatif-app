-- Jobsly: detail job (no HP klien, lokasi, jam), foto profil, login Google/no HP.
-- Aman dijalankan ulang.

-- Detail job
alter table public.projects
  add column if not exists client_phone text,
  add column if not exists location text,
  add column if not exists maps_url text,
  add column if not exists shoot_time time,
  add column if not exists shoot_end time;

-- Foto profil
alter table public.profiles add column if not exists avatar_url text;

-- Profil otomatis juga untuk akun Google (name, avatar_url) dan no HP
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Tempat menyimpan foto profil. Setiap orang hanya boleh mengisi foldernya sendiri (nama folder = id akun).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "foto profil bisa dilihat" on storage.objects;
create policy "foto profil bisa dilihat"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "unggah foto profil sendiri" on storage.objects;
create policy "unggah foto profil sendiri"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "ubah foto profil sendiri" on storage.objects;
create policy "ubah foto profil sendiri"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "hapus foto profil sendiri" on storage.objects;
create policy "hapus foto profil sendiri"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
