# 40 — Preview environment contract

**Purpose:** Define when a Vercel Preview deployment is safe to exercise against a **non-production** Supabase project.  
**Production Supabase ref (protected):** `umswlpkjiwjohkolsyct` — Preview **must NOT** write here.

---

## Hard rules

1. Preview deployments use a **staging or local-linked** Supabase project, **or** read-only connection to production (strongly discouraged for mutation tests).
2. Never set Preview `NEXT_PUBLIC_SUPABASE_URL` to the production project if the deployment can mutate data.
3. `SUPABASE_SERVICE_ROLE_KEY` is server-only; never `NEXT_PUBLIC_*`.
4. No agent may deploy, merge to main, or apply remote migrations without explicit human instruction.
5. Embed secrets on Preview must match portal mint + module verify pairings.

---

## Environment variable contract (names only)

### All deployables (minimum)

| Variable | Side | Required for Preview |
|----------|------|----------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public (build) | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (build) | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Yes (portal admin, IC/policy store, tests) |

### Portal (`inspect-mn`)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SITE_URL` | Auth redirects (Preview hostname) |
| `NEXT_PUBLIC_INSPECT_URL` | IC iframe origin |
| `NEXT_PUBLIC_POLICY_URL` | Policy iframe origin |
| `NEXT_PUBLIC_DEVELOPMENT_URL` | Research iframe origin |
| `INSPECTION_EMBED_SECRET` | Sign inspection embed |
| `POLICY_EMBED_SECRET` | Sign policy embed |
| `INSPECTION_EMBED_SECRET_PREVIOUS` | Optional rotation |
| `POLICY_EMBED_SECRET_PREVIOUS` | Optional rotation |
| `CRON_SECRET` | If testing distribute cron |
| `RESEND_API_KEY` / `EMAIL_FROM` | If testing email flows |

### inspection-center

| Variable | Purpose |
|----------|---------|
| `INSPECTION_EMBED_SECRET` | Verify portal embed |
| `SUPABASE_SERVICE_ROLE_KEY` | Org-partitioned store I/O (transitional) |
| `USE_REMOTE_STORE` | Force remote path locally if needed |

### bgs-policy-compliance

| Variable | Purpose |
|----------|---------|
| `POLICY_EMBED_SECRET` | Verify portal embed |
| `SUPABASE_SERVICE_ROLE_KEY` | Org-partitioned store I/O |
| `USE_REMOTE_STORE` | Remote persist on Preview (`VERCEL=1` auto) |

### development (Research)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_*` | User auth + RLS CRUD |
| `SUPABASE_SERVICE_ROLE_KEY` | Test seeding only |

**Do not document or commit secret values.**

---

## Database contract

| Item | Preview expectation |
|------|---------------------|
| Migrations | Applied to **Preview/staging** DB before app deploy that depends on them |
| P0-03 | `20260907090000_org_app_data_store_p0_03.sql` required for org store |
| Research | `20260906120000_research_projects_rls.sql` required for program/projects |
| P0-01 lock | `20260906140000_lock_app_data_store_rls.sql` after service-role writers verified |
| Production DB | **No writes** from Preview |

---

## READY criteria

Preview is **READY** for human smoke when **all** apply:

| # | Criterion |
|---|-----------|
| R1 | Preview Supabase project ≠ production ref, **or** confirmed read-only mode |
| R2 | Required migrations applied on Preview DB |
| R3 | All four apps deploy successfully on Preview URLs |
| R4 | Env vars set (names above); embed secrets aligned portal ↔ modules |
| R5 | Portal login works on Preview hostname (Auth redirect allowlisted) |
| R6 | Signed embed: IC + policy load in iframe with scoped writes |
| R7 | Research session handoff; projects + program CRUD via API |
| R8 | P0-03 tests PASS locally or against Preview staging DB |
| R9 | `e2e/p0-security.spec.ts` / bundle scan: no service role in client |
| R10 | Human confirms any leaked Vercel token rotated (doc 19) |

---

## NOT READY criteria

Mark **NOT READY** if **any** apply:

| # | Blocker |
|---|---------|
| N1 | Preview points at production Supabase with write-capable service role |
| N2 | P0-03 migration missing but apps expect `org_app_data_store` |
| N3 | Embed secrets missing → modules fail closed (writes denied) |
| N4 | `20260906140000_lock_app_data_store_rls.sql` applied before service-role app deploy |
| N5 | Docker/local Supabase down **and** no staging DB for RLS verification |
| N6 | Full portal cross-org Playwright suite incomplete **and** required by release gate |
| N7 | Uncommitted P0-03 branch not merged/deployed to Preview |
| N8 | Production deploy or remote migration performed without approval |

---

## Current assessment (2026-09-07 final gate)

| Gate | State |
|------|-------|
| Contract document | **READY** (variable names + isolated-DB rule complete) |
| Local release gate | **PASS** (builds, lint errors 0, Playwright 24/24, DB reset + RLS) |
| Human next step | Provision isolated Preview Supabase; set Preview-only env; deploy release branch (explicit instruction only) |
| Production | Untouched |

---

## Verification artifacts

| Doc | Content |
|-----|---------|
| 39 | P0-03 Phase 2 PASS criteria |
| 37 | Elevated write inventory |
| 38 | Program initiatives wiring |
| 41 | Ordered rollout Preview → Production |
