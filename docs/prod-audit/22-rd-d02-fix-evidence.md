# 22 — RD-D02 fix evidence

## Reproduction (before)
1. User A creates projects in R&D iframe (same browser).
2. Logout from portal; User B logs in; opens `/development`.
3. **Actual:** User A’s `localStorage` keys still visible.
4. **Expected:** Isolated per user; cleared on logout.

## Root cause
Shared keys `rd-research-projects` / `rd-program-initiatives-v1` with no user namespace; portal logout did not notify the iframe.

## Fix
- Namespace keys as `…:user:<uid>` via `rd_uid` from portal auth (`buildDevelopmentEmbedOptions`).
- Clear legacy shared keys on hydrate.
- Portal `LogoutButton` / `IdleLogout` broadcast `inspect-logout` through `ModuleEmbed` postMessage; R&D clears all RD keys.

## Changed files
- `development/src/lib/rd-storage.ts`, `use-rd-user-id.ts`, clients/stores above
- `inspect-mn/src/lib/development-embed-server.ts`
- `inspect-mn/src/lib/portal-logout-broadcast.ts`
- `inspect-mn/src/components/modules/{DutyModulePage,ModuleEmbed}.tsx`
- `inspect-mn/src/components/auth/{LogoutButton,IdleLogout}.tsx`

## Tests
- Unit: user A vs B isolation; logout clearAll; legacy key clear — PASS
- Portal/inspection typecheck — PASS

## Remaining risk
- Unsigned `rd_uid` is a namespace binder, not authz; without portal uid, data lands in `:anonymous` bucket.
- Full Playwright portal login→logout E2E still missing (Preview blocker).

## Status
**Verified locally** (unit + build). Not Preview verified.
