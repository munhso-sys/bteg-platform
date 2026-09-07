-- Allow authenticated users to read their own profile (required for Research auth).
-- Bootstrap enabled RLS on user_profiles without a SELECT policy (deny-all for JWT clients).

drop policy if exists user_profiles_select_own on public.user_profiles;
create policy user_profiles_select_own
  on public.user_profiles
  for select
  to authenticated
  using (user_id = auth.uid());

grant select on table public.user_profiles to authenticated;
