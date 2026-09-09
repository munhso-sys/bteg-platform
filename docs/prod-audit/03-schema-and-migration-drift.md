# 03 — Schema and Migration Drift

## Sources compared

| Source | What was inspected |
|--------|--------------------|
| Git | `inspect-mn/supabase/migrations/`, `bgs-policy-compliance/supabase/migrations/` |
| Production | Supabase MCP `list_migrations`, `list_tables`, `information_schema`, `pg_policies`, `pg_constraint` on project `umswlpkjiwjohkolsyct` |
| Staging | **Not separately linked** in this workspace; no distinct staging project ref documented for portal |
| Generated TS DB types | **Not found** as `database.types.ts` for portal |

## Production public tables (canonical)

| Table | RLS | Approx rows (2026-09-04 count query) |
|-------|-----|--------------------------------------|
| `app_data_store` | enabled | 21 |
| `roles` | enabled | 10 |
| `permissions` | enabled | 18 |
| `role_permissions` | enabled | 72 |
| `user_profiles` | enabled | 9 |
| `access_requests` | enabled | 8 |
| `temporary_edit_grants` | enabled | 0 |

Note: MCP `list_tables` row estimates can show `0` while `count(*)` shows data — treat `list_tables` counts as unreliable.

## Remote migrations (production)

1. `20260813051324_create_app_data_store`
2. `20260814051227_portal_rbac_access_requests`
3. `20260814051441_access_requests_pending_email_unique`
4. `20260814053704_fix_user_profiles_rls_recursion`
5. `20260815030939_add_user_profiles_telegram_id`
6. `20260815031307_user_profiles_self_update_contact`
7. `20260815031429_drop_user_profiles_self_update_contact`

## Git vs remote drift

| Item | Status |
|------|--------|
| `inspect-mn/supabase/migrations/20260817_add_smartmine_permission.sql` | Present in Git; **not** in remote migration list. Permission may have been applied manually or never. |
| Full SQL history for remote versions | Not checked into `inspect-mn/supabase/migrations/` with matching timestamps |
| `bgs-policy-compliance/supabase/migrations/20260810000000_bgs_policy_compliance.sql` | Defines relational `job_positions`, policies, etc. — **not applied** to `inspect-bteg` public schema (those tables absent). Module uses JSON store instead. |

## Foreign keys (production)

Present between RBAC tables and `auth.users` as expected. **No FKs** for inspection findings/actions.

Unindexed FKs (Supabase performance advisor):  
`access_requests.assigned_role_id`, `created_user_id`, `reviewed_by`; `role_permissions.permission_id`; `temporary_edit_grants.granted_by`, `permission_id`; `user_profiles.role_id`.

## RLS vs policies

| Table | RLS | Policies | Issue |
|-------|-----|----------|-------|
| `app_data_store` | on | select/insert/update/delete all `true` for `anon,authenticated` | **P0** — RLS enabled but effectively open |
| RBAC catalogs | on | public SELECT | intentional for lookups |
| `user_profiles` / grants / requests | on | admin/own patterns using `is_portal_admin()` | recursion previously fixed by migration |

## SECURITY DEFINER RPCs (advisor)

- `public.is_portal_admin()` executable by `anon` and `authenticated`
- `public.update_own_profile_contact(...)` executable by `anon` and `authenticated`

Remediation links from advisor: Supabase database linter docs for anon/authenticated SECURITY DEFINER execute grants.

## Manual / untracked objects

- Functions above exist in production; confirm whether SQL is fully represented in Git.
- Auth “leaked password protection” disabled (security advisor WARN).

## TypeScript types drift

No generated Supabase TypeScript database types committed for portal. Manual `RoleId` / `PermissionId` unions can drift from seeded `roles`/`permissions` rows.

## PostgREST schema-cache note

If a future migration adds relational FKs for findings/actions, a PostgREST schema reload may be required after apply. **Not executed** during this audit. Today’s missing-relationship symptoms are more likely “table never existed” than stale cache.

## Staging gap

Documented environments are local + production (`inspect-bteg`). A dedicated staging database for portal RBAC + `app_data_store` is not evidenced. Preview deployments likely share production Supabase or mis-pointed env — treat as risk.