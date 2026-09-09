# 49 — Vercel Preview project map

**Date:** 2026-09-08  
**Git branch:** `fix/prod-stabilization-p0`  
**Expected SHA:** `ac58a6bd3e56f3f3d04e785bec9623ed8b0c117a`  
**Draft PR:** #1  
**Preview Supabase ref:** `epismclrjnpgewpaiidd`  
**Production Supabase ref (forbidden for Preview):** `umswlpkjiwjohkolsyct`

**Scope:** Read-only mapping of Vercel deployables for isolated Preview.  
**Explicit non-actions:** No Production env changes. No Production deploy. No PR merge.

---

## Deployable map

| Role | App folder | Vercel project name | Git repository | Root directory | Build | Framework / output | Production hostname (do not use for Preview smoke) | Preview domain pattern |
|------|------------|---------------------|----------------|----------------|-------|--------------------|---------------------------------------------------|------------------------|
| Portal | `inspect-mn` | `platform-portal` | `munhso-sys/platform-clean` | `inspect-mn` | `npm run build` (`vercel.json`) | Next.js | `bteg.inspect.mn`, `platform-portal-blue.vercel.app` | `*-platform-portal*.vercel.app` / branch Preview URL |
| Internal control (IC) | `inspection-center` | `platform-inspection-center` | same | `inspection-center` | Next.js default | Next.js | `platform-inspection-center.vercel.app` | `*-platform-inspection-center*.vercel.app` |
| Policy / compliance | `bgs-policy-compliance` | `platform-policy-compliance` | same | `bgs-policy-compliance` | Next.js default | Next.js | `platform-policy-compliance.vercel.app` | `*-platform-policy-compliance*.vercel.app` |
| Research | `development` | `platform-development` | same | `development` | Next.js default | Next.js | `platform-development-amber.vercel.app` | `*-platform-development*.vercel.app` |

Evidence: `docs/VERCEL_DEPLOYMENT.md`, `docs/prod-audit/01-runtime-and-environment-matrix.md`, per-app `vercel.json`.

**Branch for Preview deploy:** `fix/prod-stabilization-p0` only.

---

## Required Preview env variables (names only)

### All four deployables (Supabase Preview target)

| Variable | Side | Required | Notes |
|----------|------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public / build | Yes | Must contain host `epismclrjnpgewpaiidd.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` **or** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public / build | Yes | Preview publishable/anon only |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Yes (portal/IC/policy; research optional for CRUD) | Preview service role only; never `NEXT_PUBLIC_*` |

### Portal (`platform-portal` / `inspect-mn`)

| Variable | Side | Required |
|----------|------|----------|
| `NEXT_PUBLIC_SITE_URL` | Public | Yes — Preview portal hostname |
| `NEXT_PUBLIC_INSPECT_URL` | Public | Yes — Preview IC hostname |
| `NEXT_PUBLIC_POLICY_URL` | Public | Yes — Preview policy hostname |
| `NEXT_PUBLIC_DEVELOPMENT_URL` | Public | Yes — Preview research hostname |
| `INSPECTION_EMBED_SECRET` | Server | Yes — Preview-only; match IC |
| `POLICY_EMBED_SECRET` | Server | Yes — Preview-only; match policy |
| `INSPECTION_EMBED_SECRET_PREVIOUS` / `POLICY_EMBED_SECRET_PREVIOUS` | Server | Optional |
| `CRON_SECRET` | Server | Optional for smoke |

### IC (`platform-inspection-center`)

| Variable | Side | Required |
|----------|------|----------|
| `INSPECTION_EMBED_SECRET` | Server | Yes — match portal |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Yes |
| `USE_REMOTE_STORE` | Server | Optional |

### Policy (`platform-policy-compliance`)

| Variable | Side | Required |
|----------|------|----------|
| `POLICY_EMBED_SECRET` | Server | Yes — match portal |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Yes |
| `USE_REMOTE_STORE` | Server | Optional (`VERCEL=1` may auto-enable) |

### Research (`platform-development`)

| Variable | Side | Required |
|----------|------|----------|
| `NEXT_PUBLIC_SUPABASE_*` | Public | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Optional for app path; needed for seed/admin helpers |

---

## Hard safety rules for configuration

1. Preview env target ref must be `epismclrjnpgewpaiidd`.
2. If any Preview value resolves to `umswlpkjiwjohkolsyct` → **STOP**.
3. Do not modify Vercel **Production** environment variables.
4. Do not copy Production secret values into Preview.
5. Generate fresh Preview embed secrets (portal mint ↔ module verify pairs).
6. Local workstation `.env.local` currently points at Production — **must not** be used as the Preview source.

---

## Configuration / deploy status (this session)

| Item | State |
|------|-------|
| Project map | Documented |
| Vercel CLI | Authenticated as `munhso-9795` / team `munhso-9795s-projects` |
| `inspect-mn` linked to | `platform-portal` |
| Preview `NEXT_PUBLIC_SUPABASE_URL` | **Added** (Preview only → `epismclrjnpgewpaiidd`) |
| Preview `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Added** (Preview only; JWT ref verified) |
| Preview embed secrets | **Added** (`INSPECTION_EMBED_SECRET`, `POLICY_EMBED_SECRET` Preview only) |
| Preview `SUPABASE_SERVICE_ROLE_KEY` | **Not set** (blocked — Preview service-role not available via automation) |
| Preview deploy | **Not started** (Phase 4 STOP) |

### Critical incident note

`SUPABASE_SERVICE_ROLE_KEY` previously existed as a **shared** Preview+Production variable. Removing it from Preview via CLI **also removed the Production entry** from `platform-portal` env listing. **Human must verify/restore Production `SUPABASE_SERVICE_ROLE_KEY` from Supabase Dashboard (Production project) + Vercel Production env before any Production traffic reliance.** This agent did not redeploy Production and did not rotate the Production key.

See `docs/prod-audit/51-openclaw-preview-qa-handoff.md` and Phase 16 blockers.
