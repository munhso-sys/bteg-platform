# 52 — Vercel env scope recovery

**Date:** 2026-09-08  
**Git branch:** `fix/prod-stabilization-p0`  
**SHA:** `ac58a6bd3e56f3f3d04e785bec9623ed8b0c117a`  
**Production Supabase:** `umswlpkjiwjohkolsyct`  
**Preview Supabase:** `epismclrjnpgewpaiidd`  

**This run:** No Production env writes. No Vercel deploy. No merge. No remote migration.  
**Secret values:** never recorded.

---

## Phase 1 — Production recovery verification

| Check | Result |
|-------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` present on `platform-portal` | **YES** |
| Scope | **Production only** (not Preview+Production) |
| Type | Secret (server-only) |
| `NEXT_PUBLIC_*` name | **No** |
| Live homepage | `307` → login (available) |
| Live `/login` | `200` |
| `/api/supabase/health` | `200`, `projectRef=umswlpkjiwjohkolsyct` |
| `/api/runtime-info` | `307` → login (auth middleware; non-mutating probe OK) |

**Production config recovered:** YES  
**Current live Production healthy:** YES  
**Production modified by this run:** NO

---

## Service-role consumer classification (source)

| App | Path | Class | Preview privileged secret? |
|-----|------|-------|----------------------------|
| `platform-portal` | Admin/RBAC/voice/reports/`app_data_store` via `createAdminClient()` | **A** | **YES** (Preview-only) |
| `platform-inspection-center` | `store/remote.ts` → `org_app_data_store` via `createServerSupabaseClient()` | **A** | **YES** (Preview-only) |
| `platform-policy-compliance` | `db/remote-store.ts` → `org_app_data_store` via service role | **A** | **YES** (Preview-only) |
| `platform-development` | Research APIs use `createUserServerClient()` (user JWT + RLS) | **B** | **NO** for app runtime |
| `platform-development` | `createServiceRoleClient()` (tests/seed only) | **C** (runtime) | **NO** for Preview deploy |

---

## Env scope matrix (metadata only)

### platform-portal (`inspect-mn`)

| VARIABLE | PROD scope? | PREVIEW scope? | PUBLIC/SERVER | SECRET? | EXPECTED REF | SHARED? | ACTION |
|----------|-------------|----------------|---------------|---------|--------------|---------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | YES | NO | Server | Yes | Prod=`umsw…` / Preview=`epis…` | **No** (good) | Human set **Preview-only** from `epismclrjnpgewpaiidd` |
| `NEXT_PUBLIC_SUPABASE_URL` | YES | YES | Public | No* | Prod=`umsw…` Preview=`epis…` | Separate entries | Preview already set; leave Prod |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | YES | YES | Public | No* | Matching project | Separate | Preview already set; leave Prod |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | YES | NO | Public | No* | Prod | — | Optional Preview mirror |
| `NEXT_PUBLIC_SITE_URL` | YES | NO | Public | No | Preview host | — | **Add Preview** |
| `NEXT_PUBLIC_INSPECT_URL` | YES | NO | Public | No | Preview IC host | — | **Add Preview** |
| `NEXT_PUBLIC_POLICY_URL` | YES | NO | Public | No | Preview policy host | — | **Add Preview** |
| `NEXT_PUBLIC_DEVELOPMENT_URL` | YES | NO | Public | No | Preview research host | — | **Add Preview** |
| `INSPECTION_EMBED_SECRET` | NO | YES | Server | Yes | n/a | No | Sync same Preview value to IC |
| `POLICY_EMBED_SECRET` | NO | YES | Server | Yes | n/a | No | Sync same Preview value to policy |
| `CRON_SECRET` | YES | YES | Server | Yes | n/a | **YES — bleed** | Split later (Preview-only copy); do not touch Prod this run |
| `SMARTMINE_SUPABASE_*` | YES | YES | Mixed | Yes | SmartMine (other) | **YES — bleed** | Out of portal P0 path; split later |
| `OPENAI_*` / `TELEGRAM_*` / `RESEND_*` / `EMAIL_FROM` | YES | YES | Server | Yes | n/a | **YES — bleed** | Not Supabase isolation blockers; prefer split |

\*Stored as Secret or Config in Vercel UI; still browser-exposed if `NEXT_PUBLIC_`.

### platform-inspection-center

| VARIABLE | PROD? | PREVIEW? | Side | SECRET? | EXPECTED REF | SHARED? | ACTION |
|----------|-------|----------|------|---------|--------------|---------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | YES | NO | Public | No | Preview=`epis…` | — | **Add Preview** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | YES | NO | Public | No | Preview | — | **Add Preview** |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | YES | NO | Public | No | Preview | — | Optional |
| `SUPABASE_SERVICE_ROLE_KEY` | NO | NO | Server | Yes | Preview=`epis…` | — | **Add Preview-only** (class A) |
| `INSPECTION_EMBED_SECRET` | NO | NO | Server | Yes | n/a | — | **Add Preview-only** (match portal) |

### platform-policy-compliance

| VARIABLE | PROD? | PREVIEW? | Side | SECRET? | EXPECTED REF | SHARED? | ACTION |
|----------|-------|----------|------|---------|--------------|---------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | YES | NO | Public | No | Preview=`epis…` | — | **Add Preview** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | YES | NO | Public | No | Preview | — | **Add Preview** |
| `SUPABASE_SERVICE_ROLE_KEY` | NO | NO | Server | Yes | Preview=`epis…` | — | **Add Preview-only** (class A) |
| `POLICY_EMBED_SECRET` | NO | NO | Server | Yes | n/a | — | **Add Preview-only** (match portal) |

### platform-development (Research)

| VARIABLE | PROD? | PREVIEW? | Side | SECRET? | EXPECTED REF | SHARED? | ACTION |
|----------|-------|----------|------|---------|--------------|---------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | YES | NO | Public | No | Preview=`epis…` | — | **Add Preview** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | YES | NO | Public | No | Preview | — | **Add Preview** |
| `SUPABASE_SERVICE_ROLE_KEY` | NO | NO | Server | Yes | — | — | **Do not set** for Preview runtime (class B/C) |

---

## Provisional Preview hostnames (pre-deploy)

Branch slug: `fix-prod-stabilization-p0`

| App | Provisional Preview origin |
|-----|----------------------------|
| Portal | `https://platform-portal-git-fix-prod-stabilization-p0-munhso-9795s-projects.vercel.app` |
| IC | `https://platform-inspection-center-git-fix-prod-stabilization-p0-munhso-9795s-projects.vercel.app` |
| Policy | `https://platform-policy-compliance-git-fix-prod-stabilization-p0-munhso-9795s-projects.vercel.app` |
| Research | `https://platform-development-git-fix-prod-stabilization-p0-munhso-9795s-projects.vercel.app` |

Confirm exact hosts after first Preview deploy; update Auth redirects + `NEXT_PUBLIC_*_URL` if Vercel assigns different URLs.

---

## Embed secret ownership (Preview only; no values)

| Variable | Signer | Verifier | Scope |
|----------|--------|----------|-------|
| `INSPECTION_EMBED_SECRET` | `platform-portal` | `platform-inspection-center` | Preview only |
| `POLICY_EMBED_SECRET` | `platform-portal` | `platform-policy-compliance` | Preview only |

Do **not** reuse Production embed secrets.

---

## Auth redirects (Preview Supabase only)

Target project: `epismclrjnpgewpaiidd` only.  
See `docs/prod-audit/50-preview-auth-redirects.md`.

**Status this run:** not applied (requires Supabase Dashboard / Management API; agent has no Auth-config write tool that avoids Production).

---

## Privileged shared-env bleed (remaining)

| Variable | Apps | Assessment |
|----------|------|------------|
| `CRON_SECRET` | portal | NOT SAFE long-term — split Preview vs Production |
| `SMARTMINE_SUPABASE_SERVICE_ROLE_KEY` | portal | NOT SAFE — privileged; split |
| `SMARTMINE_SUPABASE_URL` | portal | Prefer split |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | portal | Prefer split |
| `TELEGRAM_BOT_TOKEN` | portal | Prefer split |
| `RESEND_API_KEY` / `EMAIL_FROM` | portal | Prefer split |

**Default for privileged secrets:** NOT SAFE when shared. Do **not** auto-modify Production this run.

---

## Incident note (2026-09-08)

Human could not find top-level project `epismclrjnpgewpaiidd` in the Supabase project list (expected: it is a **Branch**, not a standalone project).

**Incorrect action taken:** Preview-scoped `SUPABASE_SERVICE_ROLE_KEY` on portal / IC / policy was populated from Production project `umswlpkjiwjohkolsyct`.

**Remediation:** Agent removed Preview-scoped `SUPABASE_SERVICE_ROLE_KEY` from portal / IC / policy. Production-scoped keys left untouched.

**Follow-up (human, verified by scope metadata 2026-09-08):** Preview-only `SUPABASE_SERVICE_ROLE_KEY` re-added on portal + IC + policy as **separate Preview entries** (not shared with Production). Values not inspected. Research (`platform-development`) correctly has **no** Preview service-role (user JWT + RLS path).

**How to open Preview keys correctly:**

1. Supabase Dashboard → open Production project **inspect-bteg** (`umswlpkjiwjohkolsyct`)
2. Go to **Branches** (or Project Settings → Branches)
3. Open branch **`fix-prod-stabilization-p0`** (ref `epismclrjnpgewpaiidd`, `ACTIVE_HEALTHY`, `with_data: false`)
4. Copy **that branch’s** service_role / secret key only
5. Add to Vercel as **Preview-only** on portal + IC + policy (never Production+Preview shared)

Do **not** use Production service_role for Preview.

## Blockers before isolated Preview deploy

1. Human sets Preview-only `SUPABASE_SERVICE_ROLE_KEY` on portal + IC + policy from project `epismclrjnpgewpaiidd` (never Production; never shared scope).
2. Apply Preview Auth redirects on `epismclrjnpgewpaiidd` only (doc 50).
3. Confirm provisional Preview hostnames match real Vercel Preview URLs after first deploy attempt (or set exact hosts first).
4. Re-run isolation matrix → ALL PASS.
5. Split remaining privileged shared vars (`CRON_SECRET`, SmartMine, OpenAI, Telegram, Resend) in a later change — do not auto-touch Production.
