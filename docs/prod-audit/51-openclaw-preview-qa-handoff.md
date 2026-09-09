# 51 — OpenClaw Preview QA handoff (read-only)

**Date:** 2026-09-08  
**Package status:** **NOT READY** for independent OpenClaw QA  

**Reasons:**
1. Team-authenticated Chrome + OpenClaw extension can unlock Preview hosts (operator-confirmed earlier).
2. Onboarding/catalog + Policy P0-03 fixes are on new Preview deploys (see `54-preview-onboarding-p0-03-fix.md`); Portal host changed to `ggde6hxyc` — Auth Site URL + `NEXT_PUBLIC_*` must be synced by human before resume.
3. Full approve/`munh_so@barulas.mn` onboarding + cross-org/Research/Program/IC CRUD not completed in this Cursor session.
4. Policy `/dashboard` P0-03 500 fixed on latest Policy Preview (`dhgqmqck9`); verify in browser.

**Latest Preview Portal:** https://platform-portal-ggde6hxyc-munhso-9795s-projects.vercel.app  
**Latest Preview Policy:** https://platform-policy-compliance-dhgqmqck9-munhso-9795s-projects.vercel.app  

**Git branch:** `fix/prod-stabilization-p0`  
**Working tree includes uncommitted onboarding fixes; deploy used local tree (commit label may still show `ac58a6b…`).**  
**Draft PR:** #1  

**Expected Preview Supabase ref:** `epismclrjnpgewpaiidd`  
**Forbidden Production Supabase ref:** `umswlpkjiwjohkolsyct`

---

## Prohibited actions

- Do not merge PR #1, deploy/promote Production, or change Production env.
- Do not apply Production migrations.
- Do not use Production Supabase credentials.
- Do not log passwords, service-role, or embed secrets.
- Stop write tests if `/api/runtime-info` shows wrong project ref / non-preview env.

---

## Preview URLs (canonical after URL-contract resync)

| Deployable | Deployment URL | Deployment ID |
|------------|----------------|---------------|
| Portal | https://platform-portal-b5613ju7l-munhso-9795s-projects.vercel.app | `dpl_2QNxTRpksoZ1JiF4iuLUavxwqXQa` |
| IC | https://platform-inspection-center-5t6p25yx1-munhso-9795s-projects.vercel.app | `dpl_BmCU1EyHtykEDGA6KBT6hVxGGK3S` |
| Policy | https://platform-policy-compliance-nvdybxanr-munhso-9795s-projects.vercel.app | `dpl_As7YBLCgMeoQ7avwTJcPFrMa6TqV` |
| Research | https://platform-development-8rmopb2kj-munhso-9795s-projects.vercel.app | `dpl_Ag1TtSFcRpaCKVq3fNFgXHTTZgGz` |

Environment: **Preview**. Build: **READY**.

---

## Runtime contract (portal — verified via `vercel curl`)

| Field | Observed | Expected |
|-------|----------|----------|
| `vercelEnv` | `preview` | `preview` |
| `commitSha` | `ac58a6b…` | `ac58a6b…` |
| `supabaseProjectRefMasked` | `epis…iidd` | `epismclrjnpgewpaiidd` |
| Production ref absent | YES | YES |
| Module origins (ready API) | IC/Policy/Research new hosts | match env |

---

## Synthetic QA identities (names only)

| Org | Role | Email |
|-----|------|-------|
| QA_ORG_A | admin / inspector / manager | `qa-org-a-*@example.com` |
| QA_ORG_B | admin / inspector / manager | `qa-org-b-*@example.com` |

Passwords: secure channel only — not in this file. (Preview QA passwords were rotated during agent smoke prep; obtain from operator.)

---

## Required human unblock before READY

1. Unlock Preview access for OpenClaw (pick one; do **not** disable Deployment Protection globally):
   - **A:** Install/connect OpenClaw Chrome extension relay; open Portal Preview in Chrome already logged into Vercel team; re-run.
   - **B:** `vercel login` on the OpenClaw machine; use `vercel curl --deployment <url>` for gated reads; browser still needs team session for UI login smoke.
   - **D (optional):** Protection Bypass for Automation — create in Vercel project settings, hand header/secret to OpenClaw privately (never commit).
2. Confirm Auth Site URL spelling is exactly `b5613ju7l` (not `b5813`).
3. Re-run Phase 7–12 with `docs/prod-audit/53-openclaw-phase7-12-prompt.md` + QA passwords out-of-band.
4. Then flip this package to **READY**.

---

## PASS/FAIL criteria

See `docs/prod-audit/47-preview-smoke-plan.md`. Suite stop if runtime identity fails.

---

## OpenClaw Phase 0 gate result — 2026-09-08

**Result:** **STOP / NOT READY**

- Deployment Protection is enabled; unauthenticated checks redirect to the Vercel login wall.
- The existing-team-browser path was unavailable: the Windows existing-session connector could not attach, and no Chrome extension relay was installed/connected.
- No authenticated Vercel CLI session or Trusted Sources/OIDC path was available in this run.
- Prior protected CLI artifacts in this handoff package match Preview runtime identity: `vercelEnv=preview`, commit prefix `ac58a6b`, Preview Supabase `epis…iidd`, and no Production project ref.
- Preview Auth Site URL and redirect allowlist remain documented as **NEEDS HUMAN UPDATE** in `50-preview-auth-redirects.md`; therefore the Phase 0 Auth gate fails pending operator confirmation/fix.
- Phases 7–12 were not executed because the required Phase 0 stop rule applied. No application writes, Production changes, merge, deployment, or promotion were performed.

---

## Phase 7–12 direct-host rerun — 2026-09-08 17:18 Asia/Ulaanbaatar

**Result:** **NOT READY / UI BLOCKED**

- Phase 0 runtime identity: **PASS** via authenticated Vercel CLI (`vercel curl`). Live protected responses reported `vercelEnv=preview`, commit prefix `ac58a6b`, and Preview Supabase `epismclrjnpgewpaiidd`; the Production project ref was absent and no secret values were returned.
- Preview Auth redirect allowlist: **PASS** by the operator-confirmed status in `50-preview-auth-redirects.md`, covering the Portal Site URL and canonical Portal/IC/Policy/Research `/**` redirects.
- Deployment Protection: **enabled**. Verification method **B (authenticated Vercel CLI)** worked for protected reads.
- Interactive browser access: **BLOCKED**. The managed OpenClaw profile reached the Vercel login wall; GitHub and Google both required fresh account authentication. The existing-user Windows Chrome connector failed, and the Chrome extension relay was not connected. Therefore auth, portal/module UI, cross-org, Research, Program, and IC write smoke were not executed.
- Direct-host availability: protected HTML and static JS were readable for Portal, IC, Policy, and Research through the CLI. This does not substitute for top-level interactive UI validation.
- Deployment logs: **WARN**. Policy logged three `/dashboard` HTTP 500 responses matching known P0-03. Portal `/api/settings/session` and Research `/api/research/program` had isolated 401 responses; no PGRST, RLS, Production-project-ref, Auth redirect, or timeout signatures were found in the reviewed two-hour window.
- Client secret scan: **PASS**. Protected HTML and 29 static JavaScript bundles across all four hosts contained no Production Supabase ref, service-role JWT, service/embed secret identifier, Vercel-token pattern, or database credential URI.
- No QA credentials were printed. No application writes, Production changes, merge, deployment, or promotion were performed.

---

## Phase 7–12 interactive Chrome rerun — 2026-09-08 18:52 Asia/Ulaanbaatar

**Result:** **NOT READY / AUTH FAIL**

- Access method **A** is now working: OpenClaw extension **2.2.0** is connected to the team-authenticated Chrome session. Browser control enumerated and inspected the canonical Portal, IC, Policy, and Research top-level tabs.
- Deployment Protection unlock: **PASS** for all four canonical hosts.
- Portal logout: **PASS**. The active non-QA session returned to the Portal login page.
- QA_ORG_A admin login: **FAIL**. The operator-supplied common Preview QA password was rejected with the generic invalid email/password message. The password was read locally and was not written to this file or chat.
- Invalid-password behavior: **PASS**. The Portal remained on the canonical Preview login host and displayed an error.
- Session persistence / relogin / protected-route checks: **BLOCKED** because a valid QA_ORG_A session could not be established.
- Direct module navigation: IC **PASS**, Research **PASS**, Policy **FAIL P0-03**. Policy showed `This page couldn't load` with digest `2770608369`.
- Portal iframe behavior: **WARN / expected under Deployment Protection**. The inspection, policy-compliance, and development embeds were blank or refused to connect; direct-host results remain authoritative.
- Cross-org, Research, Program, and IC synthetic write smoke: **BLOCKED**. No non-QA account was used as a substitute and no application writes were made.
- Prior same-deployment log review remains **WARN** (Policy P0-03 500s; isolated unauthenticated 401s; no PGRST/RLS/wrong-project/timeout signature).
- Prior same-deployment protected client scan remains **PASS** (29 JS bundles plus HTML; no prohibited secret or Production credential pattern).
- No Production changes, merge, deployment, or promotion were performed.
