# 01 — Runtime and Environment Matrix

## Baseline

| Item | Value |
|------|-------|
| Audit branch | `audit/prod-stabilization-20260904` |
| Commit SHA | `597d1ffceacfd5ce4e550f12e7b490134ff418ec` |
| Portal package | `inspect-mn@0.1.0` |
| Build | `npm run build` → `next build` |
| Start (prod mode) | `npm start` → `next start -p 3000` |
| Vercel buildCommand | `npm run build` (`inspect-mn/vercel.json`) |
| Framework | Next.js (`vercel.json`) |
| Cron | `/api/reports/distribute` daily `0 1 * * *` |
| `next.config.ts` | empty options object (no `cacheComponents`) |
| Auth entry | `src/middleware.ts` (not `src/proxy.ts`) |

## Package versions (portal)

From `inspect-mn/package.json`:

- `next@16.3.0`
- `react@19.2.8` / `react-dom@19.2.8`
- `@supabase/ssr@^0.12.4`
- `@supabase/supabase-js@^2.112.3`
- No `test` script; lint via `eslint`

## Vercel apps (documented)

| App folder | Vercel project | Production hostname |
|------------|----------------|---------------------|
| `inspect-mn` | `platform-portal` | `bteg.inspect.mn` (+ `platform-portal-blue.vercel.app`) |
| `inspection-center` | `platform-inspection-center` | `platform-inspection-center.vercel.app` |
| `bgs-policy-compliance` | `platform-policy-compliance` | `platform-policy-compliance.vercel.app` |
| `development` | `platform-development` | `platform-development-amber.vercel.app` |

Evidence: `docs/VERCEL_DEPLOYMENT.md`, `docs/SUPABASE_CONNECTION.md`, prior CLI `vercel project ls`.

## Environment variable matrix (names only)

### Portal (`inspect-mn`) — public / build-inlined

| Name | Purpose |
|------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Portal Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Preferred publishable JWT (see `env.ts`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Alternate key; used if anon missing / non-JWT |
| `NEXT_PUBLIC_SITE_URL` | Auth redirects, emails |
| `NEXT_PUBLIC_APP_URL` | Telegram fallback URL |
| `NEXT_PUBLIC_INSPECT_URL` | Inspection iframe origin |
| `NEXT_PUBLIC_POLICY_URL` | Policy iframe origin |
| `NEXT_PUBLIC_DEVELOPMENT_URL` | Development iframe origin |

### Portal — server-only

| Name | Purpose |
|------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Admin client; access-request approve; many store upserts |
| `SMARTMINE_SUPABASE_URL` | Second Supabase project |
| `SMARTMINE_SUPABASE_SERVICE_ROLE_KEY` | SmartMine reads |
| `SMARTMINE_SUPABASE_ANON_KEY` | Fallback SmartMine key |
| `SMARTMINE_ORGANIZATION_ID` | SmartMine org filter |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | AI / policy-review |
| `POLICY_REVIEW_DISABLE_OPENAI` | Feature flag |
| `TELEGRAM_BOT_TOKEN` | Voice bot |
| `RESEND_API_KEY` / `EMAIL_FROM` | Transactional email |
| `CRON_SECRET` | Protect distribute cron |
| `POLICY_EMBED_SECRET` | Sign policy iframe claims |
| `INSPECTION_EMBED_SECRET` | Sign inspection iframe claims |

### Module apps

| App | Notable names |
|-----|---------------|
| `inspection-center` | Same Supabase public URL/key pattern; remote keys under `app_data_store` |
| `bgs-policy-compliance` | `VERCEL`, `USE_REMOTE_STORE`, Supabase URL/key; local `data/` gitignored |
| `development` | Separate Vercel app |

**Do not print values.** Local secrets live in `inspect-mn/.env.local` (present; not committed).

## Key selection logic

`inspect-mn/src/lib/supabase/env.ts`:

1. Prefer `NEXT_PUBLIC_SUPABASE_ANON_KEY` if it starts with `eyJ`
2. Else `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` if JWT-shaped
3. Else either string

Risk: non-JWT publishable key can break `@supabase/ssr` auth (comment in source).

## Project ref expectations

| Env | Expected portal ref | Notes |
|-----|---------------------|-------|
| Local | `umswlpkjiwjohkolsyct` (`inspect-bteg`) | Documented in `docs/SUPABASE_CONNECTION.md` |
| Preview | Same or misconfigured clone | Preview URLs must be in Auth Redirect list |
| Production | `umswlpkjiwjohkolsyct` | Site URL `https://bteg.inspect.mn` |

Secondary project (SmartMine): `hlidcdaaxmdhisdfkaca` — **must not** be used as portal auth URL.

## Build-time vs runtime

- `NEXT_PUBLIC_*` inlined at **build** for Next client bundles.
- A Preview/Production build against project A that later points runtime health checks at project B causes auth/data mismatch.
- Recommendation: `/api/runtime-info` returning commit SHA, `VERCEL_ENV`, `VERCEL_DEPLOYMENT_ID`, **masked** project ref only (no keys).

## Auth URL expectations (documented)

Site URL: `https://bteg.inspect.mn`  
Redirects include production, `platform-portal-blue.vercel.app/**`, `localhost:3000/**`.

## Parity gaps

1. Local duty modules often use `localhost:3001/3002/3003`; production embeds Vercel origins — env mismatch → blank iframe.
2. Local policy data under gitignored `data/`; production requires remote rows.
3. Hardcoded embed secret fallback defeats secret rotation (see issue register P0-02).
4. `scripts/start-duty-modules.ps1` historically hardcodes `C:\Users\Owner\platform\...` — local path parity failure on other machines.
