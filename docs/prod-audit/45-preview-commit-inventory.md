# 45 — Preview commit inventory

**Branch:** `fix/prod-stabilization-p0`  
**Base HEAD before commits:** `3f041aa`  
**Stash (do not pop):** `stash@{0}: wip-unrelated-policy-ui`

## Classification legend

| Code | Meaning |
|------|---------|
| A | required stabilization code |
| B | required migration |
| C | required tests |
| D | required audit docs |
| E | package/lockfile for Playwright/testing |
| F | generated artifact/log — do not commit |
| G | unrelated WIP — exclude |
| H | secret/local env/temp — never commit |

## Modified (tracked)

| Path | Class | Notes |
|------|-------|-------|
| `bgs-policy-compliance/next.config.ts` | A | turbopack.root |
| `bgs-policy-compliance/.../assign-responsibility-form.tsx` | A | lint fix |
| `bgs-policy-compliance/src/lib/access/embed.ts` | A | UTF-8 restore |
| `bgs-policy-compliance/src/lib/db/local-store.ts` | A | P0-03 org scope |
| `bgs-policy-compliance/src/lib/db/remote-store.ts` | A | org_app_data_store |
| `bgs-policy-compliance/src/lib/db/repository.ts` | A | prefer-const |
| `bgs-policy-compliance/tsconfig.json` | A | exclude stale `.next/dev` |
| `development/package.json` | E | npx tsx test scripts |
| `development/.../ProgramBoard.tsx` | A | server-backed program UI |
| `development/.../ProjectsClient.tsx` | A | lint |
| `development/src/lib/program-store.ts` | A | API-backed store |
| `development/src/lib/research/rls.test.ts` | C | typing |
| `development/src/lib/use-rd-user-id.ts` | A | lint |
| `docs/prod-audit/issue-register.csv` | D | P0 statuses |
| `e2e/p0-security.spec.ts` | C | gate probes |
| `inspect-mn/package.json` / `package-lock.json` | E | tsx / test:p0-03 |
| `inspect-mn/src/lib/embed-*.ts` / `policy-embed*.ts` / `inspection-embed-server.ts` | A | UTF-8 restore (P0-02 tooling) |
| `inspect-mn/tsconfig.json` | A | exclude `*.test.ts` from app tsc |
| `inspection-center/src/lib/store/index.ts` | A | P0-03 org writes |
| `inspection-center/src/lib/store/remote.ts` | A | org_app_data_store |
| `playwright.config.ts` | C | single-project gate config |

## Untracked — commit

| Path | Class |
|------|-------|
| `development/src/app/api/research/program/route.ts` | A |
| `inspect-mn/supabase/migrations/20260907090000_org_app_data_store_p0_03.sql` | B |
| `inspect-mn/supabase/migrations/20260907120000_user_profiles_select_own.sql` | B |
| `inspect-mn/src/lib/org-app-data-store.p0-03.test.ts` | C |
| `e2e/auth.spec.ts` … `runtime-info.spec.ts`, `helpers.ts` | C |
| `package.json` / `package-lock.json` (repo root) | E |
| `scripts/rebuild-apps-local-supabase.mjs` | C/E |
| `scripts/run-local-db-security-tests.mjs` | C |
| `scripts/run-preview-gate-e2e.mjs` | C |
| `docs/prod-audit/36`–`44` (+ this `45`) | D |
| `docs/prod-audit/46-preview-db-plan.md` | D |
| `docs/prod-audit/47-preview-smoke-plan.md` | D |
| `.cursor/rules/production-safety.mdc` | D | safety rule for agents |

## Untracked — exclude (F/H)

| Path | Class | Reason |
|------|-------|--------|
| `docs/prod-audit/e2e-gate-run*.log` | F | raw logs; summary in markdown |
| `docs/prod-audit/e2e-gate-run5.log` | F | evidence summarized in doc 39/gate report |
| `docs/prod-audit/e2e-server-*.log` | F | server stdout |
| `docs/prod-audit/rebuild-local.log` | F | |
| `docs/prod-audit/db-tests-after-profile-policy.log` | F | |
| `docs/prod-audit/e2e-last-run.json` | F | exit code only |
| `test-results/` | F | Playwright artifacts |
| `.env.local` | H | not listed dirty; gitignored |
| `inspect-mn/supabase/.temp/**` | H | gitignored via supabase |
| `.next/` | F | gitignored |

## Unrelated (G)

| Item | Action |
|------|--------|
| `stash@{0}: wip-unrelated-policy-ui` | **Do not pop / do not include** |

## Already in HEAD `3f041aa` (not re-committed)

IC-D01/D05, P0-01/P0-02 core, Research projects API/RLS, runtime-info, lock `app_data_store` migration, Batch1 research tables.

## Planned local commit series

1. UTF-8 embed encoding restore (build blockers)
2. `user_profiles` SELECT-own migration
3. P0-03 org store + program server + IC/policy wiring  
   - Emergency rollback: revert app commit(s); **do not drop** `org_app_data_store`
4. Playwright + gate scripts + root/dev package files
5. Audit/readiness docs + issue register + production-safety rule
