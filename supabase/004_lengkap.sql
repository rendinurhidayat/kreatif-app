-- Versi lengkap: profil usaha dan invoice. Keduanya hanya milik pemilik akun.
-- Jalankan di Supabase: SQL Editor > New query > tempel > Run.

create table if not exists public.business_settings (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  business_name text,
  contact text,
  address text,
  payment_info text,
  terms text,
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  number text not null,
  client text not null,
  project_id uuid references public.projects (id) on delete set null,
  items jsonb not null default '[]', -- [{ "desc": "...", "qty": 1, "price": 1000000 }]
  discount bigint not null default 0,
  paid_amount bigint not null default 0, -- DP yang sudah dibayar
  issue_date date not null default current_date,
  due_date date,
  notes text,
  terms text,
  status text not null default 'draft' check (status in ('draft', 'terkirim', 'lunas')),
  transaction_id uuid references public.transactions (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists invoices_owner_created on public.invoices (owner_id, created_at desc);

alter table public.business_settings enable row level security;
alter table public.invoices enable row level security;

drop policy if exists "profil usaha sendiri" on public.business_settings;
create policy "profil usaha sendiri"
  on public.business_settings for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "invoice sendiri" on public.invoices;
create policy "invoice sendiri"
  on public.invoices for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
