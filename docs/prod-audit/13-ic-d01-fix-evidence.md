# 13 — IC-D01 fix evidence

## Issue
**IC-D01 (P0):** Middleware mints a signed unit embed from unsigned `?scope=unit&heltes_*` query params.

## Reproduction (before)
1. Open inspection-center `/dashboard?scope=unit&heltes_id=x&heltes_name=Forged` **without** portal `embed`.
2. Middleware called `mintSoftUnitToken` → `signInspectionEmbedToken` → set `inspection_scope` cookie and/or redirect with `embed=`.
3. Attacker could obtain a trusted unit-scoped session without portal HMAC.

Evidence (pre-fix code on `master`): `inspection-center/src/middleware.ts` `mintSoftUnitToken`.

## Root cause
Unsigned query parameters were treated as authority to mint HMAC-signed claims.

## Fix
- Removed soft mint path.
- Token resolution only accepts verified `embed` query or verified `inspection_scope` cookie via `resolveInspectionEmbedFromParts`.
- `softUnitQueryIsTrustedAuthority()` returns `false`.

## Changed files
- `inspection-center/src/middleware.ts`
- `inspection-center/src/lib/access/embed-resolve.ts` (new)
- `inspection-center/src/lib/access/embed-resolve.test.ts` (new)
- `inspection-center/scripts/e2e-security.test.ts` (new)
- `inspection-center/package.json` (test scripts)

## Regression tests
| Command | Result |
|---------|--------|
| `npm run test:access` | PASS (includes IC-D01 suite) |
| `INSPECTION_E2E_BASE_URL=http://127.0.0.1:3001 npm run test:e2e:security` against `next start` | PASS (soft query does not set cookie / embed redirect) |

## Persistence / duplicates / Supabase
N/A — auth boundary change only; no store mutation introduced.

## Remaining risk
- Pre-existing soft-minted cookies remain valid until expiry if signed with a key the server still trusts.
- Master lineage still contains hardcoded embed signing fallback (Batch1 `123c17f` / P0-02 excluded) — unsigned soft mint remains removed, but env-less signing may still work via hardcoded secret until Track C.
- Portal timeout that loads iframe without `embed` no longer gets forged unit scope; writes denied by IC-D05.

## Additional regression coverage (this pass)
Forged/modified/expired/malformed tokens; cookie vs embed precedence; orphan-key verify deny; middleware source ban on `mintSoftUnitToken`.

## Required Preview test
- Load module from portal with real signed `embed` (unit + full).
- Open raw module URL with only `scope=unit&…` → no unit cookie / no write.

## Rollback
Revert middleware + `embed-resolve*` commits; soft mint returns (not recommended).

## Status
**Verified** (local unit + production build + HTTP E2E). Not Closed (no Preview).
