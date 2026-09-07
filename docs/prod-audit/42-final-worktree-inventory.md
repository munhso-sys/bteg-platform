# 42 — Final worktree inventory

**Branch:** `fix/prod-stabilization-p0`  
**HEAD:** `3f041aaaf4b6de34fd3fcb1c96853e12c4e4dd88`  
**Recorded:** 2026-09-07

## Stash

| Entry | Action |
|-------|--------|
| `stash@{0}: wip-unrelated-policy-ui` | **Do not pop** |

## Staged

None.

## Unstaged (related to stabilization)

| Path | Topic |
|------|-------|
| `bgs-policy-compliance/next.config.ts` | turbopack.root |
| `bgs-policy-compliance/src/lib/access/embed.ts` | UTF-8 re-encode / P0-02 |
| `bgs-policy-compliance/src/lib/db/local-store.ts` | P0-03 org scope |
| `bgs-policy-compliance/src/lib/db/remote-store.ts` | P0-03 org store |
| `bgs-policy-compliance/src/lib/db/repository.ts` | lint prefer-const |
| `bgs-policy-compliance/tsconfig.json` | exclude stale `.next/dev` |
| `development/package.json` | npx tsx test scripts |
| `development/src/components/program/ProgramBoard.tsx` | program server UI |
| `development/src/components/projects/ProjectsClient.tsx` | lint |
| `development/src/lib/program-store.ts` | server-backed program |
| `development/src/lib/research/rls.test.ts` | typing |
| `development/src/lib/use-rd-user-id.ts` | lint |
| `docs/prod-audit/issue-register.csv` | P0 statuses |
| `e2e/p0-security.spec.ts` | Playwright probes |
| `inspect-mn/package.json` / `package-lock.json` | tsx / test:p0-03 |
| `inspect-mn/src/lib/embed-*.ts` / `policy-embed*.ts` / `inspection-embed-server.ts` | UTF-8 / P0-02 |
| `inspect-mn/tsconfig.json` | exclude tests from app tsc |
| `inspection-center/src/lib/store/index.ts` | P0-03 org writes |
| `inspection-center/src/lib/store/remote.ts` | org_app_data_store |

## Untracked (related)

| Path | Topic |
|------|-------|
| `development/src/app/api/research/program/` | program API |
| `docs/prod-audit/36`–`41` | audit docs |
| `inspect-mn/src/lib/org-app-data-store.p0-03.test.ts` | P0-03 regression |
| `inspect-mn/supabase/migrations/20260907090000_org_app_data_store_p0_03.sql` | migration |
| `package.json` / `package-lock.json` (repo root) | Playwright |
| `scripts/run-local-db-security-tests.mjs` | local DB test runner |

## Untracked / ignore (exclude from release commit)

| Path | Note |
|------|------|
| `.cursor/rules/` | editor rules |
| `test-results/` | Playwright output |

## Unrelated WIP

- Stash `wip-unrelated-policy-ui` left untouched.
- No evidence of unrelated app feature WIP mixed into the listed paths beyond UTF-8 encoding repairs required for builds.
