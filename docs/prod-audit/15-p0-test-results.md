# 15 — P0 test results (local)

**Branch:** `fix/prod-stabilization-p0`  
**App:** `inspection-center`  
**Production actions:** none

## Commands run

| Check | Command | Result |
|-------|---------|--------|
| Access unit tests | `npm run test:access` | PASS 11/11 |
| Scoring unit tests | `npm run test:scoring` | PASS 3/3 |
| Typecheck | `npx tsc --noEmit` | PASS |
| Lint | `npm run lint` | PASS (exit 0) |
| Production build | `npm run build` | PASS |
| Production server | `npx next start -p 3001` | Started locally |
| HTTP security E2E | `INSPECTION_E2E_BASE_URL=http://127.0.0.1:3001 npm run test:e2e:security` | PASS 3/3 |
| Client bundle secret scan | Select-String on `.next/static/chunks/*.js` for service role / embed secret / hardcoded embed / known anon JWT | **No hits** |

## Not run / gaps
| Check | Reason |
|-------|--------|
| Playwright portal login E2E | No Playwright project in inspection-center |
| Local Supabase migration apply | IC-D01/D05 need no migration; P0-01 migration **not** on this branch |
| Database/RLS role matrix | Deferred with Batch 1 track B |
| Cross-organization denial E2E | Still Open as IC-D06 / P0-03 |
| Mutation persistence-after-reload E2E | Out of IC-D01/D05 scope (IC-D02 still Open) |

## Issue status after tests
- IC-D01 → **Verified** (local)
- IC-D05 → **Verified** (local)
