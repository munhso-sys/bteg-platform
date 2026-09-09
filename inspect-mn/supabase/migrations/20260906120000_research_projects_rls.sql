-- Additive Research persistence (RD-D01/D02).
-- Safe on empty local DB and on inspect-bteg (no DROP of existing objects).
-- Organization boundary = user_profiles.heltes_id (platform unit id).

create extension if not exists pgcrypto;

-- Minimal portal stubs for local empty databases (no-op when already present).
create table if not exists public.roles (
  id text primary key,
  label text not null,
  description text,
  sort_order integer not null default 100
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
  updated_at timestamptz not null default now()
);

create table if not exists public.app_data_store (
  key text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;
alter table public.app_data_store enable row level security;

create or replace function public.current_user_organization_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nullif(trim(heltes_id), '')
  from public.user_profiles
  where user_id = auth.uid()
    and status = 'active'
  limit 1;
$$;

revoke all on function public.current_user_organization_id() from public;
grant execute on function public.current_user_organization_id() to authenticated;

create or replace function public.current_user_has_research_edit()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles up
    where up.user_id = auth.uid()
      and up.status = 'active'
      and (
        up.role_id = 'admin'
        or up.role_id in ('inspector', 'manager', 'editor')
        or up.role_id is not null
      )
  );
$$;

revoke all on function public.current_user_has_research_edit() from public;
grant execute on function public.current_user_has_research_edit() to authenticated;

create table if not exists public.research_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  created_by uuid not null references auth.users (id) on delete restrict,
  updated_by uuid references auth.users (id) on delete set null,
  title text not null,
  description text not null default '',
  category text not null default '',
  priority text not null default 'medium'
    check (priority = any (array['low'::text, 'medium'::text, 'high'::text])),
  status text not null default 'active'
    check (status = any (array['active'::text, 'completed'::text, 'hold'::text])),
  owner text not null default '',
  result_summary text not null default '',
  next_step text not null default '',
  start_date text not null default '',
  end_date text not null default '',
  extended_end_date text not null default '',
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  issue text not null default '',
  pending_decision text not null default '',
  is_urgent boolean not null default false,
  file_name text not null default '',
  file_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists research_projects_organization_id_idx
  on public.research_projects (organization_id);

create index if not exists research_projects_created_by_idx
  on public.research_projects (created_by);

create table if not exists public.research_program_initiatives (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  created_by uuid not null references auth.users (id) on delete restrict,
  updated_by uuid references auth.users (id) on delete set null,
  pillar_id text not null,
  no integer not null default 0,
  title text not null,
  owner text not null default '',
  department text not null default '',
  score numeric not null default 0,
  target numeric not null default 100,
  status text not null default 'planned',
  year integer not null,
  start_date text not null default '',
  end_date text not null default '',
  quarters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists research_program_initiatives_organization_id_idx
  on public.research_program_initiatives (organization_id);

alter table public.research_projects enable row level security;
alter table public.research_program_initiatives enable row level security;

-- Fail closed: no policies for anon.
revoke all on table public.research_projects from anon;
revoke all on table public.research_program_initiatives from anon;
grant select, insert, update, delete on table public.research_projects to authenticated;
grant select, insert, update, delete on table public.research_program_initiatives to authenticated;

drop policy if exists research_projects_select_own_org on public.research_projects;
create policy research_projects_select_own_org
  on public.research_projects
  for select
  to authenticated
  using (
    organization_id = public.current_user_organization_id()
    and public.current_user_organization_id() is not null
  );

drop policy if exists research_projects_insert_own_org on public.research_projects;
create policy research_projects_insert_own_org
  on public.research_projects
  for insert
  to authenticated
  with check (
    organization_id = public.current_user_organization_id()
    and public.current_user_organization_id() is not null
    and created_by = auth.uid()
    and public.current_user_has_research_edit()
  );

drop policy if exists research_projects_update_own_org on public.research_projects;
create policy research_projects_update_own_org
  on public.research_projects
  for update
  to authenticated
  using (
    organization_id = public.current_user_organization_id()
    and public.current_user_organization_id() is not null
    and public.current_user_has_research_edit()
  )
  with check (
    organization_id = public.current_user_organization_id()
    and public.current_user_organization_id() is not null
  );

drop policy if exists research_projects_delete_own_org on public.research_projects;
create policy research_projects_delete_own_org
  on public.research_projects
  for delete
  to authenticated
  using (
    organization_id = public.current_user_organization_id()
    and public.current_user_organization_id() is not null
    and public.current_user_has_research_edit()
  );

drop policy if exists research_program_select_own_org on public.research_program_initiatives;
create policy research_program_select_own_org
  on public.research_program_initiatives
  for select
  to authenticated
  using (
    organization_id = public.current_user_organization_id()
    and public.current_user_organization_id() is not null
  );

drop policy if exists research_program_insert_own_org on public.research_program_initiatives;
create policy research_program_insert_own_org
  on public.research_program_initiatives
  for insert
  to authenticated
  with check (
    organization_id = public.current_user_organization_id()
    and public.current_user_organization_id() is not null
    and created_by = auth.uid()
    and public.current_user_has_research_edit()
  );

drop policy if exists research_program_update_own_org on public.research_program_initiatives;
create policy research_program_update_own_org
  on public.research_program_initiatives
  for update
  to authenticated
  using (
    organization_id = public.current_user_organization_id()
    and public.current_user_organization_id() is not null
    and public.current_user_has_research_edit()
  )
  with check (
    organization_id = public.current_user_organization_id()
    and public.current_user_organization_id() is not null
  );

drop policy if exists research_program_delete_own_org on public.research_program_initiatives;
create policy research_program_delete_own_org
  on public.research_program_initiatives
  for delete
  to authenticated
  using (
    organization_id = public.current_user_organization_id()
    and public.current_user_organization_id() is not null
    and public.current_user_has_research_edit()
  );
