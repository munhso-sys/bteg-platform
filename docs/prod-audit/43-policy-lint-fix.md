# 43 — Policy lint fix

**File:** `bgs-policy-compliance/src/app/(app)/policies/[id]/assign-responsibility-form.tsx`  
**Rule:** `react-hooks/set-state-in-effect`

## Confirmation

Re-ran eslint before fix: three error-level findings at lines ~55, ~65, ~113 (sync `setAlbaId` / `setPositions` / `setPositionId` inside `useEffect`).

## Classification

| Finding | Introduced by stabilization? | Pattern |
|---------|------------------------------|---------|
| Sync albaId when `albaOptions` changes | **No** — pre-existing form | Effect mirrors derived select state |
| Clear positions when scope missing | **No** — pre-existing | Effect resets on empty heltes/alba |
| Clear positionId when filtered out | **No** — pre-existing | Effect validates selection vs filter |

## Fix (minimal)

1. Derive `activeAlbaId` / `selectedPositionId` during render instead of syncing via effects.
2. Reset related state in event handlers (`heltes` / `alba` `onChange`).
3. Keep a single async fetch effect for positions; setState occurs only inside the async load path after the effect schedules work (no sync selection sync effects).

No global eslint-disable. No rule disable.

## Verification

| Check | Result |
|-------|--------|
| eslint form file `--quiet` | **PASS** |
| eslint package `--quiet` | **PASS** (0 errors) |
| typecheck | **PASS** |
| production build | **PASS** |
