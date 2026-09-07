-- P0-03: org-partitioned document store (additive).
-- Replaces shared mega-row app_data_store as system-of-record for tenant business JSON.
-- organization_id = user_profiles.heltes_id (same mapping as research_*).

create table if not exists public.org_app_data_store (
  organization_id text not null,
  key text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  primary key (organization_id, key),
  constraint org_app_data_store_organization_id_nonempty check (length(trim(organization_id)) > 0),
  constraint org_app_data_store_key_nonempty check (length(trim(key)) > 0)
);

create index if not exists org_app_data_store_key_idx
  on public.org_app_data_store (key);

create index if not exists org_app_data_store_updated_at_idx
  on public.org_app_data_store (updated_at desc);

alter table public.org_app_data_store enable row level security;

revoke all on table public.org_app_data_store from anon;
revoke all on table public.org_app_data_store from authenticated;
grant select, insert, update, delete on table public.org_app_data_store to authenticated;
grant all on table public.org_app_data_store to service_role;

drop policy if exists org_app_data_store_select_own on public.org_app_data_store;
create policy org_app_data_store_select_own
  on public.org_app_data_store
  for select
  to authenticated
  using (
    organization_id = public.current_user_organization_id()
    and public.current_user_organization_id() is not null
  );

drop policy if exists org_app_data_store_insert_own on public.org_app_data_store;
create policy org_app_data_store_insert_own
  on public.org_app_data_store
  for insert
  to authenticated
  with check (
    organization_id = public.current_user_organization_id()
    and public.current_user_organization_id() is not null
    and (updated_by is null or updated_by = auth.uid())
  );

drop policy if exists org_app_data_store_update_own on public.org_app_data_store;
create policy org_app_data_store_update_own
  on public.org_app_data_store
  for update
  to authenticated
  using (
    organization_id = public.current_user_organization_id()
    and public.current_user_organization_id() is not null
  )
  with check (
    organization_id = public.current_user_organization_id()
    and public.current_user_organization_id() is not null
  );

drop policy if exists org_app_data_store_delete_own on public.org_app_data_store;
create policy org_app_data_store_delete_own
  on public.org_app_data_store
  for delete
  to authenticated
  using (
    organization_id = public.current_user_organization_id()
    and public.current_user_organization_id() is not null
  );

-- Mark legacy global mega-keys as non-authoritative for tenant data (comment only).
comment on table public.org_app_data_store is
  'P0-03 tenant-scoped JSON documents. Do not store multi-tenant business data in public.app_data_store mega-rows.';
