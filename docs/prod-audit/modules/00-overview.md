# Module E2E & data-contract audit

**Modules:** Inspection Center · Compliance (Журмын биелэлт) · Research & Development  
**Date:** 2026-09-04  
**Branch context:** `fix/prod-batch-1-security` / platform-clean  
**Mode:** Read-only (no production changes)

Shared dependencies in scope only: portal auth embed tokens, `app_data_store`, layout/theme.

## Canonical storage (all three)

| Module | SQL tables for domain | Actual persistence |
|--------|----------------------|-------------------|
| Inspection Center | none | JSON `InspectionCenterData` in FS and/or `app_data_store.inspection_center_*` |
| Compliance | BGS SQL migration exists in Git but **not** used at runtime on `inspect-bteg` | `LocalDatabase` JSON / `policy_compliance_db` |
| R&D | none | Browser `localStorage` only |

There is **no** Postgres `organization_id` FK on these domain records. Scope is embed claims (`heltes`/`alba`/`position`) or absent.

## Documents in this folder

| File | Content |
|------|---------|
| `inspection-center-matrix.md` | Action matrix + defects |
| `compliance-center-matrix.md` | Action matrix + defects |
| `research-development-matrix.md` | Action matrix + defects |
| `acceptance-checklist.md` | Cross-module QA checklist |
| `issue-register-modules.csv` | Defect register |

## Top cross-cutting defects

| ID | Sev | Module | Summary |
|----|-----|--------|---------|
| IC-D01 | P0 | Inspection | Middleware mints signed `unit` embed from **unsigned query params** (`scope=unit&heltes_*`) — bypasses portal HMAC trust |
| IC-D02 | P1 | Inspection | Remote `saveRemotePayload` failure only `console.warn`; local mutation already succeeded → silent prod loss |
| IC-D05 | P0 | Inspection | Missing/invalid embed scope treated as **full write** (fail-open) |
| IC-D06 | P1 | Inspection | Unit lists scoped but run detail/evidence allow foreign IDs (IDOR) |
| CC-D01 | P1 | Compliance | `writeQueue = run.catch(() => undefined)` can swallow write failures after caller believes success |
| RD-D01 | P0 | R&D | No middleware/auth; all data in `localStorage`; logout/login/other device = empty or seed data |
| SHARED-D01 | P1 | All embeds | After Batch 1, missing `*_EMBED_SECRET` → null tokens → open or soft-scoped module access |

Cross-check: [Audit inspection-center flows](8a983875-d3a0-4dcc-8ffc-dace81e708fc).

## Test coverage today

| Module | Automated tests |
|--------|-----------------|
| Inspection | `test:scoring` only; no E2E lifecycle |
| Compliance | Batch 1 `test:supabase` (service role); no action E2E |
| R&D | none |

## Stop

No deploy. No production schema apply. IC-D01/D05 and RD-D01/D02 are **Verified locally** on `fix/prod-stabilization-p0` (docs 13–14, 21–22, 25). Remaining Open P0: platform P0-01/P0-02/P0-03 (Batch 1 track). Preview readiness remains **NOT READY** (docs 16, 19, 25).
