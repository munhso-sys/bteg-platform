# 11 — Branch and change inventory

**Inventory time:** 2026-09-04 (local)  
**Production actions:** none (no deploy, push, merge, migration, or secret changes)

## Snapshot

| Item | Value |
|------|--------|
| Inventory started on | `fix/prod-batch-1-security` @ `44e6526` |
| Latest local `master` | `597d1ff` (`origin/master`) |
| Audit branch | `audit/prod-stabilization-20260904` @ `cc99172` (docs only through executive/module precursors) |
| Batch 1 branch | `fix/prod-batch-1-security` @ `44e6526` |
| New stabilization branch | `fix/prod-stabilization-p0` (from `master`, docs cherry-picked; **no** Batch 1 code/migration) |
| Uncommitted at inventory | `bgs-policy-compliance` UI/API WIP (stashed as `wip-unrelated-policy-ui`); `.cursor/rules/`; stray `vercel token.txt` (not committed) |

## Compare: main vs audit

`audit/prod-stabilization-20260904` vs `master`: documentation under `docs/prod-audit/` only (00–10 + issue-register fold-ins). **No application or migration files.**

## Compare: main vs `fix/prod-batch-1-security`

| Commit | Summary | App code | Schema | Env | Tests | Include in P0 IC branch? |
|--------|---------|----------|--------|-----|-------|---------------------------|
| `46d1b47` | Prod audit docs 00–10 | No | No | No | N/A | Yes (docs) |
| `bffe011` | Phase A tsc/lint note | No | No | No | N/A | Yes (docs) |
| `5eba925` | Explore findings fold-in | No | No | No | N/A | Yes (docs) |
| `cc99172` | R&D localStorage gaps | No | No | No | N/A | Yes (docs) |
| `3b90932` | **P0-01** lock `app_data_store` RLS + service-role-only writers | Yes (inspection + policy server clients) | Yes (`20260904120000_lock_app_data_store_rls.sql`) | Runtime: `SUPABASE_SERVICE_ROLE_KEY` (already used); restrictive after apply | `server.test.ts` | **No** — separate track B (restrictive migration) |
| `123c17f` | **P0-02** remove hardcoded embed HMAC | Yes (portal + both embeds) | No | Runtime: `POLICY_EMBED_SECRET` / `INSPECTION_EMBED_SECRET` (+ optional `*_PREVIOUS`) | `embed-secrets.test.ts` | **No** — separate track C (secrets); not required to fix IC-D01/D05 |
| `6c4cb48` | **A3** masked `/api/runtime-info` + checklist | Yes (portal) | No | Reads flags only | `route.test.ts` | **No** — observability; not IC-D01/D05 |
| `881826f` | Module E2E audit matrices | No | No | No | N/A | Yes (docs) |
| `193bfe9` | Fold IC explore defects | No | No | No | N/A | Yes (docs) |
| `44e6526` | Overview IC-D05/D06 | No | No | No | N/A | Yes (docs) |

### Batch 1 commit detail

#### `3b90932` — P0-01
- **Files:** migration SQL; `inspection-center` + `bgs-policy-compliance` `supabase/server.ts` (+ tests); seed script; package/tsconfig test wiring.
- **Issue:** P0-01.
- **Backward compatible:** App that already uses service role keeps working; **anon/authenticated PostgREST breaks** after migration (intentional). Old app using anon for store **breaks**.
- **Safe to include in IC-D01/D05 branch:** No (restrictive DB change; separate rollout).

#### `123c17f` — P0-02
- **Files:** `embed-secret-config.ts`, portal embed signers, module `embed.ts` (no hardcoded fallback).
- **Issue:** P0-02.
- **Backward compatible:** Only if env secrets already set; otherwise embed signing returns null / verification fails.
- **Safe to include in IC-D01/D05 branch:** No (secret rollout track; soft-mint removal does not depend on it).

#### `6c4cb48` — A3
- **Files:** `inspect-mn` runtime-info route + middleware allowlist; `docs/VERCEL_ENV_CHECKLIST.md`.
- **Issue:** observability / SHARED-D01 support.
- **Safe to include:** Optional later; skipped for minimal P0 IC branch.

## Issue register vs implemented code (at branch create)

| ID | Status on docs | Code on `master` / this branch start |
|----|----------------|--------------------------------------|
| IC-D01 | Open | Soft mint **present** in `middleware.ts` |
| IC-D05 | Open | Null scope = write allowed in `scope.ts` |
| P0-01 | Open (register) | Implemented only on `fix/prod-batch-1-security`, **not** on this branch |
| P0-02 | Open (register) | Implemented only on `fix/prod-batch-1-security`, **not** on this branch |
| RD-D01/D02 | Open | Not in scope of this P0 IC batch |

## Generated Supabase types vs migration

- Batch 1 migration only changes **RLS/grants** on existing `app_data_store` — no new columns/tables.
- No TypeScript database type regeneration required for P0-01 SQL itself.
- IC-D01/IC-D05 require **no** schema change and **no** type regen.

## Stabilization branch policy

`fix/prod-stabilization-p0` includes:
1. Cherry-picked audit documentation from Batch 1 lineage.
2. Application-only IC-D01 + IC-D05 fixes + regression tests + evidence docs.

Explicitly **excluded** until separate human-approved tracks:
- Restrictive RLS migration (`3b90932`)
- Embed secret fail-closed (`123c17f`)
- Runtime-info (`6c4cb48`)
- Unrelated `bgs-policy-compliance` WIP stash
