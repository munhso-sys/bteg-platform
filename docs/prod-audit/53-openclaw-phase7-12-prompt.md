# 53 — Local OpenClaw prompt: Preview Phase 7–12 smoke

Copy everything inside the fenced `PROMPT` block into Local OpenClaw.  
Supply QA passwords out-of-band (do not paste secrets into git).

**Operator known facts (2026-09-08):**
- Portal + IC + Research open in **top-level tabs** after Vercel team auth.
- Portal routes `/inspection`, `/policy-compliance`, `/development` use **iframes**; with Deployment Protection they show a blank/broken frame (Vercel login cannot be framed). Treat iframe embed as **expected FAIL/WARN**, not suite-stop, when direct hosts work.
- Management Center “3/3 Онлайн” is a **false positive** if module ready returns HTTP 302 (Protection).
- Policy standalone `/dashboard` crashes: `Policy remote update refused without organization scope (P0-03)` (digest ~2770608369). Record Policy accordingly.
- SmartMine `v_processing_dashboard: TypeError: fetch failed` is **out of scope** for this Preview P0 smoke (separate SmartMine Supabase).

---

````PROMPT
TITLE: PREVIEW PROTECTED SMOKE — PHASE 7–12 (DIRECT MODULE HOSTS)

ROLE
You are a QA agent running Local OpenClaw against isolated Vercel Preview.
Complete auth + module navigation + cross-org + Research/Program/IC smoke,
plus log review and client secret scan, without touching Production.

CONTEXT
- Git SHA expected: ac58a6bd3e56f3f3d04e785bec9623ed8b0c117a
- Preview Supabase ONLY: epismclrjnpgewpaiidd
- Production Supabase FORBIDDEN: umswlpkjiwjohkolsyct
- Draft PR #1 must NOT be merged
- Deployment Protection is ON — do NOT disable it globally
- Do NOT deploy Production, change Production env/Auth, apply Production migrations
- Do NOT print passwords, service-role keys, embed secrets, Vercel tokens, or bypass secrets

CANONICAL PREVIEW URLS (use these exactly)
- Portal: https://platform-portal-b5613ju7l-munhso-9795s-projects.vercel.app
- IC: https://platform-inspection-center-5t6p25yx1-munhso-9795s-projects.vercel.app
- Policy: https://platform-policy-compliance-nvdybxanr-munhso-9795s-projects.vercel.app
- Research: https://platform-development-8rmopb2kj-munhso-9795s-projects.vercel.app

Repo docs (if available):
- docs/prod-audit/47-preview-smoke-plan.md
- docs/prod-audit/50-preview-auth-redirects.md
- docs/prod-audit/51-openclaw-preview-qa-handoff.md
- docs/prod-audit/52-preview-url-contract.md
- docs/prod-audit/53-openclaw-phase7-12-prompt.md

ACCESS METHOD (required)
1. Use Chrome (or team browser) already authenticated to the Vercel team.
2. Unlock EACH host in a **top-level tab** (not inside portal iframe): Portal, IC, Policy, Research. Complete Vercel SSO per project if prompted.
3. Prefer: A team browser > B vercel curl CLI > C Trusted Sources/OIDC > D approved Protection Bypass (secret private only).
4. Never disable Deployment Protection globally. Never commit bypass secrets.
5. If UI still blocked after SSO attempts → BLOCKED (not FAIL) for UI phases; report Exact blockers.

CRITICAL — MODULE ACCESS RULE
- Do NOT rely on Portal iframe routes `/inspection`, `/policy-compliance`, `/development` for PASS.
  Those iframes typically show blank/broken icon under Deployment Protection (login page not frameable).
- For module navigation + IC/Research/Policy app smoke: open the **canonical module Preview URLs in top-level tabs**.
- Optionally note portal iframe as WARN/FAIL-expected under Protection; do not stop the suite if direct hosts work.
- Ignore Management Center “modules online 3/3” if probes are HTTP 302.

SYNTHETIC QA USERS (emails only — passwords from operator secure channel)
- qa-org-a-admin@example.com
- qa-org-a-inspector@example.com
- qa-org-a-manager@example.com
- qa-org-b-admin@example.com
- qa-org-b-inspector@example.com
- qa-org-b-manager@example.com

Do not invent Production users. Do not log passwords.

OUT OF SCOPE (record WARN only, do not FAIL the suite)
- SmartMine metrics / v_processing_dashboard fetch failed (separate SmartMine Supabase; not Preview P0 gate).

================================================================
PHASE 0 — PRECHECK (STOP only on runtime/Auth identity FAIL)
================================================================
On Portal (after Vercel unlock):
1. Open /api/runtime-info
2. Open /api/supabase/health

PASS only if:
- vercelEnv = preview
- commitSha starts with ac58a6b
- supabase ref epismclrjnpgewpaiidd (or masked epis…iidd)
- umswlpkjiwjohkolsyct ABSENT
- no secret material in JSON

Auth: accept docs/prod-audit/50-preview-auth-redirects.md Status PASS, or live Preview Dashboard matching the four canonical hosts. STOP for Auth only if canonical hosts missing from Site URL / redirects.

If Vercel wall blocks and no access method works → UI BLOCKED; still report.

================================================================
PHASE 7 — AUTH SMOKE (Portal host)
================================================================
QA_ORG_A admin:
1. Login on Portal Preview
2. Protected route (e.g. /dashboard or /management-center)
3. Logout
4. Login again
5. Reload — session persists
6. Invalid password — stays on login
7. Post-login URL stays on Portal Preview host (not Production / localhost / git-fix alias)

Record: PASS / FAIL / BLOCKED

================================================================
PHASE 8 — MODULE NAVIGATION (+ optional embed note)
================================================================
A) Direct hosts (REQUIRED for PASS):
- Open IC canonical URL top-level — UI loads
- Open Research canonical URL top-level — UI loads
- Open Policy canonical URL top-level — record result:
  * Known defect: /dashboard may white-screen with Next digest ~2770608369
    message: "Policy remote update refused without organization scope (P0-03)"
  * Mark Policy module navigation FAIL or BLOCKED-with-known-bug; do not invent fixes; do not touch Production.

B) Portal chrome links (informational):
- From Portal, confirm module link targets are the canonical Preview hosts (not Production / git-fix / localhost).
- Open /inspection, /policy-compliance, /development iframes once:
  * Blank/broken iframe under Protection = expected WARN (document as portal/embed WARN or FAIL-expected).
  * Do not require iframe PASS for suite READY if direct hosts PASS (except Policy known P0-03).

Record:
- portal/embed: …
- module navigation: … (base on direct hosts; call out Policy P0-03)

================================================================
PHASE 9 — CROSS-ORG SECURITY
================================================================
Synthetic data only. Prefer Research/IC surfaces on Preview hosts + Portal where applicable.
QA_ORG_A vs QA_ORG_B:
- own-org list allowed
- other-org list denied/empty
- direct detail denied
- crafted update denied
- forged organization_id denied
- same-browser user switch isolated

Record: PASS / FAIL / BLOCKED

================================================================
PHASE 10 — RESEARCH / PROGRAM / IC
================================================================
Synthetic only. Titles prefix “QA-SMOKE-<timestamp>-…”.

Research (on Research Preview host and/or Portal session as designed):
- create, reload, edit, persistence, cross-org deny

Program:
- create, edit, status, persistence, cross-org deny

IC (on IC Preview host):
- create inspection, finding, corrective action, reload
- IC-D01, IC-D05, P0-01 as applicable

Policy app deep smoke: skip or FAIL with P0-03 evidence if /dashboard still crashes.

Record each: PASS / FAIL / BLOCKED

================================================================
PHASE 11 — LOGS
================================================================
Preview window: 5xx, unexpected 401/403, Auth redirect failures, PGRST/RLS, wrong project ref, timeouts.
Ignore Protection-only 302.
Note known Policy P0-03 errors if present (WARN/FAIL for Policy only).
Record: PASS / WARN / FAIL

================================================================
PHASE 12 — CLIENT SECRET SCAN
================================================================
Via protected access: no service-role / embed secret / Vercel token / DB secret / Production credential values in client JS.
Publishable/anon JWT alone OK.
If blocked → BLOCKED.
Record: PASS / BLOCKED / FAIL

================================================================
PHASE 13 — HANDOFF
================================================================
Update docs/prod-audit/51-openclaw-preview-qa-handoff.md if writable.
READY only if: runtime PASS, auth PASS, module navigation PASS for IC+Research (Policy known FAIL allowed with explicit blocker), cross-org PASS, research PASS, program PASS, IC PASS, logs not critical FAIL, secret scan PASS/BLOCKED acceptable, access method documented.
Never include credentials.

================================================================
FINAL RESPONSE FORMAT (required)
================================================================
Git SHA:

Actual Preview URLs:
- Portal:
- IC:
- Policy:
- Research:

URL contract: PASS / FAIL
Supabase Auth redirects: PASS / FAIL
Runtime identity: PASS / FAIL

Deployment Protection:
- enabled:
- verification method: (A / B / C / D)

Smoke:
- auth:
- portal/embed: (expect WARN/FAIL under Protection iframe)
- module navigation: (direct hosts; note Policy P0-03)
- cross-org:
- research:
- program:
- IC:
- policy-app: (PASS / FAIL P0-03 / BLOCKED)
- smartmine: OUT_OF_SCOPE / WARN

Logs: PASS / WARN / FAIL
Client secret scan: PASS / BLOCKED / FAIL
OpenClaw package: READY / NOT READY
PREVIEW VERIFICATION: PASS / FAIL
Safe for OpenClaw independent QA: YES / NO
Safe for human business review: YES / NO
Exact blockers:

STOP.
NO PRODUCTION CHANGE.
NO MERGE.
NO PROMOTION.
````

---

## Operator checklist

1. Chrome: Vercel team logged in; unlock Portal + IC + Policy + Research in **separate tabs**.
2. QA passwords via secure channel only.
3. Paste the `PROMPT` block into Local OpenClaw.
4. Expect portal iframe blank; judge modules on **direct URLs**.
