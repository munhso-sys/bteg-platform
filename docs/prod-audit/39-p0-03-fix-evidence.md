# 39 — P0-03 fix evidence

**Status:** Verified locally  
**Date:** 2026-09-07  
**Branch:** `fix/prod-stabilization-p0` @ `3f041aa` + uncommitted fix wave

## Local environment

| Step | Result |
|------|--------|
| Docker Desktop | Running (engine 29.7.2) |
| `supabase db reset` (inspect-mn) | **PASS** — applied through `20260907090000_org_app_data_store_p0_03.sql` |
| Runner | `node scripts/run-local-db-security-tests.mjs` (loads local status JSON; does not print secrets) |

## Failing-before

| Assertion | Result |
|-----------|--------|
| Legacy mega-key `app_data_store` can hold org-a + org-b in one payload | **PASS** (documents defect) |

## Passing-after (`org_app_data_store` RLS)

| Assertion | Result |
|-----------|--------|
| B list sees only org-b | **PASS** |
| B direct SELECT org-a row → 0 rows | **PASS** |
| B forged insert `organization_id=org-a` → error | **PASS** |
| B cross-org UPDATE → 0 rows | **PASS** |
| Empty `organization_id` insert → error | **PASS** |
| Anon cannot see tenant documents | **PASS** |

Test file: `inspect-mn/src/lib/org-app-data-store.p0-03.test.ts`  
Suite result: **2 pass / 0 fail** (`EXIT_P003=0`)

## Related regression (same local DB)

| Suite | Result |
|-------|--------|
| Research storage (RD-D01/D02 client keys) | **PASS** |
| Research RLS (`research_projects`) | **PASS** |
| Combined | `EXIT_RESEARCH=0` |

## Application wiring (code, not marked Verified alone)

- IC / Policy remote writers prefer `org_app_data_store` when embed `heltesId` present; refuse unscoped tenant mega writes
- Program initiatives use `/api/research/program` + `research_program_initiatives` RLS

## Still out of scope for this evidence doc

- Remote Supabase migration (not applied; not requested)
- Full Playwright against `next start`
- Preview deploy

**Issue register:** P0-03 → **Verified locally**
