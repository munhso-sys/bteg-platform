# 54 — Preview onboarding + Policy P0-03 fix

**Date:** 2026-09-08  
**Branch:** `fix/prod-stabilization-p0`  
**Base SHA (pre-change):** `ac58a6bd3e56f3f3d04e785bec9623ed8b0c117a`  
**Preview Supabase:** `epismclrjnpgewpaiidd`  
**Production:** untouched

## Root causes

1. **Org catalog ENOENT on Preview:** Portal `GET /api/org/options` fell back to `process.cwd()/data/reference/org-catalog.json`. Root `.gitignore` ignores `data/`, so the catalog was never in the Vercel function filesystem. Policy remote `/api/org/access-options` also failed under Deployment Protection → fallback ENOENT → access-request dropdowns empty.

2. **Policy dashboard 500 (P0-03):** `/dashboard` called `applyOrgNamingCorrections()` → `updateDb` → remote write without organization scope → `Policy remote update refused without organization scope (P0-03)`.

## Fixes (security rationale)

| Change | Why |
|--------|-----|
| Bundle `org-catalog.json` under `inspect-mn/src/lib/org/` and `bgs-policy-compliance/src/lib/db/` | Version-controlled, included in Next/Vercel bundle; no reliance on ignored `data/` |
| Portal options: remote-first, bundled fallback; sanitized API errors | Access-request works even when Policy is protected/unreachable; no FS paths leaked |
| SHA256 sync test between portal/policy catalogs | Prevent silent drift |
| Remove dashboard render-time org mutation; skip remote naming corrections without `heltesId` | No unscoped tenant write; missing scope ≠ 500 on dashboard |
| Users PATCH returns 404 when zero rows | No false success |
| Access-request: document existing Auth lookup; `existing_auth_user` flag; Vercel≠app role comment | Idempotent approve for pre-created Auth users; domain separation |

## Tests / builds

- Portal unit: 5/5 PASS (`catalog.test.ts`, `options/route.test.ts`)
- Policy unit: 2/2 PASS (`p0-03-dashboard.test.ts`)
- Portal `tsc --noEmit`: PASS
- Policy `tsc --noEmit`: PASS
- Portal `next build`: PASS
- Policy `next build`: PASS

## Preview deploy (CLI `--target=preview`, no Production)

| App | URL | Notes |
|-----|-----|--------|
| Portal | https://platform-portal-ggde6hxyc-munhso-9795s-projects.vercel.app | `/api/org/options` → `ok:true`, `source:local`, 6 heltes; runtime `preview` + `epis…iidd` |
| Policy | https://platform-policy-compliance-dhgqmqck9-munhso-9795s-projects.vercel.app | `/dashboard` no longer `__next_error__` / P0-03; empty read-only DB when unscoped |

IC / Research hosts unchanged unless redeployed separately.

**Human follow-up:** Update Preview Auth Site URL + Portal `NEXT_PUBLIC_SITE_URL` to the new Portal host if continuing smoke on `ggde6hxyc`. Do not modify Production Auth.

## Policy P0-03 result

PASS (safe): unscoped dashboard no longer 500s; no unscoped remote write/seed. Unscoped view uses empty/bundled read-only data.

## Remaining blockers for OpenClaw READY

- Full onboarding UI approve for `munh_so@barulas.mn` still needs an authorized Preview admin session (not automated here).
- Cross-org / Research / Program / IC CRUD smoke not re-run in this agent session.
- Portal URL changed → Auth allowlist + env URL contract need human sync before OpenClaw resume on new host.
- Module iframe under Deployment Protection remains WARN.

OpenClaw Phase 7–12: **can resume** after Auth/env host sync + admin onboarding of `munh_so@barulas.mn`.

NO PRODUCTION CHANGE. NO MERGE. NO PROMOTION.
