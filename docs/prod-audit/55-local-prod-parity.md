# 55 — Local ↔ Production parity (LOCAL ONLY)

**Date:** 2026-09-09  
**Constraint:** No GitHub push, no Vercel deploy, no Production mutation.

## Production reference (read-only)

| Item | Value |
|------|--------|
| Host | `https://bteg.inspect.mn` |
| Latest Production deploy (CLI) | `platform-portal-zs7xy9zvx-…` (~24h before this note) |
| Git SHA on that deploy | Confirm in Vercel UI / `/api/runtime-info` — not assumed = local HEAD |
| `origin/master` tip | `597d1ff…` — duty modules **iframe-embedded** (same architecture as current branch) |

## Why local looked incomplete

1. `scripts/start-duty-modules.ps1` hardcoded `C:\Users\Owner\platform\…` → started nothing on this machine.
2. Duty module `.env.local` lacked public Supabase + embed secrets → iframe claim/verify fail-closed / empty UX.
3. Portal `NEXT_PUBLIC_SITE_URL` pointed at Production host → local auth redirects wrong.
4. Docs (`STABLE_RUN.md`, READMEs) claimed “9 modules in-portal / no iframe” — **false** vs code on master and HEAD.
5. Policy/IC business JSON lives under gitignored `data/` — present on this machine but easy to miss on a fresh clone.

## Local fixes applied (this session)

| Change | Purpose |
|--------|---------|
| `scripts/start-duty-modules.ps1` | Repo-relative paths |
| `scripts/sync-local-env.cjs` | Localhost SITE_URL, duty URLs, public keys, matching embed secrets |
| `*.env.example` (4 apps) | Templates without secrets |
| `HOW_TO_OPEN_DUTY_MODULES.md` | Restored operator guide |
| `docs/STABLE_RUN.md`, root + portal README | Align with iframe architecture |

## Still local gaps (expected)

| Gap | Impact | Local action |
|-----|--------|--------------|
| `SUPABASE_SERVICE_ROLE_KEY` absent on portal | Admin approve / some remote stores | Human pastes into `.env.local` (never commit; prefer Preview key if not writing Production) |
| IC `preferLocalStore()` in `development` | Uses `data/store.json`, not live Production remote JSON | OK for local; optional read-only sync later |
| Policy uses `data/local/db.json` | Not identical to Production remote payload | OK if seed present; `npm run data:refresh` to rebuild |
| Uncommitted P0-03 Policy WIP | Safer empty/fail paths vs crash | Keep for local stability |

## Smoke checklist (local)

1. `node scripts/sync-local-env.cjs`
2. `.\scripts\start-duty-modules.ps1` then `cd inspect-mn && npm run dev`
3. Open http://localhost:3000 — login
4. Direct tabs: :3001, :3002, :3003 load module UI
5. Portal `/inspection`, `/policy-compliance`, `/development` iframes load (not blank)
6. No Production Vercel/Supabase writes
