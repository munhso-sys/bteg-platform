# 38 — Program initiatives server migration

**Branch:** `fix/prod-stabilization-p0` @ `3f041aa` + uncommitted work  
**Status:** **Production-ready (code path)** — API + RLS + UI wired; pending Preview smoke against live auth

## Problem (before)

Program board persisted to browser `localStorage` (`rd-program-initiatives-v1:*`). No org isolation, no cross-device consistency, not authoritative for audit.

## Solution (after)

| Layer | Implementation |
|-------|----------------|
| Table | `public.research_program_initiatives` (migration `20260906120000_research_projects_rls.sql`) |
| API | `development/src/app/api/research/program/route.ts` — GET/POST/PATCH/DELETE |
| Client hook | `development/src/lib/program-store.ts` — `useProgramInitiatives()` |
| UI | `development/src/components/program/ProgramBoard.tsx` |
| Auth | Portal session → development cookies → `requireResearchAuth()` → user JWT + RLS |

`PROGRAM_STORAGE_KEY` retained as legacy constant only; **not authoritative**.

---

## UI field → column mapping

| UI (`ProgramInitiative`) | DB column | Type | Notes |
|--------------------------|-----------|------|-------|
| `id` | `id` | `uuid` | Server-generated on POST |
| — | `organization_id` | `text` | Set from `auth.ctx.organizationId` (`heltes_id`); client cannot forge |
| — | `created_by` | `uuid` | Set on insert from `auth.uid()` |
| — | `updated_by` | `uuid` | Set on insert/update |
| `pillarId` | `pillar_id` | `text` | Default `"research"` |
| `no` | `no` | `integer` | Sort order within year |
| `title` | `title` | `text` | Required on POST |
| `owner` | `owner` | `text` | |
| `department` | `department` | `text` | |
| `score` | `score` | `numeric` | |
| `target` | `target` | `numeric` | Default 100 |
| `status` | `status` | `text` | e.g. `planned`, `delayed` |
| `year` | `year` | `integer` | Board filter dimension |
| `start_date` | `start_date` | `text` | ISO/date string |
| `end_date` | `end_date` | `text` | |
| `quarters.q1`…`q4` | `quarters` | `jsonb` | Keys `q1`–`q4`; values `QuarterMark` |
| — | `created_at` | `timestamptz` | DB default |
| — | `updated_at` | `timestamptz` | API sets on mutation |

**Row ↔ UI transforms:** `rowToInitiative()` / `initiativeToRow()` in program route.

---

## RLS policies

All policies predicate on `organization_id = current_user_organization_id()`.

| Operation | Extra checks |
|-----------|--------------|
| SELECT | Own org only |
| INSERT | `created_by = auth.uid()`, `current_user_has_research_edit()` |
| UPDATE | `current_user_has_research_edit()` |
| DELETE | `current_user_has_research_edit()` |

`anon` revoked; `authenticated` granted CRUD.

---

## API contract

| Method | Path | Behavior |
|--------|------|----------|
| GET | `/api/research/program` | List org initiatives ordered by `year` desc, `no` asc |
| POST | `/api/research/program` | Create; rejects forged `organization_id` in body (403) |
| PATCH | `/api/research/program` | Update by `id` scoped to org; 404 if cross-org |
| DELETE | `/api/research/program?id=` | Delete scoped to org |

Mutations use `mutationOk()` — success only when expected row returned/affected.

---

## UI integration

`ProgramBoard`:

- Loads via `useProgramInitiatives()` → GET on mount
- Create/edit → POST/PATCH via `save()`
- Delete → DELETE via `remove()`
- Quarter cycle → PATCH via `cycleQuarter()`
- Subtitle states server persistence with org RLS

Errors surfaced in UI alert; no silent localStorage fallback.

---

## Production-ready checklist

| Criterion | Status |
|-----------|--------|
| Schema + RLS migration exists | ✅ `20260906120000_research_projects_rls.sql` |
| Server API replaces localStorage | ✅ |
| UI uses API hook | ✅ |
| Org from auth profile, not client param | ✅ |
| Forged org rejected | ✅ POST guard |
| Cross-org update/delete blocked | ✅ `.eq("organization_id", …)` + RLS |
| Unit/RLS test | ✅ `development/src/lib/research/rls.test.ts` (program covered by same org model) |
| Preview E2E program board | ⏳ Pending human Preview |
| Remote migration applied | ❌ Not applied to production |

**Verdict:** Code path is **production-ready** once branch is deployed with migrations applied and Preview smoke passes (login → program board CRUD → second org cannot see/edit).

---

## Rollout dependency

1. Apply `20260906120000_research_projects_rls.sql` (includes program table) before or with app deploy.
2. Deploy `development` app with program route + UI changes.
3. Ensure portal auth session forwarding to development iframe works (`/api/auth/session`).

No service role required for program CRUD at runtime.
