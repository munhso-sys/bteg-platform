-- Local/empty-DB bootstrap for portal core tables referenced by later migrations.
-- Additive IF NOT EXISTS — safe if production already has these objects.

create extension if not exists pgcrypto;

create table if not exists public.roles (
  id text primary key,
  label text not null,
  description text,
  sort_order integer not null default 100
);

create table if not exists public.permissions (
  id text primary key,
  label text not null,
  module text not null,
  description text
);

create table if not exists public.role_permissions (
  role_id text not null references public.roles (id) on delete cascade,
  permission_id text not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  phone text,
  heltes_id text,
  heltes_name text,
  alba_id text,
  alba_name text,
  position_id text,
  position_name text,
  role_id text references public.roles (id),
  status text not null default 'active'
    check (status = any (array['pending'::text, 'active'::text, 'suspended'::text])),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  telegram_id text
);

create table if not exists public.app_data_store (
  key text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_profiles enable row level security;
alter table public.app_data_store enable row level security;

-- Temporary open policies for local bootstrap of app_data_store until lock migration.
-- Production currently has equivalent open policies; lock migration removes them later.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_data_store' and policyname = 'app_data_store_select'
  ) then
    create policy app_data_store_select on public.app_data_store for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_data_store' and policyname = 'app_data_store_insert'
  ) then
    create policy app_data_store_insert on public.app_data_store for insert with check (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_data_store' and policyname = 'app_data_store_update'
  ) then
    create policy app_data_store_update on public.app_data_store for update using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_data_store' and policyname = 'app_data_store_delete'
  ) then
    create policy app_data_store_delete on public.app_data_store for delete using (true);
  end if;
end $$;

insert into public.permissions (id, label, module, description)
values ('module.results.view', 'Results view', 'results', 'bootstrap')
on conflict (id) do nothing;
