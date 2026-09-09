-- P0-01 restrictive lock for app_data_store.
-- Apply ONLY after application writers use SUPABASE_SERVICE_ROLE_KEY exclusively.
-- Classification: restrictive / not backward compatible with anon writers.

alter table public.app_data_store enable row level security;

drop policy if exists "app_data_store_select" on public.app_data_store;
drop policy if exists "app_data_store_insert" on public.app_data_store;
drop policy if exists "app_data_store_update" on public.app_data_store;
drop policy if exists "app_data_store_delete" on public.app_data_store;
drop policy if exists app_data_store_select on public.app_data_store;
drop policy if exists app_data_store_insert on public.app_data_store;
drop policy if exists app_data_store_update on public.app_data_store;
drop policy if exists app_data_store_delete on public.app_data_store;

revoke all on table public.app_data_store from anon;
revoke all on table public.app_data_store from authenticated;

grant all on table public.app_data_store to service_role;
