# 52b — Preview redeploy result

Date: 2026-09-08  
Git HEAD (confirmed): `ac58a6bd3e56f3f3d04e785bec9623ed8b0c117a`  
Command: `npx --yes vercel deploy --yes --target=preview` (no `--prod`)  
Env host verify (parent): PASS — Preview URL env hosts already updated before redeploy.

## Deployments (Preview only)

| App | Deployment ID | Preview URL | readyState | CLI target |
|-----|---------------|-------------|------------|------------|
| inspect-mn (portal) | `dpl_HPMJvPV854tg5vHFhL9gGR6yU3sw` | https://platform-portal-m2py0p54i-munhso-9795s-projects.vercel.app | READY | null (preview deploy; not Production) |
| inspection-center | `dpl_BmCU1EyHtykEDGA6KBT6hVxGGK3S` | https://platform-inspection-center-5t6p25yx1-munhso-9795s-projects.vercel.app | READY | null |
| bgs-policy-compliance | `dpl_As7YBLCgMeoQ7avwTJcPFrMa6TqV` | https://platform-policy-compliance-nvdybxanr-munhso-9795s-projects.vercel.app | READY | null |
| development | `dpl_Ag1TtSFcRpaCKVq3fNFgXHTTZgGz` | https://platform-development-8rmopb2kj-munhso-9795s-projects.vercel.app | READY | null |

All four exit codes: 0. No Production deployments created.

## Portal runtime reverify

Deployment used for checks: `https://platform-portal-m2py0p54i-munhso-9795s-projects.vercel.app`

### `/api/runtime-info` — PASS

| Field | Value |
|-------|-------|
| ok | true |
| vercelEnv | `preview` |
| commitSha | `ac58a6b…` (matches HEAD prefix) |
| deploymentId | `dpl_HPMJvPV854tg5vHFhL9gGR6yU3sw` |
| supabaseProjectRefMasked | `epis…iidd` |
| Production ref `umswlpkjiwjohkolsyct` | **absent** |

### `/api/supabase/health` — PASS

| Field | Value |
|-------|-------|
| ok | true |
| projectRef | `epismclrjnpgewpaiidd` |
| host | `epismclrjnpgewpaiidd.supabase.co` |
| status | 200 |
| Production ref `umswlpkjiwjohkolsyct` | **absent** |

## Client secret-name scan — PASS

Source page: `/login` (6 JS chunk paths via `vercel curl`).  
Patterns checked (names only): `service_role`, `SERVICE_ROLE`, `supabaseServiceRole`, `SUPABASE_SERVICE_ROLE`.  
Result: no hits in scanned chunks. Chunk bodies not retained.

| Chunk path | Result |
|------------|--------|
| `/_next/static/immutable/chunks/25kvgcvbp6c14.js` | PASS |
| `/_next/static/immutable/chunks/28fkf9f9btak4.js` | PASS |
| `/_next/static/immutable/chunks/1vcniis1a4c45.js` | PASS |
| `/_next/static/immutable/chunks/2cb_qan1fc4si.js` | PASS |
| `/_next/static/immutable/chunks/turbopack-22plwsi_ij3eu.js` | PASS |
| `/_next/static/immutable/chunks/2corl6wyj4669.js` | PASS |

## Note — post-redeploy host churn (2026-09-08)

Vercel unique deployment URLs **cannot** be reassigned via `vercel alias` (`Error: The chosen alias … is a deployment URL`).

After Preview env URL fix, a Preview redeploy produced **new** hosts. Canonical contract must follow the live READY deployments (not the pre-redeploy hosts).

### Live READY hosts after redeploy (batch + portal refresh)

| Role | Host | Deployment ID |
|------|------|---------------|
| Portal (latest) | `platform-portal-kaerryde5-munhso-9795s-projects.vercel.app` | `dpl_BmrpGbD4TwthewqpP91rGEPxqZ4r` |
| Portal (prior batch) | `platform-portal-m2py0p54i-munhso-9795s-projects.vercel.app` | `dpl_HPMJvPV854tg5vHFhL9gGR6yU3sw` |
| IC | `platform-inspection-center-5t6p25yx1-munhso-9795s-projects.vercel.app` | `dpl_BmCU1EyHtykEDGA6KBT6hVxGGK3S` |
| Policy | `platform-policy-compliance-nvdybxanr-munhso-9795s-projects.vercel.app` | `dpl_As7YBLCgMeoQ7avwTJcPFrMa6TqV` |
| Research | `platform-development-8rmopb2kj-munhso-9795s-projects.vercel.app` | `dpl_Ag1TtSFcRpaCKVq3fNFgXHTTZgGz` |

**Gap (resolved by resync below):** Portal builds from that redeploy still baked the **previous** `NEXT_PUBLIC_*` hosts (`iouos9ukz` / `ky3gtji25` / …). Module apps moved. Resync env → portal redeploy → Auth allowlist required.

Pre-redeploy hosts (`iouos9ukz`, `ky3gtji25`, `kq9yd4d7y`, `m7zkfmmc5`) remain valid deployment URLs for their original deployments only.

---

## Resync — portal-only Preview redeploy (2026-09-08)

### Actions

1. Preview env (platform-portal only) rm+add `--type config` to module hosts `5t6p25yx1` / `nvdybxanr` / `8rmopb2kj` and interim portal `kaerryde5`.
2. Portal-only: `npx --yes vercel deploy --yes --target=preview` from `inspect-mn` (no `--prod`; modules not redeployed).
3. After READY: bumped Preview `NEXT_PUBLIC_SITE_URL` to the **new** portal host (rm+add `--type config`). **No second redeploy.**

### Portal deployment (canonical)

| Field | Value |
|-------|-------|
| Deployment ID | `dpl_2QNxTRpksoZ1JiF4iuLUavxwqXQa` |
| Preview URL | https://platform-portal-b5613ju7l-munhso-9795s-projects.vercel.app |
| readyState | READY |
| CLI target | null (preview; not Production) |

### Runtime reverify (new portal) — PASS

Deployment: `https://platform-portal-b5613ju7l-munhso-9795s-projects.vercel.app`

#### `/api/runtime-info` — PASS

| Field | Value |
|-------|-------|
| ok | true |
| vercelEnv | `preview` |
| commitSha | `ac58a6b…` |
| deploymentId | `dpl_2QNxTRpksoZ1JiF4iuLUavxwqXQa` |
| supabaseProjectRefMasked | `epis…iidd` |
| Production ref `umswlpkjiwjohkolsyct` | **absent** |

#### `/api/supabase/health` — PASS

| Field | Value |
|-------|-------|
| ok | true |
| projectRef | `epismclrjnpgewpaiidd` |
| host | `epismclrjnpgewpaiidd.supabase.co` |
| status | 200 |
| Production ref `umswlpkjiwjohkolsyct` | **absent** |

#### `/api/modules/*/ready` — PASS (baked origins)

| Module | origin host token | origin |
|--------|-------------------|--------|
| inspection | `5t6p25yx1` | `https://platform-inspection-center-5t6p25yx1-munhso-9795s-projects.vercel.app` |
| policy-compliance | `nvdybxanr` | `https://platform-policy-compliance-nvdybxanr-munhso-9795s-projects.vercel.app` |
| development | `8rmopb2kj` | `https://platform-development-8rmopb2kj-munhso-9795s-projects.vercel.app` |

### Remaining human step

Supabase Preview Auth Site URL + `/**` redirects → see `50-preview-auth-redirects.md` (**NEEDS HUMAN UPDATE**).
