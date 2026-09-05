# 14 — IC-D05 fix evidence

## Issue
**IC-D05 (P0):** Missing/invalid embed scope treated as full editor (fail-open writes).

## Reproduction (before)
1. Call `PATCH /api/runs/:id/answers` with no embed cookie/header.
2. `requireInspectionWriteAccess` only blocked `mode === "unit"`.
3. `null` scope returned `{ scope }` → mutation proceeded.
4. `isInspectionAdmin(null)` returned `true`.

## Root cause
Absence of authenticated embed claims was interpreted as “full access / admin,” not “unauthenticated.”

## Fix
- Pure policy in `decideInspectionWriteAccess` / `decideInspectionAdminAccess` / `isInspectionAdminScope`.
- Null scope → **401** (unless explicit `INSPECTION_ALLOW_UNSCOPED_WRITES=1` for local QA only).
- Unit scope → **403**.
- Signed non-unit (`mode: "full"`) → allow writes.
- Admin destructive ops require `role === "admin"`; null is not admin.

## Changed files
- `inspection-center/src/lib/access/write-access.ts` (new)
- `inspection-center/src/lib/access/write-access.test.ts` (new)
- `inspection-center/src/lib/access/scope.ts`
- `inspection-center/scripts/e2e-security.test.ts`
- `inspection-center/package.json`

## Regression tests
| Command | Result |
|---------|--------|
| `npm run test:access` | PASS (null/unit deny; full allow; admin cases) |
| E2E `PATCH` without embed → 401/403 | PASS |
| E2E unit cookie PATCH denied | PASS |

## Allowed / denied matrix (unit tests)
| Scope | Write | Admin |
|-------|-------|-------|
| null | deny 401 | deny |
| unit | deny 403 | deny |
| full + inspector | allow | deny |
| full + admin | allow | allow |
| null + `INSPECTION_ALLOW_UNSCOPED_WRITES=1` | allow (local only) | allow |

## Service-role / browser
No new elevated keys. Write gate is embed-claims only. Client bundle scan: no `SUPABASE_SERVICE_ROLE_KEY` / embed secret literals in `.next/static/chunks`.

## Remaining risk
- Positive “full embed allows PATCH and mutates store” not fully exercised against a seeded run id in E2E (denied paths verified).
- Unscoped bypass **removed** (see doc 20); legacy env flags cannot grant access.

## Additional coverage (this pass)
Production/VERCEL/preview env + legacy flag deny; admin/manager/unknown role; zero-rows helper; scope resolution error deny.

## Required Preview test
- Portal full-mode embed: score save succeeds.
- No embed: mutating APIs 401/403.
- Unit embed: mutating APIs 403.

## Rollback
Revert `write-access*` + `scope.ts` gate; restores fail-open (not recommended).

## Status
**Verified** locally. Not Closed (no Preview).
