# 46 — Preview database plan

**Status:** READY (procedure only — do not execute remote apply without explicit human instruction)

## Preferred target

Isolated **Supabase Preview/QA project or branch** — never production ref `umswlpkjiwjohkolsyct`.

## Procedure

1. **Create** isolated Preview/QA Supabase project (or Supabase branch linked only to Preview).
2. **Apply migrations in order** (from zero):
   1. `20260816000000_local_bootstrap_core.sql`
   2. `20260817_add_smartmine_permission.sql` (if present in tree)
   3. `20260906120000_research_projects_rls.sql`
   4. `20260906121000_research_roles_seed.sql`
   5. `20260906140000_lock_app_data_store_rls.sql`
   6. `20260907090000_org_app_data_store_p0_03.sql`
   7. `20260907120000_user_profiles_select_own.sql`
3. **Seed** synthetic QA orgs/users only (e.g. `org-a` / `org-b` inspectors). No production dump unless separately approved and sanitized.
4. **Run** DB/RLS tests (`scripts/run-local-db-security-tests.mjs` pattern against Preview URL with Preview keys only).
5. **Configure** each Vercel Preview deployable `NEXT_PUBLIC_SUPABASE_URL` / anon / service-role to this project only.
6. **Verify** `/api/runtime-info` masked project ref is **not** production.

## Compatibility

| Migration | Additive | Rollback note |
|-----------|----------|---------------|
| `..._org_app_data_store_p0_03.sql` | YES | **Emergency:** revert application code only; leave `org_app_data_store` in place. **Do not** drop the table for emergency rollback. Remove via a later reviewed cleanup migration only after apps no longer depend on it. Keep legacy `app_data_store` read fallback until cutover is complete. |
| `..._user_profiles_select_own.sql` | YES | Emergency: revert app if needed; `DROP POLICY user_profiles_select_own` only if explicitly required (Research auth fails closed without it). Prefer leave policy until a reviewed cleanup. |

## Explicit non-goals

- No production dump by default  
- No remote migration from this agent session  
- No Production service-role key in Preview unless human explicitly requires (prefer Preview-only keys)
