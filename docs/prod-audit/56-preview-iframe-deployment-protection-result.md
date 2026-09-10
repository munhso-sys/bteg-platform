# 56 — Preview iframe blocker: Deployment Protection

**Date:** 2026-09-09  
**Scope:** Vercel Preview only  
**Result:** **WARN — iframe FAIL-expected; authenticated direct-host smoke PASS**

## Live READY Preview hosts

- Portal: `https://platform-portal-bmdctb89u-munhso-9795s-projects.vercel.app`
- Inspection Center: `https://platform-inspection-center-ctm5zzd5h-munhso-9795s-projects.vercel.app`
- Policy: `https://platform-policy-compliance-l475g5lfl-munhso-9795s-projects.vercel.app`
- Research: `https://platform-development-e55dpxuwm-munhso-9795s-projects.vercel.app`

The obsolete Portal host `j308w9hv5` was not used.

## Identity and URL contract

- `vercel inspect` reports the Portal target as `preview`, state `Ready`.
- Authenticated `GET /api/supabase/health` returns `ok: true` and Preview ref `epismclrjnpgewpaiidd`; the Production ref is absent.
- Portal ready endpoints return the exact three live module origins above.
- Authenticated `GET /api/runtime-info` returns the application 404 page on this deployment. Runtime identity is established by the Preview deployment target plus the authenticated Supabase health endpoint.

## Authenticated iframe evidence

The Portal QA login succeeded and persisted on the newest Preview host. On `/inspection`, the iframe navigation produced:

1. module dashboard document: `302`
2. Vercel SSO document: `307`
3. final Vercel login document: `200`, blocked by the browser as `net::ERR_BLOCKED_BY_RESPONSE`

The rendered iframe error is exactly **“vercel.com refused to connect.”**

Independent header capture shows Vercel SSO/login responses send `X-Frame-Options: DENY`; the final login page also sends CSP `frame-ancestors 'none'`. Authenticated module responses allow `https://*.vercel.app` as frame ancestors. The primary classification is therefore **PROT_SSO_IFRAME**, not stale origin or module CSP.

Opening Inspection Center top-level first does not unblock the iframe. Inspection Center rendered its authenticated dashboard in a top-level tab; after returning to Portal and hard-reloading `/inspection`, the same refusal remained. Portal `/policy-compliance` and `/development` reproduced the same visible refusal.

## Option and direct-host smoke

- Option applied: **A — smoke without iframe**
- Portal iframe result: **WARN-expected** while Deployment Protection remains enabled
- Inspection Center top-level: **PASS**, authenticated dashboard rendered
- Policy top-level: **PASS**, authenticated dashboard rendered; the previously noted P0-03 crash did not reproduce
- Research top-level: **PASS**, authenticated dashboard rendered

No bypass was created, no Protection setting was changed, and no Auth URL or redeploy is needed for Option A.

## Operator handoff

Preview smoke may continue on the three top-level module hosts under `47-preview-smoke-plan.md` and `53-openclaw-phase7-12-prompt.md` Phase 7+.

**Exact remaining human clicks for this iframe decision: none.** Keep judging Preview modules through the authenticated top-level tabs. Do not use the Portal iframe as the pass criterion while Deployment Protection is enabled.

No Production change. No deploy. No merge. No promotion.
