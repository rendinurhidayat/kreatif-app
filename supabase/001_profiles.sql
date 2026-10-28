-- Tahap 1: profil pengguna.
-- Jalankan di Supabase: SQL Editor > New query > tempel > Run.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Pengguna yang login boleh melihat profil (dibutuhkan nanti untuk tim)
drop policy if exists "profil terlihat oleh pengguna login" on public.profiles;
create policy "profil terlihat oleh pengguna login"
  on public.profiles for select
  to authenticated
  using (true);

-- Hanya pemilik yang boleh mengubah profilnya
drop policy if exists "ubah profil sendiri" on public.profiles;
create policy "ubah profil sendiri"
  on public.profiles for update
  to authenticated
  using (id = auth.uid());

-- Buat profil otomatis saat ada akun baru
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
