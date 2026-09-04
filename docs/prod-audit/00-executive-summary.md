# Production Stabilization Audit — Executive Summary

**Scope:** `bteg.inspect.mn` (Vercel project `platform-portal` / app `inspect-mn`) and embedded duty modules.  
**Branch:** `audit/prod-stabilization-20260904`  
**Baseline commit:** `597d1ffceacfd5ce4e550f12e7b490134ff418ec`  
**Audit date:** 2026-09-04  
**Mode:** Phase 1 read-only (no code, schema, env, or production data changes).

## Tooling baseline

| Tool | Version |
|------|---------|
| Node | v24.19.0 |
| npm | 12.0.2 |
| Next.js (inspect-mn) | 16.3.0 |
| @supabase/ssr | ^0.12.4 |
| @supabase/supabase-js | ^2.112.3 |
| Vercel CLI (via npx) | 59.x |
| Supabase project (portal) | `inspect-bteg` / ref `umswlpkjiwjohkolsyct` / region `ap-southeast-2` |

## Phase A safe checks (`inspect-mn`)

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | Completed with exit 0 (no TS errors printed) |
| `npm run lint` | Exit 0 — **5 warnings** (react-hooks on risk work page; `window.location.assign` on logout/idle) |
| `next build` + `next start` | Not completed in this pass (time-boxed); recommend on Batch A kickoff |
| Unit/integration tests | No `test` script in package.json |

## Architecture reality (critical)

The prompt’s expected relational model (`organizations`, `inspections`, `findings`, `corrective_actions`, …) **does not exist** in production PostgreSQL for `inspect-bteg`.

**Canonical production tables (public):**

1. `app_data_store` (key/jsonb payload) — primary business data for inspection, policy compliance, voice, guidance, risk, etc.
2. `roles`, `permissions`, `role_permissions`
3. `user_profiles`
4. `access_requests`
5. `temporary_edit_grants`

Inspection “findings / corrective actions” live **inside JSON documents** keyed e.g. `inspection_center_store`, not as FK-linked tables. Policy module uses `policy_compliance_db` (and related override keys) in the same store.

Portal routes that matter:

| Menu expectation | Actual portal route | Embedded origin env |
|------------------|---------------------|---------------------|
| Dashboard | `/` | n/a |
| Inspection | `/inspection` | `NEXT_PUBLIC_INSPECT_URL` |
| Compliance | `/policy-compliance` (not `/compliance`) | `NEXT_PUBLIC_POLICY_URL` |
| Research | `/development` (not `/research`) | `NEXT_PUBLIC_DEVELOPMENT_URL` |
| Voice | `/employee-voice` | in-portal |
| AI | `/ai-assistant` | in-portal |
| Settings | `/settings` | in-portal |

Auth uses `src/middleware.ts` → `lib/supabase/middleware.ts`. **There is no `src/proxy.ts`.**

## Top P0 findings

| ID | Summary |
|----|---------|
| **P0-01** | `app_data_store` RLS policies are `USING (true)` / `WITH CHECK (true)` for `anon` + `authenticated` → any holder of the publishable/anon key can read/write all module JSON stores. |
| **P0-02** | Hardcoded HMAC fallback secret `"inspect-platform-policy-embed-v1"` in portal embed signing (`policy-embed.ts`, `inspection-embed-server.ts`) when dedicated secrets unset → forgeable embed claims / privilege bypass across iframe modules. |
| **P0-03** | No DB-level organization isolation for module payloads; unit/position scoping is application JS after loading whole blobs. Cross-tenant exposure risk if RLS or client misuse occurs (compounded by P0-01). |

## Top P1 findings

| ID | Summary |
|----|---------|
| **P1-01** | Local vs production store split: local FS `data/` vs Vercel `app_data_store` (`preferRemoteStore` when `VERCEL=1`). Missing remote seed / wrong project → empty, stale, or local-only behavior in prod. |
| **P1-02** | Multi-app deploy drift: monorepo Git push does not auto-deploy sibling Vercel apps unless each is linked; CLI redeploy required historically for `platform-policy-compliance`. |
| **P1-03** | Dual Supabase projects (`inspect-bteg` + SmartMine `hlidcdaaxmdhisdfkaca`). Wrong URL/key pairing breaks auth or SmartMine silently. |
| **P1-04** | Middleware auth timeout (8s) / swallowed errors treat failure as logged-out → intermittent production login loops. |
| **P1-05** | Migration inventory drift: Git has `inspect-mn/supabase/migrations/20260817_add_smartmine_permission.sql` not listed among remote migration versions. |
| **P1-06** | Admin mutations require `SUPABASE_SERVICE_ROLE_KEY`; missing on Vercel → approve/invite/settings writes fail while local may appear fine. |

## Safest first fix batch (do not implement yet)

**Batch A (security, minimal surface):**

1. Restrict `app_data_store` RLS to service_role / authenticated admin paths only; modules already prefer admin client for writes.
2. Remove hardcoded embed secret; require `POLICY_EMBED_SECRET` / `INSPECTION_EMBED_SECRET` in all environments; rotate if ever used in prod.
3. Add `/api/runtime-info` (masked) for deployment/project ref parity checks.

**Then Batch B:** remote-store contract tests + Vercel Git link for all four apps + region/latency notes.

## Stop condition

No fixes applied. No deploy. No production mutation. Await implementation instruction.