# 48 — Preview Supabase provisioning

**Date:** 2026-09-07  
**Git branch:** `fix/prod-stabilization-p0`  
**Git HEAD:** `ac58a6bd3e56f3f3d04e785bec9623ed8b0c117a`  
**Draft PR:** #1  

**Status:** Preview DB provisioned and verified. **No Vercel deploy. No Production changes.**

---

## Preview method

**Supabase Branch** (preferred path).

| Field | Value |
|-------|--------|
| Branch name | `fix-prod-stabilization-p0` |
| Preview project ref | `epismclrjnpgewpaiidd` |
| Preview API URL host | `epismclrjnpgewpaiidd.supabase.co` |
| Parent / Production project ref | `umswlpkjiwjohkolsyct` (`inspect-bteg`) |
| Branch data copy | `with_data: false` |
| Branch status (at provision) | `FUNCTIONS_DEPLOYED` / Preview project `ACTIVE_HEALTHY` |

**Isolation confirmation:** Preview ref **≠** `umswlpkjiwjohkolsyct`.

---

## Isolation / emptiness (before and after seed)

| Check | Result |
|-------|--------|
| Production business rows present | **No** |
| Production Auth users copied | **No** (`auth.users` started at 0) |
| Production Storage objects copied | **No** (`storage.objects` = 0) |
| Preview has own API credentials | **Yes** (publishable/anon keys for Preview ref only) |
| Schema clone from parent migrations | **Yes** (portal core tables from parent history) |
| Parent data carry-over | **No** (`with_data: false`) |

After synthetic QA seed only:

| Metric | Count |
|--------|-------|
| QA Auth users (`qa-org-*@example.com`) | 6 |
| Non-QA Auth users | 0 |
| Non-QA `user_profiles` | 0 |
| Storage objects | 0 |

---

## Migration result

**Target:** `epismclrjnpgewpaiidd` only.  
**Not targeted:** `umswlpkjiwjohkolsyct`.

Applied (committed sequence):

1. `20260816000000_local_bootstrap_core.sql` → recorded as `local_bootstrap_core`
2. `20260817_add_smartmine_permission.sql` → `add_smartmine_permission`
3. `20260906120000_research_projects_rls.sql` → `research_projects_rls`
4. `20260906121000_research_roles_seed.sql` → `research_roles_seed`
5. `20260906140000_lock_app_data_store_rls.sql` → `lock_app_data_store_rls`
6. `20260907090000_org_app_data_store_p0_03.sql` → `org_app_data_store_p0_03`
7. `20260907120000_user_profiles_select_own.sql` → `user_profiles_select_own`

**Migration history:** PASS (Preview history includes parent versions plus the seven apply entries above).

---

## DB / RLS contract result

| Check | Result |
|-------|--------|
| `research_projects` exists + RLS on | PASS (4 policies) |
| `research_program_initiatives` exists + RLS on | PASS (4 policies) |
| `org_app_data_store` exists + RLS on | PASS (4 policies) |
| `user_profiles` SELECT-own policy | PASS (`user_profiles_select_own`) |
| `app_data_store` locked (RLS on, 0 open policies) | PASS |
| Expected indexes | PASS |
| Research FKs to `auth.users` | PASS |
| `org_app_data_store.updated_by` FK | PASS |

---

## Synthetic QA seed result

Organizations (synthetic `heltes_id` values):

- `QA_ORG_A`
- `QA_ORG_B`

Users (synthetic emails only):

| Org | Role | Email |
|-----|------|-------|
| QA_ORG_A | admin | `qa-org-a-admin@example.com` |
| QA_ORG_A | inspector | `qa-org-a-inspector@example.com` |
| QA_ORG_A | manager | `qa-org-a-manager@example.com` |
| QA_ORG_B | admin | `qa-org-b-admin@example.com` |
| QA_ORG_B | inspector | `qa-org-b-inspector@example.com` |
| QA_ORG_B | manager | `qa-org-b-manager@example.com` |

Passwords were set for Preview Auth sign-in testing; **values are not recorded in this document**. Rotate or reset via Supabase Auth dashboard if shared.

No Production emails, UUIDs, or business records were copied.

---

## Cross-org isolation result

Executed as JWT `authenticated` / `anon` role switches on Preview:

| Check | Result |
|-------|--------|
| A can create/list own research project | PASS |
| A can write own `org_app_data_store` | PASS |
| A forged `organization_id=B` insert denied | PASS |
| A forged org store insert denied | PASS |
| B cannot list A project | PASS |
| B cannot update A project | PASS |
| B cannot read A org store | PASS |
| B cannot read A program initiative | PASS |
| Anonymous denied | PASS |
| Missing profile/org denied | PASS |

**Overall RLS isolation:** PASS

---

## Required Vercel Preview variable NAMES (no values)

### Shared Supabase (all deployables that talk to Preview DB)

| Variable | Consuming app(s) | Public/server | Build/runtime | Required |
|----------|------------------|---------------|---------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | portal, IC, policy, development | Public | Build + runtime | Required — must be Preview URL (`…epismclrjnpgewpaiidd…`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` **or** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | portal, IC, policy, development | Public | Build + runtime | Required — Preview publishable/anon only |
| `SUPABASE_SERVICE_ROLE_KEY` | portal, IC, policy, development (admin/store/seed) | Server | Runtime | Required for Preview store/admin paths — Preview service role only |

### Portal (`inspect-mn`)

| Variable | Public/server | Build/runtime | Required |
|----------|---------------|---------------|----------|
| `NEXT_PUBLIC_SITE_URL` | Public | Build + runtime | Required (Preview hostname) |
| `NEXT_PUBLIC_INSPECT_URL` | Public | Build + runtime | Required |
| `NEXT_PUBLIC_POLICY_URL` | Public | Build + runtime | Required |
| `NEXT_PUBLIC_DEVELOPMENT_URL` | Public | Build + runtime | Required |
| `INSPECTION_EMBED_SECRET` | Server | Runtime | Required |
| `POLICY_EMBED_SECRET` | Server | Runtime | Required |
| `INSPECTION_EMBED_SECRET_PREVIOUS` | Server | Runtime | Optional (rotation) |
| `POLICY_EMBED_SECRET_PREVIOUS` | Server | Runtime | Optional (rotation) |
| `CRON_SECRET` | Server | Runtime | Optional (cron tests) |

### inspection-center

| Variable | Public/server | Build/runtime | Required |
|----------|---------------|---------------|----------|
| `INSPECTION_EMBED_SECRET` | Server | Runtime | Required (must match portal) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Runtime | Required (org store I/O) |
| `USE_REMOTE_STORE` | Server | Runtime | Optional (`VERCEL=1` may auto-enable policy; IC follows its own path) |

### bgs-policy-compliance

| Variable | Public/server | Build/runtime | Required |
|----------|---------------|---------------|----------|
| `POLICY_EMBED_SECRET` | Server | Runtime | Required (must match portal) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Runtime | Required |
| `USE_REMOTE_STORE` | Server | Runtime | Optional / auto on Vercel |

### development (Research)

| Variable | Public/server | Build/runtime | Required |
|----------|---------------|---------------|----------|
| `NEXT_PUBLIC_SUPABASE_*` | Public | Build + runtime | Required (user JWT + RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Runtime | Optional for app CRUD; used for seeding/tests |

### Secret ownership by deployable

| Secret family | Owner |
|---------------|-------|
| Preview Supabase URL + anon/publishable | All Preview deployables (same Preview project) |
| Preview `SUPABASE_SERVICE_ROLE_KEY` | Server-only on portal / IC / policy / development — **never** `NEXT_PUBLIC_*` |
| Embed signing/verifying pair | Portal mints; IC / policy verify — Preview-only values OK; must match across Preview deployables |
| Production Supabase credentials | **Must not** be set on Vercel Preview |

### Contract confirmations

- Every Supabase URL/key for Preview must belong to `epismclrjnpgewpaiidd`.
- No Production (`umswlpkjiwjohkolsyct`) Supabase credential may be used by Preview.
- No secret uses the `NEXT_PUBLIC_` prefix.
- Ordinary Research CRUD uses authenticated user + RLS; IC/policy org JSON still uses service role (category B transitional) against Preview only.

---

## Rollback / reset method (Preview only)

Preferred for this Supabase Preview Branch:

1. Reset or delete/recreate branch `fix-prod-stabilization-p0` (or recreate equivalent Preview branch).
2. Re-apply the seven migrations listed above to the new Preview ref only.
3. Re-seed synthetic QA users/orgs only.
4. Re-run isolation checks.

**Do not** modify Production.  
**Do not** write reverse destructive migrations merely to repair Preview unless separately reviewed.  
Emergency app rollback still leaves additive tables (`org_app_data_store`) in place (see docs 41/45/46).

---

## Advisors (Preview)

- `app_data_store` RLS enabled with **no policies** — expected after P0-01 lock (service_role only).
- SECURITY DEFINER execute WARNs for helper RPCs (`current_user_organization_id`, `current_user_has_research_edit`, portal helpers) — P1 hardening; not a Preview isolation blocker (table RLS still enforced).
- Auth leaked-password protection disabled on branch — optional Preview hardening.

## Remaining human actions before Vercel Preview deploy

1. Set Vercel **Preview** env vars (names above) to Preview values — not Production.
2. Allowlist Preview Auth redirect URLs for the Preview project.
3. Obtain Preview **service role** from Supabase Dashboard for `epismclrjnpgewpaiidd` (do not reuse Production).
4. Explicit approval required before any Vercel Preview deployment.

---

## Explicit non-actions taken

- No Vercel deploy
- No PR merge
- No Production env change
- No Production migration
- No Production data copy
- No secret values recorded in git
