# 52 — Preview URL contract

**Date:** 2026-09-08  
**Git SHA:** `ac58a6bd3e56f3f3d04e785bec9623ed8b0c117a`  
**Preview Supabase:** `epismclrjnpgewpaiidd`  
**Production Supabase:** `umswlpkjiwjohkolsyct` (forbidden for Preview)

## Actual Preview hosts (canonical)

| Role | Host | Deployment ID |
|------|------|---------------|
| Portal | `platform-portal-b5613ju7l-munhso-9795s-projects.vercel.app` | `dpl_2QNxTRpksoZ1JiF4iuLUavxwqXQa` |
| IC | `platform-inspection-center-5t6p25yx1-munhso-9795s-projects.vercel.app` | `dpl_BmCU1EyHtykEDGA6KBT6hVxGGK3S` |
| Policy | `platform-policy-compliance-nvdybxanr-munhso-9795s-projects.vercel.app` | `dpl_As7YBLCgMeoQ7avwTJcPFrMa6TqV` |
| Research | `platform-development-8rmopb2kj-munhso-9795s-projects.vercel.app` | `dpl_Ag1TtSFcRpaCKVq3fNFgXHTTZgGz` |

Note: Long `…-git-fix-prod-stabilization-p0-…` vercel.app aliases are **invalid** (sub-sub domain limit). Do not use them.

Prior hosts (`iouos9ukz` / `ky3gtji25` / `kq9yd4d7y` / `m7zkfmmc5`, and interim `kaerryde5` / `m2py0p54i`) are **obsolete** relative to the current canonical set above.

---

## Audit (Preview env pull — hosts only)

### platform-portal

| VARIABLE | Current host (before fix) | Flag | Action |
|----------|---------------------------|------|--------|
| `NEXT_PUBLIC_SITE_URL` | `…-git-fix-prod-stabilization-p0-…` | OBSOLETE_GIT_ALIAS | Update → Portal actual |
| `NEXT_PUBLIC_INSPECT_URL` | `…-git-fix-…` | OBSOLETE_GIT_ALIAS | Update → IC actual |
| `NEXT_PUBLIC_POLICY_URL` | `…-git-fix-…` | OBSOLETE_GIT_ALIAS | Update → Policy actual |
| `NEXT_PUBLIC_DEVELOPMENT_URL` | `…-git-fix-…` | OBSOLETE_GIT_ALIAS | Update → Research actual |
| `NEXT_PUBLIC_SUPABASE_URL` | `epismclrjnpgewpaiidd.supabase.co` | PREVIEW_SUPABASE | Keep |

### IC / policy / research

| VARIABLE | Status |
|----------|--------|
| Module URL vars (`SITE`/`INSPECT`/…) | Not set on these projects (OK — portal owns cross-links) |
| `NEXT_PUBLIC_SUPABASE_URL` | Preview Supabase — Keep |

No Production / localhost hosts found on Preview URL vars.

---

## Supabase Auth (Preview branch)

| Item | Status |
|------|--------|
| Project | `epismclrjnpgewpaiidd` / branch PREVIEW |
| Site URL | **NEEDS HUMAN UPDATE** → Portal `b5613ju7l` (see `50-preview-auth-redirects.md`) |
| Redirects include Portal/IC/Policy/Research `/**` | **NEEDS HUMAN UPDATE** for new hosts |
| Prior `iouos9ukz` / `ky3gtji25` / … Auth entries | Stale relative to current deploy |
| Production Auth untouched | Assumed (Preview branch only) |

---

## Verified after resync (env pull + portal redeploy)

| VARIABLE | Host |
|----------|------|
| `NEXT_PUBLIC_SITE_URL` | `platform-portal-b5613ju7l-munhso-9795s-projects.vercel.app` |
| `NEXT_PUBLIC_INSPECT_URL` | `platform-inspection-center-5t6p25yx1-munhso-9795s-projects.vercel.app` |
| `NEXT_PUBLIC_POLICY_URL` | `platform-policy-compliance-nvdybxanr-munhso-9795s-projects.vercel.app` |
| `NEXT_PUBLIC_DEVELOPMENT_URL` | `platform-development-8rmopb2kj-munhso-9795s-projects.vercel.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | `epismclrjnpgewpaiidd.supabase.co` |

Git HEAD at verify: `ac58a6bd3e56f3f3d04e785bec9623ed8b0c117a`  
**URL contract:** PASS (Preview-scoped non-secret URLs).  
**Note:** `NEXT_PUBLIC_SITE_URL` bumped to the post-redeploy portal host **without** a second redeploy (Auth Site URL must match via human update).
