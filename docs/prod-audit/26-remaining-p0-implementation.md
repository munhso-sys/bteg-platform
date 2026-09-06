# 26 — Remaining P0 implementation status (2026-09-06)

## Issue status corrections
| ID | Status | Reason |
|----|--------|--------|
| RD-D01 | **Open → Implemented** (pending local DB verify) | Banner alone rejected; server tables + API added |
| RD-D02 | **Mitigated / Open → Implemented** (pending RLS verify) | localStorage no longer authoritative; RLS policies defined |
| IC-D01 | Verified locally | unchanged |
| IC-D05 | Verified locally | unchanged |

## Research inventory
- **No pre-existing research_* tables** on inspect-bteg (read-only MCP inventory).
- New additive migration: `20260906120000_research_projects_rls.sql`
- Org boundary: `user_profiles.heltes_id` → `organization_id`
- Auth path: portal posts Supabase session into development iframe → `/api/auth/session` cookies → user-scoped PostgREST (RLS)

## Authoritative data source
`public.research_projects` (and `research_program_initiatives` schema ready).  
UI: `ProjectsClient` uses `/api/research/projects` only — **not** localStorage.

## Local Supabase gate
Local `supabase start` succeeded; migrations applied including research RLS and app_data_store lock.
RLS test: `development/src/lib/research/rls.test.ts` → **PASS** (own org / cross-org / anon / forged org_id).

RD-D01/D02 marked **Verified locally** for DB persistence + RLS isolation.
Remaining Preview blockers: full Playwright portal login/embed suite against `next start`, program-initiatives UI still not fully server-backed.

## P0-01
- App writers: service-role-only (`inspection-center` + `bgs-policy-compliance` `server.ts`)
- Restrictive migration: `20260906140000_lock_app_data_store_rls.sql` (apply after app deploy; **not applied remotely**)

## P0-02
- Hardcoded embed fallback removed from `inspection-center` embed.ts
- Portal embed-secret-config + related files restored from Batch 1 review

## P0-03
- `/api/runtime-info` + middleware allowlist + secret-absence tests

## Production actions
None (no deploy, remote migration, env change, push, merge).
