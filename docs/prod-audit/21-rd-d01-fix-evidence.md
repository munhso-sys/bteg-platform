# 21 — RD-D01 fix evidence

## Reproduction (before)
1. Create a research project in `development` on PC-A.
2. Open the same production/module URL on PC-B / another browser profile.
3. **Actual:** seed/empty data (localStorage only).
4. **Expected (audit):** server persistence **or** clearly labeled local prototype.

## Root cause
Module persisted exclusively to shared browser `localStorage` with no server backend and no production honesty banner.

## Fix (minimal accepted option from audit)
- Added `PrototypePersistenceBanner` on projects and program boards stating local-prototype / not multi-device.
- Persistence remains local by design until a later server-backed track (not Batch 1).
- Storage helpers centralized in `rd-storage.ts` for testability.

## Changed files
- `development/src/components/PrototypePersistenceBanner.tsx`
- `development/src/components/projects/ProjectsClient.tsx`
- `development/src/components/program/ProgramBoard.tsx`
- `development/src/lib/rd-storage.ts` (+ tests)
- `development/package.json` (`test:storage`)

## Tests
| Command | Result |
|---------|--------|
| `tsx --test src/lib/rd-storage.test.ts` | PASS |
| `npx tsc --noEmit` (development) | PASS |
| `npm run build` (development) | PASS |

## Status
**Verified locally** for the labeled-prototype contract. Full multi-device server persistence remains a future track (not Closed).
