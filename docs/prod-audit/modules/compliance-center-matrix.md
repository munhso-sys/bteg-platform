# Compliance Center (bgs-policy-compliance) — action matrix & defects

App: `bgs-policy-compliance` · Portal: `/policy-compliance` · Remote key: `policy_compliance_db`

## Auth / client

| Concern | Behavior |
|---------|----------|
| Middleware | Embed token (`lib/access/embed.ts`); Batch 1 requires `POLICY_EMBED_SECRET` |
| Mutations | REST under `src/app/api/**` + `requirePolicyMutation` where used |
| Persistence | `readDb` / `updateDb` → local `data/` **or** remote when `VERCEL` / `USE_REMOTE_STORE=1` |
| Supabase | Service role client for remote (Batch 1) |
| Domain model | JSON: policies, clauses, positions, responsibilities, evaluations |
| Logical FKs | `clause.policy_id`, `responsibility.policy_clause_id` + `job_position_id` |
| Org scope | heltes/alba overrides + embed position/unit modes |
| SQL RLS | On `app_data_store` only; not per-policy row |
| Audit log | none |

## Route map (high level)

| Route | Purpose |
|-------|---------|
| `/dashboard` | KPIs |
| `/policies`, `/policies/[id]`, matrix | Policy CRUD / clauses / assign |
| `/clauses/[id]` | Clause detail, evaluate, unlink |
| `/positions`, `/positions/[id]` | Jobs, JD, evaluate |
| `/evaluations`, `/evaluations/new` | Evaluations |
| `/org`, heltes/alba trees | Org navigation |
| `/matrix`, `/imports`, `/settings`, `/my` | Matrix, import, settings, my obligations |

## Action matrix (core)

| page/route | role | action | validation | API | client | storage | mutated | FKs | org scope | RLS | success | error | cache | UI refresh | audit | tests |
|------------|------|--------|------------|-----|--------|---------|---------|-----|-----------|-----|---------|-------|-------|------------|-------|-------|
| `/policies` | edit | Create policy | name required (zod/form) | `POST /api/policies` | updateDb | JSON policies | new policy | — | full | store | 201 | 4xx/5xx | none (dynamic) | router.push/refresh | none | none |
| `/policies/[id]` | edit | Add section/clause | text/refs | `/api/policies/[id]/sections\|clauses` | updateDb | sections/clauses | parent ids | embed | store | 201 | error JSON | — | refresh | none | none |
| `/policies/[id]` | edit | Assign responsibility | position+type | `POST /api/responsibilities` | updateDb | responsibilities | clause+position | unit/position embed | store | 201 | 4xx | — | refresh | none | none |
| `/clauses/[id]` | edit | Evaluate | score/status | `POST /api/evaluations` | updateDb | evaluations | clause+position | scoped | store | 201 | 4xx | — | form | none | none |
| `/clauses/[id]` | edit | Unlink | link id | DELETE responsibilities | updateDb | soft deactivate | link id | — | store | ok | 4xx | — | refresh | none | none |
| `/positions` | edit | Create position | name; official_code optional | `POST /api/positions` | updateDb + copy links by code | positions | org assign | — | store | 201 | 4xx | — | navigate | none | none |
| `/positions` | edit | Patch official_code | string | `PATCH /api/positions/[id]` | updateDb | official_code only | — | — | store | ok | 4xx | — | blur save | none | none |
| `/positions` | edit | Org assign | heltes/alba | `PATCH .../org` | overrides file/remote | overrides | — | — | store | ok | 4xx | — | tree refresh | none | none |
| org-policies settings | edit | Bulk allocate | form | API org policy routes | overrides | catalog overrides | — | — | store | ok | UI error | — | client | none | none |

## Lifecycle verdict

| Step | Result |
|------|--------|
| create policy → list → detail → edit | OK if store writable |
| status transition | Policy status menu PATCH |
| child clause / responsibility / evaluation | Supported |
| reload | Remote OK if `updateDb` commit succeeded; conflict retries exist |
| logout/login | Embed must be re-minted from portal |

## Negative cases

| Case | Actual |
|------|--------|
| Missing field | Zod/API 400 common |
| Invalid ID | 404/500 uneven |
| Deleted parent | Soft flags `is_deleted` / `is_active` |
| Unauthorized | Mutation gates; embed modes restrict views |
| Other org | Unit/position embed filters; store still global blob |
| Expired embed | Middleware/scope denies |
| Double submit | Limited protection; responsibilities upsert by natural key |
| DB error | Remote throws in `writeDb` if `!ok`; **queue catch may swallow** (CC-D01) |
| Stale client | Conflict retry in `updateDb`; UI may need refresh |

## Silent success risks

1. `writeQueue = run.catch(() => undefined)` in `local-store.ts` (~297, ~363) — subsequent waiters may not see failure.  
2. Client `res.json().catch(() => null)` then generic errors — OK if `!res.ok` checked first (verify each form).  
3. Remote load failure → empty/bundled DB risk if misconfigured.

## Defects

### CC-D01 — Write queue swallows rejections (P1)
- **Evidence:** `local-store.ts` `writeQueue = run.catch(() => undefined)`.  
- **Minimal fix:** Keep queue serialization without erasing rejection for the awaiting caller (`writeQueue = run.then(...)` pattern that preserves awaiter errors).  
- **Test:** Force `saveRemotePayload` false; `updateDb` must reject.

### CC-D02 — Global JSON blob vs org isolation (P1)
- **Evidence:** Single `policy_compliance_db`; filters in app.  
- **Minimal fix:** After Batch 1 RLS, still need app-level guarantees; document as known; later split keys.  
- **Test:** Embed position mode cannot PATCH other position org via API.

### CC-D03 — No E2E for official_code link copy (P2)
- **Evidence:** `copyResponsibilitiesByOfficialCode` in repository.  
- **Test:** Create position with code matching linked job → link_count increases; existing links unchanged.

### CC-D04 — Missing Playwright lifecycle (P3)
- create policy → clause → assign → evaluate → reload.
