# 36 — P0-03 root cause

**Status at write:** Verified locally (see doc 39)  
**Branch:** `fix/prod-stabilization-p0`  
**Canonical org mapping:** `user_profiles.heltes_id` via `current_user_organization_id()`

## Issue definition (from register)

| Field | Value |
|-------|--------|
| ID | P0-03 |
| Symptom | No DB isolation of unit/org data in JSON stores |
| Reproduction | Auth/service path reads `inspection_center_store` / `policy_compliance_db` |
| Expected | Tenant cannot see other tenants at DB |
| Actual | Full payload shared; JS filters only |
| Root cause class | JSON mega-row without `organization_id` RLS predicate |

## Store inventory (authoritative multi-tenant)

| Store | Key / path | Multi-tenant in one object? | Org filter | Auth client | Browser can set org? |
|-------|------------|------------------------------|------------|-------------|----------------------|
| Inspection mega | `app_data_store.inspection_center_store` (+ plans/master) | **Yes (legacy)** | JS `readScopedStore` after full load | **service_role** | No (embed HMAC); scope can be missing → historically full |
| IC allocations | `inspection_center_org_template_allocations` | **Yes** | JS `allocationsForUnit` | service_role | PUT supplies heltes/alba ids |
| Policy mega | `policy_compliance_db` / `data/local/db.json` | **Yes (legacy)** | JS after `readDb()` | service_role | Position create may pass `organization_id` |
| Policy overrides | `policy_compliance_*_overrides` | **Yes** | JS | service_role | Admin UI |
| Portal voice | `employee_voice_db` | **Yes** | JS `filterVoiceDbByUnit` | service_role | department text only |
| Portal guidance | `platform_guidance_db` | **Yes** | **Often unfiltered GET** | service_role | No |
| R&D projects | `research_projects` table | No (row-level) | SQL + RLS | user JWT | Forge rejected |
| R&D program | `research_program_initiatives` + `/api/research/program` | No (row-level) | SQL + RLS | user JWT | Forge rejected |

## Exact failing path (P0-03)

1. Organization A and B both have runs/policies inside **one** JSON document under a single `app_data_store.key`.
2. Server loads the **entire** payload with service-role (bypasses any table RLS on that row).
3. Unit/organization filtering happens in application JS (`readScopedStore`, policy repository filters).
4. Therefore:
   - A bug or missing scope check exposes cross-tenant data.
   - There is **no** Postgres predicate that can deny cross-tenant reads inside the blob.
   - Client-side `localStorage` / query params must not be treated as isolation.

## Fix direction implemented (local, not remote-applied)

1. Additive table `org_app_data_store (organization_id, key, payload)` + RLS (`20260907090000_org_app_data_store_p0_03.sql`).
2. IC / Policy writers prefer org-partitioned rows when embed `heltesId` is present; unscoped mega writes of tenant DBs refused.
3. Program initiatives leave localStorage; server API + `research_program_initiatives` RLS.
4. Regression: `inspect-mn/src/lib/org-app-data-store.p0-03.test.ts` (failing-before mega-key + passing-after RLS).

## Remaining risks

- Service-role still used for IC/policy document upserts (see doc 37) — partition removes shared mega-row SoR, but elevated client bypasses RLS; migrate ordinary CRUD to user JWT when feasible.
- Portal voice/guidance mega-keys not yet org-partitioned in this wave.
- Full admin / null-scope paths must fail closed for writes (already refused).
