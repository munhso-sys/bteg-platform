# 08 — Test Gap Analysis

## Current state

- `inspect-mn/package.json` has **no** `test` script.  
- No Playwright/Cypress config found at portal root during audit spot-check.  
- Module apps similarly lean on manual QA.

## Required test matrix

| # | Scenario | Unit | DB contract | RLS | Integration | Playwright E2E | Preview smoke | Prod read-only smoke |
|---|----------|------|-------------|-----|-------------|----------------|---------------|----------------------|
| 1 | Login/logout/session refresh | | | | Y | Y | Y | Y (login only) |
| 2 | Role-protected routes | Y | | Y | Y | Y | Y | |
| 3 | Create inspection run | | Y (store shape) | Y | Y | Y | Y | |
| 4 | Inspection list/detail | | Y | | Y | Y | Y | Y |
| 5 | Add finding | | Y | Y | Y | Y | | |
| 6 | Add/update corrective action | | Y | Y | Y | Y | | |
| 7 | Overdue KPI | Y | | | Y | Y | | |
| 8 | Compliance create/edit/filter | | Y | Y | Y | Y | Y | |
| 9 | Research create/edit | | | | Y | Y | Y | |
| 10 | Organization/unit isolation | Y | | **Y** | Y | Y | | |
| 11 | Unauthorized access | | | Y | Y | Y | | |
| 12 | Persistence after reload | | | | Y | Y | Y | |
| 13 | Behavior after new deploy | | | | | | Y | Y |
| 14 | Stale-data regression | | | | Y | Y | | |
| 15 | Relationship regression | | Y | | Y | | | |

## Priority gaps (highest first)

1. **RLS tests** proving `anon` cannot read/write `app_data_store` (fails today — becomes regression suite after fix).  
2. **Embed token forgery test** with hardcoded secret removed.  
3. **Store contract tests** validating `inspection_center_store` / `policy_compliance_db` schema version field.  
4. **E2E**: login → open `/inspection` → create finding → reload → still present on Preview against non-prod DB.  
5. **Deploy smoke**: `/api/supabase/health` + `/api/runtime-info` (proposed) + iframe ready endpoints.

## Distinctions

| Type | Purpose |
|------|---------|
| Unit | Pure RBAC maps, KPI math, embed claim encoding |
| DB contract | JSON shape + optional future SQL FK |
| RLS | As authenticated roles via Supabase test users |
| Integration | Next route handlers with mocked/real store |
| Playwright | Browser + iframe flows |
| Preview smoke | Post-deploy checklist on Vercel Preview |
| Prod read-only | Health, login, list views without mutations |

## Note on expected entities

Until relational `inspections`/`findings`/`corrective_actions` exist, “relationship regression” tests must assert **JSON graph integrity** (finding.runId exists, action.findingId exists), not Postgres FK.