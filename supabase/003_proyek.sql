-- Tahap 3: tim, proyek, dan tugas.
-- Anggota tim hanya bisa melihat proyek dan tugas timnya. Data keuangan tetap privat.
-- Jalankan di Supabase: SQL Editor > New query > tempel > Run.

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  title text not null,
  client text,
  kind text not null default 'video' check (kind in ('video', 'foto', 'editing', 'lainnya')),
  status text not null default 'brief'
    check (status in ('brief', 'praproduksi', 'shooting', 'editing', 'revisi', 'selesai', 'lunas')),
  shoot_date date,
  deadline date,
  links text,
  notes text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  assignee uuid references public.profiles (id) on delete set null,
  due_date date,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

-- Pemasukan bisnis bisa ditandai ke proyek (hanya terlihat oleh pemilik transaksi)
alter table public.transactions
  add column if not exists project_id uuid references public.projects (id) on delete set null;

-- Cek keanggotaan tanpa memicu aturan akses berulang
create or replace function public.is_team_member(t uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (select 1 from public.team_members where team_id = t and user_id = auth.uid());
$$;

create or replace function public.is_team_owner(t uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (select 1 from public.teams where id = t and owner_id = auth.uid());
$$;

-- Pembuat tim otomatis jadi anggota
create or replace function public.add_team_owner()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.team_members (team_id, user_id) values (new.id, new.owner_id);
  return new;
end;
$$;

drop trigger if exists on_team_created on public.teams;
create trigger on_team_created
  after insert on public.teams
  for each row execute function public.add_team_owner();

-- Undang anggota lewat email. Orangnya harus sudah daftar di app.
create or replace function public.invite_member(t uuid, member_email text)
returns text
language plpgsql
security definer set search_path = ''
as $$
declare
  uid uuid;
begin
  if not public.is_team_owner(t) then
    return 'Hanya pemilik tim yang bisa mengundang.';
  end if;
  select id into uid from auth.users where lower(email) = lower(trim(member_email));
  if uid is null then
    return 'Email belum terdaftar. Minta dia daftar di app dulu.';
  end if;
  insert into public.team_members (team_id, user_id) values (t, uid) on conflict do nothing;
  return 'ok';
end;
$$;

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;

drop policy if exists "lihat tim sendiri" on public.teams;
create policy "lihat tim sendiri"
  on public.teams for select to authenticated
  using (public.is_team_member(id) or owner_id = auth.uid());
drop policy if exists "buat tim" on public.teams;
create policy "buat tim"
  on public.teams for insert to authenticated
  with check (owner_id = auth.uid());
drop policy if exists "pemilik ubah tim" on public.teams;
create policy "pemilik ubah tim"
  on public.teams for update to authenticated
  using (owner_id = auth.uid());

drop policy if exists "lihat anggota tim" on public.team_members;
create policy "lihat anggota tim"
  on public.team_members for select to authenticated
  using (public.is_team_member(team_id));
drop policy if exists "pemilik atau diri sendiri keluar" on public.team_members;
create policy "pemilik atau diri sendiri keluar"
  on public.team_members for delete to authenticated
  using (public.is_team_owner(team_id) or user_id = auth.uid());

drop policy if exists "proyek tim" on public.projects;
create policy "proyek tim"
  on public.projects for all to authenticated
  using (public.is_team_member(team_id))
  with check (public.is_team_member(team_id));

drop policy if exists "tugas tim" on public.tasks;
create policy "tugas tim"
  on public.tasks for all to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.is_team_member(p.team_id)))
  with check (exists (select 1 from public.projects p where p.id = project_id and public.is_team_member(p.team_id)));
