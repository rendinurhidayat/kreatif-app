-- Tahap 2: keuangan. Semua data hanya bisa dibaca dan diubah oleh pemiliknya.
-- Jalankan di Supabase: SQL Editor > New query > tempel > Run.

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  book text not null check (book in ('pribadi', 'bisnis')),
  type text not null check (type in ('masuk', 'keluar')),
  amount bigint not null check (amount > 0), -- dalam Rupiah
  category text not null,
  note text,
  date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists transactions_owner_date on public.transactions (owner_id, date desc);

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  direction text not null check (direction in ('hutang', 'piutang')), -- hutang = saya berhutang, piutang = orang berhutang ke saya
  person text not null,
  amount bigint not null check (amount > 0),
  due_date date,
  note text,
  paid boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.transactions enable row level security;
alter table public.debts enable row level security;

drop policy if exists "transaksi milik sendiri" on public.transactions;
create policy "transaksi milik sendiri"
  on public.transactions for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "hutang milik sendiri" on public.debts;
create policy "hutang milik sendiri"
  on public.debts for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
