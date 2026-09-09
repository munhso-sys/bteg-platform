# 37 — Elevated write review (service role inventory)

**Branch:** `fix/prod-stabilization-p0` @ `3f041aa` + uncommitted P0-03 work  
**Org mapping:** `user_profiles.heltes_id` → `current_user_organization_id()`  
**Status:** Partial mitigation — org-partitioned writes; elevated client retained for IC/policy store I/O

## Summary

| Layer | Auth model | RLS enforced? | Notes |
|-------|------------|---------------|-------|
| Research projects / program initiatives | User JWT + PostgREST | **Yes** | `createUserServerClient()` |
| `org_app_data_store` (IC/policy tenant JSON) | **Service role** (server) | **Yes at DB**; bypassed by client | P0-03 partition; app must pass correct `organization_id` |
| Legacy `app_data_store` mega-keys | **Service role** (server) | Bypassed | Reads fallback; tenant mega-writes **refused** |
| Portal guidance / voice / AI scope | **Service role** (server) | Bypassed | Still global mega-rows; out of P0-03 tenant scope |

**Principle:** Ordinary multi-tenant CRUD should use authenticated user + RLS. Service role is acceptable only where RLS cannot apply (global config), auth admin APIs require it, or a transitional compatibility path exists — and each call site must enforce org scope in application code when using service role against org-partitioned tables.

---

## Inventory by app

### inspection-center

| Call site | Table / key | Client | Org scope | Write allowed? |
|-----------|-------------|--------|-----------|----------------|
| `src/lib/store/remote.ts` | `org_app_data_store` | `createServerSupabaseClient()` (service role) | `organizationId` from embed `heltesId` via `resolveStoreOrganizationId()` | Yes, when scoped |
| `src/lib/store/remote.ts` | `app_data_store` (legacy) | service role | None | **Read-only fallback**; unscoped writes refused |
| `src/lib/store/index.ts` | All `REMOTE_KEYS` | via `remote.ts` | Required for remote persist | Refuses unscoped remote write (P0-03) |

**Keys (org-partitioned when scoped):**

- `inspection_center_store`
- `inspection_center_annual_plans`
- `inspection_center_annual_plan_types`
- `inspection_center_master`
- `inspection_center_org_template_allocations`

**Justification for remaining service role:** P0-01 locked `app_data_store` RLS; module store helpers were built on service-role PostgREST. P0-03 adds `org_app_data_store` with RLS predicates, but IC still uses service role — RLS is not the enforcement boundary today; **embed-signed `heltesId` + refused unscoped writes** are.

**Target state:** Replace `createServerSupabaseClient()` with request-scoped user client (portal session forwarded or module cookie) so PostgREST enforces `org_app_data_store_*` policies. Service role reserved for migration/backfill jobs only.

---

### bgs-policy-compliance

| Call site | Table / key | Client | Org scope | Write allowed? |
|-----------|-------------|--------|-----------|----------------|
| `src/lib/db/remote-store.ts` | `org_app_data_store` | service role | `getPolicyScope().heltesId` | Yes, when scoped |
| `src/lib/db/remote-store.ts` | `app_data_store` | service role | Optional | **`policy_compliance_db` unscoped write refused**; override catalog keys may still write unscoped |
| `src/lib/db/local-store.ts` | `policy_compliance_db` | via remote-store | **Required** on Vercel / `USE_REMOTE_STORE=1` | Throws if scope missing |

**Override keys (may remain global until normalized):**

- `policy_compliance_position_org_overrides`
- `policy_compliance_policy_org_overrides`
- `policy_compliance_org_catalog_overrides`

**Justification:** Same P0-01 compatibility path as IC. Tenant mega-db (`policy_compliance_db`) now **requires** org partition; gzip encoding preserved for large payloads.

---

### development (Research)

| Call site | Table | Client | Org scope | Elevated? |
|-----------|-------|--------|-----------|-----------|
| `/api/research/projects` | `research_projects` | `createUserServerClient()` | From profile `heltes_id` + RLS | **No** |
| `/api/research/program` | `research_program_initiatives` | `createUserServerClient()` | From profile + explicit `.eq("organization_id", …)` | **No** |
| `src/lib/research/rls.test.ts` | seed only | `createServiceRoleClient()` | Test harness | Test-only |

**Justification:** Relational tables with row-level `organization_id` and RLS — correct pattern. API rejects forged `organization_id` in POST body.

---

### inspect-mn (portal)

| Call site | Table / key | Client | Tenant isolation | P0-03 scope |
|-----------|-------------|--------|------------------|-------------|
| `src/lib/guidance/store.ts` | `platform_guidance_db` | `createAdminClient()` | JS filter / global row | Non-goal (platform-global) |
| `src/lib/guidance/other-store.ts` | `platform_other_work_db` | admin | Global | Non-goal |
| `src/lib/voice/store.ts` | `employee_voice_db` | admin | JS `filterVoiceDbByUnit` | **Future** — still mega-row |
| `src/lib/ai/scope-config-store.ts` | AI scope key | admin | Platform config | Non-goal |
| `src/app/api/settings/session/route.ts` | session settings | admin | Per-user cache | Non-goal |
| Admin: access-requests, users, roles | auth + profiles | admin | RBAC routes | Required for Auth Admin API |
| `src/lib/reports/distribution-store.ts` | reports | admin | Cron/worker | Privileged job |

**Justification for admin client:** Supabase Auth Admin (`auth.admin.*`), cross-user profile provisioning, and global config keys have no user-scoped RLS alternative without new RPCs. Tenant business JSON (voice) remains a **follow-up** migration to `org_app_data_store`.

---

## RLS vs service role (post P0-03 migration)

Migration: `inspect-mn/supabase/migrations/20260907090000_org_app_data_store_p0_03.sql`

| Role | `org_app_data_store` access |
|------|----------------------------|
| `anon` | Revoked |
| `authenticated` | SELECT/INSERT/UPDATE/DELETE where `organization_id = current_user_organization_id()` |
| `service_role` | Full (bypasses RLS) |

IC/policy **currently bypass RLS** via service role even though policies exist. Isolation depends on:

1. Embed HMAC supplying correct `heltesId`
2. Application refusing unscoped mega-key writes
3. Org-partitioned row keys `(organization_id, key)` instead of one shared blob

---

## Recommendations (priority order)

1. **Keep:** User JWT + RLS for Research CRUD (`research_projects`, `research_program_initiatives`).
2. **Keep (transitional):** Service role for IC/policy `org_app_data_store` until user-client migration is tested on Preview.
3. **Refuse:** Any new unscoped `app_data_store` writes for tenant business data.
4. **Migrate next:** Portal `employee_voice_db` → `org_app_data_store` or normalized tables.
5. **Migrate later:** IC/policy store writers from service role → user client so RLS is the enforcement boundary.
6. **Never:** Expose `SUPABASE_SERVICE_ROLE_KEY` via `NEXT_PUBLIC_*` or client bundles.

---

## Verification hooks

- `inspect-mn/src/lib/org-app-data-store.p0-03.test.ts` — RLS isolation (requires local Supabase)
- `development/src/lib/research/rls.test.ts` — Research RLS (PASS when Supabase up)
- `e2e/p0-security.spec.ts` — client bundle must not contain `service_role` string

**Remote state:** P0-03 migration **not applied** to production project `umswlpkjiwjohkolsyct`. No deploy performed.
