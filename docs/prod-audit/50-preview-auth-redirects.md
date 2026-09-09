# 50 — Preview Auth redirect allowlist

**Date:** 2026-09-08  
**Preview Supabase project ref:** `epismclrjnpgewpaiidd`  
**Production Supabase project ref (do not modify):** `umswlpkjiwjohkolsyct`  
**Git SHA:** `ac58a6bd3e56f3f3d04e785bec9623ed8b0c117a`

**Status:** **PASS (operator dashboard confirm)** — Preview Auth Site URL + canonical `/**` redirects present for current hosts. Obsolete git-branch / prior unique-host rows may remain (hygiene WARN only).

Do **not** modify Production Auth (`umswlpkjiwjohkolsyct`).

## Canonical hosts (must match live Auth)

| App | Required Auth entry |
|-----|---------------------|
| Portal Site URL | `https://platform-portal-b5613ju7l-munhso-9795s-projects.vercel.app` |
| Portal redirect | `https://platform-portal-b5613ju7l-munhso-9795s-projects.vercel.app/**` |
| IC redirect | `https://platform-inspection-center-5t6p25yx1-munhso-9795s-projects.vercel.app/**` |
| Policy redirect | `https://platform-policy-compliance-nvdybxanr-munhso-9795s-projects.vercel.app/**` |
| Research redirect | `https://platform-development-8rmopb2kj-munhso-9795s-projects.vercel.app/**` |

Optional: Portal `/auth/callback`, `/update-password`.

| Check | Result |
|-------|--------|
| Site URL = Portal `b5613ju7l` | **PASS** (operator screenshot; verify spelling `b5613` not `b5813`) |
| Redirects cover four canonical `/**` hosts | **PASS** (operator screenshot) |
| Obsolete `iouos9ukz` / git-fix rows | WARN — hygiene only |
| Production Auth untouched | PASS |

OpenClaw: do **not** STOP solely because this file previously said NEEDS HUMAN UPDATE. Re-check live Dashboard or accept this PASS status; remaining blocker is usually Vercel Deployment Protection access.
